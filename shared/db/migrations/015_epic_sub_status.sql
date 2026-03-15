-- Epic sub-status for detailed AI work state tracking
-- and branch tracking for multi-machine coordination
ALTER TABLE epics ADD COLUMN sub_status VARCHAR(20) NOT NULL DEFAULT 'not_started';
ALTER TABLE epics ADD COLUMN branch_name VARCHAR(255);
ALTER TABLE epics ADD COLUMN notes TEXT;
ALTER TABLE epics ADD CONSTRAINT epics_sub_status_check
  CHECK (sub_status IN ('not_started', 'scoping', 'in_development', 'paused', 'needs_input', 'pr_open', 'complete'));

-- Task note field for context on outcome (completion, blocked, cut, descoped, etc.)
-- Replaces block_reason — status alone indicates blocked, note provides context
ALTER TABLE tasks ADD COLUMN note TEXT;
ALTER TABLE tasks DROP COLUMN block_reason;
