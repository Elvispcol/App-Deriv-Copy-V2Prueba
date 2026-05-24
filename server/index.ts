import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db.js';
import router from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(router);

const distPath = path.join(__dirname, '../../dist/client');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;

async function start() {
  const migrationsPath = path.join(process.cwd(), 'drizzle');
  console.log('CWD:', process.cwd());
  console.log('Migrations path:', migrationsPath);
  
  try {
    const fs = await import('fs');
    const exists = fs.existsSync(migrationsPath);
    console.log('Drizzle folder exists:', exists);
    if (exists) {
      const files = fs.readdirSync(migrationsPath);
      console.log('Files in drizzle:', files);
    }
  } catch (e) {
    console.log('FS check error:', e);
  }

  try {
    await migrate(db, { migrationsFolder: migrationsPath });
    console.log('Database migrated successfully');
  } catch (err) {
    console.error('Migration error:', err);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
