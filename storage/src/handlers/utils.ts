/**
 * Utility functions for storage handlers.
 */

import path from 'path';

/**
 * Validate and normalize a file path.
 * Prevents path traversal attacks and normalizes the path.
 *
 * @param filePath - The path to validate
 * @returns Normalized path, or null if invalid
 */
export function validatePath(filePath: string): string | null {
	if (!filePath || typeof filePath !== 'string') {
		return null;
	}

	// Normalize the path
	const normalized = path.normalize(filePath);

	// Check for path traversal attempts
	if (normalized.startsWith('..') || normalized.includes('/../') || normalized.startsWith('/')) {
		return null;
	}

	// Remove leading ./ if present
	const cleaned = normalized.replace(/^\.\//, '');

	// Check for empty path
	if (!cleaned || cleaned === '.') {
		return null;
	}

	// Check for null bytes (security)
	if (cleaned.includes('\0')) {
		return null;
	}

	return cleaned;
}
