# MCP Document Operations Specification

This specification defines full document CRUD capabilities via MCP, allowing Claude Code to create, read, edit, and delete documents.

---

## Overview

Extend the MCP server with document management tools so Claude Code can:
- **Create** new documents in a project
- **Read** document content directly via MCP
- **Edit** existing documents (full or partial updates)
- **Move/rename** documents within the project tree
- **Delete** documents

---

## Requirements

### MCP Tools
- `create_document` — create a new markdown document
- `read_document` — fetch document content by path or ID
- `update_document` — modify document content
- `move_document` — rename or move a document
- `delete_document` — remove a document

### Authorization
- All operations scoped to authenticated user's project access
- Respect `docs:read` and `docs:write` OAuth scopes

---

## Dependencies

- MCP Server
- REST API & Database (document storage)

## Status

Needs design
