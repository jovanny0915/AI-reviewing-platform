-- Phase 3: Metadata Grid and Filtering — indexes and saved searches
-- 3.1 Indexes for key filter fields; full-text on metadata/title (Postgres)

-- Filter field indexes (custodian, date, doc_type, family_id)
CREATE INDEX IF NOT EXISTS idx_documents_custodian ON documents(custodian);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
-- family_id and created_at already indexed; add composite for list-by-matter + sort
CREATE INDEX IF NOT EXISTS idx_documents_matter_created ON documents(matter_id, created_at DESC);

-- Keyword filter uses ILIKE on metadata/original_filename in API (Phase 5 adds OpenSearch/FTS).

-- 3.5 Saved searches: persist search name + params; list/run saved searches
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_matter ON saved_searches(matter_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created ON saved_searches(created_at DESC);

ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON saved_searches
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE saved_searches IS 'Phase 3: Saved search name + filter params (custodian, dateFrom, dateTo, keyword, etc.)';
