# Competitive Analysis: Git-Backed Documentation Editor & Lightweight Kanban Board

Two market gaps present a compelling opportunity for solo developers and small teams: no tool combines **true Markdown files + Git version control + robust inline commenting**, and no kanban board achieves **Linear's speed** with **better mobile support**. This analysis synthesizes research across documentation tools, project management platforms, AI integration patterns, MCP protocols, and UX best practices to inform PRD development for both products.

---

## Product 1: Git-Backed Markdown Documentation Editor

### Market landscape reveals a clear whitespace

The documentation tool market splits into two camps that fail to serve developer-focused teams. **Cloud-native tools** like Notion and Confluence offer excellent collaboration but abandon true Markdown—Notion uses proprietary blocks, Confluence converts Markdown to XML one-way, losing the source format. **Markdown-native tools** like Obsidian excel at local-first editing but lack collaboration features entirely. GitBook bridges this gap partially but uses block-based editing rather than true Markdown files.

**Key competitive insight**: No existing tool provides true Markdown files + full WYSIWYG editing + Git-native version control + Google Docs-style inline comments in a single product. This is the product's unique positioning opportunity.

| Competitor | Markdown Files | WYSIWYG | Git Integration | Inline Comments | AI Features | MCP Support |
|------------|----------------|---------|-----------------|-----------------|-------------|-------------|
| **Notion** | ❌ Block-based | ✅ Full | ❌ None | ✅ Excellent | ✅ Notion AI | ❌ None |
| **Confluence** | ❌ Converts to XML | ✅ Full | ❌ Plugin only | ✅ Robust | 🟡 Atlassian AI | ❌ None |
| **GitBook** | 🟡 Block-based | ✅ Block | ✅ Bi-directional | 🟡 Change requests | ✅ GitBook AI | ❌ None |
| **Obsidian** | ✅ True .md | 🟡 Live preview | 🟡 Plugin | ❌ None | 🟡 Plugins | ❌ None |
| **HackMD** | ✅ True .md | 🟡 Split-pane | 🟡 GitHub sync | ✅ Real-time | ❌ None | ❌ None |
| **Target Product** | ✅ True .md | ✅ Full WYSIWYG | ✅ Native Git | ✅ Footer-stored | ✅ Full AI suite | ✅ Native |

### User stories for documentation editor

**Core workflow stories:**
- *As a developer, I want to write documentation in Markdown that I can edit in any tool, so I'm not locked into proprietary formats*
- *As a solo developer, I want to switch between raw markdown and a clean WYSIWYG rich text editor, so I can write naturally or edit syntax directly depending on my preference*
- *As a small team lead, I want every save to be a Git commit, so I have full version history without extra steps*
- *As a reviewer, I want to highlight text and add comments that appear aligned to the right margin, so I can provide feedback without cluttering the document*
- *As a documentation owner, I want comments stored in a human-readable Markdown footer, so they're preserved in version control and readable outside the tool*

**AI-assisted stories:**
- *As a writer, I want to select text and ask AI to improve/simplify/expand it via context menu, so I can refine documentation quickly*
- *As a reviewer, I want AI to review my entire document and show suggestions as inline Git diffs, so I can accept/reject changes granularly*
- *As a user stuck on documentation, I want a sidebar chat with AI that has full document context, so I can ask questions and get help*

**MCP integration stories:**
- *As a developer using Claude Code, I want my documentation repository exposed via MCP, so Claude can read my requirements and specs*
- *As a developer, I want Claude Code to search across all my docs for relevant context when I'm coding*
- *As a developer, I want Claude Code to understand which doc sections are linked to the task I'm working on*
- *As a developer, I want to ask Claude Code "what are the requirements for the auth system?" and have it query my docs*

### Core requirements for MVP

**Markdown editing (Priority 1 - Must Have):**
- Two editing modes, switchable via tab:
  - **Raw Markdown mode**: Plain text editor showing actual markdown syntax
  - **WYSIWYG mode**: Standard rich text editor with formatting toolbar (Bold, Italic, Underline, Headings, Lists, Links, Code, etc.) — no markdown syntax visible, looks like Google Docs or Word
- Underlying file is always plain `.md` — switching modes just changes the view
- Full CommonMark + GFM support (tables, checkboxes, fenced code blocks)
- File tree sidebar with expand/collapse, search, create/rename/delete operations
- Keyboard shortcuts for all formatting (Cmd+B bold, Cmd+I italic, etc.)
- Command palette (Cmd+K) for all actions

