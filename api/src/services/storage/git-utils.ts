/**
 * Git utilities for storage operations
 * Wraps git CLI commands
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface GitInfo {
	repoRoot: string;
	branch: string;
	remoteUrl: string | null;
}

/**
 * Execute a git command in a directory
 */
export async function execGit(
	cwd: string,
	args: string[]
): Promise<{ stdout: string; stderr: string }> {
	const command = `git ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;
	try {
		return await execAsync(command, { cwd, maxBuffer: 10 * 1024 * 1024 });
	} catch (error) {
		const execError = error as { stdout?: string; stderr?: string; message?: string };
		throw new Error(`Git command failed: ${execError.stderr || execError.message}`);
	}
}

/**
 * Find the git repository root for a given path
 * Returns null if not in a git repository
 */
export async function findRepoRoot(folderPath: string): Promise<string | null> {
	try {
		const { stdout } = await execGit(folderPath, ['rev-parse', '--show-toplevel']);
		return stdout.trim();
	} catch {
		return null;
	}
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(repoPath: string): Promise<string> {
	const { stdout } = await execGit(repoPath, ['rev-parse', '--abbrev-ref', 'HEAD']);
	return stdout.trim();
}

/**
 * Get the remote origin URL
 */
export async function getRemoteUrl(repoPath: string): Promise<string | null> {
	try {
		const { stdout } = await execGit(repoPath, ['remote', 'get-url', 'origin']);
		return stdout.trim() || null;
	} catch {
		return null;
	}
}

/**
 * Get full git info for a path
 */
export async function getGitInfo(folderPath: string): Promise<GitInfo | null> {
	const repoRoot = await findRepoRoot(folderPath);
	if (!repoRoot) {
		return null;
	}

	const branch = await getCurrentBranch(repoRoot);
	const remoteUrl = await getRemoteUrl(repoRoot);

	return { repoRoot, branch, remoteUrl };
}

/**
 * Calculate relative path within repository
 */
export function getRelativePath(repoRoot: string, absolutePath: string): string {
	const relative = path.relative(repoRoot, absolutePath);
	// Normalize to forward slashes and ensure leading slash
	const normalized = '/' + relative.replace(/\\/g, '/');
	return normalized === '/.' ? '/' : normalized;
}

/**
 * Validate that a path is within the repository (prevent path traversal)
 */
export function validatePath(repoRoot: string, relativePath: string): string {
	const absolutePath = path.resolve(repoRoot, relativePath.replace(/^\//, ''));
	const normalizedRepo = path.normalize(repoRoot);

	if (!absolutePath.startsWith(normalizedRepo)) {
		throw new Error('Path traversal detected');
	}

	return absolutePath;
}
