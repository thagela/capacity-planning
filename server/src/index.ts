import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { migrate, seed } from './db.js';
import { api } from './routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

migrate();
seed();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', api);

// In production, serve the built client (client/dist) and let the SPA handle routing.
const clientDist = resolve(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(resolve(clientDist, 'index.html')));
}

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Capacity planning server listening on http://localhost:${port}`);
  if (!existsSync(clientDist)) {
    console.log('Client build not found — run "npm run dev" for development, or "npm run build" then "npm start".');
  }
});
