-- Phase 1: Processing status and error for ingestion pipeline (OCR, metadata)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'metadata_extracted', 'ocr_complete', 'failed')),
  ADD COLUMN IF NOT EXISTS processing_error TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
COMMENT ON COLUMN documents.processing_status IS 'Ingestion pipeline: pending → processing → metadata_extracted → ocr_complete (or failed)';
