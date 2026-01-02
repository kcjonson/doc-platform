/**
 * Token utilities for email verification and password reset
 */

import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

/**
 * Token expiry duration (1 hour in milliseconds)
 */
export const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Generate a secure random token
 * Returns a 64-character hex string (256 bits of entropy)
 */
export function generateToken(): string {
	return randomBytes(32).toString('hex');
}

/**
 * Hash a token using SHA-256
 * Tokens are stored as hashes in the database for security
 */
export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Compare a token against a stored hash in constant time
 * Prevents timing attacks during token verification
 */
export function verifyToken(token: string, storedHash: string): boolean {
	const tokenHash = hashToken(token);

	// Ensure both strings are the same length for timingSafeEqual
	const tokenBuffer = Buffer.from(tokenHash, 'utf-8');
	const storedBuffer = Buffer.from(storedHash, 'utf-8');

	if (tokenBuffer.length !== storedBuffer.length) {
		return false;
	}

	return timingSafeEqual(tokenBuffer, storedBuffer);
}

/**
 * Calculate token expiry timestamp
 */
export function getTokenExpiry(): Date {
	return new Date(Date.now() + TOKEN_EXPIRY_MS);
}

/**
 * Check if a token has expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
	return new Date() > expiresAt;
}