**Git integration (Priority 1 - Must Have):**
- Save button creates Git commit with auto-generated message
- Visual diff view for changes since last commit
- Branch switching support
- Basic conflict resolution UI
- .gitignore respect

**Commenting system (Priority 1 - Must Have):**
- Highlight text → Add comment via button or Cmd+Shift+M
- Comments displayed in right margin, visually connected to highlighted text
- Comment metadata stored in Markdown footer: `<!-- COMMENTS: [{"range": "L12-C5:L12-C25", "text": "Consider rewording", "author": "john@example.com", "timestamp": "2025-12-09T10:30:00Z"}] -->`
- Threading support (reply to comments)
- Resolve/archive comments

**AI features (Priority 2 - Should Have for MVP):**
- Context menu AI: Select text → Right-click → AI actions (Improve, Simplify, Expand, Explain)
- Full document AI review generating inline diffs with accept/reject per suggestion
- Sidebar AI chat with document context

**MCP integration (Priority 2 - Should Have for MVP):**
- MCP server exposing tools: `get_document`, `search_docs`, `list_documents`, `get_section`
- MCP resources: `docs://repo/{repoId}`, `docs://doc/{docId}`, `docs://doc/{docId}/section/{sectionId}`
- Full-text search across all documents in a repository
- Section-level access for granular context (e.g., just the "Authentication" section of a PRD)
- Authentication via OAuth 2.1 with PKCE
- Claude Code configuration via `.mcp.json` in project root

### AI implementation patterns to adopt

Based on analysis of GitHub Copilot, Cursor, and Notion AI, implement a **three-tier AI invocation system**:

1. **Inline suggestions** (lowest friction): Ghost text completions while typing, accepted with Tab
2. **Context menu actions** (medium friction): Right-click selection reveals AI menu with 4-6 predefined actions plus "Ask AI about this..."
3. **Sidebar chat** (highest friction, most powerful): Full conversational interface with document context

**Diff presentation for AI review**: Show original vs. suggested text inline—deletions struck-through in red, additions underlined in green. Provide per-suggestion accept/reject buttons plus "Accept All"/"Reject All" for bulk actions. Always include "Try again" option.

### MCP implementation guidance

**Required MCP server structure:**
```
docs-editor-mcp/
├── src/
│   ├── index.ts          # Server entry point
│   ├── tools/            # MCP tools (get_document, search_docs, etc.)
│   ├── resources/        # MCP resources (doc, section URIs)
│   └── api/              # Docs editor API client
├── package.json
└── .mcp.json             # Claude Code configuration
```

