import type { JSX } from 'preact';
import styles from './form.module.css';

export interface TextareaProps {
	/** Textarea value (controlled) */
	value: string;
	/** Label text displayed above the textarea */
	label?: string;
	/** Error message displayed below the textarea */
	error?: string;
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
	/** Resize behavior */
	resize?: 'none' | 'vertical' | 'horizontal' | 'both';
	/** CSS classes for the textarea (e.g., "size-sm") */
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
	label,
	error,
	placeholder,
	rows = 3,
	onInput,
	onKeyDown,
	onBlur,
	onFocus,
	disabled = false,
	readOnly = false,
	resize = 'vertical',
	class: className,
	name,
	id,
	autoFocus,
}: TextareaProps): JSX.Element {
	const fieldClasses = `${styles.field} ${error ? styles.hasError : ''}`;
	const errorClasses = `${styles.error} ${error ? styles.errorVisible : ''}`;

	return (
		<div class={fieldClasses}>
			{label && <label class={styles.label} htmlFor={id}>{label}</label>}
			<textarea
				class={className || undefined}
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
			<span class={errorClasses}>{error || '\u00A0'}</span>
		</div>
	);
}
