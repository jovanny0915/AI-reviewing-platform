-- Phase 0: Foundation schema for Document Processing Platform
-- Documents table with storage path, file metadata, and extensible metadata (JSONB)

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common queries (Phase 3 will add more indexes)
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN(metadata);

-- Enable RLS (Row Level Security) - can be configured when auth is added
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (anonymous/service role); tighten when auth is added
CREATE POLICY "Allow all for service role" ON documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE documents IS 'Core documents table - stores file metadata and references to Supabase Storage';
