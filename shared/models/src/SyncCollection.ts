/**
 * @doc-platform/models - SyncCollection
 *
 * A collection that syncs with a REST API.
 * Auto-fetches on construction, items are SyncModels.
 *
 * @example
 * ```typescript
 * class Epic extends SyncModel {
 *   static url = '/api/epics/:id';
 *   @prop accessor id!: string;
 *   @prop accessor title!: string;
 * }
 *
 * class EpicsCollection extends SyncCollection<Epic> {
 *   static url = '/api/epics';
 *   static Model = Epic;
 * }
 *
 * const epics = new EpicsCollection(); // Auto-fetches
 * // epics.$meta.working === true while loading
 * // epics.$meta.error if fetch failed
 *
 * await epics.add({ title: 'New Epic' }); // POSTs to API
 * epics[0].status = 'done';
 * await epics[0].save(); // PUTs to API
 * ```
 */

import { fetchClient } from '@doc-platform/fetch';
import type { SyncModel } from './SyncModel';
import type { ChangeCallback, Observable, ModelData } from './types';

/** Constructor for SyncModel subclasses */
export interface SyncModelConstructor<T extends SyncModel> {
	url: string;
	idField?: string;
	new (params?: Record<string, string | number>, initialData?: Record<string, unknown>): T;
}

/** Collection metadata */
export interface CollectionMeta {
	working: boolean;
	error: Error | null;
	lastFetched: number | null;
}

/** SyncCollection type with array index access */
export type SyncCollection<T extends SyncModel> = SyncCollectionBase<T> & {
	readonly [index: number]: T;
};

/**
 * Creates a Proxy that enables array index access on SyncCollection.
 */
function createProxy<T extends SyncModel>(collection: SyncCollectionBase<T>): SyncCollection<T> {
	return new Proxy(collection, {
		get(target, prop, receiver) {
			if (typeof prop === 'string' && /^\d+$/.test(prop)) {
				return target.__getItem(parseInt(prop, 10));
			}
			return Reflect.get(target, prop, receiver);
		},
		set(target, prop, value, receiver) {
			if (typeof prop === 'string' && /^\d+$/.test(prop)) {
				throw new Error('Cannot replace collection items by index. Use add() or modify item properties directly.');
			}
			return Reflect.set(target, prop, value, receiver);
		},
	}) as SyncCollection<T>;
}

export class SyncCollectionBase<T extends SyncModel> implements Observable {
	/** URL for the collection endpoint */
	static url: string = '';

	/** The SyncModel class for items */
	static Model: SyncModelConstructor<SyncModel>;

	/** Internal storage */
	private __items: T[] = [];

	/** Event listeners */
	private __listeners: Record<string, ChangeCallback[]> = {};

	/** Collection metadata */
	readonly $meta: CollectionMeta = {
		working: false,
		error: null,
		lastFetched: null,
	};

	constructor() {
		// Auto-fetch on construction
		this.fetch();
	}

	/** Get item at index */
	__getItem(index: number): T | undefined {
		return this.__items[index];
	}

	/** Get the Model class from static property */
	private getModelClass(): SyncModelConstructor<T> {
		return (this.constructor as typeof SyncCollectionBase).Model as SyncModelConstructor<T>;
	}

	/** Get the URL from static property */
	private getUrl(): string {
		return (this.constructor as typeof SyncCollectionBase).url;
	}

	/** Update $meta and emit change */
	private setMeta(updates: Partial<CollectionMeta>): void {
		Object.assign(this.$meta, updates);
		this.__emitChange();
	}

	/** Subscribe to child model changes */
	private __subscribeToChild(item: T): void {
		item.on('change', this.__handleChildChange);
	}

	/** Unsubscribe from child model */
	private __unsubscribeFromChild(item: T): void {
		item.off('change', this.__handleChildChange);
	}

	/** Handle child change - bubble up */
	private __handleChildChange: ChangeCallback = () => {
		this.__emitChange();
	};

