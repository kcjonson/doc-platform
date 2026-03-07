-- Add type column to epics table for chore and bug work items
-- Existing rows default to 'epic' for backward compatibility

ALTER TABLE epics
    ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'epic';

ALTER TABLE epics
    ADD CONSTRAINT epics_type_check CHECK (type IN ('epic', 'chore', 'bug'));

-- Index for filtering by type
CREATE INDEX IF NOT EXISTS idx_epics_type ON epics(type);

-- Composite index for common query pattern (project + type)
CREATE INDEX IF NOT EXISTS idx_epics_project_type ON epics(project_id, type);
