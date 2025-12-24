import type { JSX } from 'preact';
import styles from './Select.module.css';

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface SelectProps {
	/** Current selected value */
	value?: string;
	/** Select options */
	options: SelectOption[];
	/** Called when selection changes */
	onChange?: (e: Event) => void;
	/** Placeholder text (shown when no value selected) */
	placeholder?: string;
	/** Disabled state */
	disabled?: boolean;
	/** Error state */
	error?: boolean;
	/** Select size */
	size?: 'sm' | 'md' | 'lg';
	/** Additional CSS class */
	class?: string;
	/** Select name */
	name?: string;
	/** Select id */
	id?: string;
}

export function Select({
	value,
	options,
	onChange,
	placeholder,
	disabled = false,
	error = false,
	size = 'md',
	class: className,
	name,
	id,
}: SelectProps): JSX.Element {
	const classes = [
		styles.select,
		styles[size],
		error && styles.error,
		className,
	].filter(Boolean).join(' ');

	return (
		<select
			class={classes}
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
	);
}
