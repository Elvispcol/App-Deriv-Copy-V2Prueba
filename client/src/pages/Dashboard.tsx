import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, accountsApi, copyApi } from '../api';

interface Account {
  id: number;
  login_id: string;
  account_type: string;
  currency: string;
  balance: string;
  is_connected: boolean;
}

interface CopyConfig {
  id: number;
  master_account_id: number;
  replication_ratio: string;
  max_drawdown: string;
  is_enabled: boolean;
  masterAccount: Account | null;
  slaves: { id: number; slave_account_id: number; is_active: boolean; account: Account | null }[];
  isRunning: boolean;
}

interface CopyLog {
  id: number;
  config_id: number;
  master_contract_id: string | null;
  slave_account_id: number;
  slave_contract_id: string | null;
  status: string;
  error_msg: string | null;
  created_at: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [configs, setConfigs] = useState<CopyConfig[]>([]);
  const [logs, setLogs] = useState<CopyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New config form
  const [showNewConfig, setShowNewConfig] = useState(false);
  const [newMasterId, setNewMasterId] = useState('');
  const [newRatio, setNewRatio] = useState('0.5');
  const [newDrawdown, setNewDrawdown] = useState('100');

  // Add slave form
  const [addingSlaveTo, setAddingSlaveTo] = useState<number | null>(null);
  const [slaveAccountId, setSlaveAccountId] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [userData, accountsData, configsData, logsData] = await Promise.all([
        authApi.me(),
        accountsApi.list(),
        copyApi.getConfigs(),
        copyApi.getLogs(),
      ]);
      setUser(userData);
      setAccounts(accountsData);
      setConfigs(configsData);
      setLogs(logsData);
    } catch (err: any) {
      if (err.message.includes('Not authenticated') || err.message.includes('401')) {
        navigate('/');
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      navigate('/');
      return;
    }
    loadData();
  }, [navigate, loadData]);

  const handleConnectAccount = async (loginId: string) => {
    try {
      await accountsApi.connect(loginId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDisconnectAccount = async (loginId: string) => {
    try {
      await accountsApi.disconnect(loginId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateConfig = async () => {
    try {
      await copyApi.createConfig({
        master_account_id: parseInt(newMasterId),
        replication_ratio: parseFloat(newRatio),
        max_drawdown: parseFloat(newDrawdown),
      });
      setShowNewConfig(false);
      setNewMasterId('');
      setNewRatio('0.5');
      setNewDrawdown('100');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleConfig = async (configId: number, currentlyEnabled: boolean) => {
    try {
      if (currentlyEnabled) {
        await copyApi.disableConfig(configId);
      } else {
        await copyApi.enableConfig(configId);
      }
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAddSlave = async (configId: number) => {
    try {
      await copyApi.addSlave(configId, parseInt(slaveAccountId));
      setAddingSlaveTo(null);
      setSlaveAccountId('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    localStorage.removeItem('session_id');
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-deriv-dark flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-deriv-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deriv-dark">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📈</span>
            <h1 className="text-xl font-bold text-white">
              Por<span className="text-deriv-primary">Ciento</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {user?.deriv_login_id || 'Usuario'}
            </span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-400 text-sm transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 flex justify-between items-center">
            <span className="text-red-300">{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* ── Accounts Section ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Cuentas Deriv</h2>
            <button
              onClick={() => {
                const loginId = prompt('Ingresa el Login ID de tu cuenta Deriv:');
                if (loginId) handleConnectAccount(loginId);
              }}
              className="bg-deriv-primary hover:bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              + Conectar cuenta
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-deriv-card rounded-xl p-8 border border-gray-700 text-center">
              <p className="text-gray-400">No hay cuentas conectadas. Haz clic en "Conectar cuenta" para vincular tu cuenta de Deriv.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div key={acc.id} className="bg-deriv-card rounded-xl p-5 border border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-mono font-semibold">{acc.login_id}</span>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        acc.is_connected
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {acc.is_connected ? 'Conectada' : 'Desconectada'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tipo</span>
                      <span className="text-white capitalize">{acc.account_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Moneda</span>
                      <span className="text-white">{acc.currency || 'USD'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Balance</span>
                      <span className="text-white">{acc.balance || '0.00'}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    {acc.is_connected ? (
                      <button
                        onClick={() => handleDisconnectAccount(acc.login_id)}
                        className="w-full text-sm text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 py-1.5 rounded-lg transition-colors"
                      >
                        Desconectar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectAccount(acc.login_id)}
                        className="w-full text-sm text-deriv-primary hover:text-blue-400 border border-blue-800 hover:border-blue-600 py-1.5 rounded-lg transition-colors"
                      >
                        Conectar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Copy Trading Configs ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Configuraciones Copy Trading</h2>
            <button
              onClick={() => setShowNewConfig(true)}
              className="bg-deriv-secondary hover:bg-green-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              + Nueva configuración
            </button>
          </div>

          {/* New Config Form */}
          {showNewConfig && (
            <div className="bg-deriv-card rounded-xl p-6 border border-deriv-primary mb-4">
              <h3 className="text-lg font-semibold text-white mb-4">Nueva configuración</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Cuenta maestra</label>
                  <select
                    value={newMasterId}
                    onChange={(e) => setNewMasterId(e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg py-2 px-3 focus:border-deriv-primary outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.login_id} ({acc.account_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Ratio de replicación (0.1 - 1.0)</label>
                  <input
                    type="number"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={newRatio}
                    onChange={(e) => setNewRatio(e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg py-2 px-3 focus:border-deriv-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-1">Max drawdown (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newDrawdown}
                    onChange={(e) => setNewDrawdown(e.target.value)}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg py-2 px-3 focus:border-deriv-primary outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateConfig}
                  disabled={!newMasterId}
                  className="bg-deriv-primary hover:bg-blue-600 disabled:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Crear configuración
                </button>
                <button
                  onClick={() => setShowNewConfig(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {configs.length === 0 && !showNewConfig ? (
            <div className="bg-deriv-card rounded-xl p-8 border border-gray-700 text-center">
              <p className="text-gray-400">No hay configuraciones de copy trading. Crea una para empezar a replicar operaciones.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((cfg) => (
                <div key={cfg.id} className="bg-deriv-card rounded-xl p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="text-white font-semibold">
                          Config #{cfg.id}
                        </h3>
                        <p className="text-gray-400 text-sm">
                          Maestra: {cfg.masterAccount?.login_id || `Cuenta ${cfg.master_account_id}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full ${
                          cfg.isRunning
                            ? 'bg-green-900/40 text-green-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {cfg.isRunning ? 'Activo' : 'Inactivo'}
                      </span>
                      <button
                        onClick={() => handleToggleConfig(cfg.id, cfg.is_enabled)}
                        className={`font-semibold py-2 px-5 rounded-lg transition-colors text-sm ${
                          cfg.is_enabled
                            ? 'bg-red-800 hover:bg-red-700 text-white'
                            : 'bg-deriv-secondary hover:bg-green-600 text-white'
                        }`}
                      >
                        {cfg.is_enabled ? 'Detener' : 'Iniciar'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <span className="text-gray-400 text-xs block">Ratio</span>
                      <span className="text-white font-semibold">{(parseFloat(cfg.replication_ratio) * 100).toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Max Drawdown</span>
                      <span className="text-white font-semibold">{cfg.max_drawdown}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Esclavas</span>
                      <span className="text-white font-semibold">{cfg.slaves.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs block">Estado</span>
                      <span className="text-white font-semibold">{cfg.is_enabled ? 'Habilitado' : 'Deshabilitado'}</span>
                    </div>
                  </div>

                  {/* Slaves list */}
                  {cfg.slaves.length > 0 && (
                    <div className="border-t border-gray-700 pt-3">
                      <h4 className="text-gray-400 text-xs mb-2">Cuentas esclavas</h4>
                      <div className="flex flex-wrap gap-2">
                        {cfg.slaves.map((s) => (
                          <span
                            key={s.id}
                            className={`text-xs px-3 py-1 rounded-full border ${
                              s.is_active
                                ? 'border-green-700 text-green-400 bg-green-900/20'
                                : 'border-gray-600 text-gray-400 bg-gray-800'
                            }`}
                          >
                            {s.account?.login_id || `Cuenta ${s.slave_account_id}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Slave */}
                  {addingSlaveTo === cfg.id ? (
                    <div className="border-t border-gray-700 pt-3 mt-3">
                      <div className="flex gap-2">
                        <select
                          value={slaveAccountId}
                          onChange={(e) => setSlaveAccountId(e.target.value)}
                          className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-lg py-1.5 px-3 text-sm focus:border-deriv-primary outline-none"
                        >
                          <option value="">Seleccionar cuenta esclava...</option>
                          {accounts
                            .filter((a) => a.id !== cfg.master_account_id)
                            .map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.login_id} ({acc.account_type})
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleAddSlave(cfg.id)}
                          disabled={!slaveAccountId}
                          className="bg-deriv-secondary hover:bg-green-600 disabled:bg-gray-600 text-white text-sm py-1.5 px-4 rounded-lg transition-colors"
                        >
                          Agregar
                        </button>
                        <button
                          onClick={() => {
                            setAddingSlaveTo(null);
                            setSlaveAccountId('');
                          }}
                          className="bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 px-3 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingSlaveTo(cfg.id)}
                      className="text-deriv-primary hover:text-blue-400 text-sm mt-3 transition-colors"
                    >
                      + Agregar cuenta esclava
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Replication Logs ── */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Historial de replicaciones</h2>

          {logs.length === 0 ? (
            <div className="bg-deriv-card rounded-xl p-8 border border-gray-700 text-center">
              <p className="text-gray-400">No hay registros de replicación todavía. Inicia una configuración de copy trading para empezar.</p>
            </div>
          ) : (
            <div className="bg-deriv-card rounded-xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-400 font-semibold px-4 py-3">Config</th>
                      <th className="text-left text-gray-400 font-semibold px-4 py-3">Contrato Maestro</th>
                      <th className="text-left text-gray-400 font-semibold px-4 py-3">Contrato Esclavo</th>
                      <th className="text-left text-gray-400 font-semibold px-4 py-3">Estado</th>
                      <th className="text-left text-gray-400 font-semibold px-4 py-3">Error</th>
                      <th className="text-left text-gray-400 font-semibold px-4 py-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-3 text-white">#{log.config_id}</td>
                        <td className="px-4 py-3 text-white font-mono">{log.master_contract_id || '—'}</td>
                        <td className="px-4 py-3 text-white font-mono">{log.slave_contract_id || '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs font-semibold px-2 py-1 rounded-full ${
                              log.status === 'success'
                                ? 'bg-green-900/40 text-green-400'
                                : 'bg-red-900/40 text-red-400'
                            }`}
                          >
                            {log.status === 'success' ? 'Exitoso' : 'Fallido'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-red-400 text-xs max-w-xs truncate">
                          {log.error_msg || '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
