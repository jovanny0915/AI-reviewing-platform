-- Phase 9: AI-Assisted Review (Human-in-the-Loop)
-- Embeddings (pgvector), cached summaries, AI usage tracking and caps.

-- Enable pgvector for semantic search / find-similar
CREATE EXTENSION IF NOT EXISTS vector;

-- 9.1: Document embeddings — one embedding per document; cached; no per-query embedding by default.
-- Dimensions: 1536 for OpenAI text-embedding-3-small; adjust if using another model.
CREATE TABLE IF NOT EXISTS document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding vector(1536) NOT NULL,
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON document_embeddings(document_id);
-- HNSW index for fast approximate nearest-neighbor search (cosine distance)
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding ON document_embeddings
  USING hnsw (embedding vector_cosine_ops);

COMMENT ON TABLE document_embeddings IS 'Phase 9: Cached embeddings per document; used for find-similar and optional semantic search';

-- Cached summaries: scope = single document, folder, or matter (scope_id = document_id, folder_id, or matter_id)
CREATE TABLE IF NOT EXISTS document_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('document', 'folder', 'matter')),
  scope_id TEXT NOT NULL,
  matter_id UUID,
  summary TEXT NOT NULL,
  model TEXT NOT NULL,
  document_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_document_summaries_scope ON document_summaries(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS idx_document_summaries_matter_id ON document_summaries(matter_id);

COMMENT ON TABLE document_summaries IS 'Phase 9: Cached LLM summaries for document/folder/matter scope';

-- 9.4: AI usage tracking for cost controls (caps per matter/user)
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID,
  user_id UUID,
  action_type TEXT NOT NULL CHECK (action_type IN ('embedding', 'summarize', 'similar', 'suggestions')),
  units INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_matter_created ON ai_usage(matter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage(action_type);

COMMENT ON TABLE ai_usage IS 'Phase 9: AI usage per matter/user for caps; units = doc count or token proxy';

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON ai_usage FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON document_embeddings FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE document_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON document_summaries FOR ALL USING (true) WITH CHECK (true);

-- 9.2: Optional semantic search — find similar documents by vector similarity (cosine).
CREATE OR REPLACE FUNCTION match_document_embeddings(
  p_query_embedding vector(1536),
  p_exclude_document_id uuid,
  p_matter_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20
)
RETURNS TABLE(document_id uuid, distance float)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT de.document_id, (de.embedding <=> p_query_embedding)::float AS distance
  FROM document_embeddings de
  JOIN documents d ON d.id = de.document_id
  WHERE de.document_id != p_exclude_document_id
    AND (p_matter_id IS NULL OR d.matter_id = p_matter_id)
  ORDER BY de.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION match_document_embeddings IS 'Phase 9: Vector similarity search for find-similar; cosine distance';