**Essential MCP tools to expose:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_document` | Retrieve full document by ID | `docId: string` |
| `get_section` | Retrieve specific section of a doc | `docId: string, sectionId: string` |
| `search_docs` | Full-text search across repository | `query: string, repoId?: string` |
| `list_documents` | List all docs in a repository | `repoId: string` |
| `get_doc_outline` | Get document structure/headings | `docId: string` |

**Data structure for AI consumption:**
```json
{
  "id": "doc-789",
  "title": "Auth System Requirements",
  "path": "/requirements/auth-system.md",
  "repository": { "id": "repo-123", "name": "product-specs" },
  "sections": [
    { "id": "sec-1", "heading": "Overview", "level": 1 },
    { "id": "sec-2", "heading": "User Stories", "level": 2 },
    { "id": "sec-3", "heading": "Technical Requirements", "level": 2 }
  ],
  "content": "# Auth System Requirements\n\n## Overview\n...",
  "lastModified": "2025-12-09T10:30:00Z",
  "linkedTasks": [
    { "id": "TASK-123", "title": "Implement login flow" }
  ]
}
```

### MVP scope recommendation

**Phase 1 (MVP):**
- Dual-mode editing: Raw Markdown + WYSIWYG rich text editor with formatting toolbar
- File tree sidebar with basic operations
- Git commit on save with diff view
- Right-margin inline comments stored in footer
- Basic AI context menu (using Claude API)
- Basic MCP server with read operations (get_document, search_docs, list_documents)

**Phase 2 (Fast-follow):**
- Full document AI review with inline diffs
- Sidebar AI chat
- Branch management UI
- Comment threading and resolution
- MCP section-level access and document outline

**Phase 3 (Growth):**
- Real-time collaboration (optional, against stated scope)
- Export to multiple formats (PDF, HTML, Docusaurus)
- Custom AI prompts and style guide enforcement

### Feature prioritization matrix

| Feature | User Value | Differentiation | Complexity | Priority |
|---------|------------|-----------------|------------|----------|
| Dual-mode editing (WYSIWYG + Raw) | High | High | Medium | P1 |
| Git commit on save | High | High | Low | P1 |
| Inline comments in footer | High | Very High | Medium | P1 |
| File tree sidebar | Medium | Low | Low | P1 |
| MCP integration (read) | Medium | Very High | Medium | P1 |
| AI context menu | Medium | Medium | Medium | P2 |
| Full document AI review | High | High | High | P2 |
| Sidebar AI chat | Medium | Medium | Medium | P2 |
| Branch management | Medium | Medium | Medium | P2 |
| MCP section-level access | Medium | High | Low | P2 |

---

## Product 2: Lightweight Kanban Board Task Manager

### Developer tool market is polarized between complexity and capability

The project management landscape reveals a clear pattern: **JIRA** delivers comprehensive features but frustrates with slow performance and overwhelming complexity. **Trello** offers instant comprehension but lacks task hierarchy and prioritization. **Linear** threads the needle with exceptional speed and keyboard-first design but has limited mobile support.

**Key competitive insight**: Position between Linear's simplicity and Shortcut's features, with better mobile support—specifically targeting solo developers and small teams (2-10 people) who need kanban with epic/task hierarchy without JIRA's overhead.

| Competitor | Speed | Hierarchy | Prioritization | Keyboard-First | MCP Support |
|------------|-------|-----------|----------------|----------------|-------------|
| **JIRA** | ❌ Slow | Epic→Story→Subtask | ✅ Backlog ranking | 🟡 Partial | ❌ None |
| **Trello** | ✅ Fast | ❌ Checklists only | 🟡 Manual ordering | ❌ Limited | ❌ None |
| **Linear** | ✅ Instant | Project→Issue→Sub-issue | ✅ Priority fields | ✅ Excellent | ❌ None |
| **Shortcut** | 🟡 Good | Objective→Epic→Story→Task | ✅ Drag ranking | 🟡 Good | ❌ None |
| **Target Product** | ✅ Instant | Epic→Task (2-level) | ✅ Ranked backlog | ✅ Full | ✅ Native |

### Why Linear wins developer hearts (and how to learn from it)

Linear's success stems from six principles this product should adopt:

1. **Performance as feature**: Sub-500ms load times make it feel native. Target this benchmark.
2. **Keyboard-first design**: 50+ shortcuts, hover+shortcut pattern (hover over row, press shortcut to apply). Implement from day one.
3. **Opinionated defaults**: Pre-built Triage → Backlog → In Progress → Done workflow. No configuration required to start.
4. **2-click issue creation**: No modal forms—quick capture with minimal friction.
5. **Command menu (Cmd+K)**: Access any action via fuzzy search.
6. **Beautiful design**: Developers spend all day here; it should feel premium.

### User stories for kanban board

**Core workflow stories:**
- *As a solo developer, I want a kanban board with Ready, In Progress, and Done columns, so I can visualize my work state at a glance*
- *As a team lead, I want to create epics that contain multiple tasks, so I can organize work hierarchically*
- *As a developer, I want to drag epics up and down within a column to set priority, so the most important work is always at the top*
- *As a developer, I want keyboard shortcuts for all common actions (N for new task, M to move), so I can work without touching my mouse*
- *As a user, I want sub-500ms page loads, so the tool feels instant*

**MCP integration stories:**
- *As a developer using Claude Code, I want my kanban board exposed via MCP, so Claude can read my tasks and understand what I'm working on*
- *As a developer, I want Claude Code to see my highest-priority epics and tasks, so it has context when helping me code*
- *As a developer, I want to ask Claude Code "what should I work on next?" and have it query my ranked backlog*
- *As a developer, I want Claude Code to fetch the requirement documents linked to my current task, so it understands the full context of what I'm building*

### Core requirements for MVP

**Board functionality (Priority 1 - Must Have):**
- Kanban board with three columns: Ready, In Progress, Done
- Epic → Task two-level hierarchy (intentionally simple)
- Drag-and-drop for epics between columns (horizontal movement)
- Drag-and-drop for epics within columns to set priority rank (vertical reordering)
- Tasks inherit column from their parent epic, or can be moved independently
- CRUD operations: Create, Read, Update, Delete for both epics and tasks
- Epic card display: title, assignee avatar, priority rank, progress indicator (X/Y tasks complete)
- Task card display: title, assignee avatar, due date (optional)
- WIP limits per column with visual indicators (optional but recommended)

**Performance (Priority 1 - Must Have):**
- Target sub-500ms initial load
- Optimistic UI updates (show change immediately, sync in background)
- Real-time sync via WebSockets
- Offline-first architecture with sync on reconnect

**Keyboard navigation (Priority 1 - Must Have):**
- N: Create new task
- C: Create new task (alternative)
- Enter: Open selected card
- Escape: Close modal
- ←/→: Move card between columns
- ↑/↓: Navigate cards
- Space or M: Assign to me
- /: Quick search/filter
- Cmd+K: Command palette
- ?: Show keyboard shortcuts reference

**MCP integration (Priority 2 - Should Have for MVP):**
- MCP server exposing tools: `get_task`, `get_epic`, `search_tasks`, `get_backlog`, `create_task`, `update_task`
- MCP resources: `kanban://backlog`, `kanban://epic/{id}`, `kanban://task/{id}`
- Authentication via OAuth 2.1 with PKCE
- Claude Code configuration via `.mcp.json` in project root

