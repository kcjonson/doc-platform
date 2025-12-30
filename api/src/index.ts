/**
 * @doc-platform/api
 * Backend API server using Hono.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

import {
	rateLimitMiddleware,
	csrfMiddleware,
	RATE_LIMIT_CONFIGS,
} from '@doc-platform/auth';

import { handleLogin, handleLogout, handleGetMe, handleUpdateMe, handleSignup } from './handlers/auth.js';
import {
	handleOAuthMetadata,
	handleAuthorizeGet,
	handleAuthorizePost,
	handleToken,
	handleRevoke,
	handleListAuthorizations,
	handleDeleteAuthorization,
} from './handlers/oauth.js';
import {
	handleListEpics,
	handleGetEpic,
	handleCreateEpic,
	handleUpdateEpic,
	handleDeleteEpic,
	handleGetCurrentWork,
	handleSignalReadyForReview,
} from './handlers/epics.js';
import {
	handleListTasks,
	handleCreateTask,
	handleUpdateTask,
	handleDeleteTask,
	handleBulkCreateTasks,
	handleStartTask,
	handleCompleteTask,
	handleBlockTask,
	handleUnblockTask,
} from './handlers/tasks.js';
import {
	handleListEpicProgress,
	handleCreateEpicProgress,
	handleListTaskProgress,
	handleCreateTaskProgress,
} from './handlers/progress.js';
import {
	handleListProjects,
	handleGetProject,
	handleCreateProject,
	handleUpdateProject,
	handleDeleteProject,
} from './handlers/projects.js';

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
			{ path: '/oauth/token', config: RATE_LIMIT_CONFIGS.oauthToken },
			{ path: '/oauth/authorize', config: RATE_LIMIT_CONFIGS.oauthAuthorize },
		],
		defaultLimit: RATE_LIMIT_CONFIGS.api,
		excludePaths: ['/health', '/api/health'],
	})
);

// CSRF protection for state-changing requests
// Excludes login/signup (no session yet) - logout requires CSRF protection
// Excludes OAuth token/revoke endpoints (use PKCE instead)
app.use(
	'*',
	csrfMiddleware(redis, {
		excludePaths: [
			'/api/auth/login',
			'/api/auth/signup',
			'/oauth/token',
			'/oauth/revoke',
			'/.well-known/oauth-authorization-server',
			'/health',
			'/api/health',
		],
	})
);

// Health check
app.get('/health', (context) => context.json({ status: 'ok' }));
app.get('/api/health', (context) => context.json({ status: 'ok' }));

// Error reporting endpoint - accepts simple JSON and forwards to error tracking service
app.post('/api/metrics', async (context) => {
	const dsn = process.env.ERROR_REPORTING_DSN;
	if (!dsn) {
		return context.text('ok'); // Silently ignore if not configured
	}

	try {
		const report = await context.req.json<{
			name: string;
			message: string;
			stack?: string;
			timestamp: number;
			url: string;
			userAgent: string;
			context?: Record<string, unknown>;
		}>();

		// Parse DSN to extract components
		const dsnUrl = new URL(dsn);
		const publicKey = dsnUrl.username;
		const projectId = dsnUrl.pathname.slice(1);
		const host = dsnUrl.host;

		// Generate event ID
		const eventId = randomUUID().replace(/-/g, '');

		// Parse stack trace into frames
		const frames = parseStackTrace(report.stack);

		// Build envelope header
		const envelopeHeader = JSON.stringify({
			event_id: eventId,
			sent_at: new Date().toISOString(),
			dsn,
		});

		// Build event payload
		const event = {
			event_id: eventId,
			timestamp: report.timestamp / 1000,
			platform: 'javascript',
			environment: report.context?.environment || 'production',
			request: {
				url: report.url,
				headers: {
					'User-Agent': report.userAgent,
				},
			},
			exception: {
				values: [
					{
						type: report.name,
						value: report.message,
						stacktrace: frames.length > 0 ? { frames } : undefined,
					},
				],
			},
			extra: report.context,
		};

		// Build item header
		const itemHeader = JSON.stringify({
			type: 'event',
			length: JSON.stringify(event).length,
		});

		// Construct envelope (newline-separated)
		const envelope = `${envelopeHeader}\n${itemHeader}\n${JSON.stringify(event)}`;

		// Forward to error tracking service
		const response = await fetch(`https://${host}/api/${projectId}/envelope/`, {
			method: 'POST',
			body: envelope,
			headers: {
				'Content-Type': 'application/x-sentry-envelope',
				'X-Sentry-Auth': `Sentry sentry_key=${publicKey}, sentry_version=7`,
			},
		});

		if (!response.ok) {
			console.error('Error reporting failed:', response.status);
		}

		return context.text('ok');
	} catch (error) {
		console.error('Metrics endpoint error:', error);
		return context.text('ok'); // Don't expose errors to client
	}
});

/**
 * Parse a stack trace string into frames for error reporting
 */
