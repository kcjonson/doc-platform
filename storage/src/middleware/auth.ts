/**
 * Internal API key authentication middleware.
 * Storage service is only called by main API, never directly by clients.
 */

import type { Context, Next } from 'hono';

const STORAGE_API_KEY = process.env.STORAGE_API_KEY;

export async function apiKeyAuth(c: Context, next: Next): Promise<Response | void> {
	// Skip auth for health check
	if (c.req.path === '/health') {
		return next();
	}

	const apiKey = c.req.header('X-Internal-API-Key');

	if (!STORAGE_API_KEY) {
		console.error('STORAGE_API_KEY not configured');
		return c.json({ error: 'Service misconfigured' }, 500);
	}

	if (!apiKey || apiKey !== STORAGE_API_KEY) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	return next();
}
