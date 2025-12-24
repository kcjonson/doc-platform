import type { JSX, ComponentChildren } from 'preact';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
	/** Button variant */
	variant?: ButtonVariant;
	/** Button size */
	size?: ButtonSize;
	/** Button content */
	children: ComponentChildren;
	/** Click handler */
	onClick?: (e: MouseEvent) => void;
	/** Disabled state */
	disabled?: boolean;
	/** Button type */
	type?: 'button' | 'submit' | 'reset';
	/** Additional CSS class */
	class?: string;
	/** Aria label for icon buttons */
	'aria-label'?: string;
}

export function Button({
	variant = 'primary',
	size = 'md',
	children,
	onClick,
	disabled = false,
	type = 'button',
	class: className,
	'aria-label': ariaLabel,
}: ButtonProps): JSX.Element {
	const classes = [
		styles.button,
		styles[variant],
		styles[size],
		className,
	].filter(Boolean).join(' ');

	return (
		<button
			type={type}
			class={classes}
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
		>
			{children}
		</button>
	);
}