### MCP implementation guidance

Based on the MCP protocol research, implement these components:

**Required MCP server structure:**
```
kanban-board-mcp/
├── src/
│   ├── index.ts          # Server entry point
│   ├── tools/            # MCP tools (get_task, get_backlog, etc.)
│   ├── resources/        # MCP resources (epic, task URIs)
│   └── api/              # Kanban board API client
├── package.json
└── .mcp.json             # Claude Code configuration
```

**Essential MCP tools to expose:**

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_task` | Retrieve task by ID | `taskId: string` |
| `get_epic` | Retrieve epic with its tasks | `epicId: string` |
| `search_tasks` | Query tasks with filters | `status?, epicId?, assignee?` |
| `get_backlog` | Get ranked list of epics by column | `column?: "ready" \| "in_progress" \| "done"` |
| `create_task` | Create new task | `title, description, epicId?` |
| `update_task` | Modify task fields | `taskId, fields to update` |
| `get_linked_docs` | Fetch requirement docs linked to task | `taskId: string` |

**Data structure for AI consumption:**
```json
{
  "id": "TASK-123",
  "title": "Implement login flow",
  "description": "User authentication with OAuth",
  "status": "in_progress",
  "epic": { 
    "id": "EPIC-45", 
    "title": "Auth System",
    "rank": 1,
    "column": "in_progress"
  },
  "acceptanceCriteria": ["...", "..."],
  "linkedDocs": [
    { "id": "doc-789", "path": "/requirements/auth-system.md", "title": "Auth System Requirements" }
  ]
}
```

### MVP scope recommendation

**Phase 1 (MVP):**
- Kanban board with Ready, In Progress, Done columns
- Epic → Task hierarchy
- Drag-and-drop: epics between columns, epics within columns for ranking
- Full CRUD operations
- Keyboard shortcuts (core set)
- Sub-500ms performance target
- Basic MCP server with read operations

**Phase 2 (Fast-follow):**
- MCP write operations (create/update tasks)
- Mobile-optimized responsive design
- Filtering and search
- GitHub/GitLab integration for issue linking
- Epic progress visualization

**Phase 3 (Growth):**
- Custom columns (beyond the core three)
- Time tracking
- Reporting dashboard
- Team management

### Feature prioritization matrix

| Feature | User Value | Differentiation | Complexity | Priority |
|---------|------------|-----------------|------------|----------|
| Kanban board (3 columns) | High | Low | Low | P1 |
| Epic→Task hierarchy | High | Medium | Low | P1 |
| Epic ranking (drag to reorder) | High | Medium | Low | P1 |
| Keyboard shortcuts | High | High | Low | P1 |
| Sub-500ms performance | High | High | Medium | P1 |
| MCP integration (read) | Medium | Very High | Medium | P1 |
| MCP write operations | Medium | High | Low | P2 |
| Mobile optimization | Medium | High | Medium | P2 |
| GitHub integration | Medium | Low | Medium | P2 |
| Filtering and search | Medium | Low | Low | P2 |

---

## Docs-to-Tasks integration opportunity

The research reveals a significant pain point: **30-50% of project rework stems from requirements errors**, largely because requirements live in documentation tools while tasks live in project management tools. Teams spend "hours copying, pasting, tagging, linking, estimating, assigning, and translating specs into JIRA boards."

### Integration between the two products

If both products are built, a powerful integration emerges:

1. **Bidirectional linking**: Tasks in kanban board link to sections in documentation; clicking a task shows its requirement context
2. **AI-powered task extraction**: "Generate tasks from this PRD" button in documentation editor creates epics/tasks in kanban board
3. **Living documentation**: Task status updates reflected in docs (requirement shows "3/5 tasks complete")
4. **Unified MCP context**: Claude Code accesses both documentation AND tasks through MCP, understanding the full picture:
   - Query docs: "What are the requirements for auth?"
   - Query tasks: "What's my highest priority work?"
   - Cross-reference: "Show me the requirements for the task I'm working on"

This addresses the market gap where no tool provides documentation-as-task-system—where writing a requirement can create a task, and completing a task updates the living spec.

---

## UX patterns to implement

### Documentation editor key patterns

**Markdown editing:**
- Tab-based mode switching: Raw Markdown ↔ WYSIWYG
- WYSIWYG mode: Clean rich text editor with formatting toolbar (like Google Docs)
- Raw mode: Syntax-highlighted plain text editor (like VS Code)
- Cmd+K command palette for all actions
- File tree with fuzzy search (Cmd+P for quick open)
- Synchronized scroll if split-pane view offered

**Commenting (Google Docs model):**
- Highlight text → comment icon appears → click to add
- Comments float in right margin connected by subtle line
- Cmd+Shift+M keyboard shortcut
- Threading with @mentions
- Resolve/reopen workflow

### Kanban board key patterns

**Drag-and-drop (Trello model):**
- Lift card with elevation shadow on grab
- Slight tilt during drag
- Ghost image at original position
- Cards shuffle as dragged item approaches
- 100ms drop animation
- Full keyboard alternative (←/→ to move between columns, ↑/↓ to reorder within column)

**Epic card design:**
- Compact cards showing: title, assignee avatar, priority rank indicator, progress (3/5 tasks)
- Visual distinction between epics and tasks (color, size, or icon)
- Hover reveals task list preview
- Click opens full modal with task list

**Column design:**
- Three fixed columns: Ready, In Progress, Done
- Column header shows count of epics
- Optional WIP limit indicator
- Clear visual separation between columns

---

## Technical architecture recommendations

### Documentation editor stack

- **Frontend**: React + TypeScript, ProseMirror or TipTap for WYSIWYG Markdown
- **Git integration**: isomorphic-git for browser-based Git operations, or libgit2 via WASM
- **AI integration**: Claude API via AWS Lambda
- **Storage**: IndexedDB for offline, S3 for sync
- **Desktop**: Electron for cross-platform

### Kanban board stack

- **Frontend**: React + TypeScript
- **Real-time**: WebSockets for instant sync
- **Backend**: Node.js/TypeScript on AWS Lambda
- **Database**: DynamoDB for low-latency reads
- **MCP server**: TypeScript using `@modelcontextprotocol/sdk`
- **Auth**: OAuth 2.1 with PKCE for MCP

---

## Summary: Key differentiators by product

### Documentation Editor
1. **True Markdown files** that work in any editor (vs. Notion's proprietary blocks)
2. **Git-native version control** where save = commit (vs. Confluence's separate version systems)
3. **Comments stored in human-readable footer** (vs. comments trapped in proprietary formats)
4. **Dual-mode editing**: Clean WYSIWYG rich text editor + raw markdown, in a web-based collaborative tool
5. **MCP integration**: Claude Code can search and read your docs for context while coding

### Kanban Board
1. **MCP integration with Claude Code** (no competitor offers this)
2. **Linear-class performance**
3. **Mobile-first design** (Linear's weakness)
4. **Intentionally simple**: Epic→Task hierarchy, three columns (Ready, In Progress, Done), ranked backlog
5. **Linked requirements fetching** (Claude Code can access the full context behind any task)

Both products together address the docs-to-tasks workflow gap that frustrates product teams across the industry.
