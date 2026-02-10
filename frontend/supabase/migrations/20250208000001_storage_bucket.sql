-- Storage bucket 'documents' and RLS policies
-- Create the bucket via Dashboard (Storage > New Bucket > "documents") or it will be
-- created programmatically on first upload via lib/storage.ts

-- RLS policies for storage.objects (bucket must exist first)
-- Service role bypasses RLS; these policies enable anon/authenticated access when needed
DROP POLICY IF EXISTS "Allow uploads for documents bucket" ON storage.objects;
CREATE POLICY "Allow uploads for documents bucket" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "Allow reads for documents bucket" ON storage.objects;
CREATE POLICY "Allow reads for documents bucket" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Allow deletes for documents bucket" ON storage.objects;
CREATE POLICY "Allow deletes for documents bucket" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'documents');
