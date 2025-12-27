import type { JSX } from 'preact';

export type SelectSize = 'sm' | 'md' | 'lg';

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
	/** Called when selection changes */
	onChange?: (e: Event) => void;
	/** Placeholder text (shown when no value selected) */
	placeholder?: string;
	/** Disabled state */
	disabled?: boolean;
	/** Size */
	size?: SelectSize;
	/** Error state */
	error?: boolean;
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
	size = 'md',
	error = false,
	class: className,
	name,
	id,
}: SelectProps): JSX.Element {
	const classes = [
		size !== 'md' ? `size-${size}` : '',
		error ? 'error' : '',
		className || '',
	]
		.filter(Boolean)
		.join(' ');

	return (
		<select
			class={classes || undefined}
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
