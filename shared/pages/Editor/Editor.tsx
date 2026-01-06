import { useMemo, useEffect, useCallback, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { RouteProps } from '@doc-platform/router';
import { Page } from '@doc-platform/ui';
import {
	DocumentModel,
	useModel,
	saveToLocalStorage,
	loadFromLocalStorage,
	hasPersistedContent,
	clearLocalStorage,
} from '@doc-platform/models';
import { fetchClient } from '@doc-platform/fetch';
import { captureError } from '@doc-platform/telemetry';
import { FileBrowser } from '../FileBrowser/FileBrowser';
import { MarkdownEditor, mockComments, fromMarkdown, toMarkdown } from '../MarkdownEditor';
import { EditorHeader } from './EditorHeader';
import { RecoveryDialog } from './RecoveryDialog';
import styles from './Editor.module.css';

interface LoadError {
	message: string;
	filePath: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Selected file persistence
// ─────────────────────────────────────────────────────────────────────────────

const SELECTED_FILE_KEY = 'editor.selectedFile';

function loadSelectedFile(projectId: string): string | null {
	try {
		const stored = globalThis.localStorage?.getItem(SELECTED_FILE_KEY);
		if (stored) {
			const all = JSON.parse(stored) as Record<string, string>;
			return all[projectId] || null;
		}
	} catch {
		// Ignore parse errors
	}
	return null;
}

function saveSelectedFile(projectId: string, filePath: string | null): void {
	try {
		const storage = globalThis.localStorage;
		if (!storage) return;
		const stored = storage.getItem(SELECTED_FILE_KEY);
		const all = stored ? (JSON.parse(stored) as Record<string, string>) : {};
		if (filePath) {
			all[projectId] = filePath;
		} else {
			delete all[projectId];
		}
		storage.setItem(SELECTED_FILE_KEY, JSON.stringify(all));
	} catch {
		// Ignore storage errors
	}
}

/**
 * Migrate cached localStorage content from one file path to another.
 * Used when renaming files to preserve unsaved edits.
 */
function migrateLocalStorageContent(projectId: string, oldPath: string, newPath: string): void {
	if (hasPersistedContent(projectId, oldPath)) {
		const cached = loadFromLocalStorage(projectId, oldPath);
		if (cached) {
			saveToLocalStorage(projectId, newPath, cached);
		}
		clearLocalStorage(projectId, oldPath);
	}
}

export function Editor(props: RouteProps): JSX.Element {
	const projectId = props.params.projectId || 'demo';

	// Document model - source of truth for editor content
	const documentModel = useMemo(() => new DocumentModel(), []);

	// Subscribe to model changes
	useModel(documentModel);

	// Track previous content for debounced localStorage save
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Track if we've attempted to restore the selected file
	const restoredRef = useRef(false);

	// Error state for file loading failures
	const [loadError, setLoadError] = useState<LoadError | null>(null);

	// Pending recovery dialog state (file path with cached changes)
	const [pendingRecovery, setPendingRecovery] = useState<string | null>(null);

	// Reference to the startNewFile function from FileBrowser
	const startNewFileRef = useRef<((parentPath?: string) => void) | null>(null);

	// Track pending new file state to show creating notice
	const [isCreatingFile, setIsCreatingFile] = useState(false);

	// Reference to the renameFile function from FileBrowser
	const renameFileRef = useRef<((path: string, newFilename: string) => Promise<string>) | null>(null);

	// Load file from server
	const loadFileFromServer = useCallback(async (path: string) => {
		try {
			const response = await fetchClient.get<{ content: string }>(
				`/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
			);
			const slateContent = fromMarkdown(response.content);
			documentModel.loadDocument(projectId, path, slateContent);
			saveSelectedFile(projectId, path);
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			captureError(error, {
				type: 'file_load_error',
				filePath: path,
				projectId,
			});
			setLoadError({
				message: 'Unable to load this file. The file may be corrupted or contain unsupported formatting.',
				filePath: path,
			});
		}
	}, [projectId, documentModel]);

	// Handle file selection from FileBrowser
	const handleFileSelect = useCallback(async (path: string) => {
		setLoadError(null);

		// Check for cached changes - show recovery dialog if found
		if (hasPersistedContent(projectId, path)) {
			setPendingRecovery(path);
			return;
		}

		await loadFileFromServer(path);
	}, [projectId, loadFileFromServer]);

	// Handle file renamed via sidebar double-click
	const handleFileRenamed = useCallback((oldPath: string, newPath: string) => {
		// If the renamed file is the currently open file, update the model
		if (documentModel.filePath === oldPath) {
			migrateLocalStorageContent(projectId, oldPath, newPath);
			saveSelectedFile(projectId, newPath);

			// Update document model with new path and title
			documentModel.filePath = newPath;
			documentModel.title = newPath.split('/').pop() || 'Untitled';
		}
	}, [projectId, documentModel]);

	// Handle restore from recovery dialog
	const handleRestore = useCallback(() => {
		if (!pendingRecovery) return;

		const cached = loadFromLocalStorage(projectId, pendingRecovery);
		if (cached) {
			documentModel.loadDocument(projectId, pendingRecovery, cached, { dirty: true });
			saveSelectedFile(projectId, pendingRecovery);
		}
		setPendingRecovery(null);
	}, [projectId, pendingRecovery, documentModel]);

	// Handle discard from recovery dialog
	const handleDiscard = useCallback(async () => {
		if (!pendingRecovery) return;

		clearLocalStorage(projectId, pendingRecovery);
		await loadFileFromServer(pendingRecovery);
		setPendingRecovery(null);
	}, [projectId, pendingRecovery, loadFileFromServer]);

	// Restore previously selected file on mount
	useEffect(() => {
		if (restoredRef.current) return;
		restoredRef.current = true;

		const savedPath = loadSelectedFile(projectId);
		if (savedPath) {
			handleFileSelect(savedPath);
		}
	}, [projectId, handleFileSelect]);

	// Handle save
	const handleSave = useCallback(async () => {
		if (!documentModel.filePath || !documentModel.projectId) return;
		if (documentModel.saving) return;

		const { projectId: pid, filePath: fpath } = documentModel;
		documentModel.saving = true;
		try {
			const markdown = toMarkdown(documentModel.content);
			await fetchClient.put(
				`/api/projects/${pid}/files?path=${encodeURIComponent(fpath)}`,
				{ content: markdown }
			);
			documentModel.markSaved();
			try {
				clearLocalStorage(pid, fpath);
			} catch (storageErr) {
				console.warn('Failed to clear local draft from localStorage:', storageErr);
			}
		} catch (err) {
			console.error('Failed to save file:', err);
			// Could show error UI here
		} finally {
			documentModel.saving = false;
		}
	}, [documentModel]);

	// Debounced localStorage persistence on content change
	useEffect(() => {
		const { filePath, projectId: pid, content } = documentModel;
		if (!filePath || !pid) return;
		if (!documentModel.isDirty) return;

		// Clear previous timer
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}

		// Save to localStorage after 1 second of inactivity
		// Capture values before setTimeout to avoid stale references
		saveTimerRef.current = setTimeout(() => {
			saveToLocalStorage(pid, filePath, content);
		}, 1000);

		return () => {
			if (saveTimerRef.current) {
				clearTimeout(saveTimerRef.current);
			}
		};
	}, [documentModel.content, documentModel.filePath, documentModel.projectId, documentModel.isDirty]);

	// Keyboard shortcut for save (Ctrl/Cmd+S)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent): void => {
			if ((e.metaKey || e.ctrlKey) && e.key === 's') {
				e.preventDefault();
				handleSave();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [handleSave]);

	// Handle receiving the startNewFile function from FileBrowser
	const handleStartNewFileRef = useCallback((startNewFile: (parentPath: string) => void) => {
		startNewFileRef.current = startNewFile;
	}, []);

	// Handle "New Page" button click from EditorHeader
	const handleNewPage = useCallback(() => {
		if (!startNewFileRef.current) return;

		// Determine target directory:
		// - If a file is open, use its directory
		// - Otherwise, FileBrowser will use first rootPath
		let targetDir: string | undefined;

		if (documentModel.filePath) {
			// Extract directory from current file path
			const lastSlash = documentModel.filePath.lastIndexOf('/');
			if (lastSlash > 0) {
				targetDir = documentModel.filePath.substring(0, lastSlash);
			}
		}

		startNewFileRef.current(targetDir);
		setIsCreatingFile(true);
	}, [documentModel.filePath]);

	// Handle file created callback from FileBrowser
	const handleFileCreated = useCallback(async (path: string) => {
		setIsCreatingFile(false);
		// Select the newly created file
		await handleFileSelect(path);
	}, [handleFileSelect]);

	// Handle file creation cancelled
	const handleCancelNewFile = useCallback(() => {
		setIsCreatingFile(false);
	}, []);

	// Handle receiving the renameFile function from FileBrowser
	const handleRenameFileRef = useCallback((renameFile: (path: string, newFilename: string) => Promise<string>) => {
		renameFileRef.current = renameFile;
	}, []);

	// Handle rename from EditorHeader
	const handleRename = useCallback(async (newFilename: string) => {
		if (!documentModel.filePath || !renameFileRef.current) return;

		const oldPath = documentModel.filePath;
		try {
			const newPath = await renameFileRef.current(oldPath, newFilename);

			migrateLocalStorageContent(projectId, oldPath, newPath);
			saveSelectedFile(projectId, newPath);

			// Update document model with new path and title
			documentModel.filePath = newPath;
			documentModel.title = newPath.split('/').pop() || 'Untitled';
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			captureError(error, {
				type: 'file_rename_error',
				filePath: oldPath,
				newFilename,
				projectId,
			});
			// Show user-friendly error - using alert for simplicity
			// (File operations typically succeed, so a dedicated UI component isn't warranted)
			alert(`Failed to rename file: ${error.message}`);
		}
	}, [projectId, documentModel]);

	return (
		<Page projectId={projectId} activeTab="Pages">
			<div class={styles.body}>
				<FileBrowser
					projectId={projectId}
					selectedPath={documentModel.filePath || undefined}
					onFileSelect={handleFileSelect}
					onFileCreated={handleFileCreated}
					onCancelNewFile={handleCancelNewFile}
					onFileRenamed={handleFileRenamed}
					onStartNewFileRef={handleStartNewFileRef}
					onRenameFileRef={handleRenameFileRef}
					class={styles.sidebar}
				/>
				<main class={styles.main}>
					{loadError ? (
						<div class={styles.errorState}>
							<div class={styles.errorStateContent}>
								<div class={styles.errorStateIcon}>!</div>
								<div class={styles.errorStateTitle}>Unable to load file</div>
								<div class={styles.errorStateMessage}>{loadError.message}</div>
								<div class={styles.errorStateFile}>{loadError.filePath}</div>
								<div class={styles.errorStateActions}>
									<button
										class={styles.errorRetryButton}
										onClick={() => handleFileSelect(loadError.filePath)}
									>
										Try Again
									</button>
									<button
										class={styles.errorDismissButton}
										onClick={() => setLoadError(null)}
									>
										Dismiss
									</button>
								</div>
							</div>
						</div>
					) : isCreatingFile ? (
						<div class={styles.creatingState}>
							<div class={styles.creatingStateContent}>
								<div class={styles.creatingStateIcon}>📝</div>
								<div class={styles.creatingStateTitle}>Creating new file</div>
								<div class={styles.creatingStateHint}>
									Enter a filename in the sidebar to continue
								</div>
							</div>
						</div>
					) : documentModel.filePath ? (
						<>
							<EditorHeader
								title={documentModel.title}
								filePath={documentModel.filePath}
								isDirty={documentModel.isDirty}
								saving={documentModel.saving}
								onSave={handleSave}
								onNewPage={handleNewPage}
								onRename={handleRename}
							/>
							<div class={styles.editorArea}>
								<MarkdownEditor
									model={documentModel}
									comments={mockComments}
									placeholder="Start writing..."
								/>
							</div>
						</>
					) : (
						<div class={styles.emptyState}>
							<div class={styles.emptyStateContent}>
								<div class={styles.emptyStateIcon}>📄</div>
								<div class={styles.emptyStateTitle}>No file selected</div>
								<div class={styles.emptyStateHint}>
									Select a markdown file from the sidebar to start editing
								</div>
							</div>
						</div>
					)}
				</main>
			</div>
			{pendingRecovery && (
				<RecoveryDialog
					filePath={pendingRecovery}
					onRestore={handleRestore}
					onDiscard={handleDiscard}
				/>
			)}
		</Page>
	);
}
