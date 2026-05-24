import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/porciento_copy_trading';

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
