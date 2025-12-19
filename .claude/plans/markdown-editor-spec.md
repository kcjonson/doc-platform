# COMPLETE - 2025-12-19

# Markdown Editor Specification Plan

## Overview

Write a detailed specification for the documentation editor's core component: a Slate-based dual-mode markdown editor with unified commenting.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Editor framework | Slate.js | Controlled, composable, good Preact compat |
| Dual-mode approach | Single Slate editor, two render modes | Unified commenting, one plugin system |
| Markdown conversion | remark-slate-transformer | Active, bidirectional, mdast-compatible |
| Syntax highlighting | Prism.js via `decorate` | Official Slate pattern, markdown grammar |
| Comments | Slate marks + external data store | Survives mode switches, serializes to footer |

---

## Spec Document Structure

### 1. Architecture Overview
- Slate document model
- Mode switching mechanism
- State management integration (Model pattern)

### 2. Dual-Mode Rendering
- WYSIWYG render functions
- Raw mode render functions
- Shared decorations for comments

### 3. Markdown Serialization
- remark-slate-transformer integration
- GFM support (tables, checkboxes, code blocks)
- Bidirectional sync on mode switch

### 4. Comment System
- Comment marks in Slate
- Comment data model
- Side panel integration
- Footer serialization format

### 5. Keyboard Shortcuts
- Formatting shortcuts (Cmd+B, Cmd+I, etc.)
- Mode-specific behavior
- Command palette integration

### 6. AI Integration Points
- Context menu hooks
- Selection access for AI actions
- Diff rendering for AI suggestions

### 7. Preact Integration
- Controlled component pattern
- Integration with Model/SyncModel
- Event handling

---

## File to Create

`docs/specs/markdown-editor.md` - Full specification document

---

## Sources Referenced

- [Slate.js Code Highlighting Example](https://www.slatejs.org/examples/code-highlighting)
- [remark-slate-transformer](https://github.com/inokawa/remark-slate-transformer)
- [Accord Project Markdown Editor](https://github.com/accordproject/markdown-editor) (deprecated, but proves feasibility)
