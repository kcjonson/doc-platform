import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import type { JSX } from 'preact';
import styles from './UserMenu.module.css';

export interface UserMenuProps {
	/** User's display name (used to generate initials) */
	displayName: string;
	/** User's email (optional, shown in menu header) */
	email?: string;
	/** Called when Settings is clicked */
	onSettingsClick?: () => void;
	/** Called when Logout is clicked */
	onLogoutClick?: () => void;
	/** Additional CSS class */
	class?: string;
}

function getInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	if (parts.length >= 2) {
		const first = parts[0];
		const last = parts[parts.length - 1];
		return (first?.[0] || '').toUpperCase() + (last?.[0] || '').toUpperCase();
	}
	return (name[0] || '?').toUpperCase();
}

export function UserMenu({
	displayName,
	email,
	onSettingsClick,
	onLogoutClick,
	class: className,
}: UserMenuProps): JSX.Element {
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const initials = getInitials(displayName);

	const handleToggle = useCallback((): void => {
		setIsOpen((prev) => !prev);
	}, []);

	const handleSettingsClick = useCallback((): void => {
		setIsOpen(false);
		onSettingsClick?.();
	}, [onSettingsClick]);

	const handleLogoutClick = useCallback((): void => {
		setIsOpen(false);
		onLogoutClick?.();
	}, [onLogoutClick]);

	// Close menu when clicking outside
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (e: MouseEvent): void => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};

		const handleEscape = (e: KeyboardEvent): void => {
			if (e.key === 'Escape') {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen]);

	return (
		<div class={`${styles.container} ${className || ''}`} ref={menuRef}>
			<button
				type="button"
				class={styles.avatar}
				onClick={handleToggle}
				aria-expanded={isOpen}
				aria-haspopup="menu"
				aria-label={`User menu for ${displayName}`}
			>
				{initials}
			</button>

			{isOpen && (
				<div class={styles.dropdown} role="menu">
					<div class={styles.header}>
						<span class={styles.name}>{displayName}</span>
						{email && <span class={styles.email}>{email}</span>}
					</div>
					<div class={styles.divider} />
					<button
						type="button"
						class={styles.menuItem}
						onClick={handleSettingsClick}
						role="menuitem"
					>
						Settings
					</button>
					<button
						type="button"
						class={styles.menuItem}
						onClick={handleLogoutClick}
						role="menuitem"
					>
						Log out
					</button>
				</div>
			)}
		</div>
	);
}
