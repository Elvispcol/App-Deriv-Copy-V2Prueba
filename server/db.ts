import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  
  const url = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;
  console.log('DATABASE_URL exists:', !!url);
  console.log('All env keys:', Object.keys(process.env).join(', '));
  
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const client = postgres(url, {
    ssl: { rejectUnauthorized: false },
  });
  
  _db = drizzle(client, { schema });
  return _db;
}

export const db = getDb();
