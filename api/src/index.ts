/**
 * @doc-platform/api
 * Backend API server using Hono.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { Redis } from 'ioredis';
import {
	rateLimitMiddleware,
	csrfMiddleware,
	RATE_LIMIT_CONFIGS,
} from '@doc-platform/auth';

import { handleLogin, handleLogout, handleGetMe, handleSignup } from './handlers/auth.js';
import {
	handleListEpics,
	handleGetEpic,
	handleCreateEpic,
	handleUpdateEpic,
	handleDeleteEpic,
} from './handlers/epics.js';
import {
	handleListTasks,
	handleCreateTask,
	handleUpdateTask,
	handleDeleteTask,
} from './handlers/tasks.js';

// Redis connection
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

redis.on('error', (error) => {
	console.error('Redis connection error:', error);
});

redis.on('connect', () => {
	console.log('Connected to Redis');
});

// App
const app = new Hono();

// Middleware
app.use('*', cors());

// Rate limiting middleware (per spec requirements)
app.use(
	'*',
	rateLimitMiddleware(redis, {
		rules: [
			{ path: '/api/auth/login', config: RATE_LIMIT_CONFIGS.login },
			{ path: '/api/auth/signup', config: RATE_LIMIT_CONFIGS.signup },
		],
		defaultLimit: RATE_LIMIT_CONFIGS.api,
		excludePaths: ['/health', '/api/health'],
	})
);

// CSRF protection for state-changing requests
// Excludes login/signup (no session yet) - logout requires CSRF protection
app.use(
	'*',
	csrfMiddleware(redis, {
		excludePaths: [
			'/api/auth/login',
			'/api/auth/signup',
			'/health',
			'/api/health',
		],
	})
);

// Health check
app.get('/health', (context) => context.json({ status: 'ok' }));
app.get('/api/health', (context) => context.json({ status: 'ok' }));

// Auth routes
app.post('/api/auth/login', (context) => handleLogin(context, redis));
app.post('/api/auth/signup', (context) => handleSignup(context, redis));
app.post('/api/auth/logout', (context) => handleLogout(context, redis));
app.get('/api/auth/me', (context) => handleGetMe(context, redis));

// Epic routes
app.get('/api/epics', handleListEpics);
app.get('/api/epics/:id', handleGetEpic);
app.post('/api/epics', handleCreateEpic);
app.put('/api/epics/:id', handleUpdateEpic);
app.delete('/api/epics/:id', handleDeleteEpic);

// Task routes
app.get('/api/epics/:epicId/tasks', handleListTasks);
app.post('/api/epics/:epicId/tasks', handleCreateTask);
app.put('/api/tasks/:id', handleUpdateTask);
app.delete('/api/tasks/:id', handleDeleteTask);

// Start server
const PORT = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port: PORT }, () => {
	console.log(`API server running on http://localhost:${PORT}`);
});
