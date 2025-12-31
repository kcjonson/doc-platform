import type { JSX } from 'preact';
import styles from './form.module.css';

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectProps {
	/** Current selected value (controlled) */
	value: string;
	/** Select options */
	options: SelectOption[];
	/** Label text displayed above the select */
	label?: string;
	/** Error message displayed below the select */
	error?: string;
	/** Called when selection changes */
	onChange?: (e: Event) => void;
	/** Placeholder text (shown when no value selected) */
	placeholder?: string;
	/** Disabled state */
	disabled?: boolean;
	/** CSS classes for the select (e.g., "size-sm") */
	class?: string;
	/** Select name */
	name?: string;
	/** Select id */
	id?: string;
}

export function Select({
	value,
	options,
	label,
	error,
	onChange,
	placeholder,
	disabled = false,
	class: className,
	name,
	id,
}: SelectProps): JSX.Element {
	const fieldClasses = `${styles.field} ${error ? styles.hasError : ''}`;
	const errorClasses = `${styles.error} ${error ? styles.errorVisible : ''}`;

	return (
		<div class={fieldClasses}>
			{label && <label class={styles.label} htmlFor={id}>{label}</label>}
			<select
				class={className || undefined}
				value={value}
				onChange={onChange}
				disabled={disabled}
				name={name}
				id={id}
			>
				{placeholder && (
					<option value="" disabled>
						{placeholder}
					</option>
				)}
				{options.map((option) => (
					<option
						key={option.value}
						value={option.value}
						disabled={option.disabled}
					>
						{option.label}
					</option>
				))}
			</select>
			<span class={errorClasses}>{error || '\u00A0'}</span>
		</div>
	);
}
