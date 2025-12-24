/**
 * @doc-platform/models - Type definitions
 */

export type ChangeCallback = () => void;

/**
 * Observable interface for change subscriptions.
 * Implemented by Model and Collection.
 */
export interface Observable {
	on(event: 'change', callback: ChangeCallback): void;
	off(event: 'change', callback: ChangeCallback): void;
}

/**
 * Internal interface for Model instances.
 * Used by decorators to access internal storage without casting to unknown.
 */
export interface ModelInternal {
	__data: Record<string, unknown>;
	__listeners: Record<string, ChangeCallback[]>;
}

export interface ModelMeta {
	working: boolean;
	error: Error | null;
	lastFetched: number | null;
	[key: string]: unknown;
}

/**
 * Extracts only the data properties from a Model subclass.
 * Excludes:
 * - Methods (functions)
 * - Internal properties (__data, __listeners)
 * - Metadata ($meta)
 * - Model methods (on, set)
 */
export type ModelData<T> = {
	[K in keyof T as K extends `__${string}` | `$${string}` | 'on' | 'set'
		? never
		: T[K] extends (...args: unknown[]) => unknown
			? never
			: K]: T[K];
};
