# Kanban Board UI Specification

This specification defines the user interface and interactions for the kanban board.

---

## Overview

A lightweight, keyboard-first kanban board with:
- Three fixed columns: Ready, In Progress, Done
- Epic → Task two-level hierarchy
- Drag-and-drop with keyboard alternatives
- Sub-500ms performance target

---

## Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Header                                                    [User] [Settings] │
│  ┌─────────────┐                                                            │
│  │ Project ▼   │  [Search /]                              [+ New Epic]      │
│  └─────────────┘                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Ready        (3) │  │ In Progress  (2) │  │ Done         (5) │          │
│  │ ─────────────────│  │ ─────────────────│  │ ─────────────────│          │
│  │                  │  │                  │  │                  │          │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │          │
│  │ │ Epic Card    │ │  │ │ Epic Card    │ │  │ │ Epic Card    │ │          │
│  │ │              │ │  │ │              │ │  │ │              │ │          │
│  │ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │          │
│  │                  │  │                  │  │                  │          │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌──────────────┐ │          │
│  │ │ Epic Card    │ │  │ │ Epic Card    │ │  │ │ Epic Card    │ │          │
│  │ │              │ │  │ │              │ │  │ │              │ │          │
│  │ └──────────────┘ │  │ └──────────────┘ │  │ └──────────────┘ │          │
│  │                  │  │                  │  │                  │          │
│  │ ┌──────────────┐ │  │                  │  │ ┌──────────────┐ │          │
│  │ │ Epic Card    │ │  │                  │  │ │ Epic Card    │ │          │
│  │ │              │ │  │                  │  │ │              │ │          │
│  │ └──────────────┘ │  │                  │  │ └──────────────┘ │          │
│  │                  │  │                  │  │                  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  [?] Keyboard shortcuts    Press ? for help                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

### Column

**Properties:**
- status: 'ready' | 'in_progress' | 'done'
- title: string
- epics: list of epics
- onDrop: handler for dropped epic

**Visual Design:**
- Fixed width: 320px
- Header: Status name + count badge
- Scrollable content area
- Drop zone highlight on drag over
- Optional WIP limit indicator

### Epic Card

**Properties:**
- epic: Epic data
- isSelected: boolean
- onSelect: selection handler
- onOpen: open detail handler
- onDragStart: drag handler

**Data Structure:**
```
Epic:
  id: string
  title: string
  status: 'ready' | 'in_progress' | 'done'
  rank: number
  tasks: Task[]
  assignee: User (optional)
```

**Visual Design:**
```
┌────────────────────────────────────────┐
│ ◆ Auth System                      👤  │  ← Title + Assignee avatar
│                                        │
│ ████████░░░░░░░░░░░░  3/7 tasks        │  ← Progress bar
│                                        │
│ #12 · Updated 2h ago                   │  ← ID + timestamp
└────────────────────────────────────────┘
```

**States:**
| State | Appearance |
|-------|------------|
| Default | Light background |
| Hover | Subtle elevation |
| Selected | Border highlight |
| Dragging | Elevated shadow, slight rotation |

### Task Card (in Epic Detail Modal)

**Properties:**
- task: Task data
- onToggleStatus: status toggle handler
- onEdit: edit handler

**Data Structure:**
```
Task:
  id: string
  title: string
  status: 'ready' | 'in_progress' | 'done'
  assignee: User (optional)
  dueDate: Date (optional)
```

**Visual Design:**
```
┌────────────────────────────────────────┐
│ ☐ Implement login form             👤  │
│   Due: Dec 25                          │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│ ☑ Design login UI                  👤  │  ← Completed (strikethrough)
└────────────────────────────────────────┘
```

### Epic Detail Modal

