# Document Folder Selection Implementation Plan

## Overview

Implement the UI/UX for selecting document folders when connecting a repository to a project. Folder selection happens on the Pages page (not in the create dialog), with the same UI for initial setup and later modifications.

**Spec:** `/docs/specs/doc-folder-selection.md`
**Config:** `/shared/core/src/config/doc-folder-patterns.json` (already created)

---

## User Flow

### 1. Create Project Dialog

```
┌─────────────────────────────────────────────┐
│ Create Project                              │
├─────────────────────────────────────────────┤
│ Name: [____________________]                │
│ Description: [____________] (optional)      │
│                                             │
│ ── Connect Repository ──────────────────────│
│                                             │
│ (Desktop only: storage mode selector)       │
│ ○ GitHub Repository                         │
│ ○ Local Git Repository                      │
│ ○ Local Folder              [Coming soon]   │
│                                             │
│ Repository: [owner/repo            ▼]       │
│ Branch:     [main                  ▼]       │
│                                             │
│                    [Cancel]  [Create]       │
└─────────────────────────────────────────────┘
```

**In dialog:** Name, description, storage mode (desktop), repo, branch
**NOT in dialog:** Folder selection (rootPaths)

### 2. After Create → Navigate to Pages

After successful creation, redirect to `/projects/:id/pages`

### 3. Pages Shows Folder Picker

Since no `rootPaths` are configured yet, immediately show the folder picker UI:

```
┌─────────────────────────────────────────────────────────────────┐
│ Pages                                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Select Document Folders                                    │ │
│  │                                                            │ │
│  │ Choose which folders from your repository to display.      │ │
│  │                                                            │ │
│  │ ☑ /docs                      12 docs                       │ │
│  │   ├─ ● getting-started/       3 docs                       │ │
│  │   ├─ ● api/                   8 docs                       │ │
│  │   └─ ● guides/                1 doc                        │ │
│  │                                                            │ │
│  │ ☐ /wiki                       4 docs                       │ │
│  │ ☐ /content                    2 docs                       │ │
│  │                                                            │ │
│  │ [+ Browse all folders...]                                  │ │
│  │                                                            │ │
│  │                                          [Save Selection]  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Post-Creation Management

Same folder picker UI accessible from FileBrowser:
- Menu button in header: `[⋮]` → "Manage Folders..."
- Opens the same FolderPicker component/dialog
- Changes take effect immediately after save

---

## Phase 1: Dependencies & Backend

### 1.1 Add `ignore` package

**File:** `api/package.json`

```bash
npm install ignore
```

### 1.2 Create gitignore utilities

**File:** `api/src/utils/gitignore.ts`

```typescript
import ignore from 'ignore';

export async function loadGitignoreFromGitHub(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string
): Promise<ReturnType<typeof ignore>>;

export function isIgnored(ig: ReturnType<typeof ignore>, path: string): boolean;
```

### 1.3 New API endpoint: Get repository folder tree

**File:** `api/src/handlers/github.ts`

```
GET /api/github/repos/:owner/:repo/tree?branch=:branch
```

Response:
```json
{
  "folders": [
    {
      "path": "/docs",
      "name": "docs",
      "markdownCount": 12,
      "category": "preselect",
      "children": [...]
    }
  ]
}
```

Logic:
1. Use GitHub Trees API (`GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=true`)
2. Filter to directories only
3. Count `.md`/`.mdx` files per folder
4. Apply `docFolderPatterns` from `@doc-platform/core` to categorize
5. Fetch `.gitignore` from repo, filter out ignored folders (hard block)
6. Cache response (5 min TTL in Redis)

### 1.4 New API endpoint: Update project root paths

**File:** `api/src/handlers/projects.ts`

```
PUT /api/projects/:id/root-paths
```

Request:
```json
{
  "rootPaths": ["/docs", "/guides"]
}
```

---

## Phase 2: Models

### 2.1 GitHubFolderTreeCollection

**File:** `shared/models/src/github.ts`

```typescript
export interface FolderNode {
  path: string;
  name: string;
  markdownCount: number;
  category: 'preselect' | 'suggest' | 'normal';
  children: FolderNode[];
}

