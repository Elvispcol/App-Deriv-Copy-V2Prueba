import { Router, Request, Response } from 'express';
import { db } from './db.js';
import { users, derivAccounts, copyConfigs, copySlaves, copyLogs, sessions } from './schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { exchangeCodeForToken, generateSessionId } from './oauth.js';
import { wsManager } from './websocket-manager.js';
import { startCopyEngine, stopCopyEngine, isEngineRunning } from './copy-engine.js';

const router = Router();

// ─── Auth middleware ────────────────────────────────────────────
async function getSessionUser(req: Request) {
  const authHeader = req.headers.authorization;
  const sessionId = authHeader?.replace('Bearer ', '') || req.query.session_id as string;
  if (!sessionId) return null;

  const sessionRows = await db.select().from(sessions).where(eq(sessions.sessionId, sessionId)).limit(1);
  if (!sessionRows.length) return null;

  const session = sessionRows[0];
  if (new Date() > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  return userRows[0] || null;
}

// ─── Auth Routes ────────────────────────────────────────────────

// POST /api/auth/callback — Exchange OAuth code for session
router.post('/api/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code, code_verifier, redirect_uri } = req.body;
    if (!code || !code_verifier || !redirect_uri) {
      res.status(400).json({ error: 'Missing code, code_verifier, or redirect_uri' });
      return;
    }

    const tokenData = await exchangeCodeForToken(code, code_verifier, redirect_uri);

    // Upsert user
    const existingUsers = await db.select().from(users).where(eq(users.accessToken, tokenData.access_token)).limit(1);
    let userId: number;

    if (existingUsers.length) {
      userId = existingUsers[0].id;
      await db.update(users).set({
        accessToken: tokenData.access_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      }).where(eq(users.id, userId));
    } else {
      // We'll update deriv_login_id after authorizing via WS
      const inserted = await db.insert(users).values({
        derivLoginId: `pending_${Date.now()}`,
        accessToken: tokenData.access_token,
        tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      }).returning();
      userId = inserted[0].id;
    }

    // Create session
    const sessionId = generateSessionId();
    await db.insert(sessions).values({
      userId,
      sessionId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    res.json({ session_id: sessionId, user_id: userId });
  } catch (err: any) {
    console.error('Auth callback error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me — Get current user info
router.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const accounts = await db.select().from(derivAccounts).where(eq(derivAccounts.userId, user.id));

    res.json({
      id: user.id,
      deriv_login_id: user.derivLoginId,
      accounts,
    });
  } catch (err: any) {
    console.error('Auth me error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/api/auth/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionId = authHeader?.replace('Bearer ', '');
    if (sessionId) {
      await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Account Routes ─────────────────────────────────────────────

// GET /api/accounts — Get user's Deriv accounts
router.get('/api/accounts', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const accounts = await db.select().from(derivAccounts).where(eq(derivAccounts.userId, user.id));
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/connect — Connect a Deriv account to WebSocket
router.post('/api/accounts/connect', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { login_id } = req.body;
    if (!login_id) {
      res.status(400).json({ error: 'Missing login_id' });
      return;
    }

    const accountRows = await db.select().from(derivAccounts)
      .where(and(eq(derivAccounts.userId, user.id), eq(derivAccounts.loginId, login_id)))
      .limit(1);

    if (!accountRows.length) {
      // Create new account entry
      const inserted = await db.insert(derivAccounts).values({
        userId: user.id,
        loginId: login_id,
        accessToken: user.accessToken,
        accountType: 'real',
        currency: 'USD',
        isConnected: true,
      }).returning();

      await wsManager.connect(login_id, user.accessToken, process.env.DERIV_APP_ID!);

      // Update user derivLoginId if pending
      if (user.derivLoginId.startsWith('pending_')) {
        await db.update(users).set({ derivLoginId: login_id }).where(eq(users.id, user.id));
      }

      res.json(inserted[0]);
    } else {
      const account = accountRows[0];
      await wsManager.connect(login_id, account.accessToken, process.env.DERIV_APP_ID!);
      await db.update(derivAccounts).set({ isConnected: true }).where(eq(derivAccounts.id, account.id));
      res.json({ ...account, isConnected: true });
    }
  } catch (err: any) {
    console.error('Account connect error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/disconnect — Disconnect a Deriv account from WebSocket
router.post('/api/accounts/disconnect', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { login_id } = req.body;
    wsManager.disconnect(login_id);

    await db.update(derivAccounts)
      .set({ isConnected: false })
      .where(and(eq(derivAccounts.userId, user.id), eq(derivAccounts.loginId, login_id)));

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Copy Trading Routes ────────────────────────────────────────

// GET /api/copy/configs — Get all copy trading configs
router.get('/api/copy/configs', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const configs = await db.select().from(copyConfigs).where(eq(copyConfigs.ownerUserId, user.id));

    const configsWithDetails = await Promise.all(
      configs.map(async (cfg) => {
        const master = await db.select().from(derivAccounts).where(eq(derivAccounts.id, cfg.masterAccountId)).limit(1);
        const slaves = await db.select().from(copySlaves).where(eq(copySlaves.configId, cfg.id));
        const slavesWithAccounts = await Promise.all(
          slaves.map(async (s) => {
            const acc = await db.select().from(derivAccounts).where(eq(derivAccounts.id, s.slaveAccountId)).limit(1);
            return { ...s, account: acc[0] || null };
          })
        );
        return {
          ...cfg,
          masterAccount: master[0] || null,
          slaves: slavesWithAccounts,
          isRunning: isEngineRunning(cfg.id),
        };
      })
    );

    res.json(configsWithDetails);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/copy/configs — Create a new copy trading config
router.post('/api/copy/configs', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { master_account_id, replication_ratio, max_drawdown } = req.body;
    if (!master_account_id || !replication_ratio) {
      res.status(400).json({ error: 'Missing master_account_id or replication_ratio' });
      return;
    }

    const ratio = parseFloat(replication_ratio);
    if (isNaN(ratio) || ratio < 0.1 || ratio > 1.0) {
      res.status(400).json({ error: 'replication_ratio must be between 0.1 and 1.0' });
      return;
    }

    const inserted = await db.insert(copyConfigs).values({
      ownerUserId: user.id,
      masterAccountId: master_account_id,
      replicationRatio: String(ratio),
      maxDrawdown: max_drawdown ? String(max_drawdown) : '100',
      isEnabled: false,
    }).returning();

    res.json(inserted[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/copy/configs/:id/enable — Enable a copy trading config
router.post('/api/copy/configs/:id/enable', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const configId = parseInt(req.params.id as string);
    const configRows = await db.select().from(copyConfigs)
      .where(and(eq(copyConfigs.id, configId), eq(copyConfigs.ownerUserId, user.id)))
      .limit(1);

    if (!configRows.length) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }

    await db.update(copyConfigs).set({ isEnabled: true }).where(eq(copyConfigs.id, configId));
    await startCopyEngine(configId);

    res.json({ ok: true, config_id: configId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/copy/configs/:id/disable — Disable a copy trading config
router.post('/api/copy/configs/:id/disable', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const configId = parseInt(req.params.id as string);
    stopCopyEngine(configId);
    await db.update(copyConfigs).set({ isEnabled: false }).where(eq(copyConfigs.id, configId));

    res.json({ ok: true, config_id: configId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/copy/configs/:id/slaves — Add a slave account to a config
router.post('/api/copy/configs/:id/slaves', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const configId = parseInt(req.params.id as string);
    const { slave_account_id } = req.body;

    if (!slave_account_id) {
      res.status(400).json({ error: 'Missing slave_account_id' });
      return;
    }

    // Verify config belongs to user
    const configRows = await db.select().from(copyConfigs)
      .where(and(eq(copyConfigs.id, configId), eq(copyConfigs.ownerUserId, user.id)))
      .limit(1);

    if (!configRows.length) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }

    const inserted = await db.insert(copySlaves).values({
      configId,
      slaveAccountId: slave_account_id,
      isActive: true,
    }).returning();

    res.json(inserted[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/copy/logs — Get copy trading replication logs
router.get('/api/copy/logs', async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const configId = req.query.config_id ? parseInt(req.query.config_id as string) : undefined;

    const userConfigs = await db.select().from(copyConfigs).where(eq(copyConfigs.ownerUserId, user.id));
    const configIds = userConfigs.map((c) => c.id);

    let logs;
    if (configId && configIds.includes(configId)) {
      logs = await db.select().from(copyLogs)
        .where(eq(copyLogs.configId, configId))
        .orderBy(desc(copyLogs.createdAt))
        .limit(100);
    } else {
      // Get logs for all user configs
      const allLogs = [];
      for (const cid of configIds.slice(0, 10)) { // Limit to prevent huge queries
        const cfgLogs = await db.select().from(copyLogs)
          .where(eq(copyLogs.configId, cid))
          .orderBy(desc(copyLogs.createdAt))
          .limit(20);
        allLogs.push(...cfgLogs);
      }
      logs = allLogs;
    }

    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
