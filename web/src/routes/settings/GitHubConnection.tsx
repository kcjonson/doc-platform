import { useState, useEffect, useRef } from 'preact/hooks';
import type { JSX } from 'preact';
import { Button, Icon } from '@doc-platform/ui';
import { fetchClient } from '@doc-platform/fetch';
import styles from './GitHubConnection.module.css';

interface GitHubConnectionData {
	connected: boolean;
	username?: string;
	scopes?: string[];
	connectedAt?: string;
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

export function GitHubConnection(): JSX.Element {
	const [connection, setConnection] = useState<GitHubConnectionData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [disconnecting, setDisconnecting] = useState(false);
	const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

	// Track mounted state
	const mountedRef = useRef(true);
	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	// Check for URL params (success/error from OAuth callback)
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const githubConnected = params.get('github_connected');
		const githubError = params.get('github_error');

		if (githubConnected || githubError) {
			// Clean up URL
			const url = new URL(window.location.href);
			url.searchParams.delete('github_connected');
			url.searchParams.delete('github_error');
			window.history.replaceState({}, '', url.toString());

			if (githubError) {
				setError(decodeURIComponent(githubError));
			}
		}
	}, []);

	// Load connection status
	useEffect(() => {
		async function loadConnection(): Promise<void> {
			setLoading(true);
			setError(null);
			try {
				const data = await fetchClient.get<GitHubConnectionData>('/api/github/connection');
				if (mountedRef.current) {
					setConnection(data);
				}
			} catch (err: unknown) {
				if (mountedRef.current) {
					const message = err instanceof Error ? err.message : 'Failed to load GitHub connection';
					setError(message);
				}
			} finally {
				if (mountedRef.current) {
					setLoading(false);
				}
			}
		}
		loadConnection();
	}, []);

	const handleConnect = (): void => {
		// Redirect to GitHub OAuth - this will redirect back after auth
		window.location.href = '/api/auth/github';
	};

	const handleDisconnect = async (): Promise<void> => {
		setDisconnecting(true);
		try {
			await fetchClient.delete('/api/auth/github');
			if (mountedRef.current) {
				setConnection({ connected: false });
				setShowDisconnectConfirm(false);
			}
		} catch (err: unknown) {
			if (mountedRef.current) {
				const message = err instanceof Error ? err.message : 'Failed to disconnect';
				setError(message);
			}
		} finally {
			if (mountedRef.current) {
				setDisconnecting(false);
			}
		}
	};

	return (
		<div class={styles.container}>
			<h2 class={styles.title}>Connected Accounts</h2>
			<p class={styles.description}>
				Connect your GitHub account to link repositories to your projects.
			</p>

			{error && (
				<div class={styles.error}>
					{error}
					<Button
						onClick={() => setError(null)}
						class={styles.dismissButton}
					>
						Dismiss
					</Button>
				</div>
			)}

			{loading ? (
				<div class={styles.loading}>Loading...</div>
			) : connection?.connected ? (
				<div class={styles.connectedCard}>
					<div class={styles.accountInfo}>
						<span class={styles.icon}><Icon name="github" class="size-lg" /></span>
						<div class={styles.details}>
							<div class={styles.provider}>GitHub</div>
							<div class={styles.username}>@{connection.username}</div>
							{connection.connectedAt && (
								<div class={styles.connectedDate}>
									Connected {formatDate(connection.connectedAt)}
								</div>
							)}
						</div>
					</div>

					{showDisconnectConfirm ? (
						<div class={styles.confirmActions}>
							<span class={styles.confirmText}>Disconnect GitHub?</span>
							<Button
								onClick={handleDisconnect}
								class={styles.dangerButton}
								disabled={disconnecting}
							>
								{disconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
							</Button>
							<Button
								onClick={() => setShowDisconnectConfirm(false)}
								class={styles.ghostButton}
								disabled={disconnecting}
							>
								Cancel
							</Button>
						</div>
					) : (
						<Button
							onClick={() => setShowDisconnectConfirm(true)}
							class={styles.ghostButton}
						>
							Disconnect
						</Button>
					)}
				</div>
			) : (
				<div class={styles.disconnectedCard}>
					<div class={styles.accountInfo}>
						<span class={styles.icon}><Icon name="github" class="size-lg" /></span>
						<div class={styles.details}>
							<div class={styles.provider}>GitHub</div>
							<div class={styles.notConnected}>Not connected</div>
						</div>
					</div>
					<Button
						onClick={handleConnect}
						class={styles.primaryButton}
					>
						Connect GitHub
					</Button>
				</div>
			)}
		</div>
	);
}
