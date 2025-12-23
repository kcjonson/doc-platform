import type { JSX } from 'preact';
import type { RouteProps } from '@doc-platform/router';

export function EpicDetail({ params }: RouteProps): JSX.Element {
	return (
		<div>
			<h1>Epic {params.id}</h1>
			<p>Epic detail view will be implemented here.</p>
			<nav>
				<a href="/">Back to Board</a>
			</nav>
		</div>
	);
}
