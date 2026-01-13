# Document Folder Selection Specification

This specification defines the user experience for selecting which folders from a connected repository should be displayed as documentation folders ("doc folders").

---

## Overview

Folder selection is **separated from project creation**:
1. **Create Project Dialog** - Name, description, storage mode (desktop only), repository, branch
2. **Pages Page** - Folder selection happens here, immediately after project creation

This separation keeps the creation dialog simple and puts all folder management in one place.

---

## Storage Mode Selection (Desktop Only)

When creating a project on desktop (Electron or local dev), users choose from three storage modes.

**On web:** Storage mode selector is hidden. GitHub is the only option.

### The Three Modes

| Mode | Platform | Description | Status |
|------|----------|-------------|--------|
| **GitHub Repository** | Web + Desktop | Connect to GitHub repository. Files stored in cloud-managed checkout. | Implementing |
| **Local Git Repository** | Desktop only | Select local git repository folder. Files on local filesystem. | Implementing |
| **Local Folder** | Desktop only | Select local folder (no git). Simple file storage without version control. | Future |

---

## User Flow

### Step 1: Create Project Dialog

**Web version (GitHub only):**
```
┌─────────────────────────────────────────────────────────────────┐
│ Create Project                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Name: [My Documentation           ]                             │
│ Description: [                    ] (optional)                  │
│                                                                 │
│ ── Connect Repository ──────────────────────────────────────────│
│                                                                 │
│ Repository: [owner/repo                ▼]                       │
│ Branch:     [main                      ▼]                       │
│                                                                 │
│                              [Cancel]  [Create]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Desktop version (with storage mode selector):**
```
┌─────────────────────────────────────────────────────────────────┐
│ Create Project                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Name: [My Documentation           ]                             │
│ Description: [                    ] (optional)                  │
│                                                                 │
│ ── Connect Repository ──────────────────────────────────────────│
│                                                                 │
│ ○ GitHub Repository                                             │
│ ○ Local Git Repository                                          │
│ ○ Local Folder                              [Coming soon]       │
│                                                                 │
│ Repository: [owner/repo                ▼]                       │
│ Branch:     [main                      ▼]                       │
│                                                                 │
│                              [Cancel]  [Create]                 │
└─────────────────────────────────────────────────────────────────┘
```

**What's in the dialog:**
- Project name (required)
- Description (optional)
- Storage mode selector (desktop only)
- Repository picker
- Branch picker

**What's NOT in the dialog:**
- Folder selection (happens on Pages page)

### Step 2: Redirect to Pages

After successful project creation, automatically navigate to:
```
/projects/:id/pages
```

### Step 3: Folder Selection on Pages

Since no `rootPaths` are configured yet, the Pages page shows the folder picker immediately:

```
┌─────────────────────────────────────────────────────────────────┐
│ Pages                                               [← Back]    │
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
│  │ ☐ /content                    2 docs       [Has docs]      │ │
│  │                                                            │ │
│  │ [+ Browse all folders...]                                  │ │
│  │                                                            │ │
│  │                                        [Save Selection]    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

☑ = Pre-checked (conventional doc folder like /docs, /wiki, /content)
● = Included (child of checked folder, not separately selectable)
☐ = Unchecked but available
[Has docs] = Badge indicating folder contains markdown files
```

### Step 4: Post-Creation Management

Same folder picker UI accessible anytime from FileBrowser header menu:

```
Files [⋮]
      └─ Manage Folders...  → Opens folder picker dialog
