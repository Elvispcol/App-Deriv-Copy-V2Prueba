import { pgTable, serial, varchar, integer, timestamp, boolean, decimal, text } from 'drizzle-orm/pg-core';

// Usuarios de la plataforma
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  derivLoginId: varchar('deriv_login_id', { length: 50 }).unique().notNull(),
  accessToken: text('access_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Cuentas Deriv vinculadas
export const derivAccounts = pgTable('deriv_accounts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  loginId: varchar('login_id', { length: 50 }).notNull(),
  accessToken: text('access_token').notNull(),
  accountType: varchar('account_type', { length: 10 }).notNull(), // real / demo
  currency: varchar('currency', { length: 10 }).default('USD'),
  balance: decimal('balance', { precision: 15, scale: 2 }).default('0'),
  isConnected: boolean('is_connected').default(false),
});

// Configuración copy trading
export const copyConfigs = pgTable('copy_configs', {
  id: serial('id').primaryKey(),
  ownerUserId: integer('owner_user_id').references(() => users.id).notNull(),
  masterAccountId: integer('master_account_id').references(() => derivAccounts.id).notNull(),
  replicationRatio: decimal('replication_ratio', { precision: 3, scale: 2 }).notNull(), // 0.1-1.0
  maxDrawdown: decimal('max_drawdown', { precision: 5, scale: 2 }).default('100'),
  isEnabled: boolean('is_enabled').default(false),
});

// Cuentas esclavas
export const copySlaves = pgTable('copy_slaves', {
  id: serial('id').primaryKey(),
  configId: integer('config_id').references(() => copyConfigs.id).notNull(),
  slaveAccountId: integer('slave_account_id').references(() => derivAccounts.id).notNull(),
  isActive: boolean('is_active').default(true),
});

// Logs de replicación
export const copyLogs = pgTable('copy_logs', {
  id: serial('id').primaryKey(),
  configId: integer('config_id').references(() => copyConfigs.id).notNull(),
  masterContractId: varchar('master_contract_id', { length: 50 }),
  slaveAccountId: integer('slave_account_id').references(() => derivAccounts.id).notNull(),
  slaveContractId: varchar('slave_contract_id', { length: 50 }),
  status: varchar('status', { length: 10 }).notNull(), // success / failed
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Sesiones de usuario
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  sessionId: varchar('session_id', { length: 128 }).unique().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});
