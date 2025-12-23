import type { JSX } from 'preact';
import type { RouteProps } from '@doc-platform/router';

export function Board(_props: RouteProps): JSX.Element {
	return (
		<div>
			<h1>Planning Board</h1>
			<p>Three-column kanban board will be implemented here.</p>
			<nav>
				<a href="/epics/1">View Epic 1</a>
			</nav>
		</div>
	);
}