export class GitHubFolderTreeCollection extends SyncCollection<FolderNode> {
  static url = '/api/github/repos/:owner/:repo/tree';
}
```

### 2.2 Update ProjectModel

**File:** `shared/models/src/project.ts`

Add method:
```typescript
async updateRootPaths(rootPaths: string[]): Promise<void>
```

---

## Phase 3: UI Components

### 3.1 StorageModeSelector (Desktop only)

**File:** `shared/projects/ProjectDialog/StorageModeSelector.tsx`

Radio buttons:
- GitHub Repository
- Local Git Repository
- Local Folder [Coming soon - disabled]

Only rendered when `isDesktop === true`.

### 3.2 FolderPicker component

**File:** `shared/pages/FileBrowser/FolderPicker.tsx`

Core folder selection UI with tree + checkboxes.

```typescript
interface FolderPickerProps {
  folders: FolderNode[];
  selected: string[];
  onChange: (selected: string[]) => void;
  loading?: boolean;
}
```

Behavior:
- Checkbox per folder
- Checked folder → children show `●` (included, not selectable)
- Unchecking parent re-enables children
- Pre-check folders with `category: 'preselect'`
- Show markdown count
- `[Has docs]` badge for `suggest` category
- Gitignored folders already filtered out by API

### 3.3 FolderPickerPanel component

**File:** `shared/pages/FileBrowser/FolderPickerPanel.tsx`

Wrapper that shows:
- Header with title/description
- FolderPicker component
- "Browse all folders..." link → opens FolderPickerDialog
- Save button

Used both for initial setup (shown inline on Pages) and management (in dialog).

### 3.4 FolderPickerDialog component

**File:** `shared/pages/FileBrowser/FolderPickerDialog.tsx`

Dialog wrapper around FolderPickerPanel for the "Manage Folders" action.

---

## Phase 4: Update ProjectDialog

**File:** `shared/projects/ProjectDialog/ProjectDialog.tsx`

Changes:
1. Add StorageModeSelector (conditionally rendered for desktop)
2. Keep existing repo/branch pickers
3. **Remove** any folder selection (was never fully implemented anyway)
4. On successful create, navigate to `/projects/:id/pages`

---

## Phase 5: Update Pages / FileBrowser

### 5.1 Detect missing rootPaths

**File:** `shared/pages/FileBrowser/FileBrowser.tsx`

When `project.rootPaths` is empty:
- Don't show empty file tree
- Show FolderPickerPanel inline instead

### 5.2 Add "Manage Folders" menu

**File:** `shared/pages/FileBrowser/FileBrowser.tsx`

Add menu to header:
```
Files [⋮]
      └─ Manage Folders...  → Opens FolderPickerDialog
```

### 5.3 Handle folder changes

When rootPaths are updated:
- Reload file tree
- If current file is outside new rootPaths, clear selection

---

## Files to Modify/Create

| File | Change |
|------|--------|
| `api/package.json` | Add `ignore` dependency |
| `api/src/handlers/github.ts` | Add tree endpoint |
| `api/src/handlers/projects.ts` | Add root-paths PUT endpoint |
| `api/src/utils/gitignore.ts` | New - gitignore utilities |
| `shared/models/src/github.ts` | Add FolderTreeCollection |
| `shared/models/src/index.ts` | Export new model |
| `shared/projects/ProjectDialog/ProjectDialog.tsx` | Add storage mode, navigate after create |
| `shared/projects/ProjectDialog/StorageModeSelector.tsx` | New component (desktop only) |
| `shared/pages/FileBrowser/FileBrowser.tsx` | Show FolderPickerPanel when no rootPaths, add menu |
| `shared/pages/FileBrowser/FolderPicker.tsx` | New - core folder selection tree |
| `shared/pages/FileBrowser/FolderPickerPanel.tsx` | New - panel wrapper with save button |
| `shared/pages/FileBrowser/FolderPickerDialog.tsx` | New - dialog for "Manage Folders" |

**Already created:**
- `docs/specs/doc-folder-selection.md`
- `shared/core/src/config/doc-folder-patterns.json`
- `shared/core/src/config/doc-folder-patterns.ts`

---

## Implementation Order

1. **API: tree endpoint** - Fetch folder structure from GitHub
2. **API: root-paths endpoint** - Update project rootPaths
3. **Model: FolderTreeCollection** - Frontend data fetching
4. **FolderPicker component** - Core selection UI
5. **FolderPickerPanel** - Panel with save functionality
6. **FileBrowser integration** - Show panel when no rootPaths, add menu
7. **ProjectDialog update** - Storage mode selector, navigate after create
8. **FolderPickerDialog** - For "Manage Folders" action

---

## Verification

### Manual Testing

1. **Create new project (web)**
   - Enter name, select GitHub repo + branch
   - Click Create
   - Verify redirect to Pages
   - Verify FolderPickerPanel shown immediately

2. **Initial folder selection**
   - Verify `/docs` (or other preselect folders) are pre-checked
   - Verify children show as included (●)
   - Select folders, click Save
   - Verify FileBrowser now shows selected folders

3. **Gitignore blocking**
   - Test with repo that has `/node_modules`, `/dist` in .gitignore
   - Verify those folders don't appear in picker

4. **Manage Folders (post-creation)**
   - Open FileBrowser menu → "Manage Folders..."
   - Verify current selection is shown
   - Add/remove folders
   - Save, verify FileBrowser updates

5. **Desktop storage mode**
   - In Electron/dev, verify storage mode selector appears
   - Verify Local Folder is disabled with "Coming soon"

### Automated Tests

- Unit tests for `categorizeFolderPath()`
- Unit tests for gitignore utilities
- Integration test for tree API endpoint
- Integration test for root-paths endpoint
- Component tests for FolderPicker selection logic

---

## Out of Scope (Future)

- Local Git mode implementation (native folder picker)
- Local Files mode (no git)
- Nested .gitignore support (only root for now)
- "Create folder" option for empty repos
