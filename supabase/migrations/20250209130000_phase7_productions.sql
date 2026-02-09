-- Phase 7: Bates Stamp and Production (Relativity Production equivalent)
-- 7.1–7.5: productions, production_documents, production_pages; load files written to storage at job time

-- Productions: name, source (folder/matter), Bates prefix/range, status, output path
CREATE TABLE IF NOT EXISTS productions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID,
  name TEXT NOT NULL,
  bates_prefix TEXT NOT NULL,
  bates_start_number INTEGER NOT NULL CHECK (bates_start_number >= 1),
  source_folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  include_subfolders BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  output_storage_path TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_productions_matter_id ON productions(matter_id);
CREATE INDEX IF NOT EXISTS idx_productions_status ON productions(status);
CREATE INDEX IF NOT EXISTS idx_productions_created_at ON productions(created_at DESC);

COMMENT ON TABLE productions IS 'Phase 7: Production job = name, source folder, Bates prefix/range; TIFFs + DAT/OPT in output_storage_path';

-- Production documents: which docs are in this production; Bates range per doc
CREATE TABLE IF NOT EXISTS production_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  bates_begin TEXT NOT NULL,
  bates_end TEXT NOT NULL,
  page_count INTEGER NOT NULL CHECK (page_count >= 0),
  is_placeholder BOOLEAN NOT NULL DEFAULT false,
  native_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (production_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_production_documents_production_id ON production_documents(production_id);
CREATE INDEX IF NOT EXISTS idx_production_documents_document_id ON production_documents(document_id);

COMMENT ON TABLE production_documents IS 'Phase 7: Documents in a production; placeholder = native-only (one TIFF + native link in load file)';

-- Production pages: document_id + page_number → Bates number; TIFF path for load file
CREATE TABLE IF NOT EXISTS production_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  bates_number TEXT NOT NULL,
  tiff_storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (production_id, document_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_production_pages_production_id ON production_pages(production_id);
CREATE INDEX IF NOT EXISTS idx_production_pages_document_id ON production_pages(document_id);

COMMENT ON TABLE production_pages IS 'Phase 7: doc_id + page_no → Bates number; tiff_storage_path for DAT/OPT volume path';

ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON productions
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE production_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON production_documents
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE production_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON production_pages
  FOR ALL USING (true) WITH CHECK (true);
