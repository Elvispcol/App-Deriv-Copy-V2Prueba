import { wsManager } from './websocket-manager.js';
import { db } from './db.js';
import { copyConfigs, copySlaves, copyLogs, derivAccounts } from './schema.js';
import { eq, and } from 'drizzle-orm';

const activeEngines = new Map<number, () => void>(); // configId → unsubscribe fn

/**
 * Start the copy trading engine for a given configuration.
 * Subscribes to master account's open contracts and replicates trades to slaves.
 */
export async function startCopyEngine(configId: number): Promise<void> {
  // Stop existing engine if any
  stopCopyEngine(configId);

  const config = await db.select().from(copyConfigs).where(eq(copyConfigs.id, configId)).limit(1);
  if (!config.length) throw new Error('Copy config not found');

  const cfg = config[0];
  const masterAccount = await db.select().from(derivAccounts).where(eq(derivAccounts.id, cfg.masterAccountId)).limit(1);
  if (!masterAccount.length) throw new Error('Master account not found');

  const master = masterAccount[0];

  // Ensure master WS is connected
  if (!wsManager.isConnected(master.loginId)) {
    await wsManager.connect(master.loginId, master.accessToken, process.env.DERIV_APP_ID!);
  }

  // Subscribe to master's open contract updates
  const unsubscribe = wsManager.subscribe(master.loginId, async (msg) => {
    if (msg.msg_type === 'proposal_open_contract' && msg.proposal_open_contract) {
      const contract = msg.proposal_open_contract;

      // Only replicate when a new contract is opened (status === 'open')
      if (contract.status === 'open' && contract.is_sold === 0) {
        await replicateTrade(configId, cfg, master, contract);
      }
    }
  });

  activeEngines.set(configId, unsubscribe);

  // Subscribe to proposal_open_contract stream on master
  await wsManager.send(master.loginId, {
    proposal_open_contract: 1,
    subscribe: 1,
  });

  console.log(`Copy engine started for config ${configId} (master: ${master.loginId})`);
}

/**
 * Stop the copy trading engine for a given configuration.
 */
export function stopCopyEngine(configId: number): void {
  const unsubscribe = activeEngines.get(configId);
  if (unsubscribe) {
    unsubscribe();
    activeEngines.delete(configId);
    console.log(`Copy engine stopped for config ${configId}`);
  }
}

/**
 * Replicate a master trade to all active slave accounts.
 */
async function replicateTrade(
  configId: number,
  cfg: typeof copyConfigs.$inferSelect,
  master: typeof derivAccounts.$inferSelect,
  masterContract: any
): Promise<void> {
  const ratio = parseFloat(cfg.replicationRatio as string);
  const slaves = await db
    .select()
    .from(copySlaves)
    .where(and(eq(copySlaves.configId, configId), eq(copySlaves.isActive, true)));

  for (const slave of slaves) {
    const slaveAccount = await db.select().from(derivAccounts).where(eq(derivAccounts.id, slave.slaveAccountId)).limit(1);
    if (!slaveAccount.length) continue;

    const slaveAcc = slaveAccount[0];

    try {
      // Ensure slave WS is connected
      if (!wsManager.isConnected(slaveAcc.loginId)) {
        await wsManager.connect(slaveAcc.loginId, slaveAcc.accessToken, process.env.DERIV_APP_ID!);
      }

      // Calculate proportional amount
      const masterBuyPrice = parseFloat(masterContract.buy_price || '0');
      const amount = masterBuyPrice * ratio;
      const minAmount = 0.35; // Deriv minimum
      const finalAmount = Math.max(amount, minAmount);

      // Determine duration
      const duration = masterContract.tick_count || masterContract.duration || 5;
      const durationUnit = masterContract.duration_unit || 't';

      // Get proposal for the slave
      const proposal = await wsManager.send(slaveAcc.loginId, {
        proposal: 1,
        contract_type: masterContract.contract_type,
        symbol: masterContract.underlying,
        amount: finalAmount.toFixed(2),
        duration,
        duration_unit: durationUnit,
        currency: slaveAcc.currency || 'USD',
      });

      if (proposal.error) {
        throw new Error(proposal.error.message || 'Proposal failed');
      }

      // Buy the contract
      const buy = await wsManager.send(slaveAcc.loginId, {
        buy: proposal.proposal.id,
        price: proposal.proposal.ask_price,
      });

      if (buy.error) {
        throw new Error(buy.error.message || 'Buy failed');
      }

      // Log success
      await db.insert(copyLogs).values({
        configId,
        masterContractId: String(masterContract.contract_id),
        slaveAccountId: slaveAcc.id,
        slaveContractId: String(buy.buy.contract_id),
        status: 'success',
      });

      console.log(`Replicated trade: master=${masterContract.contract_id} → slave=${buy.buy.contract_id} (${slaveAcc.loginId})`);
    } catch (err: any) {
      // Log failure
      await db.insert(copyLogs).values({
        configId,
        masterContractId: String(masterContract.contract_id),
        slaveAccountId: slaveAcc.id,
        slaveContractId: null,
        status: 'failed',
        errorMsg: err.message || 'Unknown error',
      });

      console.error(`Failed to replicate trade for slave ${slaveAcc.loginId}:`, err.message);
    }
  }
}

/**
 * Check if a copy engine is running for a given config.
 */
export function isEngineRunning(configId: number): boolean {
  return activeEngines.has(configId);
}
