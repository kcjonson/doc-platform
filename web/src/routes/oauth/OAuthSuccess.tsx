import { useEffect, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { RouteProps } from '@doc-platform/router';
import { Icon } from '@doc-platform/ui';
import styles from './OAuthSuccess.module.css';

export function OAuthSuccess(_props: RouteProps): JSX.Element {
	const [redirecting, setRedirecting] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Get the redirect URL from query params
		const params = new URLSearchParams(window.location.search);
		const redirectTo = params.get('redirect_to');

		if (!redirectTo) {
			setError('Missing redirect URL');
			setRedirecting(false);
			return;
		}

		// Validate it's a localhost URL (security: only allow redirects to localhost)
		try {
			const url = new URL(redirectTo);
			if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
				setError('Invalid redirect URL');
				setRedirecting(false);
				return;
			}
		} catch {
			setError('Invalid redirect URL');
			setRedirecting(false);
			return;
		}

		// Small delay so user sees the success message, then redirect
		const timer = setTimeout(() => {
			window.location.href = redirectTo;
		}, 800);

		return () => clearTimeout(timer);
	}, []);

	return (
		<div class={styles.container}>
			<div class={styles.card}>
				{error ? (
					<>
						<div class={styles.iconError}>
							<Icon name="x" class="size-3xl" />
						</div>
						<h1 class={styles.title}>Authorization Failed</h1>
						<p class={styles.message}>{error}</p>
					</>
				) : (
					<>
						<div class={styles.iconSuccess}>
							<Icon name="check" class="size-3xl" />
						</div>
						<h1 class={styles.title}>Authorization Successful!</h1>
						<p class={styles.message}>
							{redirecting
								? 'Completing authentication...'
								: 'You can close this tab and return to the application.'}
						</p>
						{redirecting && <div class={styles.spinner} />}
					</>
				)}
			</div>
		</div>
	);
}
