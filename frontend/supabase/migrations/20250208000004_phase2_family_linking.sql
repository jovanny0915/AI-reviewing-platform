-- Phase 2: Family linking (emails + attachments)
-- family_id: same for parent email and all attachment docs; family_index: 0 = parent, 1..n = children

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS family_id UUID,
  ADD COLUMN IF NOT EXISTS family_index INTEGER;

-- Root documents (no parent): treat self as family root. Backfill existing rows.
UPDATE documents SET family_id = id, family_index = 0 WHERE family_id IS NULL AND (parent_id IS NULL OR parent_id = id);
UPDATE documents SET family_index = 0 WHERE family_index IS NULL AND parent_id IS NULL;
-- Children: family_id should already be set on insert; backfill any orphaned children
UPDATE documents d SET family_id = (SELECT id FROM documents p WHERE p.id = d.parent_id), family_index = 1
  WHERE d.parent_id IS NOT NULL AND d.family_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_family_id ON documents(family_id);
COMMENT ON COLUMN documents.family_id IS 'Family group: same for email parent and all attachments';
COMMENT ON COLUMN documents.family_index IS '0 = parent/root, 1..n = attachment order within family';
