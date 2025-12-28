import { Model } from './Model';
import { prop } from './prop';

/**
 * Slate document node type.
 * Using unknown[] to avoid coupling models package to slate.
 * The editor will cast this to Descendant[].
 */
export type SlateContent = unknown[];

/** Empty document content */
export const EMPTY_DOCUMENT: SlateContent = [
	{ type: 'paragraph', children: [{ text: '' }] }
];

/**
 * Model for a markdown document.
 * Stores the Slate AST as its content property.
 *
 * This is the source of truth for the editor - Slate operates in
 * controlled mode with the model backing it.
 */
export class DocumentModel extends Model {
	/** Document title (derived from filename or first heading) */
	@prop accessor title: string = 'Untitled';

	/** The Slate AST representing document content */
	@prop accessor content: SlateContent = EMPTY_DOCUMENT;

	/** Whether the document has unsaved changes */
	@prop accessor dirty: boolean = false;
}
