/**
 * @doc-platform/storage
 * Internal storage service - dumb filesystem API for S3 + Postgres.
 * No user auth - validated by main API before calling.
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';

import { apiKeyAuth } from './middleware/auth.ts';
import { filesRoutes } from './handlers/files.ts';
import { pendingRoutes } from './handlers/pending.ts';
import { initDb, closeDb } from './db/index.ts';

const app = new Hono();

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok' }));

// All other routes require internal API key
app.use('*', apiKeyAuth);

// Mount route handlers
app.route('/files', filesRoutes);
app.route('/pending', pendingRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((error, c) => {
	console.error('Unhandled error:', error);
	return c.json({ error: 'Internal server error' }, 500);
});

// Start server
const PORT = Number(process.env.PORT) || 3003;

// Initialize database pool
initDb();

// Graceful shutdown
process.on('SIGTERM', async () => {
	console.log('SIGTERM received, shutting down...');
	await closeDb();
	process.exit(0);
});

serve({ fetch: app.fetch, port: PORT }, () => {
	console.log(`Storage service running on http://localhost:${PORT}`);
});
