import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/porciento_copy_trading',
  },
});
