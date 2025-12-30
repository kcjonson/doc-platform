/**
 * @doc-platform/core
 * Shared types and utilities used across the platform.
 */
export declare const VERSION = "0.0.1";
export { reportError, captureException, type ErrorReport } from './error-reporting.js';
export type Status = 'ready' | 'in_progress' | 'done';
export interface Task {
    id: string;
    epicId: string;
    title: string;
    status: Status;
    assignee?: string;
    dueDate?: string;
    rank: number;
}
export interface TaskStats {
    total: number;
    done: number;
}
export interface Epic {
    id: string;
    title: string;
    description?: string;
    status: Status;
    assignee?: string;
    rank: number;
    createdAt: string;
    updatedAt: string;
    taskStats?: TaskStats;
    tasks?: Task[];
}
/**
 * Creates a unique identifier.
 */
export declare function createId(): string;
/**
 * Deep clones an object.
 */
export declare function deepClone<T>(obj: T): T;
/**
 * Debounces a function call.
 */
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, ms: number): (...args: Parameters<T>) => void;
//# sourceMappingURL=index.d.ts.map