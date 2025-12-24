import type { JSX } from 'preact';
import styles from './StatusDot.module.css';

export type StatusType = 'ready' | 'in_progress' | 'done' | 'default';

export interface StatusDotProps {
	/** Status type determines color */
	status: StatusType;
	/** Size of the dot */
	size?: 'sm' | 'md' | 'lg';
	/** Additional CSS class */
	class?: string;
}

export function StatusDot({
	status,
	size = 'md',
	class: className,
}: StatusDotProps): JSX.Element {
	const classes = [
		styles.dot,
		styles[status],
		styles[size],
		className,
	].filter(Boolean).join(' ');

	return <span class={classes} aria-hidden="true" />;
}
