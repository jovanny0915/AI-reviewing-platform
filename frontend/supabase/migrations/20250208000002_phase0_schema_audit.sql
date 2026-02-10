-- Phase 0 (IMPLEMENTATION_PLAN): Full document schema, review/coding, audit_log, matter isolation

-- 1) Extend documents with plan columns (matter_id, parent_id, hashes, extracted_text_path, review/coding)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS matter_id UUID,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES documents(id),
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS custodian TEXT,
  ADD COLUMN IF NOT EXISTS md5_hash TEXT,
  ADD COLUMN IF NOT EXISTS sha1_hash TEXT,
  ADD COLUMN IF NOT EXISTS extracted_text_path TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS relevance_flag BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS privilege_flag BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS issue_tags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS reviewer_id UUID,
  ADD COLUMN IF NOT EXISTS coding_timestamp TIMESTAMPTZ;

-- Backfill original_filename and file_type from existing filename/mime_type
UPDATE documents SET original_filename = filename WHERE original_filename IS NULL AND filename IS NOT NULL;
UPDATE documents SET file_type = mime_type WHERE file_type IS NULL AND mime_type IS NOT NULL;

-- Indexes for matter isolation and common filters (Phase 3 will add more)
CREATE INDEX IF NOT EXISTS idx_documents_matter_id ON documents(matter_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_processed_at ON documents(processed_at);

COMMENT ON COLUMN documents.matter_id IS 'Tenant/matter isolation - scope all queries when set';
COMMENT ON COLUMN documents.parent_id IS 'Family linkage - parent document (e.g. email for attachments)';

-- 2) Append-only audit_log (Phase 0.4)
CREATE TABLE IF NOT EXISTS audit_log (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  document_id UUID REFERENCES documents(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('view', 'upload', 'tag', 'redact', 'produce')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_snapshot JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_log_document_id ON audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON audit_log(action_type);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON audit_log
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE audit_log IS 'Append-only audit trail for mutations (upload, tag, redact, produce); never update or delete';
