/**
 * 404 Not Found page content component
 */

export function NotFoundContent(): preact.JSX.Element {
	return (
		<div class="not-found-container">
			<h1>You appear to be lost...</h1>
			<p>
				The page you're looking for doesn't exist or may have been moved.
				Don't worry, it happens to the best of us.
			</p>
			<a href="/">Take me home</a>
		</div>
	);
}
