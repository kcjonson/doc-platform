import { useState, useEffect, useCallback } from 'preact/hooks';
import type { JSX } from 'preact';
import { fetchClient } from '@doc-platform/fetch';
import { Button, Dialog, Text } from '@doc-platform/ui';
import styles from './UserManagement.module.css';

interface User {
	id: string;
	username: string;
	email: string;
	first_name: string;
	last_name: string;
	email_verified: boolean;
	roles: string[];
	is_active: boolean;
	created_at: string;
	updated_at: string;
	deactivated_at: string | null;
}

interface UsersResponse {
	users: User[];
	total: number;
	limit: number;
	offset: number;
}

const USERS_PER_PAGE = 10;

export function UserManagement(): JSX.Element {
	const [users, setUsers] = useState<User[]>([]);
	const [total, setTotal] = useState(0);
	const [offset, setOffset] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	// Filters
	const [searchInput, setSearchInput] = useState('');
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState('');

	// Dialog state
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [showDialog, setShowDialog] = useState(false);

	const fetchUsers = useCallback(async () => {
		setLoading(true);
		setError(null);

		try {
			const params = new URLSearchParams();
			params.set('limit', String(USERS_PER_PAGE));
			params.set('offset', String(offset));
			if (search) params.set('search', search);
			if (statusFilter) params.set('is_active', statusFilter);

			const response = await fetchClient.get<UsersResponse>(`/api/users?${params}`);
			setUsers(response.users);
			setTotal(response.total);
		} catch (err) {
			setError('Failed to load users');
		} finally {
			setLoading(false);
		}
	}, [offset, search, statusFilter]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	// Debounced search
	useEffect(() => {
		const timer = setTimeout(() => {
			setSearch(searchInput);
			setOffset(0);
		}, 300);
		return () => clearTimeout(timer);
	}, [searchInput]);

	const handleUserClick = (user: User): void => {
		setSelectedUser(user);
		setShowDialog(true);
	};

	const handleSave = async (data: Partial<User>): Promise<void> => {
		if (!selectedUser) return;

		try {
			await fetchClient.put(`/api/users/${selectedUser.id}`, data);
			setMessage({ type: 'success', text: 'User updated successfully' });
			fetchUsers();
			setShowDialog(false);
		} catch (err) {
			setMessage({ type: 'error', text: 'Failed to update user' });
		}
	};

	const formatDate = (dateStr: string): string => {
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	const totalPages = Math.ceil(total / USERS_PER_PAGE);
	const currentPage = Math.floor(offset / USERS_PER_PAGE) + 1;

	return (
		<div class={styles.section}>
			<h2 class={styles.sectionTitle}>User Management</h2>

			{message && (
				<div class={`${styles.message} ${styles[message.type]}`}>
					{message.text}
				</div>
			)}

			<div class={styles.controls}>
				<input
					type="text"
					class={styles.searchInput}
					placeholder="Search users..."
					value={searchInput}
					onInput={(e) => setSearchInput((e.target as HTMLInputElement).value)}
				/>
				<select
					class={styles.filterSelect}
					value={statusFilter}
					onChange={(e) => { setStatusFilter((e.target as HTMLSelectElement).value); setOffset(0); }}
				>
					<option value="">All Status</option>
					<option value="true">Active</option>
					<option value="false">Inactive</option>
				</select>
			</div>

			{error && <div class={styles.error}>{error}</div>}

			{loading ? (
				<div class={styles.loading}>Loading...</div>
			) : users.length === 0 ? (
				<div class={styles.emptyState}>
					{search || statusFilter ? 'No users match your filters' : 'No users found'}
				</div>
			) : (
				<>
					<table class={styles.table}>
						<thead>
							<tr>
								<th>User</th>
								<th>Roles</th>
								<th>Status</th>
								<th>Created</th>
							</tr>
						</thead>
						<tbody>
							{users.map((user) => (
								<tr key={user.id} onClick={() => handleUserClick(user)}>
									<td>
										<div class={styles.userInfo}>
											<span class={styles.userName}>
												{user.first_name} {user.last_name}
											</span>
											<span class={styles.userEmail}>
												@{user.username} &middot; {user.email}
											</span>
										</div>
									</td>
									<td>
										{user.roles.includes('admin') && (
											<span class={`${styles.badge} ${styles.badgeAdmin}`}>Admin</span>
										)}
										{user.roles.length === 0 && (
											<span style="color: var(--color-text-muted)">—</span>
										)}
									</td>
									<td>
										<span class={`${styles.badge} ${user.is_active ? styles.badgeActive : styles.badgeInactive}`}>
											{user.is_active ? 'Active' : 'Inactive'}
										</span>
									</td>
									<td>{formatDate(user.created_at)}</td>
								</tr>
							))}
						</tbody>
					</table>

					{totalPages > 1 && (
						<div class={styles.pagination}>
							<span class={styles.paginationInfo}>
								Page {currentPage} of {totalPages}
							</span>
							<div class={styles.paginationButtons}>
								<Button
									variant="secondary"
									size="small"
									disabled={currentPage <= 1}
									onClick={() => setOffset(Math.max(0, offset - USERS_PER_PAGE))}
								>
									Previous
								</Button>
								<Button
									variant="secondary"
									size="small"
									disabled={currentPage >= totalPages}
									onClick={() => setOffset(offset + USERS_PER_PAGE)}
								>
									Next
								</Button>
							</div>
						</div>
					)}
				</>
			)}

			<Dialog
				open={showDialog && selectedUser !== null}
				onClose={() => { setShowDialog(false); setSelectedUser(null); }}
				title={`Edit: ${selectedUser?.first_name} ${selectedUser?.last_name}`}
				maxWidth="md"
			>
				{selectedUser && (
					<UserEditForm
						user={selectedUser}
						onSave={handleSave}
						onCancel={() => { setShowDialog(false); setSelectedUser(null); }}
					/>
				)}
			</Dialog>
		</div>
	);
}

interface UserEditFormProps {
	user: User;
	onSave: (data: Partial<User>) => Promise<void>;
	onCancel: () => void;
}

function UserEditForm({ user, onSave, onCancel }: UserEditFormProps): JSX.Element {
	const [firstName, setFirstName] = useState(user.first_name);
	const [lastName, setLastName] = useState(user.last_name);
	const [username, setUsername] = useState(user.username);
	const [email, setEmail] = useState(user.email);
	const [isAdmin, setIsAdmin] = useState(user.roles.includes('admin'));
	const [isActive, setIsActive] = useState(user.is_active);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: Event): Promise<void> => {
		e.preventDefault();
		setSaving(true);
		setError(null);

		try {
			await onSave({
				first_name: firstName,
				last_name: lastName,
				username,
				email,
				roles: isAdmin ? ['admin'] : [],
				is_active: isActive,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save');
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} class={styles.form}>
			{error && <div class={styles.formError}>{error}</div>}

			<div class={styles.formRow}>
				<div class={styles.formField}>
					<label class={styles.formLabel}>First Name</label>
					<Text
						value={firstName}
						onInput={(e) => setFirstName((e.target as HTMLInputElement).value)}
					/>
				</div>
				<div class={styles.formField}>
					<label class={styles.formLabel}>Last Name</label>
					<Text
						value={lastName}
						onInput={(e) => setLastName((e.target as HTMLInputElement).value)}
					/>
				</div>
			</div>

			<div class={styles.formField}>
				<label class={styles.formLabel}>Username</label>
				<Text
					value={username}
					onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
				/>
			</div>

			<div class={styles.formField}>
				<label class={styles.formLabel}>Email</label>
				<Text
					value={email}
					onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
					type="email"
				/>
			</div>

			<div class={styles.checkboxRow}>
				<label class={styles.checkbox}>
					<input
						type="checkbox"
						checked={isAdmin}
						onChange={(e) => setIsAdmin((e.target as HTMLInputElement).checked)}
					/>
					<span>Admin Role</span>
				</label>
				<label class={styles.checkbox}>
					<input
						type="checkbox"
						checked={isActive}
						onChange={(e) => setIsActive((e.target as HTMLInputElement).checked)}
					/>
					<span>Active</span>
				</label>
			</div>

			<div class={styles.formActions}>
				<Button variant="secondary" onClick={onCancel} type="button">
					Cancel
				</Button>
				<Button disabled={saving} type="submit">
					{saving ? 'Saving...' : 'Save Changes'}
				</Button>
			</div>
		</form>
	);
}
