import type { JSX } from 'preact';
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
	/** ID of linked epic (if this document has one) */
	linkedEpicId?: string;
	/** Whether epic creation is in progress */
	creatingEpic?: boolean;
	/** Callback to create an epic from this document */
	onCreateEpic?: () => void;
	/** Callback to view the linked epic */
	onViewEpic?: () => void;
}

/** Check if file path is a markdown file */
function isMarkdownFile(filePath: string | null): boolean {
	if (!filePath) return false;
	return filePath.endsWith('.md') || filePath.endsWith('.markdown');
}

export function EditorHeader({
	title,
	filePath,
	isDirty,
	saving,
	onSave,
	linkedEpicId,
	creatingEpic,
	onCreateEpic,
	onViewEpic,
}: EditorHeaderProps): JSX.Element {
	const showEpicButton = isMarkdownFile(filePath);

	return (
		<div class={styles.header}>
			<div class={styles.titleArea}>
				<span class={styles.title}>{title}</span>
				{isDirty && <span class={styles.dirtyIndicator} title="Unsaved changes">*</span>}
			</div>
			{filePath && (
				<div class={styles.actions}>
					{showEpicButton && linkedEpicId && onViewEpic && (
						<Button onClick={onViewEpic} variant="secondary">
							View Epic
						</Button>
					)}
					{showEpicButton && !linkedEpicId && onCreateEpic && (
						<Button
							onClick={onCreateEpic}
							variant="secondary"
							disabled={creatingEpic}
						>
							{creatingEpic ? 'Creating...' : 'Create Epic'}
						</Button>
					)}
					<Button
						onClick={onSave}
						disabled={!isDirty || saving}
						variant={isDirty ? 'primary' : 'secondary'}
					>
						{saving ? 'Saving...' : 'Save'}
					</Button>
				</div>
			)}
		</div>
	);
}
