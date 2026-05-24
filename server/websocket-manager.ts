import WebSocket from 'ws';

interface WsConnection {
  ws: WebSocket;
  loginId: string;
  handlers: Set<(msg: any) => void>;
  heartbeat: NodeJS.Timeout | null;
  reconnectAttempts: number;
  accessToken: string;
  appId: string;
  reqIdCounter: number;
  pendingRequests: Map<number, { resolve: (value: any) => void; reject: (err: Error) => void; timeout: NodeJS.Timeout }>;
}

class DerivWSManager {
  private connections = new Map<string, WsConnection>();

  async connect(loginId: string, accessToken: string, appId: string): Promise<void> {
    // If already connected and open, skip
    const existing = this.connections.get(loginId);
    if (existing && existing.ws.readyState === WebSocket.OPEN) {
      return;
    }

    // Close existing if any
    if (existing) {
      this.disconnect(loginId);
    }

    return new Promise((resolve, reject) => {
      const wsUrl = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
      const ws = new WebSocket(wsUrl);

      const conn: WsConnection = {
        ws,
        loginId,
        handlers: new Set(),
        heartbeat: null,
        reconnectAttempts: 0,
        accessToken,
        appId,
        reqIdCounter: 1,
        pendingRequests: new Map(),
      };

      ws.on('open', () => {
        // Authorize immediately
        const authReq = { authorize: accessToken, req_id: 0 };
        ws.send(JSON.stringify(authReq));
      });

      ws.on('message', (raw: WebSocket.Data) => {
        try {
          const msg = JSON.parse(raw.toString());

          // Handle authorize response
          if (msg.msg_type === 'authorize' && msg.req_id === 0) {
            if (msg.error) {
              reject(new Error(`Authorization failed: ${msg.error.message}`));
              ws.close();
              return;
            }
            // Start heartbeat
            conn.heartbeat = setInterval(() => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ ping: 1 }));
              }
            }, 30000);

            this.connections.set(loginId, conn);
            conn.reconnectAttempts = 0;
            resolve();
          }

          // Resolve pending requests by req_id
          if (msg.req_id && conn.pendingRequests.has(msg.req_id)) {
            const pending = conn.pendingRequests.get(msg.req_id)!;
            clearTimeout(pending.timeout);
            conn.pendingRequests.delete(msg.req_id);
            if (msg.error) {
              pending.reject(new Error(msg.error.message || 'Deriv API error'));
            } else {
              pending.resolve(msg);
            }
          }

          // Notify all subscribed handlers
          for (const handler of conn.handlers) {
            try {
              handler(msg);
            } catch (err) {
              console.error(`Handler error for ${loginId}:`, err);
            }
          }
        } catch (err) {
          console.error(`Failed to parse message for ${loginId}:`, err);
        }
      });

      ws.on('close', () => {
        if (conn.heartbeat) {
          clearInterval(conn.heartbeat);
          conn.heartbeat = null;
        }
        // Reject all pending requests
        for (const [, pending] of conn.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection closed'));
        }
        conn.pendingRequests.clear();
      });

      ws.on('error', (err) => {
        console.error(`WebSocket error for ${loginId}:`, err.message);
        reject(err);
      });

      // Auto-reconnect with exponential backoff (max 5 attempts)
      ws.on('close', () => {
        if (conn.reconnectAttempts < 5) {
          const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts), 30000);
          conn.reconnectAttempts++;
          console.log(`Reconnecting ${loginId} in ${delay}ms (attempt ${conn.reconnectAttempts}/5)`);
          setTimeout(() => {
            this.connect(loginId, conn.accessToken, conn.appId).catch(console.error);
          }, delay);
        }
      });
    });
  }

  async send(loginId: string, message: object): Promise<any> {
    const conn = this.connections.get(loginId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`No active connection for ${loginId}`);
    }

    const reqId = conn.reqIdCounter++;
    const msgWithId = { ...message, req_id: reqId };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        conn.pendingRequests.delete(reqId);
        reject(new Error(`Request timeout for ${loginId} (req_id: ${reqId})`));
      }, 15000);

      conn.pendingRequests.set(reqId, { resolve, reject, timeout });
      conn.ws.send(JSON.stringify(msgWithId));
    });
  }

  subscribe(loginId: string, handler: (msg: any) => void): () => void {
    const conn = this.connections.get(loginId);
    if (!conn) {
      throw new Error(`No connection for ${loginId}`);
    }
    conn.handlers.add(handler);
    return () => {
      conn.handlers.delete(handler);
    };
  }

  disconnect(loginId: string): void {
    const conn = this.connections.get(loginId);
    if (!conn) return;
    if (conn.heartbeat) {
      clearInterval(conn.heartbeat);
    }
    if (conn.ws.readyState === WebSocket.OPEN || conn.ws.readyState === WebSocket.CONNECTING) {
      conn.ws.close();
    }
    // Reject all pending requests
    for (const [, pending] of conn.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    conn.pendingRequests.clear();
    this.connections.delete(loginId);
  }

  isConnected(loginId: string): boolean {
    const conn = this.connections.get(loginId);
    return !!conn && conn.ws.readyState === WebSocket.OPEN;
  }
}

export const wsManager = new DerivWSManager();
