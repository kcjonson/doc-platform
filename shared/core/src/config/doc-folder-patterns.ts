/**
 * Document folder detection patterns
 *
 * These patterns control automatic folder selection when connecting a repository.
 * Edit doc-folder-patterns.json to modify the patterns.
 */

import patterns from './doc-folder-patterns.json';

export interface DocFolderPatterns {
	/** Folders automatically selected if they exist and contain markdown */
	preselect: string[];
	/** Folders highlighted but not selected if they contain markdown */
	suggest: string[];
	/** Folders hidden from the picker entirely */
	ignore: string[];
}

export const docFolderPatterns: DocFolderPatterns = {
	preselect: patterns.preselect.patterns,
	suggest: patterns.suggest.patterns,
	ignore: patterns.ignore.patterns,
};

/**
 * Check if a folder path matches any pattern in a list
 * Patterns are matched against the start of the path
 */
export function matchesPattern(folderPath: string, patternList: string[]): boolean {
	const normalized = folderPath.startsWith('/') ? folderPath : `/${folderPath}`;
	return patternList.some(pattern => {
		// Exact match or folder starts with pattern followed by /
		return normalized === pattern || normalized.startsWith(`${pattern}/`);
	});
}

/**
 * Categorize a folder based on its path
 */
export function categorizeFolderPath(folderPath: string): 'preselect' | 'suggest' | 'ignore' | 'normal' {
	if (matchesPattern(folderPath, docFolderPatterns.ignore)) {
		return 'ignore';
	}
	if (matchesPattern(folderPath, docFolderPatterns.preselect)) {
		return 'preselect';
	}
	if (matchesPattern(folderPath, docFolderPatterns.suggest)) {
		return 'suggest';
	}
	return 'normal';
}