function parseStackTrace(stack?: string): Array<{
	filename: string;
	function: string;
	lineno?: number;
	colno?: number;
}> {
	if (!stack) return [];

	const frames: Array<{
		filename: string;
		function: string;
		lineno?: number;
		colno?: number;
	}> = [];

	const lines = stack.split('\n');

	for (const line of lines) {
		// Match Chrome/Node format: "    at functionName (filename:line:col)"
		const chromeMatch = line.match(/^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
		if (chromeMatch) {
			frames.push({
				function: chromeMatch[1] || '<anonymous>',
				filename: chromeMatch[2] || '',
				lineno: parseInt(chromeMatch[3] || '0', 10),
				colno: parseInt(chromeMatch[4] || '0', 10),
			});
			continue;
		}

		// Match Firefox format: "functionName@filename:line:col"
		const firefoxMatch = line.match(/^(.+?)@(.+?):(\d+):(\d+)$/);
		if (firefoxMatch) {
			frames.push({
				function: firefoxMatch[1] || '<anonymous>',
				filename: firefoxMatch[2] || '',
				lineno: parseInt(firefoxMatch[3] || '0', 10),
				colno: parseInt(firefoxMatch[4] || '0', 10),
			});
		}
	}

	// Reverse frames (most error tracking services expect innermost frame first)
	return frames.reverse();
}

// Auth routes
app.post('/api/auth/login', (context) => handleLogin(context, redis));
app.post('/api/auth/signup', (context) => handleSignup(context, redis));
app.post('/api/auth/logout', (context) => handleLogout(context, redis));
app.get('/api/auth/me', (context) => handleGetMe(context, redis));
app.put('/api/auth/me', (context) => handleUpdateMe(context, redis));

// OAuth 2.1 routes (MCP authentication)
app.get('/.well-known/oauth-authorization-server', handleOAuthMetadata);
app.get('/oauth/authorize', (context) => handleAuthorizeGet(context, redis));
app.post('/oauth/authorize', (context) => handleAuthorizePost(context, redis));
app.post('/oauth/token', handleToken);
app.post('/oauth/revoke', handleRevoke);

// OAuth authorization management (user settings)
app.get('/api/oauth/authorizations', (context) => handleListAuthorizations(context, redis));
app.delete('/api/oauth/authorizations/:id', (context) => handleDeleteAuthorization(context, redis));

// Project routes (user-scoped, not project-scoped)
app.get('/api/projects', (context) => handleListProjects(context, redis));
app.get('/api/projects/:id', (context) => handleGetProject(context, redis));
app.post('/api/projects', (context) => handleCreateProject(context, redis));
app.put('/api/projects/:id', (context) => handleUpdateProject(context, redis));
app.delete('/api/projects/:id', (context) => handleDeleteProject(context, redis));

// Project routes (user-scoped, not project-scoped)
app.get('/api/projects', (context) => handleListProjects(context, redis));
app.get('/api/projects/:id', (context) => handleGetProject(context, redis));
app.post('/api/projects', (context) => handleCreateProject(context, redis));
app.put('/api/projects/:id', (context) => handleUpdateProject(context, redis));
app.delete('/api/projects/:id', (context) => handleDeleteProject(context, redis));

// Project-scoped epic routes
app.get('/api/projects/:projectId/epics', handleListEpics);
app.get('/api/projects/:projectId/epics/current', handleGetCurrentWork);
app.get('/api/projects/:projectId/epics/:id', handleGetEpic);
app.post('/api/projects/:projectId/epics', handleCreateEpic);
app.put('/api/projects/:projectId/epics/:id', handleUpdateEpic);
app.delete('/api/projects/:projectId/epics/:id', handleDeleteEpic);
app.post('/api/projects/:projectId/epics/:id/ready-for-review', handleSignalReadyForReview);

// Project-scoped task routes
app.get('/api/projects/:projectId/epics/:epicId/tasks', handleListTasks);
app.post('/api/projects/:projectId/epics/:epicId/tasks', handleCreateTask);
app.post('/api/projects/:projectId/epics/:epicId/tasks/bulk', handleBulkCreateTasks);
app.put('/api/projects/:projectId/tasks/:id', handleUpdateTask);
app.delete('/api/projects/:projectId/tasks/:id', handleDeleteTask);
app.post('/api/projects/:projectId/tasks/:id/start', handleStartTask);
app.post('/api/projects/:projectId/tasks/:id/complete', handleCompleteTask);
app.post('/api/projects/:projectId/tasks/:id/block', handleBlockTask);
app.post('/api/projects/:projectId/tasks/:id/unblock', handleUnblockTask);

// Project-scoped progress notes routes
app.get('/api/projects/:projectId/epics/:epicId/progress', handleListEpicProgress);
app.post('/api/projects/:projectId/epics/:epicId/progress', handleCreateEpicProgress);
app.get('/api/projects/:projectId/tasks/:taskId/progress', handleListTaskProgress);
app.post('/api/projects/:projectId/tasks/:taskId/progress', handleCreateTaskProgress);

// Start server
const PORT = Number(process.env.PORT) || 3001;

serve({ fetch: app.fetch, port: PORT }, () => {
	console.log(`API server running on http://localhost:${PORT}`);
});
