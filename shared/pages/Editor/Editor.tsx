import { useMemo, useState, useCallback } from 'preact/hooks';
import type { JSX } from 'preact';
import type { Descendant } from 'slate';
import type { RouteProps } from '@doc-platform/router';
import { navigate } from '@doc-platform/router';
import { AppHeader, type NavTab } from '@doc-platform/ui';
import { useAuth } from '@shared/planning';
import { FileBrowser } from '../FileBrowser/FileBrowser';
import { CommentsPanel } from '../CommentsPanel/CommentsPanel';
import { MarkdownEditor } from '../MarkdownEditor';
import { mockDocument } from '../MarkdownEditor/mock-document';
import styles from './Editor.module.css';

// Format project ID as display name (capitalize first letter)
function formatProjectName(id: string): string {
	return id.charAt(0).toUpperCase() + id.slice(1);
}

export function Editor(props: RouteProps): JSX.Element {
	const projectId = props.params.projectId || 'demo';
	const projectName = formatProjectName(projectId);
	const { user, loading: authLoading, logout } = useAuth();

	// In-memory document state (will be replaced with file loading later)
	const [document, setDocument] = useState<Descendant[]>(mockDocument);

	const handleDocumentChange = useCallback((value: Descendant[]) => {
		setDocument(value);
		// In the future, this will trigger auto-save or mark as dirty
	}, []);

	// Navigation tabs
	const navTabs: NavTab[] = useMemo(() => [
		{ id: 'planning', label: 'Planning', href: `/projects/${projectId}/planning` },
		{ id: 'pages', label: 'Pages', href: `/projects/${projectId}/pages` },
	], [projectId]);

	function handleSettingsClick(): void {
		navigate('/settings');
	}

	async function handleLogoutClick(): Promise<void> {
		await logout();
		window.location.href = '/login';
	}

	if (authLoading) {
		return (
			<div class={styles.container}>
				<div class={styles.editorArea}>
					<div class={styles.placeholder}>Loading...</div>
				</div>
			</div>
		);
	}

	return (
		<div class={styles.container}>
			<AppHeader
				projectName={projectName}
				navTabs={navTabs}
				activeTab="pages"
				user={user ? { displayName: user.displayName, email: user.email } : undefined}
				onSettingsClick={handleSettingsClick}
				onLogoutClick={handleLogoutClick}
			/>
			<div class={styles.body}>
				<FileBrowser class={styles.sidebar} />
				<main class={styles.main}>
					<div class={styles.editorArea}>
						<MarkdownEditor
							initialValue={document}
							onChange={handleDocumentChange}
							placeholder="Start writing..."
						/>
					</div>
				</main>
				<CommentsPanel class={styles.commentsPanel} />
			</div>
		</div>
	);
}