```
┌─────────────────────────────────────────────────────────────────┐
│                                                            [×]  │
│  ◆ Auth System                                                  │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Description                                        [Edit]      │
│  Implement user authentication including login,                 │
│  signup, and password reset flows.                              │
│                                                                 │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Tasks (3/7)                                    [+ Add Task]    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑ Design login UI                                    👤 │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑ Implement login API                                👤 │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☐ Implement login form                               👤 │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☐ Add form validation                                👤 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Linked Documents                              [+ Link Doc]     │
│                                                                 │
│  📄 /requirements/auth.md                                       │
│  📄 /specs/login-flow.md                                        │
│                                                                 │
│  ──────────────────────────────────────────────────────────────│
│                                                                 │
│  Status: In Progress ▼        Assignee: @john ▼                │
│                                                                 │
│  [Delete Epic]                              [Move to Done →]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Drag and Drop

### Behavior

1. **Grab**: Click and hold on epic card (200ms delay to allow click)
2. **Drag**: Card follows cursor with slight rotation
3. **Drop zones**: Other cards shuffle to show insertion point
4. **Release**: Card animates to final position

### Implementation Notes

- Use native drag events (no library for bundle size)
- Track: dragged epic ID, hover column, drop index
- On drag start: set dragged state, add visual feedback
- On drag over: calculate drop position, show insertion gap
- On drop: optimistic update, then API call
- On drag end: clear drag state

### Keyboard Alternative

| Shortcut | Action |
|----------|--------|
| `↑/↓` | Navigate between epics in column |
| `←/→` | Move epic between columns |
| `Shift+↑` | Move epic up in column (reorder) |
| `Shift+↓` | Move epic down in column (reorder) |

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| `N` | Create new epic |
| `C` | Create new task (in selected epic) |
| `/` | Focus search |
| `Cmd+K` | Open command palette |
| `?` | Show shortcuts help |
| `Escape` | Close modal / Deselect |

### Navigation

| Shortcut | Action |
|----------|--------|
| `↑` | Select previous epic |
| `↓` | Select next epic |
| `←` | Select epic in left column |
| `→` | Select epic in right column |
| `Enter` | Open selected epic |
| `Tab` | Cycle through columns |

### Actions (on selected epic)

| Shortcut | Action |
|----------|--------|
| `M` | Assign to me |
| `1` | Move to Ready |
| `2` | Move to In Progress |
| `3` | Move to Done |
| `Shift+↑` | Move up (reorder) |
| `Shift+↓` | Move down (reorder) |
| `E` | Edit epic |
| `Delete` | Delete epic (with confirmation) |

---

## Quick Create

### Epic Quick Create

Press `N` anywhere:

```
┌────────────────────────────────────────────────────────────────┐
│  New Epic                                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Epic title...                                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Press Enter to create, Escape to cancel                       │
└────────────────────────────────────────────────────────────────┘
```

- Inline input at top of "Ready" column
- Enter creates and focuses the new card
- Tab to add description before creating

### Task Quick Create

In epic detail modal, press `C` or click "+ Add Task":

```
┌──────────────────────────────────────────────────────────────┐
│ ☐ |                                                          │  ← Inline input
└──────────────────────────────────────────────────────────────┘
```

---

## Performance Optimizations

### Target: Sub-500ms Initial Load

1. **Minimal JavaScript bundle**
   - No heavy drag-drop library
   - Code-split modal components
   - Tree-shake unused code

2. **Efficient rendering**
   - Virtualize if >50 epics (unlikely but prepare)
   - Memoize epic cards
   - Batch state updates

3. **Optimistic updates**
   - Update UI immediately on user action
   - Sync to server in background
   - Revert on failure with error message

4. **Prefetch**
   - Prefetch epic details on hover
   - Cache API responses

---

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-background` | #f8f9fa | Page background |
| `--color-surface` | #ffffff | Column background |
| `--color-surface-hover` | #f1f3f4 | Hover states |
| `--color-card` | #ffffff | Card background |
| `--color-text` | #1a1a1a | Primary text |
| `--color-text-muted` | #6b7280 | Secondary text |
| `--color-border` | #e5e7eb | Borders |
| `--color-ready` | #3b82f6 | Ready status |
| `--color-in-progress` | #f59e0b | In Progress status |
| `--color-done` | #10b981 | Done status |
| `--color-primary` | #3b82f6 | Primary actions |
| `--color-primary-hover` | #2563eb | Primary hover |
| `--color-success` | #10b981 | Success states |
| `--color-error` | #ef4444 | Error states |

### Dimensions

| Element | Value |
|---------|-------|
| Column width | 320px |
| Card padding | 12px |
| Card margin | 8px |
| Card border radius | 6px |
| Column border radius | 8px |

---

## Responsive Considerations

Desktop-only for MVP, but structure for future mobile:

| Breakpoint | Behavior |
|------------|----------|
| Desktop (>768px) | Three columns side by side |
| Tablet (future) | Horizontal scroll or collapsed columns |
| Mobile (future) | Stack columns vertically, swipe between |

---

## Accessibility

- Full keyboard navigation
- Focus indicators on all interactive elements
- ARIA labels for screen readers
- Color not sole indicator (icons + text)
- Drag-and-drop has keyboard alternative

### ARIA Roles

| Element | Role | Attributes |
|---------|------|------------|
| Column | listbox | aria-label="Column name" |
| Epic card | option | aria-selected, tabindex |
| Modal | dialog | aria-modal, aria-labelledby |

---

## Component Structure

```
packages/kanban/
├── src/
│   ├── components/
│   │   ├── Board.tsx
│   │   ├── Column.tsx
│   │   ├── EpicCard.tsx
│   │   ├── TaskCard.tsx
│   │   ├── EpicModal.tsx
│   │   ├── QuickCreate.tsx
│   │   ├── KeyboardHelp.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useKeyboardNavigation.ts
│   │   ├── useDragDrop.ts
│   │   └── useEpics.ts
│   ├── styles/
│   │   ├── board.module.css
│   │   ├── column.module.css
│   │   ├── epic-card.module.css
│   │   └── tokens.css
│   └── index.ts
└── package.json
```
