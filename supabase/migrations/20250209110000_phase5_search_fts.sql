-- Phase 5: Search (Primary: Keyword + Metadata) — Postgres FTS
-- 5.1 Index extracted text + metadata; ingest/update when text/metadata ready

-- Store extracted text in DB for FTS (also kept at extracted_text_path in storage)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Generated tsvector for content search (extracted text)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(extracted_text, ''))) STORED;

-- Generated tsvector for metadata search (filename, custodian, file_type, metadata)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS search_metadata_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(original_filename, '')), 'A')
    || setweight(to_tsvector('english', coalesce(custodian, '')), 'A')
    || setweight(to_tsvector('english', coalesce(file_type, '')), 'B')
    || setweight(to_tsvector('english', coalesce(metadata::text, '')), 'B')
  ) STORED;

-- GIN indexes for FTS
CREATE INDEX IF NOT EXISTS idx_documents_search_content_tsv ON documents USING GIN(search_content_tsv);
CREATE INDEX IF NOT EXISTS idx_documents_search_metadata_tsv ON documents USING GIN(search_metadata_tsv);

COMMENT ON COLUMN documents.extracted_text IS 'Phase 5: Extracted/OCR text stored for full-text search';
COMMENT ON COLUMN documents.search_content_tsv IS 'Phase 5: FTS vector on extracted_text';
COMMENT ON COLUMN documents.search_metadata_tsv IS 'Phase 5: FTS vector on metadata fields';

-- 5.2 / 5.3: Search API — Boolean (AND/OR/NOT via websearch); scope: content, metadata, both.
-- RPC returns document ids, snippets (KWIC), hit counts, total. No LLM.

CREATE OR REPLACE FUNCTION search_documents(
  p_query text,
  p_scope text DEFAULT 'both',
  p_matter_id uuid DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  snippet text,
  hit_count int,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_query tsquery;
  v_total bigint;
BEGIN
  -- Build tsquery from user input (websearch: "phrase", -not, space = AND)
  p_query := trim(coalesce(p_query, ''));
  IF p_query = '' THEN
    RETURN;
  END IF;
  BEGIN
    v_query := websearch_to_tsquery('english', p_query);
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

  RETURN QUERY
  WITH matches AS (
    SELECT
      d.id,
      CASE
        WHEN p_scope = 'content' THEN
          ts_headline('english', coalesce(d.extracted_text, ''), v_query,
            'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=35, MinWords=15, FragmentDelimiter=" ... "')
        WHEN p_scope = 'metadata' THEN
          ts_headline('english',
            coalesce(d.original_filename, '') || ' ' || coalesce(d.custodian, '') || ' ' || coalesce(d.file_type, '') || ' ' || coalesce(d.metadata::text, ''),
            v_query,
            'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=35, MinWords=15, FragmentDelimiter=" ... "')
        ELSE
          ts_headline('english', coalesce(d.extracted_text, ''), v_query,
            'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MaxWords=25, MinWords=10, FragmentDelimiter=" ... "')
          ||
          CASE WHEN d.search_metadata_tsv @@ v_query THEN
            ' ... ' || ts_headline('english',
              coalesce(d.original_filename, '') || ' ' || coalesce(d.custodian, ''),
              v_query, 'StartSel=<mark>, StopSel=</mark>, MaxFragments=1, MinWords=5, MaxWords=15')
          ELSE ''
          END
      END AS snippet,
      (CASE WHEN d.search_content_tsv @@ v_query THEN 1 ELSE 0 END + CASE WHEN d.search_metadata_tsv @@ v_query THEN 1 ELSE 0 END) AS hit_count_val
    FROM documents d
    WHERE
      (p_matter_id IS NULL OR d.matter_id = p_matter_id)
      AND (
        (p_scope = 'content' AND d.search_content_tsv @@ v_query)
        OR (p_scope = 'metadata' AND d.search_metadata_tsv @@ v_query)
        OR (p_scope = 'both' AND (d.search_content_tsv @@ v_query OR d.search_metadata_tsv @@ v_query))
      )
  ),
  counted AS (
    SELECT *, count(*) OVER () AS total
    FROM matches
  )
  SELECT
    c.id,
    NULLIF(trim(c.snippet), '')::text,
    c.hit_count_val::int,
    c.total
  FROM counted c
  ORDER BY c.hit_count_val DESC, c.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION search_documents IS 'Phase 5: Full-text search; scope: content | metadata | both; returns id, snippet (KWIC), hit_count, total_count';
