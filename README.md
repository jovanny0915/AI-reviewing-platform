# LitReview - E-Discovery Platform (Demo Skeleton)

Next.js 16 + React 19 + Tailwind CSS + shadcn/ui. All pages use mock data -- no backend connected.

---

## Pages & Requirements

| Route | Requirement | What it shows |
|-------|------------|---------------|
| `/documents` | 1. Upload/OCR, 2. Metadata extraction, 3. Family linking, 4. Metadata grid + filters | Upload dialog with OCR toggle, metadata table with keyword/date/custodian filters, family view with expandable parent-child (email + attachments) |
| `/viewer` | 7. Redactions for privilege | Document canvas with zoom/pagination, redaction tool with reason selector (Attorney-Client, Work Product, etc.), metadata side panel, Bates stamp overlay |
| `/search` | 6. Word search through content/metadata | Boolean search bar (AND/OR/NOT), scope toggles for content vs metadata, hit-highlighted results with KWIC snippets |
| `/folders` | 5. Cull documents into folders/subfolders | Hierarchical folder tree (Responsive > Hot Docs, Privileged > Attorney-Client, etc.), move documents between folders |
| `/productions` (Bates tab) | 8. Bates stamp + produce as single-page TIFF | Production wizard with prefix/numbering, source folder, output format (TIFF + DAT/OPT), progress tracking. Native files produce as TIFF placeholders |
| `/productions` (Import tab) | 9. Import opposing party productions | Import wizard for DAT/OPT + TIFF volumes, import history with status/error tracking |
| `/ai-review` | 10. AI search for summaries/relevance/similarity | Task selector (relevance, privilege, similar, summarize, categorize), natural language prompt, folder targeting, formatted results |

---

## Project Structure

```
app/
  page.tsx                  -> redirects to /documents
  documents/page.tsx        -> reqs 1-4
  viewer/page.tsx           -> req 7
  search/page.tsx           -> req 6
  folders/page.tsx          -> req 5
  productions/page.tsx      -> reqs 8-9 (tabbed)
  ai-review/page.tsx        -> req 10
components/
  app-shell.tsx             -> sidebar + header layout wrapper
  app-sidebar.tsx           -> navigation links
```

---

## Backend Integration Notes

Each requirement needs specific backend work to become functional:

- **Reqs 1-2 (Upload/OCR/Metadata):** File storage (S3/Vercel Blob), OCR engine (Tesseract/Google Vision), metadata parser (Apache Tika)
- **Req 3 (Families):** Email parser (MSG/EML) to detect attachments, `family_id` + `parent_doc_id` in DB
- **Req 4 (Grid/Filters):** PostgreSQL with indexed metadata columns, dynamic WHERE queries
- **Req 5 (Folders):** Folder table with `parent_id`, junction table `document_folders` for many-to-many
- **Req 6 (Search):** Full-text search index (Elasticsearch or PostgreSQL FTS), Boolean query parser
- **Req 7 (Redactions):** Store redaction coordinates in DB, apply as overlay when rendering, burn into TIFF on production
- **Req 8 (Productions):** TIFF conversion (LibreOffice + Ghostscript + ImageMagick), Bates stamp overlay, DAT/OPT generation (Concordance delimiters), TIFF placeholder for native-only formats
- **Req 9 (Load Files):** DAT parser (Concordance format), OPT parser (Opticon), TIFF volume linker, validation
- **Req 10 (AI):** LLM integration (AI SDK), vector embeddings (pgvector), RAG pipeline for document chunks

---

## Phase 0: Foundation (Supabase)

Phase 0 is implemented. Setup:

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Copy `.env.example` to `.env.local`** and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL (Settings → API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role key (keep secret)

3. **Run migrations** via Supabase Dashboard → SQL Editor:
   - Run `supabase/migrations/20250208000000_initial_schema.sql`
   - (Optional) Create Storage bucket "documents" in Dashboard → Storage, then run `supabase/migrations/20250208000001_storage_bucket.sql` for RLS policies. Or let the upload API create the bucket on first upload.

### Option A: Next.js API routes (simplest)

4. **Install & run:**
   ```bash
   npm install
   npm run dev
   ```
   The frontend calls `/api/documents` and `/api/upload` on the same origin.

### Option B: Separate Node backend

4. **Backend** — Copy `backend/.env.example` to `backend/.env` and set:
   - `SUPABASE_URL` — same as `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — same as above
   - `PORT=3001`, `CORS_ORIGIN=http://localhost:3000`

5. **Frontend** — Set in `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

6. **Run both:**
   ```bash
   # Option 1: Single command (from project root)
   npm run dev:all

   # Option 2: Separate terminals
   # Terminal 1: Backend
   cd backend && npm install && npm run dev

   # Terminal 2: Frontend
   npm run dev
   ```

**API routes:**
- `GET /api/documents` — List documents (paginated: `?page=1&pageSize=20`)
- `GET /api/documents/:id` — Get document by ID (optional `?signedUrl=true`)
- `POST /api/upload` — Upload file (multipart form, field: `file`)

---

## Run Locally

```bash
npm install
npm run dev
```

To run both frontend and backend together:
```bash
npm run dev:all
```
