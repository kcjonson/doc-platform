/**
 * Convert Slate AST to markdown string
 *
 * This module builds an mdast tree directly from Slate nodes,
 * then uses remark-stringify to produce markdown.
 */

import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import type { Descendant } from 'slate';
import type { Root, RootContent, PhrasingContent, TableContent, RowContent } from 'mdast';
import type { CustomElement, CustomText } from '../types';

/**
 * Convert a Slate text node to mdast phrasing content.
 */
function textToMdast(node: CustomText): PhrasingContent {
	let result: PhrasingContent = { type: 'text', value: node.text };

	// Apply marks by wrapping in appropriate mdast nodes
	if (node.code) {
		result = { type: 'inlineCode', value: node.text };
	} else {
		if (node.bold) {
			result = { type: 'strong', children: [result] };
		}
		if (node.italic) {
			result = { type: 'emphasis', children: [result] };
		}
		if (node.strikethrough) {
			result = { type: 'delete', children: [result] };
		}
	}

	return result;
}

/**
 * Convert Slate children to mdast phrasing content (inline nodes).
 */
function childrenToPhrasingContent(children: Descendant[]): PhrasingContent[] {
	return children.flatMap((child): PhrasingContent[] => {
		if ('text' in child) {
			return [textToMdast(child as CustomText)];
		}
		// Handle inline elements like links
		const element = child as CustomElement;
		if (element.type === 'link') {
			return [{
				type: 'link',
				url: element.url,
				children: childrenToPhrasingContent(element.children),
			}];
		}
		// Other inline elements - just extract their text
		return childrenToPhrasingContent(element.children);
	});
}

/**
 * Convert a Slate element to mdast root content.
 */
function elementToMdast(element: CustomElement): RootContent | null {
	switch (element.type) {
		case 'paragraph':
			return {
				type: 'paragraph',
				children: childrenToPhrasingContent(element.children),
			};

		case 'heading':
			return {
				type: 'heading',
				depth: element.level as 1 | 2 | 3 | 4 | 5 | 6,
				children: childrenToPhrasingContent(element.children),
			};

		case 'blockquote':
			return {
				type: 'blockquote',
				children: element.children.map((child) => {
					if ('text' in child) {
						return {
							type: 'paragraph' as const,
							children: [textToMdast(child as CustomText)],
						};
					}
					return elementToMdast(child as CustomElement);
				}).filter((n): n is RootContent => n !== null),
			};

		case 'code-block': {
			// Get the text content from children
			const value = element.children
				.map((child) => ('text' in child ? (child as CustomText).text : ''))
				.join('');
			return {
				type: 'code',
				lang: element.language || null,
				value,
			};
		}

		case 'bulleted-list':
			return {
				type: 'list',
				ordered: false,
				spread: false,
				children: element.children
					.filter((child): child is CustomElement => !('text' in child) && (child as CustomElement).type === 'list-item')
					.map((item) => ({
						type: 'listItem' as const,
						spread: false,
						children: item.children.map((child) => {
							if ('text' in child) {
								return {
									type: 'paragraph' as const,
									children: [textToMdast(child as CustomText)],
								};
							}
							// Handle nested content in list items
							const nested = elementToMdast(child as CustomElement);
							return nested as RootContent;
						}).filter((n): n is RootContent => n !== null),
					})),
			};

		case 'numbered-list':
			return {
				type: 'list',
				ordered: true,
				start: 1,
				spread: false,
				children: element.children
					.filter((child): child is CustomElement => !('text' in child) && (child as CustomElement).type === 'list-item')
					.map((item) => ({
						type: 'listItem' as const,
						spread: false,
						children: item.children.map((child) => {
							if ('text' in child) {
								return {
									type: 'paragraph' as const,
									children: [textToMdast(child as CustomText)],
								};
							}
							const nested = elementToMdast(child as CustomElement);
							return nested as RootContent;
						}).filter((n): n is RootContent => n !== null),
					})),
			};

		case 'thematic-break':
			return { type: 'thematicBreak' };

		case 'table':
			return {
				type: 'table',
				children: element.children
					.filter((child): child is CustomElement => !('text' in child) && (child as CustomElement).type === 'table-row')
					.map((row): TableContent => ({
						type: 'tableRow',
						children: row.children
							.filter((cell): cell is CustomElement => !('text' in cell) && (cell as CustomElement).type === 'table-cell')
							.map((cell): RowContent => {
								// Table cells may have paragraph wrappers - unwrap them for serialization
								let cellContent = cell.children;
								if (cellContent.length === 1 && !('text' in cellContent[0]) && (cellContent[0] as CustomElement).type === 'paragraph') {
									cellContent = (cellContent[0] as CustomElement).children;
								}
								return {
									type: 'tableCell',
									children: childrenToPhrasingContent(cellContent),
								};
							}),
					})),
			};

		case 'link':
			// Links are inline, but if at top level, wrap in paragraph
			return {
				type: 'paragraph',
				children: [{
					type: 'link',
					url: element.url,
					children: childrenToPhrasingContent(element.children),
				}],
			};

		default:
			// For unknown types, try to convert as paragraph
			return {
				type: 'paragraph',
				children: childrenToPhrasingContent(element.children),
			};
	}
}

/**
 * Convert Slate AST to mdast Root.
 */
function slateToMdastTree(content: Descendant[]): Root {
	const children: RootContent[] = [];

	for (const node of content) {
		if ('text' in node) {
			// Top-level text nodes should be wrapped in a paragraph
			children.push({
				type: 'paragraph',
				children: [textToMdast(node as CustomText)],
			});
		} else {
			const mdastNode = elementToMdast(node as CustomElement);
			if (mdastNode) {
				children.push(mdastNode);
			}
		}
	}

	return { type: 'root', children };
}

/**
 * Serialize Slate AST to markdown string.
 *
 * @param content - The Slate Descendant[] array
 * @returns Markdown string
 */
export function toMarkdown(content: Descendant[]): string {
	if (!content || content.length === 0) {
		return '';
	}

	try {
		// Build mdast tree directly
		const mdast = slateToMdastTree(content);

		// Create processor for stringifying
		const processor = unified()
			.use(remarkGfm)
			.use(remarkStringify, {
				bullet: '-',
				emphasis: '_',
				strong: '*',
				fence: '`',
				fences: true,
				listItemIndent: 'one',
				rule: '-',
			});

		return processor.stringify(mdast);
	} catch (error) {
		// Log enough context to diagnose serialization issues
		const nodeTypes = content.slice(0, 5).map(n => (n as { type?: string }).type || 'unknown');
		console.error('Failed to serialize to markdown:', error, { nodeTypes, nodeCount: content.length });
		return '';
	}
}
