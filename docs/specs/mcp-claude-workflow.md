# MCP Server Design: Claude Workflow Analysis

This document analyzes how Claude Code uses planning tools and how the MCP server should be designed to support Claude's actual workflow patterns.

---

## Current State

**Existing Spec:** `/docs/specs/mcp-integration.md` defines a comprehensive MCP server with:
- Document tools (get, search, list, create, update)
- Task tools (get_task, get_epic, get_backlog, search_tasks, create_task, update_task)
- OAuth 2.1 authentication with scopes

**Gap:** The spec is modeled after a human-facing Kanban UI, not Claude's actual workflow.

---

## How Claude Actually Works

### Starting a Conversation

1. **Read context** - Check status.md, read relevant specs
2. **Identify current work** - What's in progress? What's blocked?
3. **Plan execution** - Create internal todo list with TodoWrite

### During Work

1. **Mark task in_progress** before starting
2. **Break down into subtasks** as complexity is discovered
3. **Complete subtasks immediately** when done (not batched)
4. **Add progress notes** for visibility
5. **Block with reason** if stuck

### Finishing Work

1. **Mark task complete**
2. **Update status.md** with completed items
3. **Mark plan file as COMPLETE** (if using plan mode)

---

## Key Workflow Patterns

### Pattern 1: Context Loading

Claude needs to quickly understand "what am I working on?" in a single call.

**Current spec:** Requires multiple calls (get_backlog, get_task, get_linked_docs)

**Needed:** `get_current_context()` that returns:
- Current in-progress task(s)
- Related epic
- Linked documents with relevant sections
- Subtask progress
- Recent activity/notes

### Pattern 2: Progressive Task Breakdown

Claude discovers sub-work while implementing. Needs to record it immediately.

**Current spec:** Can only update task description, no subtask support

**Needed:**
- Subtask CRUD within tasks
- Subtasks have their own status (pending, in_progress, completed)
- Subtask completion updates parent task progress

### Pattern 3: Continuous Progress Updates

Claude completes work incrementally, not all at once.

**Current spec:** Only status changes (ready → in_progress → done)

**Needed:**
- `complete_subtask()` - granular progress
- `update_progress(note)` - add note without status change
- Progress percentage derived from subtask completion

### Pattern 4: Blocking with Context

Claude gets stuck and needs to signal "waiting on input."

**Current spec:** No blocked status, no mechanism to record why

**Needed:**
- `blocked` status
- `block_reason` field
- `request_clarification(question)` - creates a blocking note asking for user input

---

## Recommended Tool Design

### Context Tools

| Tool | Purpose | Returns |
|------|---------|---------|
| `get_current_context` | What am I working on? | Current task, epic, docs, progress |
| `get_next_work` | What should I pick up? | Prioritized ready tasks |
| `get_blocking_items` | What's stuck? | Blocked tasks with reasons |

### Task Lifecycle Tools

| Tool | Purpose | Input |
|------|---------|-------|
| `start_task` | Begin work | taskId |
| `complete_task` | Finish work | taskId |
| `block_task` | Mark blocked | taskId, reason |
| `unblock_task` | Resume work | taskId |

### Subtask Tools

| Tool | Purpose | Input |
|------|---------|-------|
| `add_subtasks` | Break down work | taskId, subtasks[] |
| `start_subtask` | Begin subtask | taskId, subtaskId |
| `complete_subtask` | Finish subtask | taskId, subtaskId |
| `reorder_subtasks` | Reprioritize | taskId, subtaskIds[] |

### Progress Tools

| Tool | Purpose | Input |
|------|---------|-------|
| `add_progress_note` | Record activity | taskId, note |
| `request_clarification` | Ask question | taskId, question |
| `answer_clarification` | Resolve question | taskId, questionId, answer |

### Document Linking

| Tool | Purpose | Input |
|------|---------|-------|
| `link_document` | Add context | taskId, docId |
| `link_section` | Add specific context | taskId, docId, sectionId |
| `get_task_context` | Get all linked docs | taskId |

---

## Status State Machine

