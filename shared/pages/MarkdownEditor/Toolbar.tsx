import type { JSX } from 'preact';
import { useSlate } from 'slate-react';
import type { MarkType, BlockType } from './types';
import styles from './Toolbar.module.css';

export interface ToolbarProps {
	isMarkActive: (mark: MarkType) => boolean;
	isBlockActive: (block: string) => boolean;
	toggleMark: (mark: MarkType) => void;
	toggleBlock: (block: string) => void;
}

interface ToolbarButtonProps {
	active: boolean;
	onMouseDown: (event: MouseEvent) => void;
	children: JSX.Element | string;
	title: string;
}

function ToolbarButton({ active, onMouseDown, children, title }: ToolbarButtonProps): JSX.Element {
	return (
		<button
			type="button"
			class={`${styles.button} ${active ? styles.active : ''}`}
			onMouseDown={onMouseDown}
			title={title}
		>
			{children}
		</button>
	);
}

interface MarkButtonProps {
	format: MarkType;
	icon: string;
	title: string;
	isActive: (mark: MarkType) => boolean;
	toggle: (mark: MarkType) => void;
}

function MarkButton({ format, icon, title, isActive, toggle }: MarkButtonProps): JSX.Element {
	// Access editor context to trigger re-renders
	useSlate();

	return (
		<ToolbarButton
			active={isActive(format)}
			onMouseDown={(event) => {
				event.preventDefault();
				toggle(format);
			}}
			title={title}
		>
			{icon}
		</ToolbarButton>
	);
}

interface BlockButtonProps {
	format: BlockType;
	icon: string;
	title: string;
	isActive: (block: string) => boolean;
	toggle: (block: string) => void;
}

function BlockButton({ format, icon, title, isActive, toggle }: BlockButtonProps): JSX.Element {
	// Access editor context to trigger re-renders
	useSlate();

	return (
		<ToolbarButton
			active={isActive(format)}
			onMouseDown={(event) => {
				event.preventDefault();
				toggle(format);
			}}
			title={title}
		>
			{icon}
		</ToolbarButton>
	);
}

export function Toolbar({ isMarkActive, isBlockActive, toggleMark, toggleBlock }: ToolbarProps): JSX.Element {
	return (
		<div class={styles.toolbar}>
			<div class={styles.group}>
				<MarkButton format="bold" icon="B" title="Bold (Ctrl+B)" isActive={isMarkActive} toggle={toggleMark} />
				<MarkButton format="italic" icon="I" title="Italic (Ctrl+I)" isActive={isMarkActive} toggle={toggleMark} />
				<MarkButton format="code" icon="<>" title="Code (Ctrl+`)" isActive={isMarkActive} toggle={toggleMark} />
				<MarkButton format="strikethrough" icon="S" title="Strikethrough" isActive={isMarkActive} toggle={toggleMark} />
			</div>
			<div class={styles.separator} />
			<div class={styles.group}>
				<BlockButton format="heading" icon="H1" title="Heading" isActive={isBlockActive} toggle={toggleBlock} />
				<BlockButton format="blockquote" icon=">" title="Quote" isActive={isBlockActive} toggle={toggleBlock} />
				<BlockButton format="code-block" icon="{}" title="Code Block" isActive={isBlockActive} toggle={toggleBlock} />
			</div>
			<div class={styles.separator} />
			<div class={styles.group}>
				<BlockButton format="bulleted-list" icon="•" title="Bulleted List" isActive={isBlockActive} toggle={toggleBlock} />
				<BlockButton format="numbered-list" icon="1." title="Numbered List" isActive={isBlockActive} toggle={toggleBlock} />
			</div>
		</div>
	);
}
