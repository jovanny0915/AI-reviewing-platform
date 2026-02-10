-- Phase 4: Folders and Batching (Culling)
-- 4.1 Schema: folders (id, name, parent_id); document_folders junction (document_id, folder_id)

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id UUID,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_folders_matter_id ON folders(matter_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);

ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON folders
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE folders IS 'Phase 4: Folder tree for culling and scoped production/AI';

-- Junction: document <-> folder (many-to-many)
CREATE TABLE IF NOT EXISTS document_folders (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_document_folders_folder_id ON document_folders(folder_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_document_id ON document_folders(document_id);

ALTER TABLE document_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON document_folders
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE document_folders IS 'Phase 4: Documents assigned to folders (culling/batching)';
