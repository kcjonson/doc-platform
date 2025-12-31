/**
 * Structured logging utilities for CloudWatch
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
	type: string;
	level: LogLevel;
	timestamp: string;
	[key: string]: unknown;
}

/**
 * Write a structured log entry to stdout (for CloudWatch)
 */
export function log(entry: Omit<LogEntry, 'timestamp'>): void {
	console.log(JSON.stringify({
		...entry,
		timestamp: new Date().toISOString(),
	}));
}

/**
 * Log an HTTP request in Combined Log Format style (structured JSON)
 */
export function logRequest(data: {
	method: string;
	path: string;
	status: number;
	duration: number;
	ip?: string;
	userAgent?: string;
	referer?: string;
	userId?: string;
	contentLength?: number;
}): void {
	log({
		type: 'http_request',
		level: data.status >= 500 ? 'error' : data.status >= 400 ? 'warn' : 'info',
		method: data.method,
		path: data.path,
		status: data.status,
		duration: data.duration,
		ip: data.ip || '-',
		userAgent: data.userAgent || '-',
		referer: data.referer || '-',
		userId: data.userId || '-',
		contentLength: data.contentLength || 0,
	});
}
