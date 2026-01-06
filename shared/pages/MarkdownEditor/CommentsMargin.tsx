import { useEffect, useState, useRef } from 'preact/hooks';
import type { JSX, RefObject } from 'preact';
import type { Comment } from './types';
import { InlineComment } from './InlineComment';
import styles from './CommentsMargin.module.css';

export interface CommentPosition {
	commentId: string;
	top: number;
}

/** Represents a pending new comment being created */
export interface PendingComment {
	/** Approximate top position for the input form */
	top: number;
}

export interface CommentsMarginProps {
	/** Comments to display */
	comments: Comment[];
	/** Ref to the editor container to find comment highlights */
	editorRef: RefObject<HTMLDivElement>;
	/** Currently active/selected comment ID */
	activeCommentId?: string;
	/** Called when a comment is clicked */
	onCommentClick?: (commentId: string) => void;
	/** Called when user submits a reply to a comment */
	onReply?: (commentId: string, replyText: string) => void;
	/** Called when user toggles resolved status */
	onToggleResolved?: (commentId: string) => void;
	/** Pending new comment (shows input form) */
	pendingComment?: PendingComment;
	/** Called when user submits a new comment */
	onSubmitNewComment?: (text: string) => void;
	/** Called when user cancels new comment */
	onCancelNewComment?: () => void;
}

/**
 * CommentsMargin positions comments in a margin to the right of the editor,
 * aligned with their corresponding highlighted text.
 */
export function CommentsMargin({
	comments,
	editorRef,
	activeCommentId,
	onCommentClick,
	onReply,
	onToggleResolved,
	pendingComment,
	onSubmitNewComment,
	onCancelNewComment,
}: CommentsMarginProps): JSX.Element {
	const [positions, setPositions] = useState<CommentPosition[]>([]);
	const [newCommentText, setNewCommentText] = useState('');
	const containerRef = useRef<HTMLDivElement>(null);
	const rafIdRef = useRef<number>(0);
	const newCommentInputRef = useRef<HTMLTextAreaElement>(null);

	// Calculate positions for each comment based on highlighted text positions
	useEffect(() => {
		function updatePositions(): void {
			const editor = editorRef.current;
			const container = containerRef.current;
			if (!editor || !container) return;

			const newPositions: CommentPosition[] = [];
			const containerRect = container.getBoundingClientRect();

			// Find all comment highlights and calculate their positions
			comments.forEach(comment => {
				const highlight = editor.querySelector(`[data-comment-id="${comment.id}"]`);
				if (highlight) {
					const highlightRect = highlight.getBoundingClientRect();
					// Position relative to the comments margin container
					const top = highlightRect.top - containerRect.top;
					newPositions.push({
						commentId: comment.id,
						top: Math.max(0, top),
					});
				}
			});

			// Resolve overlapping comments by stacking them
			// Sort by top position first
			newPositions.sort((a, b) => a.top - b.top);

			// Minimum gap between comments (approximate card height + gap)
			const minGap = 120;
			for (let i = 1; i < newPositions.length; i++) {
				const prev = newPositions[i - 1]!;
				const curr = newPositions[i]!;
				if (curr.top < prev.top + minGap) {
					curr.top = prev.top + minGap;
				}
			}

			setPositions(newPositions);
		}

		// Schedule position update after browser layout is complete
		function scheduleUpdate(): void {
			cancelAnimationFrame(rafIdRef.current);
			rafIdRef.current = requestAnimationFrame(updatePositions);
		}

		// Update positions initially
		scheduleUpdate();

		// Update on scroll and resize
		const editor = editorRef.current;
		const scrollContainer = (editor?.closest('[data-editor-wrapper]') as HTMLElement | null) ?? editor ?? null;

		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', scheduleUpdate);
		}
		window.addEventListener('resize', scheduleUpdate);

		// Observe DOM changes - use RAF to ensure layout is complete before measuring
		const observer = new MutationObserver(scheduleUpdate);
		if (editor) {
			observer.observe(editor, { childList: true, subtree: true, characterData: true });
		}

		return () => {
			cancelAnimationFrame(rafIdRef.current);
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', scheduleUpdate);
			}
			window.removeEventListener('resize', scheduleUpdate);
			observer.disconnect();
		};
	}, [comments, editorRef]);

	function handleCommentClick(commentId: string): void {
		if (onCommentClick) {
			onCommentClick(commentId);
		}

		// Scroll the highlighted text into view
		const editor = editorRef.current;
		if (editor) {
			const highlight = editor.querySelector(`[data-comment-id="${commentId}"]`);
			if (highlight) {
				highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		}
	}

	// Focus input when pending comment appears
	useEffect(() => {
		if (pendingComment && newCommentInputRef.current) {
			newCommentInputRef.current.focus();
		}
	}, [pendingComment]);

	// Reset text when pending comment is cancelled
	useEffect(() => {
		if (!pendingComment) {
			setNewCommentText('');
		}
	}, [pendingComment]);

	function handleNewCommentSubmit(e: Event): void {
		e.preventDefault();
		if (newCommentText.trim() && onSubmitNewComment) {
			onSubmitNewComment(newCommentText.trim());
			setNewCommentText('');
		}
	}

	function handleNewCommentKeyDown(e: KeyboardEvent): void {
		if (e.key === 'Escape' && onCancelNewComment) {
			onCancelNewComment();
		}
	}

	return (
		<div ref={containerRef} class={styles.container}>
			{/* Pending new comment input */}
			{pendingComment && (
				<div class={styles.newCommentContainer} style={{ top: `${pendingComment.top}px` }}>
					<div class={styles.connector} />
					<form onSubmit={handleNewCommentSubmit} class={styles.newCommentForm}>
						<textarea
							ref={newCommentInputRef}
							class={styles.newCommentInput}
							placeholder="Add a comment..."
							value={newCommentText}
							onInput={(e) => setNewCommentText((e.target as HTMLTextAreaElement).value)}
							onKeyDown={handleNewCommentKeyDown}
							rows={3}
						/>
						<div class={styles.newCommentActions}>
							<button
								type="button"
								class={styles.cancelButton}
								onClick={onCancelNewComment}
							>
								Cancel
							</button>
							<button
								type="submit"
								class={styles.submitButton}
								disabled={!newCommentText.trim()}
							>
								Comment
							</button>
						</div>
					</form>
				</div>
			)}

			{/* Existing comments */}
			{comments.map(comment => {
				const position = positions.find(p => p.commentId === comment.id);
				if (!position) return null;

				return (
					<InlineComment
						key={comment.id}
						comment={comment}
						top={position.top}
						isActive={activeCommentId === comment.id}
						onClick={() => handleCommentClick(comment.id)}
						onReply={onReply}
						onToggleResolved={onToggleResolved}
					/>
				);
			})}
		</div>
	);
}
