/**
 * Lightweight error reporting telemetry
 *
 * Captures unhandled errors and sends them to our API endpoint.
 * Minimal footprint (~1KB) with no external dependencies.
 */

const ENDPOINT = '/api/metrics';

interface ErrorReport {
	name: string;
	message: string;
	stack?: string;
	timestamp: number;
	url: string;
	userAgent: string;
	context?: Record<string, unknown>;
}

interface TelemetryConfig {
	enabled: boolean;
	environment?: string;
}

let config: TelemetryConfig = {
	enabled: false,
};

let handlersInstalled = false;

/**
 * Initialize telemetry with configuration
 */
export function init(options: TelemetryConfig): void {
	config = { ...options };

	if (!config.enabled) {
		return;
	}

	// Prevent duplicate handler installation
	if (handlersInstalled) {
		return;
	}
	handlersInstalled = true;

	// Global error handler for uncaught errors
	window.addEventListener('error', (event) => {
		captureError(event.error || new Error(event.message), {
			type: 'uncaught',
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
		});
	});

	// Global handler for unhandled promise rejections
	window.addEventListener('unhandledrejection', (event) => {
		const error = event.reason instanceof Error
			? event.reason
			: new Error(String(event.reason));
		captureError(error, { type: 'unhandled_rejection' });
	});
}

/**
 * Capture and report an error
 */
export function captureError(
	error: Error,
	context?: Record<string, unknown>
): void {
	if (!config.enabled) {
		return;
	}

	const report: ErrorReport = {
		name: error.name,
		message: error.message,
		stack: error.stack,
		timestamp: Date.now(),
		url: location.href,
		userAgent: navigator.userAgent,
		context: {
			environment: config.environment,
			...context,
		},
	};

	// Use sendBeacon for reliable delivery (works even during page unload)
	// Wrap in Blob to ensure proper Content-Type header
	if (navigator.sendBeacon) {
		const payload = new Blob([JSON.stringify(report)], { type: 'application/json' });
		navigator.sendBeacon(ENDPOINT, payload);
	} else {
		// Fallback for older browsers
		fetch(ENDPOINT, {
			method: 'POST',
			body: JSON.stringify(report),
			headers: { 'Content-Type': 'application/json' },
			keepalive: true,
		}).catch(() => {
			// Silently fail - we don't want error reporting to cause errors
		});
	}
}

/**
 * Capture a message (for non-error events)
 */
export function captureMessage(
	message: string,
	context?: Record<string, unknown>
): void {
	captureError(new Error(message), { type: 'message', ...context });
}
