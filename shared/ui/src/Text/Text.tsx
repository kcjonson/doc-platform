import type { JSX } from 'preact';
import styles from './Text.module.css';

export interface TextProps {
	/** Input value */
	value?: string;
	/** Default value for uncontrolled input */
	defaultValue?: string;
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
	/** Error state */
	error?: boolean;
	/** Input size */
	size?: 'sm' | 'md' | 'lg';
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
	defaultValue,
	type = 'text',
	placeholder,
	onInput,
	onKeyDown,
	onBlur,
	onFocus,
	disabled = false,
	readOnly = false,
	error = false,
	size = 'md',
	class: className,
	name,
	id,
	autoFocus,
	autoComplete,
}: TextProps): JSX.Element {
	const classes = [
		styles.text,
		styles[size],
		error && styles.error,
		className,
	].filter(Boolean).join(' ');

	return (
		<input
			type={type}
			class={classes}
			value={value}
			defaultValue={defaultValue}
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
