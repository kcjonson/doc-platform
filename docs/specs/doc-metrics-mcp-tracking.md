# Doc Metrics & MCP Access Tracking Specification

This specification defines how Specboard records and surfaces MCP access patterns for documents and epics.

---

## Overview

Track when specs, epics, and documents are accessed over MCP to provide usage insights:
- Which documents are most frequently referenced by Claude Code
- When documents were last accessed
- Access patterns over time

---

## Requirements

### Access Event Tracking
- Record MCP tool invocations that read documents or epics
- Capture: which item, when, by which MCP client/user
- Lightweight — must not add latency to MCP requests

### Storage
- Database schema for access events
- Retention policy (aggregate old events, keep recent detail)

### Reporting UI
- Access frequency per document
- Most-used documents ranking
- Last accessed timestamp on document list views

---

## Dependencies

- MCP Server

## Status

Needs design
