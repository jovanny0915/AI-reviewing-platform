-- Phase 6: Redactions (Relativity Redact equivalent)
-- 6.1 Schema: redactions stored as coordinates + reason; originals never altered; burn-in only at production time

CREATE TABLE IF NOT EXISTS redactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number >= 1),
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  width DOUBLE PRECISION NOT NULL CHECK (width > 0),
  height DOUBLE PRECISION NOT NULL CHECK (height > 0),
  reason_code TEXT NOT NULL,
  polygon JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE redactions IS 'Phase 6: Redaction regions per document page; burn-in only at production time';
COMMENT ON COLUMN redactions.reason_code IS 'e.g. Attorney-Client, Work Product, Confidential, Personal Information';
COMMENT ON COLUMN redactions.polygon IS 'Optional: non-rectangular redaction as array of {x,y}; null = use x,y,width,height';

ALTER TABLE redactions ADD COLUMN IF NOT EXISTS polygon JSONB;

CREATE INDEX IF NOT EXISTS idx_redactions_document_id ON redactions(document_id);
CREATE INDEX IF NOT EXISTS idx_redactions_document_page ON redactions(document_id, page_number);

ALTER TABLE redactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON redactions
  FOR ALL USING (true) WITH CHECK (true);
