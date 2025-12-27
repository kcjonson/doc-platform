import type { JSX } from 'preact';

export type TextareaSize = 'sm' | 'md' | 'lg';

export interface TextareaProps {
	/** Textarea value (controlled) */
	value: string;
	/** Placeholder text */
	placeholder?: string;
	/** Number of visible rows */
	rows?: number;
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
	size?: TextareaSize;
	/** Error state */
	error?: boolean;
	/** Resize behavior */
	resize?: 'none' | 'vertical' | 'horizontal' | 'both';
	/** Additional CSS class */
	class?: string;
	/** Textarea name */
	name?: string;
	/** Textarea id */
	id?: string;
	/** Autofocus */
	autoFocus?: boolean;
}

export function Textarea({
	value,
	placeholder,
	rows = 3,
	onInput,
	onKeyDown,
	onBlur,
	onFocus,
	disabled = false,
	readOnly = false,
	size = 'md',
	error = false,
	resize = 'vertical',
	class: className,
	name,
	id,
	autoFocus,
}: TextareaProps): JSX.Element {
	const classes = [
		size !== 'md' ? `size-${size}` : '',
		error ? 'error' : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<textarea
			class={classes || undefined}
			value={value}
			placeholder={placeholder}
			rows={rows}
			onInput={onInput}
			onKeyDown={onKeyDown}
			onBlur={onBlur}
			onFocus={onFocus}
			disabled={disabled}
			readOnly={readOnly}
			name={name}
			id={id}
			autoFocus={autoFocus}
			style={{ resize }}
		/>
	);
}
