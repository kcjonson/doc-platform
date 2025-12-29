import { useState, useEffect, useCallback } from 'preact/hooks';
import type { JSX } from 'preact';
import { fetchClient } from '@doc-platform/fetch';
import { Button } from '@doc-platform/ui';
import styles from './AuthorizedApps.module.css';

interface Authorization {
	id: string;
	client_id: string;
	device_name: string;
	scopes: string[];
	created_at: string;
	last_used_at: string | null;
}

// Friendly names for clients
const CLIENT_NAMES: Record<string, string> = {
	'claude-code': 'Claude Code',
	'doc-platform-cli': 'Doc Platform CLI',
};

// Friendly descriptions for scopes
const SCOPE_LABELS: Record<string, string> = {
	'docs:read': 'Read docs',
	'docs:write': 'Write docs',
	'tasks:read': 'Read tasks',
	'tasks:write': 'Write tasks',
};

function formatRelativeTime(dateString: string | null): string {
	if (!dateString) return 'Never';

	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffMinutes < 1) return 'Just now';
	if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
	if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
	if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

	return date.toLocaleDateString();
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

export function AuthorizedApps(): JSX.Element {
	const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [revoking, setRevoking] = useState<string | null>(null);
	const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

	const fetchAuthorizations = useCallback(async (): Promise<void> => {
		try {
			setLoading(true);
			setError(null);
			const response = await fetchClient.get<{ authorizations: Authorization[] }>('/api/oauth/authorizations');
			setAuthorizations(response.authorizations);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load authorizations');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAuthorizations();
	}, [fetchAuthorizations]);

	const handleRevoke = async (id: string): Promise<void> => {
		try {
			setRevoking(id);
			await fetchClient.delete(`/api/oauth/authorizations/${id}`);
			setAuthorizations(prev => prev.filter(a => a.id !== id));
			setConfirmRevoke(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to revoke authorization');
		} finally {
			setRevoking(null);
		}
	};

	if (loading) {
		return (
			<div class={styles.container}>
				<div class={styles.loading}>Loading authorized apps...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div class={styles.container}>
				<div class={styles.error}>
					{error}
					<Button onClick={fetchAuthorizations} class={styles.retryButton}>
						Retry
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div class={styles.container}>
			<h2 class={styles.title}>Authorized Apps</h2>
			<p class={styles.description}>
				These applications have access to your account. You can revoke access at any time.
			</p>

			{authorizations.length === 0 ? (
				<div class={styles.empty}>
					No applications are currently authorized to access your account.
				</div>
			) : (
				<div class={styles.list}>
					{authorizations.map((auth) => (
						<div key={auth.id} class={styles.item}>
							<div class={styles.itemHeader}>
								<span class={styles.icon}>🤖</span>
								<div class={styles.itemInfo}>
									<div class={styles.clientName}>
										{CLIENT_NAMES[auth.client_id] || auth.client_id}
									</div>
									<div class={styles.deviceName}>{auth.device_name}</div>
								</div>
							</div>

							<div class={styles.itemDetails}>
								<div class={styles.scopes}>
									{auth.scopes.map((scope) => (
										<span key={scope} class={styles.scope}>
											{SCOPE_LABELS[scope] || scope}
										</span>
									))}
								</div>
								<div class={styles.dates}>
									<span>Authorized {formatDate(auth.created_at)}</span>
									<span class={styles.separator}>•</span>
									<span>Last used {formatRelativeTime(auth.last_used_at)}</span>
								</div>
							</div>

							<div class={styles.itemActions}>
								{confirmRevoke === auth.id ? (
									<div class={styles.confirmRevoke}>
										<span class={styles.confirmText}>Revoke access?</span>
										<Button
											onClick={() => handleRevoke(auth.id)}
											class={styles.dangerButton}
											disabled={revoking === auth.id}
										>
											{revoking === auth.id ? 'Revoking...' : 'Yes, Revoke'}
										</Button>
										<Button
											onClick={() => setConfirmRevoke(null)}
											class={styles.ghostButton}
											disabled={revoking === auth.id}
										>
											Cancel
										</Button>
									</div>
								) : (
									<Button
										onClick={() => setConfirmRevoke(auth.id)}
										class={styles.ghostButton}
									>
										Revoke Access
									</Button>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
