# Markdown Serialization with Crash Recovery

## Goal
Enable loading/saving markdown files with localStorage crash recovery and save UI.

## Requirements
1. Load markdown files from FileBrowser into editor
2. Convert between Markdown ↔ Slate AST
3. Persist uncommitted changes to localStorage (crash recovery)
4. Track dirty state (current vs last saved)
5. Save button in UI with dirty indicator
6. Ctrl+S keyboard shortcut

## Architecture

### State Flow
```
File on Server (markdown string)
    ↓ load
DocumentModel.savedContent (Slate AST - last saved snapshot)
    ↓ edit
DocumentModel.content (Slate AST - current working state)
    ↓ persist
localStorage (crash recovery)
    ↓ save (button or Ctrl+S)
File on Server
```

### Storage Keys
- `doc.${projectId}:${filePath}` - persisted Slate content JSON

## Implementation

### Task 1: Serialization Utilities
Create `shared/pages/MarkdownEditor/serialization/`:

**fromMarkdown.ts**
```typescript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { remarkToSlate } from 'remark-slate-transformer';

export function fromMarkdown(markdown: string): Descendant[] {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkToSlate);
  const result = processor.processSync(markdown);
  return result.result as Descendant[];
}
```

**toMarkdown.ts**
```typescript
import { unified } from 'unified';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { slateToRemark } from 'remark-slate-transformer';

export function toMarkdown(content: Descendant[]): string {
  const processor = unified()
    .use(slateToRemark)
    .use(remarkGfm)
    .use(remarkStringify);
  const tree = processor.runSync({ type: 'root', children: content });
  return processor.stringify(tree);
}
```

### Task 2: Install Dependencies
```bash
pnpm --filter @doc-platform/pages add unified remark-parse remark-stringify remark-gfm remark-slate-transformer
```

### Task 3: Extend DocumentModel
Add to `shared/models/src/DocumentModel.ts`:

```typescript
@prop accessor filePath: string | null = null;
@prop accessor projectId: string | null = null;
@prop accessor savedContent: SlateContent = EMPTY_DOCUMENT;
@prop accessor saving: boolean = false;

get isDirty(): boolean {
  return JSON.stringify(this.content) !== JSON.stringify(this.savedContent);
}

loadDocument(projectId: string, filePath: string, content: SlateContent): void {
  this.documentId = crypto.randomUUID();
  this.projectId = projectId;
  this.filePath = filePath;
  this.title = filePath.split('/').pop() || 'Untitled';
  this.content = content;
  this.savedContent = JSON.parse(JSON.stringify(content));
  this.dirty = false;
}

markSaved(): void {
  this.savedContent = JSON.parse(JSON.stringify(this.content));
  this.dirty = false;
}
```

### Task 4: localStorage Persistence
Create `shared/models/src/documentPersistence.ts`:

```typescript
const STORAGE_PREFIX = 'doc.';

export function saveToLocalStorage(model: DocumentModel): void {
  if (!model.projectId || !model.filePath) return;
  const key = `${STORAGE_PREFIX}${model.projectId}:${model.filePath}`;
  localStorage.setItem(key, JSON.stringify({ content: model.content, savedAt: Date.now() }));
}

export function loadFromLocalStorage(projectId: string, filePath: string): SlateContent | null {
  const key = `${STORAGE_PREFIX}${projectId}:${filePath}`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  return JSON.parse(stored).content;
}

export function clearLocalStorage(projectId: string, filePath: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${projectId}:${filePath}`);
}
```

### Task 5: Editor Header with Save Button
Create `shared/pages/Editor/EditorHeader.tsx`:

```typescript
interface EditorHeaderProps {
  title: string;
  filePath: string | null;
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
}

export function EditorHeader({ title, filePath, isDirty, saving, onSave }: EditorHeaderProps) {
  return (
    <div class={styles.header}>
      <div class={styles.titleArea}>
        <span class={styles.title}>{title}</span>
        {isDirty && <span class={styles.dirtyIndicator}>●</span>}
      </div>
      {filePath && (
        <Button
          onClick={onSave}
          disabled={!isDirty || saving}
          variant={isDirty ? 'primary' : 'secondary'}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      )}
    </div>
  );
}
```

### Task 6: Wire Up Editor.tsx

```typescript
// File selection handler
const handleFileSelect = async (path: string) => {
  // Check for crash recovery
  const cached = loadFromLocalStorage(projectId, path);
  if (cached) {
    const useCached = confirm('Unsaved changes found. Restore?');
    if (useCached) {
      documentModel.loadDocument(projectId, path, cached);
      documentModel.dirty = true;
      return;
    }
    clearLocalStorage(projectId, path);
  }

  // Load from server
  const { content } = await fetchClient.get<{ content: string }>(
    `/api/projects/${projectId}/files?path=${encodeURIComponent(path)}`
  );
  const slateContent = fromMarkdown(content);
  documentModel.loadDocument(projectId, path, slateContent);
};

// Save handler
const handleSave = async () => {
  if (!documentModel.filePath) return;
  documentModel.saving = true;
  try {
    const markdown = toMarkdown(documentModel.content as Descendant[]);
    await fetchClient.put(
      `/api/projects/${projectId}/files?path=${encodeURIComponent(documentModel.filePath)}`,
      { content: markdown }
    );
    documentModel.markSaved();
    clearLocalStorage(projectId, documentModel.filePath);
  } finally {
    documentModel.saving = false;
  }
};

// Debounced localStorage persistence
useEffect(() => {
  if (!documentModel.filePath || !documentModel.isDirty) return;
  const timer = setTimeout(() => saveToLocalStorage(documentModel), 1000);
  return () => clearTimeout(timer);
}, [documentModel.content]);

// Ctrl+S handler
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

### Task 7: Update Layout
```tsx
<Page projectId={projectId} activeTab="Pages">
  <div class={styles.body}>
    <FileBrowser
      projectId={projectId}
      selectedPath={documentModel.filePath}
      onFileSelect={handleFileSelect}
      class={styles.sidebar}
    />
    <main class={styles.main}>
      <EditorHeader
        title={documentModel.title}
        filePath={documentModel.filePath}
        isDirty={documentModel.isDirty}
        saving={documentModel.saving}
        onSave={handleSave}
      />
      <div class={styles.editorArea}>
        <MarkdownEditor model={documentModel} comments={mockComments} />
      </div>
    </main>
  </div>
</Page>
```

## Files to Modify

**New Files:**
1. `shared/pages/MarkdownEditor/serialization/fromMarkdown.ts`
2. `shared/pages/MarkdownEditor/serialization/toMarkdown.ts`
3. `shared/pages/MarkdownEditor/serialization/index.ts`
4. `shared/models/src/documentPersistence.ts`
5. `shared/pages/Editor/EditorHeader.tsx`
6. `shared/pages/Editor/EditorHeader.module.css`

**Modified Files:**
7. `shared/pages/MarkdownEditor/index.ts` - export serialization
8. `shared/models/src/DocumentModel.ts` - add filePath, projectId, savedContent, saving, isDirty
9. `shared/models/src/index.ts` - export persistence helpers
10. `shared/pages/Editor/Editor.tsx` - wire up everything
11. `shared/pages/Editor/Editor.module.css` - header styles
12. `shared/pages/package.json` - add remark dependencies

## Testing
1. Click file in FileBrowser → loads in editor
2. Edit content → dirty indicator (●) appears, Save button enabled
3. Click Save or Ctrl+S → saves to server, indicator clears
4. Close browser, reopen, select same file → prompted to restore
5. Decline restore → loads fresh from server
6. Accept restore → loads localStorage version with dirty state
