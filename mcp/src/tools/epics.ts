/**
 * Epic-related MCP tools
 *
 * These tools allow Claude to:
 * - Find available work (get_ready_epics)
 * - Read epic details and specs (get_epic)
 * - Get current work context (get_current_work)
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import {
	getReadyEpics as getReadyEpicsService,
	getEpicWithDetails,
	getCurrentWork as getCurrentWorkService,
	createEpic as createEpicService,
	verifyProjectAccess,
	type EpicType,
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
			'Get all in-progress and in-review work items with their tasks. Use this at the start of a session to understand what work is ongoing.',
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
			'Create a new work item (epic, chore, or bug) in the project. Epics are large features with spec docs, chores are small tasks, bugs are defect reports.',
		inputSchema: {
			type: 'object',
			properties: {
				project_id: {
					type: 'string',
					description: 'The UUID of the project',
				},
				title: {
					type: 'string',
					description: 'Title for the work item (max 255 chars)',
				},
				type: {
					type: 'string',
					enum: ['epic', 'chore', 'bug'],
					description: 'Type of work item. Defaults to "epic".',
				},
				description: {
					type: 'string',
					description: 'Optional description text',
				},
				status: {
					type: 'string',
					enum: ['ready', 'in_progress', 'done'],
					description: 'Initial status. Defaults to "ready".',
				},
			},
			required: ['project_id', 'title'],
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
			default:
				return {
					content: [{ type: 'text', text: `Unknown epic tool: ${name}` }],
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

	const validTypes: EpicType[] = ['epic', 'chore', 'bug'];
	const type = (args?.type as EpicType) || 'epic';
	if (!validTypes.includes(type)) {
		return {
			content: [{ type: 'text', text: 'Invalid type. Must be one of: epic, chore, bug' }],
			isError: true,
		};
	}

	const epic = await createEpicService(projectId, {
		title,
		type,
		description: args?.description as string | undefined,
		status: (args?.status as 'ready' | 'in_progress' | 'done') || 'ready',
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
