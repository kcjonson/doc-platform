/**
 * Server-side error reporting utility
 *
 * Builds envelope format and forwards to error tracking service.
 * Used by API, MCP, and the /api/metrics tunnel endpoint.
 */
export interface ErrorReport {
    name: string;
    message: string;
    stack?: string;
    timestamp: number;
    url?: string;
    userAgent?: string;
    userId?: string;
    source: 'web' | 'api' | 'mcp';
    environment?: string;
    extra?: Record<string, unknown>;
}
/**
 * Report an error to the error tracking service
 */
export declare function reportError(report: ErrorReport): Promise<void>;
/**
 * Convenience function to report a caught error
 */
export declare function captureException(error: Error, source: 'api' | 'mcp', extra?: Record<string, unknown>): void;
//# sourceMappingURL=error-reporting.d.ts.map