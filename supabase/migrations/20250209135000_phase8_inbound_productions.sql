-- Phase 8: Inbound Productions (Opposing Party)
-- Import TIFF + DAT/OPT; track import jobs and link imported documents with Bates preserved.

-- Import job: one row per inbound production import (upload DAT/OPT, provide TIFF location, run import).
CREATE TABLE IF NOT EXISTS inbound_productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID,
  name TEXT NOT NULL,
  producing_party TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  dat_storage_path TEXT,
  opt_storage_path TEXT,
  tiff_base_path TEXT,
  error_message TEXT,
  document_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inbound_productions_matter_id ON inbound_productions(matter_id);
CREATE INDEX IF NOT EXISTS idx_inbound_productions_status ON inbound_productions(status);
CREATE INDEX IF NOT EXISTS idx_inbound_productions_created_at ON inbound_productions(created_at DESC);

COMMENT ON TABLE inbound_productions IS 'Phase 8: Inbound production import job; load file(s) + TIFF location; status and error tracking';

-- Per-document record for an inbound production: links document to import job and preserves Bates/image path from load file.
CREATE TABLE IF NOT EXISTS inbound_production_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_production_id UUID NOT NULL REFERENCES inbound_productions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  bates_begin TEXT NOT NULL,
  bates_end TEXT NOT NULL,
  image_path TEXT,
  native_path TEXT,
  page_count INTEGER NOT NULL CHECK (page_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inbound_production_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_production_documents_import ON inbound_production_documents(inbound_production_id);
CREATE INDEX IF NOT EXISTS idx_inbound_production_documents_document ON inbound_production_documents(document_id);

COMMENT ON TABLE inbound_production_documents IS 'Phase 8: Documents created from an inbound production; preserves Bates and load file paths';

-- Optional: allow querying documents by inbound production without joining through inbound_production_documents.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS inbound_production_id UUID REFERENCES inbound_productions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_inbound_production_id ON documents(inbound_production_id) WHERE inbound_production_id IS NOT NULL;

ALTER TABLE inbound_productions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON inbound_productions
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE inbound_production_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON inbound_production_documents
  FOR ALL USING (true) WITH CHECK (true);
