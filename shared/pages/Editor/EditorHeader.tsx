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
}

export function EditorHeader({
	title,
	filePath,
	isDirty,
	saving,
	onSave,
}: EditorHeaderProps): JSX.Element {
	return (
		<div class={styles.header}>
			<div class={styles.titleArea}>
				<span class={styles.title}>{title}</span>
				{isDirty && <span class={styles.dirtyIndicator} title="Unsaved changes">*</span>}
			</div>
			{filePath && (
				<div class={styles.actions}>
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
