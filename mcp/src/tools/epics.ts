/**
 * Work item MCP tools (unified)
 *
 * These tools provide a unified interface for all work items:
 * - get_ready_epics: Find available work
 * - get_epic: Read full item details
 * - get_current_work: Get in-progress/in-review items
 * - create_item: Create epic/chore/bug/task
 * - create_items: Bulk create tasks under a parent
 * - update_item: Update any item (status, sub_status, notes, etc.)
 * - delete_item: Delete any item
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
	getReadyEpics as getReadyEpicsService,
	getEpicWithDetails,
	getCurrentWork as getCurrentWorkService,
	createEpic as createEpicService,
	updateEpic as updateEpicService,
	deleteEpic as deleteEpicService,
	createTask as createTaskService,
	createTasks as createTasksService,
	updateTask as updateTaskService,
	deleteTask as deleteTaskService,
	startTask as startTaskService,
	completeTask as completeTaskService,
	blockTask as blockTaskService,
	unblockTask as unblockTaskService,
	verifyProjectAccess,
	verifyEpicOwnership,
	verifyTaskOwnership,
	type EpicType,
	type EpicStatus,
	type SubStatus,
	type TaskStatus,
} from '@specboard/db';

export const epicTools: Tool[] = [
	{
		name: 'get_ready_epics',
		description:
			'Get all work items in "ready" status that are available to work on. Returns items with their type, linked spec paths, and basic info. Use this to find new work to pick up.',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project to query',
				},
				item_type: {
					type: 'string',
					enum: ['epic', 'chore', 'bug'],
					description: 'Filter by type. If omitted, returns all types.',
				},
			},
			required: ['project_id'],
		},
	},
	{
		name: 'get_epic',
		description:
			'Get full details of a work item (epic, chore, or bug) including its tasks, progress notes, and linked spec path. Use this after picking up an item to understand the requirements.',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project',
				},
				epic_id: {
					type: 'string',
					description: 'The UUID of the work item to retrieve',
				},
			},
			required: ['project_id', 'epic_id'],
		},
	},
	{
		name: 'get_current_work',
		description:
			'Get all in-progress and in-review work items with their tasks, sub-status, and branch info. Use this at the start of a session to understand what work is ongoing.',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project to query',
				},
			},
			required: ['project_id'],
		},
	},
	{
		name: 'create_item',
		description:
			'Create a new work item. For epics/chores/bugs: creates a top-level item. For tasks: creates under a parent work item (parent_id required).',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project',
				},
				title: {
					type: 'string',
					description: 'Title for the item (max 255 chars)',
				},
				type: {
					type: 'string',
					enum: ['epic', 'chore', 'bug', 'task'],
					description: 'Type of item. Defaults to "epic".',
				},
				parent_id: {
					type: 'string',
					description: 'Parent work item ID (required when type=task, ignored otherwise)',
				},
				description: {
					type: 'string',
					description: 'Description (for epics/chores/bugs) or details (for tasks)',
				},
			},
			required: ['project_id', 'title'],
		},
	},
	{
		name: 'create_items',
		description:
			'Bulk create tasks under a parent work item. Each item gets a title and optional details.',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project',
				},
				parent_id: {
					type: 'string',
					description: 'The UUID of the parent work item (epic, chore, or bug)',
				},
				items: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							title: {
								type: 'string',
								description: 'Task title',
							},
							details: {
								type: 'string',
								description: 'Optional details',
							},
						},
						required: ['title'],
					},
					description: 'Array of tasks to create',
				},
			},
			required: ['project_id', 'parent_id', 'items'],
		},
	},
	{
		name: 'update_item',
		description:
			'Update any work item or task. For work items (epic/chore/bug): supports title, description, status, sub_status, branch_name, pr_url, notes. Setting sub_status auto-updates board status (scoping/in_development→in_progress, pr_open→in_review, complete→done). For tasks: supports title, details, status (ready/in_progress/blocked/done), note.',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project',
				},
				item_id: {
					type: 'string',
					description: 'The UUID of the item to update',
				},
				type: {
					type: 'string',
					enum: ['epic', 'chore', 'bug', 'task'],
					description: 'Type of item being updated — routes to correct table',
				},
				title: {
					type: 'string',
					description: 'New title',
				},
				description: {
					type: 'string',
					description: 'New description (work items) or details (tasks)',
				},
				status: {
					type: 'string',
					description: 'New status. Work items: ready/in_progress/in_review/done. Tasks: ready/in_progress/blocked/done.',
				},
				sub_status: {
					type: 'string',
					enum: ['not_started', 'scoping', 'in_development', 'paused', 'needs_input', 'pr_open', 'complete'],
					description: 'Detailed work state (work items only). Auto-updates board status at key transitions.',
				},
				branch_name: {
					type: 'string',
					description: 'Git branch name linked to this item (work items only)',
				},
				pr_url: {
					type: 'string',
					description: 'Pull request URL (work items only)',
				},
				notes: {
					type: 'string',
					description: 'Append a note to the item (work items only). Auto-prepends timestamp.',
				},
				note: {
					type: 'string',
					description: 'Set note on a task — context for any outcome (completion, blocked, cut, etc.)',
				},
			},
			required: ['project_id', 'item_id', 'type'],
		},
	},
	{
		name: 'delete_item',
		description:
			'Delete a work item or task.',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project',
				},
				item_id: {
					type: 'string',
					description: 'The UUID of the item to delete',
				},
				type: {
					type: 'string',
					enum: ['epic', 'chore', 'bug', 'task'],
					description: 'Type of item being deleted',
				},
			},
			required: ['project_id', 'item_id', 'type'],
		},
	},
];

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };

export async function handleEpicTool(
	name: string,
	args: Record<string, unknown> | undefined,
	userId: string
): Promise<ToolResult> {
	const projectId = args?.project_id as string;
	if (!projectId) {
		return {
			content: [{ type: 'text', text: 'project_id is required' }],
			isError: true,
		};
	}

	// Security: Verify the user has access to this project
	const hasAccess = await verifyProjectAccess(projectId, userId);
	if (!hasAccess) {
		return {
			content: [{ type: 'text', text: 'Access denied: You do not have permission to access this project' }],
			isError: true,
		};
	}

	try {
		switch (name) {
			case 'get_ready_epics':
				return await getReadyEpics(projectId, args?.item_type as EpicType | undefined);
			case 'get_epic':
				return await getEpic(projectId, args?.epic_id as string);
			case 'get_current_work':
				return await getCurrentWork(projectId);
			case 'create_item':
				return await createItem(projectId, args);
			case 'create_items':
				return await createItems(projectId, args);
			case 'update_item':
				return await updateItem(projectId, args);
			case 'delete_item':
				return await deleteItem(projectId, args);
			default:
				return {
					content: [{ type: 'text', text: `Unknown tool: ${name}` }],
					isError: true,
				};
		}
	} catch (error) {
		return {
			content: [{ type: 'text', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
			isError: true,
		};
	}
}

async function getReadyEpics(projectId: string, itemType?: EpicType): Promise<ToolResult> {
	const epics = await getReadyEpicsService(projectId, itemType);

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify({ epics, count: epics.length }, null, 2),
			},
		],
	};
}

async function getEpic(projectId: string, epicId: string): Promise<ToolResult> {
	if (!epicId) {
		return {
			content: [{ type: 'text', text: 'epic_id is required' }],
			isError: true,
		};
	}

	const epic = await getEpicWithDetails(projectId, epicId);

	if (!epic) {
		return {
			content: [{ type: 'text', text: 'Epic not found' }],
			isError: true,
		};
	}

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(epic, null, 2),
			},
		],
	};
}

async function getCurrentWork(projectId: string): Promise<ToolResult> {
	const result = await getCurrentWorkService(projectId);

	return {
		content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
	};
}

async function createItem(
	projectId: string,
	args: Record<string, unknown> | undefined,
): Promise<ToolResult> {
	const title = args?.title as string;
	if (!title) {
		return {
			content: [{ type: 'text', text: 'title is required' }],
			isError: true,
		};
	}

	const type = (args?.type as string) || 'epic';

	if (type === 'task') {
		// Route to task creation
		const parentId = args?.parent_id as string;
		if (!parentId) {
			return {
				content: [{ type: 'text', text: 'parent_id is required when type=task' }],
				isError: true,
			};
		}

		const task = await createTaskService(projectId, parentId, {
			title,
			details: args?.description as string | undefined,
		});

		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							created: { id: task.id, title: task.title, type: 'task', status: task.status },
							message: 'Task created',
						},
						null,
						2
					),
				},
			],
		};
	}

	// Epic/chore/bug creation
	const validTypes: EpicType[] = ['epic', 'chore', 'bug'];
	if (!validTypes.includes(type as EpicType)) {
		return {
			content: [{ type: 'text', text: 'Invalid type. Must be one of: epic, chore, bug, task' }],
			isError: true,
		};
	}

	const epic = await createEpicService(projectId, {
		title,
		type: type as EpicType,
		description: args?.description as string | undefined,
	});

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(
					{
						created: {
							id: epic.id,
							title: epic.title,
							type: epic.type,
							status: epic.status,
						},
						message: `${type.charAt(0).toUpperCase() + type.slice(1)} created`,
					},
					null,
					2
				),
			},
		],
	};
}

async function createItems(
	projectId: string,
	args: Record<string, unknown> | undefined,
): Promise<ToolResult> {
	const parentId = args?.parent_id as string;
	const items = args?.items as Array<{ title: string; details?: string }>;

	if (!parentId || !items || items.length === 0) {
		return {
			content: [{ type: 'text', text: 'parent_id and items array are required' }],
			isError: true,
		};
	}

	const created = await createTasksService(projectId, parentId, items);

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(
					{
						created: created.map((t) => ({ id: t.id, title: t.title, status: t.status })),
						count: created.length,
					},
					null,
					2
				),
			},
		],
	};
}

async function updateItem(
	projectId: string,
	args: Record<string, unknown> | undefined,
): Promise<ToolResult> {
	const itemId = args?.item_id as string;
	const type = args?.type as string;

	if (!itemId || !type) {
		return {
			content: [{ type: 'text', text: 'item_id and type are required' }],
			isError: true,
		};
	}

	if (type === 'task') {
		// Verify task belongs to project
		const taskBelongs = await verifyTaskOwnership(projectId, itemId);
		if (!taskBelongs) {
			return {
				content: [{ type: 'text', text: 'Access denied: Task does not belong to this project' }],
				isError: true,
			};
		}

		// Handle task-specific status transitions via dedicated service functions
		const status = args?.status as TaskStatus | undefined;
		const note = args?.note as string | undefined;

		if (status === 'in_progress') {
			const task = await startTaskService(itemId);
			if (!task) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
			// If note was also provided, update it separately
			if (note !== undefined) {
				await updateTaskService(itemId, { note });
			}
			return {
				content: [{ type: 'text', text: JSON.stringify({ updated: { id: task.id, status: task.status }, message: 'Task started' }, null, 2) }],
			};
		}

		if (status === 'done') {
			const task = await completeTaskService(itemId, note);
			if (!task) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
			return {
				content: [{ type: 'text', text: JSON.stringify({ updated: { id: task.id, status: task.status, note: task.note }, message: 'Task completed' }, null, 2) }],
			};
		}

		if (status === 'blocked') {
			if (!note) {
				return { content: [{ type: 'text', text: 'note is required when blocking a task' }], isError: true };
			}
			const task = await blockTaskService(itemId, note);
			if (!task) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
			return {
				content: [{ type: 'text', text: JSON.stringify({ updated: { id: task.id, status: task.status, note: task.note }, message: 'Task blocked' }, null, 2) }],
			};
		}

		if (status === 'ready' && !args?.title && !args?.description) {
			// Unblock shorthand
			const task = await unblockTaskService(itemId);
			if (!task) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };
			return {
				content: [{ type: 'text', text: JSON.stringify({ updated: { id: task.id, status: task.status }, message: 'Task unblocked' }, null, 2) }],
			};
		}

		// General task update (title, details, note without status change)
		const updateData: Record<string, unknown> = {};
		if (args?.title !== undefined) updateData.title = args.title;
		if (args?.description !== undefined) updateData.details = args.description;
		if (note !== undefined) updateData.note = note;
		if (status !== undefined) updateData.status = status;

		const task = await updateTaskService(itemId, updateData);
		if (!task) return { content: [{ type: 'text', text: 'Task not found' }], isError: true };

		return {
			content: [{ type: 'text', text: JSON.stringify({ updated: { id: task.id, title: task.title, status: task.status, note: task.note }, message: 'Task updated' }, null, 2) }],
		};
	}

	// Work item (epic/chore/bug) update
	const epicBelongs = await verifyEpicOwnership(projectId, itemId);
	if (!epicBelongs) {
		return {
			content: [{ type: 'text', text: 'Access denied: Item does not belong to this project' }],
			isError: true,
		};
	}

	const updateData: Record<string, unknown> = {};
	if (args?.title !== undefined) updateData.title = args.title;
	if (args?.description !== undefined) updateData.description = args.description;
	if (args?.status !== undefined) updateData.status = args.status as EpicStatus;
	if (args?.sub_status !== undefined) updateData.subStatus = args.sub_status as SubStatus;
	if (args?.branch_name !== undefined) updateData.branchName = args.branch_name;
	if (args?.pr_url !== undefined) updateData.prUrl = args.pr_url;
	if (args?.notes !== undefined) updateData.notes = args.notes;

	const epic = await updateEpicService(projectId, itemId, updateData);
	if (!epic) {
		return {
			content: [{ type: 'text', text: 'Item not found' }],
			isError: true,
		};
	}

	return {
		content: [
			{
				type: 'text',
				text: JSON.stringify(
					{
						updated: {
							id: epic.id,
							title: epic.title,
							status: epic.status,
							subStatus: epic.subStatus,
							branchName: epic.branchName,
							prUrl: epic.prUrl,
						},
						message: 'Item updated',
					},
					null,
					2
				),
			},
		],
	};
}

async function deleteItem(
	projectId: string,
	args: Record<string, unknown> | undefined,
): Promise<ToolResult> {
	const itemId = args?.item_id as string;
	const type = args?.type as string;

	if (!itemId || !type) {
		return {
			content: [{ type: 'text', text: 'item_id and type are required' }],
			isError: true,
		};
	}

	if (type === 'task') {
		const taskBelongs = await verifyTaskOwnership(projectId, itemId);
		if (!taskBelongs) {
			return {
				content: [{ type: 'text', text: 'Access denied: Task does not belong to this project' }],
				isError: true,
			};
		}

		const deleted = await deleteTaskService(itemId);
		return {
			content: [{ type: 'text', text: JSON.stringify({ deleted, message: deleted ? 'Task deleted' : 'Task not found' }, null, 2) }],
			isError: !deleted,
		};
	}

	// Work item delete
	const epicBelongs = await verifyEpicOwnership(projectId, itemId);
	if (!epicBelongs) {
		return {
			content: [{ type: 'text', text: 'Access denied: Item does not belong to this project' }],
			isError: true,
		};
	}

	const deleted = await deleteEpicService(projectId, itemId);
	return {
		content: [{ type: 'text', text: JSON.stringify({ deleted, message: deleted ? 'Item deleted' : 'Item not found' }, null, 2) }],
		isError: !deleted,
	};
}
