-- Add is_demo flag to tracks table
-- Demo tracks appear only in the Demo section and are excluded from the main HaM queue

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
