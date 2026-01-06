/**
 * Convert markdown string to Slate AST
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkToSlate } from 'remark-slate-transformer';
import type { Descendant } from 'slate';
import type { CustomElement } from '../types';

// Default empty document
const EMPTY_DOCUMENT: Descendant[] = [
	{ type: 'paragraph', children: [{ text: '' }] }
];

// Node types that are not yet supported - skip silently
const UNSUPPORTED_TYPES = new Set([
	'image',
	'imageReference',
	'footnote',
	'footnoteReference',
	'footnoteDefinition',
]);

/**
 * Map remark-slate node types to our custom types.
 * remark-slate uses slightly different names for some elements.
 * Returns null for unsupported types (will be filtered out).
 */
function normalizeNodeType(node: Record<string, unknown>): CustomElement | null {
	const type = node.type as string;

	// Skip unsupported types silently
	if (UNSUPPORTED_TYPES.has(type)) {
		return null;
	}

	// Get children - we'll set this on the result
	const children = node.children as Descendant[] | undefined;

	// Map remark-slate types to our custom types
	// IMPORTANT: Only include properties we need - don't spread node
	// as it contains remark-slate specific props that confuse Slate
	switch (type) {
		case 'p':
		case 'paragraph':
			return { type: 'paragraph', children: children || [] } as CustomElement;

		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6': {
			const level = parseInt(type.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
			return { type: 'heading', level, children: children || [] } as CustomElement;
		}

		case 'heading': {
			// remark-slate uses 'depth', we use 'level'
			const depth = (node.depth as number) || 1;
			return { type: 'heading', level: depth, children: children || [] } as CustomElement;
		}

		case 'blockquote':
			return { type: 'blockquote', children: children || [] } as CustomElement;

		case 'code':
		case 'code_block':
		case 'code-block': {
			const language = (node.lang as string) || undefined;
			return { type: 'code-block', language, children: children || [] } as CustomElement;
		}

		case 'ul':
		case 'unordered_list':
			return { type: 'bulleted-list', children: children || [] } as CustomElement;

		case 'ol':
		case 'ordered_list':
			return { type: 'numbered-list', children: children || [] } as CustomElement;

		case 'list': {
			// remark-slate outputs 'list' with 'ordered' property
			const ordered = node.ordered as boolean;
			return { type: ordered ? 'numbered-list' : 'bulleted-list', children: children || [] } as CustomElement;
		}

		case 'li':
		case 'list_item':
		case 'listItem':
			return { type: 'list-item', children: children || [] } as CustomElement;

		case 'lic':
			// List item content - unwrap and return children as paragraph
			return { type: 'paragraph', children: children || [] } as CustomElement;

		case 'a':
		case 'link': {
			const url = (node.url as string) || (node.href as string) || '';
			return { type: 'link', url, children: children || [] } as CustomElement;
		}

		case 'hr':
		case 'thematicBreak':
		case 'thematic-break':
			return { type: 'thematic-break', children: [{ text: '' }] } as CustomElement;

		case 'table':
			return { type: 'table', children: children || [] } as CustomElement;

		case 'tableRow':
		case 'tr':
			return { type: 'table-row', children: children || [] } as CustomElement;

		case 'tableCell':
		case 'td':
		case 'th': {
			const header = type === 'th' || (node.header as boolean) || false;
			return { type: 'table-cell', header, children: children || [] } as CustomElement;
		}

		default:
			// Unknown type - wrap in paragraph
			console.warn(`Unknown node type: ${type}, converting to paragraph`);
			return { type: 'paragraph', children: children || [] } as CustomElement;
	}
}

/**
 * Normalize text marks from remark-slate format to our format.
 * remark-slate may use different property names.
 */
function normalizeMarks(node: Record<string, unknown>): Record<string, unknown> {
	const result = { ...node };

	// Map strong -> bold
	if (result.strong) {
		result.bold = true;
		delete result.strong;
	}

	// Map emphasis -> italic
	if (result.emphasis) {
		result.italic = true;
		delete result.emphasis;
	}

	// Map inlineCode -> code
	if (result.inlineCode) {
		result.code = true;
		delete result.inlineCode;
	}

	// Map delete -> strikethrough
	if (result.delete) {
		result.strikethrough = true;
		delete result.delete;
	}

	return result;
}

/**
 * Check if all children are text nodes (no block elements).
 */
function hasOnlyTextChildren(children: unknown[]): boolean {
	return children.every(child => {
		const c = child as Record<string, unknown>;
		return typeof c.text === 'string';
	});
}

/**
 * Recursively normalize a Slate tree from remark-slate output.
 */
function normalizeTree(nodes: unknown[]): Descendant[] {
	const results: Descendant[] = [];

	for (const node of nodes) {
		const n = node as Record<string, unknown>;

		// Text node
		if (typeof n.text === 'string') {
			results.push(normalizeMarks(n) as Descendant);
			continue;
		}

		// Element node - normalize type and recurse into children
		const normalized = normalizeNodeType(n);

		// Skip unsupported types (returned as null)
		if (normalized === null) {
			continue;
		}

		if (Array.isArray(normalized.children)) {
			// Table cells need their text content wrapped in paragraphs
			// because Slate expects block elements inside cells for proper selection
			if (normalized.type === 'table-cell' && hasOnlyTextChildren(normalized.children)) {
				normalized.children = [{
					type: 'paragraph',
					children: normalizeTree(normalized.children),
				}] as Descendant[];
			} else {
				normalized.children = normalizeTree(normalized.children);
			}
		}

		results.push(normalized as Descendant);
	}

	return results;
}

/**
 * Parse markdown string to Slate AST.
 *
 * @param markdown - The markdown string to parse
 * @returns Slate Descendant[] array
 */
export function fromMarkdown(markdown: string): Descendant[] {
	if (!markdown || markdown.trim() === '') {
		return EMPTY_DOCUMENT;
	}

	try {
		const processor = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkToSlate);

		const result = processor.processSync(markdown);
		const slateNodes = result.result as unknown[];

		// Normalize the output to match our custom types
		const normalized = normalizeTree(slateNodes);

		// Ensure we have at least one node
		if (normalized.length === 0) {
			return EMPTY_DOCUMENT;
		}

		return normalized;
	} catch (error) {
		console.error('Failed to parse markdown:', error);
		return EMPTY_DOCUMENT;
	}
}
