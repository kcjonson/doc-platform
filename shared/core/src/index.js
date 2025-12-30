/**
 * @doc-platform/core
 * Shared types and utilities used across the platform.
 */
export const VERSION = '0.0.1';
// Error reporting
export { reportError, captureException } from './error-reporting.js';
/**
 * Creates a unique identifier.
 */
export function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
/**
 * Deep clones an object.
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
/**
 * Debounces a function call.
 */
export function debounce(fn, ms) {
    let timeoutId = null;
    return (...args) => {
        if (timeoutId)
            clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), ms);
    };
}
//# sourceMappingURL=index.js.map