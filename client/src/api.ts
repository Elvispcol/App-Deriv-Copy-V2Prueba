const BASE_URL = '';

function getAuthHeaders(): Record<string, string> {
  const sessionId = localStorage.getItem('session_id');
  return sessionId ? { Authorization: `Bearer ${sessionId}` } : {};
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth API
export const authApi = {
  callback: (code: string, code_verifier: string, redirect_uri: string) =>
    apiFetch('/api/auth/callback', {
      method: 'POST',
      body: JSON.stringify({ code, code_verifier, redirect_uri }),
    }),
  me: () => apiFetch('/api/auth/me'),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
};

// Accounts API
export const accountsApi = {
  list: () => apiFetch('/api/accounts'),
  connect: (login_id: string) =>
    apiFetch('/api/accounts/connect', {
      method: 'POST',
      body: JSON.stringify({ login_id }),
    }),
  disconnect: (login_id: string) =>
    apiFetch('/api/accounts/disconnect', {
      method: 'POST',
      body: JSON.stringify({ login_id }),
    }),
};

// Copy Trading API
export const copyApi = {
  getConfigs: () => apiFetch('/api/copy/configs'),
  createConfig: (data: { master_account_id: number; replication_ratio: number; max_drawdown?: number }) =>
    apiFetch('/api/copy/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  enableConfig: (id: number) =>
    apiFetch(`/api/copy/configs/${id}/enable`, { method: 'POST' }),
  disableConfig: (id: number) =>
    apiFetch(`/api/copy/configs/${id}/disable`, { method: 'POST' }),
  addSlave: (configId: number, slave_account_id: number) =>
    apiFetch(`/api/copy/configs/${configId}/slaves`, {
      method: 'POST',
      body: JSON.stringify({ slave_account_id }),
    }),
  getLogs: (config_id?: number) =>
    apiFetch(`/api/copy/logs${config_id ? `?config_id=${config_id}` : ''}`),
};
