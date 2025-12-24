import type { JSX, ComponentChildren } from 'preact';
import styles from './Card.module.css';

export interface CardProps {
	/** Card content */
	children: ComponentChildren;
	/** Card variant */
	variant?: 'default' | 'interactive' | 'selected';
	/** Padding size */
	padding?: 'none' | 'sm' | 'md' | 'lg';
	/** Click handler (makes card interactive) */
	onClick?: (e: MouseEvent) => void;
	/** Additional CSS class */
	class?: string;
	/** Tab index for keyboard navigation */
	tabIndex?: number;
	/** Role attribute */
	role?: JSX.HTMLAttributes<HTMLDivElement>['role'];
}

export function Card({
	children,
	variant = 'default',
	padding = 'md',
	onClick,
	class: className,
	tabIndex,
	role,
}: CardProps): JSX.Element {
	const classes = [
		styles.card,
		styles[variant],
		styles[`padding-${padding}`],
		onClick && styles.clickable,
		className,
	].filter(Boolean).join(' ');

	return (
		<div
			class={classes}
			onClick={onClick}
			tabIndex={tabIndex}
			role={role}
		>
			{children}
		</div>
	);
}