```

---

## Folder Selection Semantics

### What is a rootPath?

A `rootPath` is an *entry point* into the repository. When you add `/docs` as a rootPath:
- The file browser shows `/docs` as a top-level folder
- ALL contents of `/docs` are visible (subfolders, files, everything)
- You don't need to separately select `/docs/guides` - it's already included

### Parent/Child Selection Rules

**Core rule: Selecting a folder includes all its contents. You cannot select a parent and child separately.**

| User Action | Result |
|-------------|--------|
| Select `/docs` | See everything in `/docs` including `/docs/guides/*`, `/docs/api/*`, etc. |
| Select `/docs/guides` only | See only `/docs/guides` and its contents. NOT `/docs/api`. |
| Try to select both `/docs` AND `/docs/guides` | **Not allowed.** `/docs/guides` is already included in `/docs`. |

### UI Behavior for Selection

When a folder is checked:
1. **Children become visually "included"** - Show with a different indicator (●) instead of checkbox
2. **Children are not independently selectable** - Checkboxes disabled or hidden
3. **Parent-to-child:** Checking a parent disables all descendant checkboxes
4. **Child-to-parent:** Checking a child does NOT affect the parent

**Visual example:**
```
☑ /docs                          ← Selected as rootPath
   ├─ ● getting-started/         ← Included (not a checkbox, just indicator)
   ├─ ● api/                     ← Included
   └─ ● guides/                  ← Included
☐ /packages                      ← Available to select
   ├─ ☐ sdk/                     ← Available to select
   │   └─ ☐ docs/                ← Available to select
   └─ ☐ cli/                     ← Available to select
```

### Why Not Auto-Select Root?

We **never** auto-select the repository root (`/`) as a default because:
1. **Noise:** Most repos have tons of non-documentation files (src, node_modules, config files)
2. **Performance:** Sparse checkout won't help if we're checking out everything
3. **Focus:** Forces users to think about what they actually want to document
4. **Intent:** If someone really wants root, they can explicitly select it

---

## Smart Default Rules

Folder detection behavior is driven by a config file: `shared/core/src/config/doc-folder-patterns.json`

**Three categories of folders:**

| Category | Behavior | Examples |
|----------|----------|----------|
| **Preselect** | Auto-checked if exists with markdown | `/docs`, `/doc`, `/documentation`, `/wiki`, `/guides`, `/content` |
| **Suggest** | Highlighted but not checked | `/manual`, `/help`, `/reference`, `/specs`, `/api-docs` |
| **Ignore** | Hidden from picker entirely | `/node_modules`, `/.git`, `/dist`, `/build`, `/coverage` |

**Gitignore Integration:**

Folders matching patterns in the repository's `.gitignore` are **hard blocked** - they don't appear in the folder picker at all. This is implemented using the `ignore` npm package.

**Rules applied in order:**
1. If folder matches `.gitignore` → hide from picker (hard block)
2. If folder matches `ignore` pattern in config → hide from picker
3. If folder matches `preselect` pattern AND has markdown → auto-check
4. If folder matches `suggest` pattern AND has markdown → highlight with badge
5. If folder has markdown but matches neither → show normally
6. If no markdown anywhere → prompt to create `/docs`

---

## Folder Picker Dialog (Browse All)

For "Browse all folders..." or when many folders exist, show a full tree browser:

```
┌─────────────────────────────────────────────────────────────────┐
│ Select Document Folders                               [×]       │
├─────────────────────────────────────────────────────────────────┤
│ Select folders to display as documentation in your project.    │
│                                                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ 🔍 [Filter folders...                               ]     │   │
│ │                                                           │   │
│ │ ☑ /docs                                    12 docs        │   │
│ │   ├─ ● getting-started/                     3 docs        │   │
│ │   ├─ ● api/                                 8 docs        │   │
│ │   └─ ● guides/                              1 doc         │   │
│ │ ☐ /packages                                               │   │
│ │   ├─ ☐ sdk/                                               │   │
│ │   │   └─ ☐ docs/                            4 docs        │   │
│ │   └─ ☐ cli/                                               │   │
│ │ ☐ /wiki                                     0 docs        │   │
│ │                                                           │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│ Selected: 1 folder • 12 documents                               │
│                                                                 │
│                                       [Cancel]  [Save]          │
└─────────────────────────────────────────────────────────────────┘
```

**Key features:**

1. **Filter/search** - For large repos, find folders by name
2. **Markdown counts** - Shows "12 docs" (counts .md/.mdx only)
3. **Parent/child behavior** - Selecting parent shows children as included (●)
4. **Dimmed folders with 0 docs** - Still selectable, but visually de-emphasized
5. **Selection summary** - Shows total impact at bottom

---

## User Scenarios

### Scenario A: Repository with existing /docs folder
Most common case. User has a repo with a `/docs` folder containing markdown files.

**Expected behavior:**
- System detects `/docs` folder with markdown content
- `/docs` is pre-checked in the folder picker
- User can accept default or modify

### Scenario B: Repository with documentation in multiple locations
Monorepo with docs in `/docs`, `/packages/api/docs`, `/guides`, etc.

**Expected behavior:**
- System shows all folders containing markdown
- Pre-checks conventional folders (`/docs`, `/guides`, etc.)
- User can multi-select which to include

### Scenario C: Empty repository or no markdown files
User wants to start fresh or add documentation to a repo that doesn't have any.

**Expected behavior:**
- Show prompt to create a folder
- Offer `/docs` as recommended default
- User can choose a different location

### Scenario D: Changing folder selection after initial setup
User realizes they need to add or remove folders from their project view.

**Expected behavior:**
- Click menu in FileBrowser → "Manage Folders..."
- Same folder picker dialog opens with current selection
- Changes take effect immediately after save

---

## API Requirements

### New Endpoint: Get Repository Folder Tree

```
GET /api/github/repos/:owner/:repo/tree?branch=:branch
```

**Response:**
```json
{
  "folders": [
    {
      "path": "/docs",
      "name": "docs",
      "markdownCount": 12,
      "category": "preselect",
      "children": [
        {
          "path": "/docs/getting-started",
          "name": "getting-started",
          "markdownCount": 3,
          "category": "normal",
          "children": []
        }
      ]
    }
  ]
}
```

**Implementation notes:**
- Use GitHub Trees API (`GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=true`)
- Filter to only directories
- Count `.md` and `.mdx` files per folder
- Fetch `.gitignore` and filter out ignored folders
- Apply `docFolderPatterns` config to set category
- Cache response (5 minutes TTL in Redis)
- Limit depth to 4 levels to prevent performance issues

### New Endpoint: Update Root Paths

```
PUT /api/projects/:id/root-paths
```

**Request body:**
```json
{
  "rootPaths": ["/docs", "/guides"]
}
```

**Validation:**
- `rootPaths` must be non-empty array
- Paths must exist in repository
- Paths must not be gitignored

---

## Edge Cases

### Large Repositories

**Problem:** Repos with 1000+ folders would be slow to fetch and render.

**Solution:**
1. Fetch full tree but limit depth to 4 levels
2. Show "X more folders..." with expand button after 50 items at any level
3. Encourage search/filter over browsing

### Permission Errors

**Problem:** User may not have access to view tree for private repo.

**Solution:**
1. Show friendly error: "Unable to load repository structure"
2. Offer manual path entry as fallback
3. Link to GitHub permission settings

### Repository Structure Changes

**Problem:** Selected folder may be deleted/renamed in git.

**Solution:**
1. On file tree load, validate rootPaths still exist
2. If folder missing, show warning: "Folder '/old-docs' no longer exists"
3. Offer to remove from selection

### Gitignored Folders

**Problem:** User tries to select a gitignored folder.

**Solution:**
- Hard block - gitignored folders don't appear in picker at all
- They're filtered out server-side before response

---

## Accessibility

- Checkboxes must have proper labels
- Tree must be keyboard navigable (arrow keys)
- Screen readers should announce folder and document counts
- Focus management on dialog open/close
- "Included" indicator (●) needs accessible description

---

## Open Questions

1. ~~**Should selecting a parent auto-select children?**~~
   - **RESOLVED:** No. Selecting a parent *includes* children in the view, but children are not separate rootPaths.

2. **Should we show individual file selection?**
   - **RESOLVED:** No. Folder-level only. Individual files appear in file browser.

3. **Should empty folders be selectable?**
   - **RESOLVED:** Yes, dimmed but selectable. User might want to create docs there.

4. **Should we require at least one folder selected?**
   - **RESOLVED:** Yes. Must select at least one rootPath. "Save Selection" disabled until selection made.
