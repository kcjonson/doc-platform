import type { JSX } from 'preact';

export type TextSize = 'sm' | 'md' | 'lg';

export interface TextProps {
	/** Input value (controlled) */
	value: string;
	/** Input type */
	type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
	/** Placeholder text */
	placeholder?: string;
	/** Called when value changes */
	onInput?: (e: Event) => void;
	/** Called on key down */
	onKeyDown?: (e: KeyboardEvent) => void;
	/** Called on blur */
	onBlur?: (e: FocusEvent) => void;
	/** Called on focus */
	onFocus?: (e: FocusEvent) => void;
	/** Disabled state */
	disabled?: boolean;
	/** Read-only state */
	readOnly?: boolean;
	/** Size */
	size?: TextSize;
	/** Error state */
	error?: boolean;
	/** Additional CSS class */
	class?: string;
	/** Input name */
	name?: string;
	/** Input id */
	id?: string;
	/** Autofocus */
	autoFocus?: boolean;
	/** Autocomplete */
	autoComplete?: string;
}

export function Text({
	value,
	type = 'text',
	placeholder,
	onInput,
	onKeyDown,
	onBlur,
	onFocus,
	disabled = false,
	readOnly = false,
	size = 'md',
	error = false,
	class: className,
	name,
	id,
	autoFocus,
	autoComplete,
}: TextProps): JSX.Element {
	const classes = [
		size !== 'md' ? `size-${size}` : '',
		error ? 'error' : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<input
			type={type}
			class={classes || undefined}
			value={value}
			placeholder={placeholder}
			onInput={onInput}
			onKeyDown={onKeyDown}
			onBlur={onBlur}
			onFocus={onFocus}
			disabled={disabled}
			readOnly={readOnly}
			name={name}
			id={id}
			autoFocus={autoFocus}
			autoComplete={autoComplete}
		/>
	);
}
