/**
 * Logout page content component
 * Shows a brief message while logging out, then redirects to login
 */
import type { JSX } from 'preact';

export function LogoutContent(): JSX.Element {
	return (
		<div class="logout-container">
			<h1>Signing out...</h1>
			<p id="status">Please wait while we sign you out.</p>
		</div>
	);
}

export const logoutScript = `(function() {
	var statusEl = document.getElementById('status');

	fetch('/api/auth/logout', {
		method: 'POST',
		credentials: 'same-origin'
	})
	.then(function() {
		statusEl.textContent = 'You have been signed out. Redirecting...';
		window.location.href = '/login';
	})
	.catch(function() {
		statusEl.textContent = 'An error occurred. Redirecting to login...';
		// Redirect anyway - the session may be invalid
		setTimeout(function() {
			window.location.href = '/login';
		}, 1000);
	});
})();`;
