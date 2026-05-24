import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db.js';
import router from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use(router);

// Serve static frontend (built by Vite)
const clientDistPath = path.join(__dirname, '../../dist/client');
app.use(express.static(clientDistPath));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Run migrations automatically before starting the server
await migrate(db, { migrationsFolder: './drizzle' });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PorCiento Copy Trading server running on port ${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Frontend: http://localhost:${PORT}`);
});

export default app;
