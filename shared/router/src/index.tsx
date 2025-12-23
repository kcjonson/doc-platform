/**
 * @doc-platform/router
 *
 * Minimal client-side router. Intercepts <a> clicks automatically.
 * View components don't need to know about routing.
 *
 * @example
 * ```tsx
 * import { startRouter } from '@doc-platform/router';
 *
 * const routes = [
 *   { route: '/', entry: HomePage },
 *   { route: '/login', entry: LoginPage },
 *   { route: '/users/:id', entry: UserPage },
 * ];
 *
 * startRouter(routes, document.getElementById('app')!);
 * ```
 */

import { render, type ComponentType } from 'preact';

/**
 * Props passed to route components.
 */
export interface RouteProps {
	params: Record<string, string>;
}

/**
 * Route configuration.
 */
export interface Route {
	route: string;
	entry: ComponentType<RouteProps>;
}

/** Current routes */
let currentRoutes: Route[] = [];

/** Current container */
let currentContainer: Element | null = null;

/**
 * Match a pathname against routes.
 * Returns matched route and extracted params.
 */
function matchRoute(pathname: string): { route: Route; params: Record<string, string> } | null {
	const path = pathname === '/' ? '/' : pathname.replace(/\/$/, '');

	for (const route of currentRoutes) {
		const pattern = route.route === '/' ? '/' : route.route.replace(/\/$/, '');
		const patternParts = pattern.split('/').filter(Boolean);
		const pathParts = path.split('/').filter(Boolean);

		if (patternParts.length !== pathParts.length) continue;

		const params: Record<string, string> = {};
		let matched = true;

		for (let i = 0; i < patternParts.length; i++) {
			const patternPart = patternParts[i] as string;
			const pathPart = pathParts[i] as string;

			if (patternPart.startsWith(':')) {
				params[patternPart.slice(1)] = decodeURIComponent(pathPart);
			} else if (patternPart !== pathPart) {
				matched = false;
				break;
			}
		}

		if (matched) {
			return { route, params };
		}
	}

	return null;
}

/**
 * Render the current route.
 */
function renderCurrentRoute(): void {
	if (!currentContainer) return;

	const match = matchRoute(window.location.pathname);

	if (match) {
		const Component = match.route.entry;
		render(<Component params={match.params} />, currentContainer);
	} else {
		render(<div>Not Found</div>, currentContainer);
	}
}

/**
 * Navigate to a path programmatically.
 *
 * @example
 * ```ts
 * // After form submission
 * navigate('/dashboard');
 * ```
 */
export function navigate(path: string): void {
	if (path !== window.location.pathname) {
		window.history.pushState(null, '', path);
		renderCurrentRoute();
	}
}

/**
 * Start the router.
 * Intercepts <a> clicks and handles browser navigation.
 *
 * @example
 * ```tsx
 * startRouter(routes, document.getElementById('app')!);
 * ```
 */
export function startRouter(routes: Route[], container: Element): void {
	currentRoutes = routes;
	currentContainer = container;

	// Handle browser back/forward
	window.addEventListener('popstate', renderCurrentRoute);

	// Intercept <a> clicks
	document.addEventListener('click', (e) => {
		const target = e.target as Element;
		const anchor = target.closest('a');

		if (!anchor) return;

		const href = anchor.getAttribute('href');
		if (!href) return;

		// Skip external links, hash links, and modified clicks
		if (
			href.startsWith('http') ||
			href.startsWith('//') ||
			href.startsWith('#') ||
			anchor.hasAttribute('download') ||
			anchor.getAttribute('target') === '_blank' ||
			e.metaKey ||
			e.ctrlKey ||
			e.shiftKey ||
			e.altKey
		) {
			return;
		}

		e.preventDefault();
		navigate(href);
	});

	// Initial render
	renderCurrentRoute();
}