	/** Emit change event */
	private __emitChange(): void {
		const listeners = this.__listeners['change'];
		if (listeners) {
			for (const listener of listeners) {
				listener();
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Observable interface
	// ─────────────────────────────────────────────────────────────────────────────

	on(event: 'change', callback: ChangeCallback): void {
		if (!this.__listeners[event]) {
			this.__listeners[event] = [];
		}
		this.__listeners[event].push(callback);
	}

	off(event: 'change', callback: ChangeCallback): void {
		const listeners = this.__listeners[event];
		if (listeners) {
			const index = listeners.indexOf(callback);
			if (index !== -1) {
				listeners.splice(index, 1);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Read access
	// ─────────────────────────────────────────────────────────────────────────────

	get length(): number {
		return this.__items.length;
	}

	[Symbol.iterator](): Iterator<T> {
		return this.__items[Symbol.iterator]();
	}

	map<U>(fn: (item: T, index: number) => U): U[] {
		return this.__items.map(fn);
	}

	filter(fn: (item: T, index: number) => boolean): T[] {
		return this.__items.filter(fn);
	}

	find(fn: (item: T, index: number) => boolean): T | undefined {
		return this.__items.find(fn);
	}

	findIndex(fn: (item: T, index: number) => boolean): number {
		return this.__items.findIndex(fn);
	}

	some(fn: (item: T, index: number) => boolean): boolean {
		return this.__items.some(fn);
	}

	every(fn: (item: T, index: number) => boolean): boolean {
		return this.__items.every(fn);
	}

	toArray(): T[] {
		return [...this.__items];
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Sync operations
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Fetch all items from the API.
	 */
	async fetch(): Promise<void> {
		this.setMeta({ working: true, error: null });

		try {
			const data = await fetchClient.get<Array<Record<string, unknown>>>(this.getUrl());
			const ModelClass = this.getModelClass();

			// Clear existing items
			for (const item of this.__items) {
				this.__unsubscribeFromChild(item);
			}

			// Create new model instances from data
			// Pass initialData but no params (we already have the data, no need to fetch)
			this.__items = data.map((itemData) => {
				const item = new ModelClass(undefined, itemData);
				this.__subscribeToChild(item);
				return item;
			});

			this.setMeta({ working: false, lastFetched: Date.now() });
		} catch (error) {
			this.setMeta({
				working: false,
				error: error instanceof Error ? error : new Error(String(error)),
			});
		}
	}

	/**
	 * Add a new item. POSTs to API, adds to collection on success.
	 */
	async add(data: Partial<ModelData<T>>): Promise<T> {
		const ModelClass = this.getModelClass();

		// Create model with data but no params (new record)
		const item = new ModelClass(undefined, data as Record<string, unknown>);

		// Save to API (will POST since no ID)
		await item.save();

		// Add to collection
		this.__subscribeToChild(item);
		this.__items.push(item);
		this.__emitChange();

		return item;
	}

	/**
	 * Remove an item. DELETEs from API, removes from collection on success.
	 */
	async remove(item: T): Promise<boolean> {
		const index = this.__items.indexOf(item);
		if (index === -1) {
			return false;
		}

		// Delete from API
		await item.delete();

		// Remove from collection
		this.__unsubscribeFromChild(item);
		this.__items.splice(index, 1);
		this.__emitChange();

		return true;
	}
}

/**
 * Wrap a SyncCollectionBase instance with a Proxy for array index access.
 * Use this when extending SyncCollectionBase directly.
 */
export function wrapCollection<T extends SyncModel>(
	collection: SyncCollectionBase<T>
): SyncCollection<T> {
	return createProxy(collection);
}

/**
 * Create a SyncCollection class for a given SyncModel.
 * For collections that need custom methods, extend SyncCollectionBase directly
 * and use wrapCollection() in the constructor.
 */
export function createSyncCollectionClass<T extends SyncModel>(
	url: string,
	ModelClass: SyncModelConstructor<T>
): new () => SyncCollection<T> {
	class CustomSyncCollection extends SyncCollectionBase<T> {
		static override url = url;
		static override Model = ModelClass as SyncModelConstructor<SyncModel>;
	}

	// Return a constructor that creates a proxied instance
	return class {
		constructor() {
			return createProxy(new CustomSyncCollection());
		}
	} as unknown as new () => SyncCollection<T>;
}
