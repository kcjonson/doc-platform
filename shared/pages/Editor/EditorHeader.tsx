import type { JSX } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Button } from '@doc-platform/ui';
import styles from './EditorHeader.module.css';

export interface EditorHeaderProps {
	/** Document title (usually filename) */
	title: string;
	/** File path being edited (null if no file loaded) */
	filePath: string | null;
	/** Whether the document has unsaved changes */
	isDirty: boolean;
	/** Whether a save operation is in progress */
	saving: boolean;
	/** Callback to save the document */
	onSave: () => void;
	/** Callback to create a new page */
	onNewPage?: () => void;
	/** Callback to rename the current file */
	onRename?: (newFilename: string) => void;
}

export function EditorHeader({
	title,
	filePath,
	isDirty,
	saving,
	onSave,
	onNewPage,
	onRename,
}: EditorHeaderProps): JSX.Element {
	const [isEditing, setIsEditing] = useState(false);
	const [editTitle, setEditTitle] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	// Focus and select input when editing starts
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			// Select filename without extension
			const dotIndex = title.lastIndexOf('.');
			if (dotIndex > 0) {
				inputRef.current.setSelectionRange(0, dotIndex);
			} else {
				inputRef.current.select();
			}
		}
		// Only run when isEditing changes, not on every keystroke
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isEditing]);

	const handleStartEditing = (): void => {
		if (!filePath || !onRename) return;
		setEditTitle(title);
		setIsEditing(true);
	};

	const handleSubmit = (): void => {
		const trimmed = editTitle.trim();
		if (trimmed && trimmed !== title && onRename) {
			onRename(trimmed);
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: KeyboardEvent): void => {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			setIsEditing(false);
		}
	};

	const handleBlur = (): void => {
		// Small delay to allow click events to fire first
		setTimeout(() => {
			if (isEditing) {
				handleSubmit();
			}
		}, 100);
	};

	return (
		<div class={styles.header}>
			<div class={styles.titleArea}>
				{isEditing ? (
					<input
						ref={inputRef}
						type="text"
						class={styles.titleInput}
						value={editTitle}
						onInput={(e) => setEditTitle((e.target as HTMLInputElement).value)}
						onKeyDown={handleKeyDown}
						onBlur={handleBlur}
					/>
				) : (
					<>
						<span class={styles.title}>{title}</span>
						{filePath && onRename && (
							<button
								class={styles.editButton}
								onClick={handleStartEditing}
								title="Rename file"
								aria-label="Rename file"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
									<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
								</svg>
							</button>
						)}
					</>
				)}
				{isDirty && !isEditing && <span class={styles.dirtyIndicator} title="Unsaved changes">*</span>}
			</div>
			<div class={styles.actions}>
				{onNewPage && (
					<Button
						onClick={onNewPage}
						variant="secondary"
					>
						New Page
					</Button>
				)}
				{filePath && (
					<Button
						onClick={onSave}
						disabled={!isDirty || saving}
						variant={isDirty ? 'primary' : 'secondary'}
					>
						{saving ? 'Saving...' : 'Save'}
					</Button>
				)}
			</div>
		</div>
	);
}
