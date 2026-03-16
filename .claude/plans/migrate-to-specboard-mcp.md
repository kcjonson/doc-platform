# COMPLETE - 2026-03-15

# Migrate from status.md to Specboard MCP

## Goal

Fully dogfood Specboard by replacing `docs/status.md` with live project data managed through the Specboard MCP tools. After this migration, all project tracking happens in Specboard — the `/whats-next` skill queries live data instead of reading a static file.

## Context

PR #121 merged the technical foundation:
- Unified MCP tools (`create_item`, `update_item`, etc.)
- `/whats-next` skill that queries Specboard MCP for live data
- `sub_status` field for detailed AI work state tracking
- `branch_name` and `notes` fields on epics
- `assess-git-state.sh` helper script

The old `/whats-next` at `~/.claude/commands/whats-next.md` reads `status.md` directly.
The new one at `tools/whats-next.md` queries Specboard MCP. Replacing the old with a symlink is the core cutover.

## Prerequisites

- [x] Technical MCP tool changes merged (PR #121)

## Phase 1: Production Deploy — DONE

- [x] Created release v0.4.0, triggered prod-deploy workflow
- [x] Deploy succeeded — all jobs passed including health check
- [x] Verify migration `015_epic_sub_status.sql` ran against prod DB
- [ ] Verify unified tools respond once OAuth is complete

## Phase 1.5: WAF Fixes — DONE

- [x] `CrossSiteScripting_BODY` excluded from WAF CommonRuleSet (#122, v0.4.1)
- [x] `EC2MetaDataSSRF_BODY` excluded from WAF CommonRuleSet (#123, v0.4.2)
- [x] Verified: `POST /oauth/register` with `http://localhost` redirect_uri returns 201

## Phase 2: Register MCP & Replace /whats-next — DONE

### Register production MCP — DONE
- [x] `claude mcp add --transport http -s user specboard https://specboard.io/mcp`
- [x] MCP status: "Needs authentication" (OAuth discovery working)

### Replace old /whats-next with new MCP-powered version — DONE
- [x] Symlinked: `~/.claude/commands/whats-next.md` → `/Volumes/Code/specboard/tools/whats-next.md`

### Set up assess-git-state.sh — DONE
- [x] Symlinked: `~/.claude/scripts/assess-git-state.sh` → `/Volumes/Code/specboard/tools/assess-git-state.sh`

### Verify — DONE
- [x] OAuth completed, MCP connected
- [x] Fixed: 2 ECS tasks caused session routing failures (scaled to 1, PR #125)
- [x] `list_projects` returns data via production MCP

## Phase 3: Migrate Data from status.md — DONE

- [x] Created stub specs for 5 planned epics (committed to main)
- [x] Created 12 epics + 1 chore via MCP tools
- [x] Set statuses: 1 done, 5 in_progress, 7 ready
- [x] Skipped completed chores (Expose MCP at Staging, GitHub Commit, GitHub Sync Lambda) — already done
- [x] Tasks will be broken down when picking up each epic, not upfront
- Note: spec_doc_path not settable via MCP yet — link specs in UI or add field to MCP tools later

## Phase 4: Cut Over

- [ ] Delete `docs/status.md`
- [ ] Verify `/whats-next` shows all migrated work correctly
- [ ] Confirm full workflow loop: `/whats-next` → pick task → work → `update_item` → `/whats-next` reflects changes
