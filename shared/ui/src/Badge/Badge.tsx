import type { JSX, ComponentChildren } from 'preact';
import styles from './Badge.module.css';

export interface BadgeProps {
	/** Badge content */
	children: ComponentChildren;
	/** Badge variant */
	variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
	/** Badge size */
	size?: 'sm' | 'md';
	/** Additional CSS class */
	class?: string;
}

export function Badge({
	children,
	variant = 'default',
	size = 'md',
	class: className,
}: BadgeProps): JSX.Element {
	const classes = [
		styles.badge,
		styles[variant],
		styles[size],
		className,
	].filter(Boolean).join(' ');

	return (
		<span class={classes}>
			{children}
		</span>
	);
}
