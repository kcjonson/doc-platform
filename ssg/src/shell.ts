/**
 * HTML document shell for SSG pages
 * Uses template literal - Preact only renders body content
 */

export interface PageOptions {
	title: string;
	description?: string;
	cssFiles: string[];
	body: string;
	scripts?: string;
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Render a complete HTML document
 */
export function renderDocument(options: PageOptions): string {
	const { title, description, cssFiles, body, scripts } = options;

	const cssLinks = cssFiles
		.map(href => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
		.join('\n\t');

	const metaDesc = description
		? `<meta name="description" content="${escapeHtml(description)}">`
		: '';

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	${metaDesc}
	<title>${escapeHtml(title)}</title>
	${cssLinks}
</head>
<body>
	${body}
	${scripts ? `<script>${scripts}</script>` : ''}
</body>
</html>`;
}
