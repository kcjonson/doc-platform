import { useMemo, useCallback } from 'preact/hooks';
import type { JSX } from 'preact';
import { createEditor, Descendant, Editor, Element as SlateElement, Transforms } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps } from 'slate-react';
import { withHistory } from 'slate-history';
import isHotkey from 'is-hotkey';
import type { MarkType, CustomElement, CustomText } from './types';
import { Toolbar } from './Toolbar';
import styles from './MarkdownEditor.module.css';

// Import types to augment Slate
import './types';

export interface MarkdownEditorProps {
	/** Initial content as Slate nodes */
	initialValue: Descendant[];
	/** Called when content changes */
	onChange?: (value: Descendant[]) => void;
	/** Placeholder text when empty */
	placeholder?: string;
	/** Read-only mode */
	readOnly?: boolean;
}

// Hotkey mappings
const HOTKEYS: Record<string, MarkType> = {
	'mod+b': 'bold',
	'mod+i': 'italic',
	'mod+`': 'code',
};

// Check if a mark is active
function isMarkActive(editor: Editor, format: MarkType): boolean {
	const marks = Editor.marks(editor);
	return marks ? marks[format] === true : false;
}

// Toggle a mark on/off
function toggleMark(editor: Editor, format: MarkType): void {
	const isActive = isMarkActive(editor, format);
	if (isActive) {
		Editor.removeMark(editor, format);
	} else {
		Editor.addMark(editor, format, true);
	}
}

// Check if a block type is active
function isBlockActive(editor: Editor, format: string): boolean {
	const { selection } = editor;
	if (!selection) return false;

	const [match] = Array.from(
		Editor.nodes(editor, {
			at: Editor.unhangRange(editor, selection),
			match: n =>
				!Editor.isEditor(n) && SlateElement.isElement(n) && n.type === format,
		})
	);

	return !!match;
}

// Toggle block type
function toggleBlock(editor: Editor, format: CustomElement['type']): void {
	const isActive = isBlockActive(editor, format);
	const isList = format === 'bulleted-list' || format === 'numbered-list';

	Transforms.unwrapNodes(editor, {
		match: n =>
			!Editor.isEditor(n) &&
			SlateElement.isElement(n) &&
			(n.type === 'bulleted-list' || n.type === 'numbered-list'),
		split: true,
	});

	const newProperties: Partial<CustomElement> = {
		type: isActive ? 'paragraph' : isList ? 'list-item' : format,
	};
	Transforms.setNodes<CustomElement>(editor, newProperties);

	if (!isActive && isList) {
		const block: CustomElement = { type: format, children: [] };
		Transforms.wrapNodes(editor, block);
	}
}

// Element renderer
function renderElement(props: RenderElementProps): JSX.Element {
	const { attributes, children, element } = props;

	switch (element.type) {
		case 'heading': {
			const HeadingTag = `h${element.level}` as keyof JSX.IntrinsicElements;
			return <HeadingTag {...attributes} class={styles.heading}>{children}</HeadingTag>;
		}
		case 'blockquote':
			return <blockquote {...attributes} class={styles.blockquote}>{children}</blockquote>;
		case 'code-block':
			return (
				<pre {...attributes} class={styles.codeBlock}>
					<code>{children}</code>
				</pre>
			);
		case 'bulleted-list':
			return <ul {...attributes} class={styles.list}>{children}</ul>;
		case 'numbered-list':
			return <ol {...attributes} class={styles.list}>{children}</ol>;
		case 'list-item':
			return <li {...attributes}>{children}</li>;
		case 'link':
			return (
				<a {...attributes} href={element.url} class={styles.link}>
					{children}
				</a>
			);
		case 'thematic-break':
			return <hr {...attributes} class={styles.thematicBreak} />;
		default:
			return <p {...attributes} class={styles.paragraph}>{children}</p>;
	}
}

// Leaf renderer (text with marks)
function renderLeaf(props: RenderLeafProps): JSX.Element {
	const { attributes, children, leaf } = props;
	let content = children;
	const text = leaf as CustomText;

	if (text.bold) {
		content = <strong>{content}</strong>;
	}
	if (text.italic) {
		content = <em>{content}</em>;
	}
	if (text.code) {
		content = <code class={styles.inlineCode}>{content}</code>;
	}
	if (text.strikethrough) {
		content = <s>{content}</s>;
	}

	return <span {...attributes}>{content}</span>;
}

export function MarkdownEditor({
	initialValue,
	onChange,
	placeholder = 'Start typing...',
	readOnly = false,
}: MarkdownEditorProps): JSX.Element {
	// Create editor instance with plugins
	const editor = useMemo(
		() => withHistory(withReact(createEditor())),
		[]
	);

	// Handle keyboard shortcuts
	const handleKeyDown = useCallback(
		(event: KeyboardEvent) => {
			for (const hotkey in HOTKEYS) {
				if (isHotkey(hotkey, event)) {
					event.preventDefault();
					const mark = HOTKEYS[hotkey];
					toggleMark(editor, mark);
				}
			}
		},
		[editor]
	);

	// Handle value changes
	const handleChange = useCallback(
		(value: Descendant[]) => {
			// Check if content actually changed (not just selection)
			const isAstChange = editor.operations.some(
				op => 'set_selection' !== op.type
			);
			if (isAstChange && onChange) {
				onChange(value);
			}
		},
		[editor, onChange]
	);

	return (
		<div class={styles.container}>
			<Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
				{!readOnly && (
					<Toolbar
						isMarkActive={(mark) => isMarkActive(editor, mark)}
						isBlockActive={(block) => isBlockActive(editor, block)}
						toggleMark={(mark) => toggleMark(editor, mark)}
						toggleBlock={(block) => toggleBlock(editor, block as CustomElement['type'])}
					/>
				)}
				<div class={styles.editorWrapper}>
					<Editable
						class={styles.editable}
						renderElement={renderElement}
						renderLeaf={renderLeaf}
						placeholder={placeholder}
						readOnly={readOnly}
						onKeyDown={handleKeyDown}
						spellCheck
						autoFocus
					/>
				</div>
			</Slate>
		</div>
	);
}