```
          ┌─────────────────────────────────────────┐
          │                                         │
          ▼                                         │
       ┌──────┐    start_task    ┌─────────────┐   │
       │ready │ ───────────────► │ in_progress │   │
       └──────┘                  └─────────────┘   │
          ▲                           │   │        │
          │                           │   │        │
          │              complete_task│   │block   │
          │                           │   │        │
          │                           ▼   ▼        │
          │                      ┌────────────┐    │
          │   unblock_task       │  blocked   │────┘
          └───────────────────── └────────────┘
                                       │
                                       │ complete_task
                                       ▼
                                  ┌────────┐
                                  │  done  │
                                  └────────┘
```

---

## Subtask Model

Each task can have subtasks:

```typescript
interface Subtask {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  order: number;
  completedAt?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'ready' | 'in_progress' | 'blocked' | 'done';
  blockReason?: string;
  subtasks: Subtask[];
  progressNotes: ProgressNote[];
  linkedDocs: LinkedDoc[];
  // ... other fields
}
```

Progress is derived:
```typescript
const progress = task.subtasks.length > 0
  ? task.subtasks.filter(s => s.status === 'completed').length / task.subtasks.length
  : null;
```

---

## get_current_context Response

The most important tool for Claude. Returns everything needed to resume work:

```typescript
interface CurrentContext {
  // Current work
  currentTask?: {
    id: string;
    title: string;
    description?: string;
    status: 'in_progress' | 'blocked';
    blockReason?: string;
    epic: { id: string; title: string };
    subtasks: Subtask[];
    progress: number; // 0.0 - 1.0
  };

  // Context documents
  linkedDocs: {
    id: string;
    title: string;
    path: string;
    relevantSections: {
      heading: string;
      snippet: string;
    }[];
  }[];

  // Recent activity
  recentNotes: {
    timestamp: string;
    note: string;
  }[];

  // What's waiting
  pendingClarifications: {
    id: string;
    question: string;
    askedAt: string;
  }[];
}
```

---

## MCP Best Practices Applied

Based on official MCP documentation:

### 1. Tool Naming (snake_case, clear purpose)

- `get_current_context` not `getCurrentContext`
- `complete_subtask` not `markSubtaskDone`
- Consistent verb prefixes: get_, add_, update_, complete_, start_

### 2. Single Purpose Tools

Each tool does one thing:
- `start_task` only starts (doesn't also update description)
- `add_subtasks` only adds (separate from update_task)

### 3. Output-to-Input Chaining

Results from one tool can feed into another:
- `get_next_work` returns taskId → `start_task(taskId)`
- `start_task` confirms → `add_subtasks(taskId, [...])`

### 4. Error Handling

Use `isError` flag for tool failures:
```json
{
  "content": [{
    "type": "text",
    "text": "Task not found: id=abc123",
    "isError": true
  }]
}
```

### 5. Resources for Static Data

Use resources for:
- `planning://templates` - Task/epic templates
- `planning://schema` - Field definitions

Use tools for:
- All dynamic operations (CRUD)
- Anything where Claude decides when to call it

---

## Implementation Priority

### Phase 1: Core Claude Workflow
1. `get_current_context` - Essential for context loading
2. `start_task`, `complete_task` - Basic lifecycle
3. `add_subtasks`, `complete_subtask` - Progress tracking
4. `add_progress_note` - Visibility

### Phase 2: Blocking & Clarification
5. `block_task`, `unblock_task` - Handle stuck states
6. `request_clarification`, `answer_clarification` - User interaction

### Phase 3: Enhanced Context
7. `get_next_work` - Smart prioritization
8. `link_document`, `get_task_context` - Document integration

---

## Open Questions

1. **Multi-user assignment**: Should tasks be assignable to Claude specifically vs human users?

2. **Session tracking**: Should the MCP server track Claude "sessions" (like plan files)?

3. **Automatic updates**: Should completing all subtasks auto-complete the parent task?

4. **History**: How much task history should be retained for context?

5. **Notifications**: Should there be a way to notify Claude of changes made by humans?

---

## Next Steps

1. Review this analysis with the team
2. Decide on Phase 1 scope
3. Update `/docs/specs/mcp-integration.md` with Claude-specific tools
4. Implement subtask data model in database
5. Build MCP server with TypeScript SDK
