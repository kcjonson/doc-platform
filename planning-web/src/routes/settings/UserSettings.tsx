import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { RouteProps } from '@doc-platform/router';
import { Button, Text } from '@doc-platform/ui';
import styles from './UserSettings.module.css';

// TODO: Replace with actual user data from API/context when auth is implemented
const mockUser = {
	displayName: 'John Doe',
	email: 'john@example.com',
};

export function UserSettings(_props: RouteProps): JSX.Element {
	const [displayName, setDisplayName] = useState(mockUser.displayName);
	const [email] = useState(mockUser.email);
	const [isSaving, setIsSaving] = useState(false);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	const handleSave = async (): Promise<void> => {
		setIsSaving(true);
		setMessage(null);

		// TODO: Implement actual API call
		await new Promise((resolve) => setTimeout(resolve, 500));

		setIsSaving(false);
		setMessage({ type: 'success', text: 'Settings saved successfully' });
	};

	return (
		<div class={styles.container}>
			<div class={styles.content}>
				<nav class={styles.nav}>
					<a href="/" class={styles.backLink}>
						← Back to Board
					</a>
				</nav>

				<div class={styles.card}>
					<h1 class={styles.title}>User Settings</h1>

					{message && (
						<div class={`${styles.message} ${styles[message.type]}`}>
							{message.text}
						</div>
					)}

					<div class={styles.form}>
						<div class={styles.field}>
							<label class={styles.label} htmlFor="displayName">
								Display Name
							</label>
							<Text
								id="displayName"
								value={displayName}
								onInput={(e) => setDisplayName((e.target as HTMLInputElement).value)}
								placeholder="Enter your display name"
							/>
						</div>

						<div class={styles.field}>
							<label class={styles.label} htmlFor="email">
								Email
							</label>
							<Text
								id="email"
								value={email}
								disabled
								placeholder="Your email address"
							/>
							<span class={styles.hint}>Email cannot be changed</span>
						</div>

						<div class={styles.actions}>
							<Button onClick={handleSave} disabled={isSaving}>
								{isSaving ? 'Saving...' : 'Save Changes'}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
