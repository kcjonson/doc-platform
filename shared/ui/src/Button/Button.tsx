import type { JSX, ComponentChildren } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
	/** Button content */
	children: ComponentChildren;
	/** Click handler */
	onClick?: (e: MouseEvent) => void;
	/** Disabled state */
	disabled?: boolean;
	/** Button type */
	type?: 'button' | 'submit' | 'reset';
	/** Visual variant */
	variant?: ButtonVariant;
	/** Size */
	size?: ButtonSize;
	/** Additional CSS class */
	class?: string;
	/** Aria label for icon buttons */
	'aria-label'?: string;
}

export function Button({
	children,
	onClick,
	disabled = false,
	type = 'button',
	variant = 'primary',
	size = 'md',
	class: className,
	'aria-label': ariaLabel,
}: ButtonProps): JSX.Element {
	const classes = [
		variant !== 'primary' ? variant : '',
		size !== 'md' ? `size-${size}` : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<button
			type={type}
			class={classes || undefined}
			onClick={onClick}
			disabled={disabled}
			aria-label={ariaLabel}
		>
			{children}
		</button>
	);
}
