import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { Badge, Button, Icon, Notice } from '@doc-platform/ui';
import type { GitStatusModel } from '@doc-platform/models';
import { CommitErrorBanner } from './CommitErrorBanner';
import { CommitDialog } from './CommitDialog';
import styles from './GitStatusBar.module.css';

export interface GitStatusBarProps {
	gitStatus: GitStatusModel;
}

export function GitStatusBar({ gitStatus }: GitStatusBarProps): JSX.Element {
	const [showCommitDialog, setShowCommitDialog] = useState(false);

	const handlePull = async (): Promise<void> => {
		await gitStatus.pull();
	};

	const handleCommit = async (message?: string): Promise<void> => {
		await gitStatus.commit(message);

		// Close dialog on success
		if (!gitStatus.commitError) {
			setShowCommitDialog(false);
		}
	};

	const handleRetry = (): void => {
		setShowCommitDialog(true);
	};

	const handleDismiss = (): void => {
		gitStatus.clearErrors();
	};

	return (
		<div class={styles.container}>
			{/* Error banners */}
			{gitStatus.pullError && (
				<Notice variant="error" class={styles.errorNotice}>
					<span class={styles.errorText}>{gitStatus.pullError}</span>
					<Button onClick={handleDismiss} class="icon" aria-label="Dismiss error">
						<Icon name="x" class="size-sm" />
					</Button>
				</Notice>
			)}
			{gitStatus.commitError && (
				<CommitErrorBanner
					error={gitStatus.commitError}
					onRetry={handleRetry}
					onDismiss={handleDismiss}
				/>
			)}

			{/* Main bar */}
			<div class={styles.bar}>
				{/* Left: branch info */}
				<div class={styles.branchInfo}>
					<Icon name="git-branch" class="size-sm" />
					<span class={styles.branchName}>{gitStatus.branch || 'main'}</span>
				</div>

				{/* Right: actions */}
				<div class={styles.actions}>
					{/* Pull button with behind badge */}
					{gitStatus.behind > 0 && (
						<Badge class="variant-primary" title={`${gitStatus.behind} commits behind`}>
							{gitStatus.behind}
						</Badge>
					)}
					<Button
						onClick={handlePull}
						class="icon"
						disabled={gitStatus.pulling}
						aria-label={gitStatus.pulling ? 'Pulling...' : 'Pull latest'}
						title={gitStatus.pulling ? 'Pulling...' : 'Pull latest'}
					>
						<Icon name="download" />
					</Button>

					{/* Commit button - always visible, disabled when no changes */}
					<Button
						onClick={() => setShowCommitDialog(true)}
						class="icon"
						disabled={gitStatus.committing || !gitStatus.hasAnyChanges}
						aria-label="Commit changes"
						title={gitStatus.hasAnyChanges ? 'Commit changes' : 'No changes to commit'}
					>
						<Icon name="git-commit" />
					</Button>
				</div>
			</div>

			{/* Commit dialog */}
			<CommitDialog
				open={showCommitDialog}
				gitStatus={gitStatus}
				onClose={() => setShowCommitDialog(false)}
				onCommit={handleCommit}
			/>
		</div>
	);
}
