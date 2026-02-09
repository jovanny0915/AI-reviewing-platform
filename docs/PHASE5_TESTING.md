# Phase 5 Testing Guide — Search (Keyword + Metadata)

Use this guide to verify Phase 5: full-text search (content + metadata), scope toggles, snippets (KWIC), and no-AI search.

---

## Prerequisites

1. **Apply the Phase 5 migration**
   - Run migration `20250209110000_phase5_search_fts.sql` against your Supabase database (Supabase Dashboard → SQL Editor, or `supabase db push`).
   - Ensure the `search_documents` function and FTS columns/indexes are created.

2. **Start backend and frontend**
   - Backend: `cd backend && npm run dev` (port 3000).
   - Frontend: `npm run dev` or `pnpm dev` (e.g. port 4000).
   - Ensure `NEXT_PUBLIC_API_URL` (or `BACKEND_API_URL`) points to the backend.

3. **Have documents with extracted text**
   - Search uses **extracted text** (OCR/metadata extraction) and **metadata** (filename, custodian, file_type, metadata JSON).
   - Upload a few documents via **Documents** and wait until processing completes (**OCR complete** or **Metadata extracted**). Only then will **content** search find them; **metadata** search works as soon as the document row exists (filename, custodian, etc.).

---

## What to Test

| # | Area | What to verify |
|---|------|----------------|
| 1 | **Search UI – basic** | Enter query → Search → results load; total and snippets shown; no crash. |
| 2 | **Scope toggles** | "Content & metadata", "Document content only", "Metadata only" change which fields are searched; results differ when appropriate. |
| 3 | **Snippets (KWIC)** | Matching terms appear inside `<mark>` in the snippet; snippet is readable. |
| 4 | **Viewer link** | Click View (eye) on a result → opens `/viewer?id=<documentId>` for that document. |
| 5 | **Pagination** | When results > page size (e.g. 20), Next/Previous appear and change the result set. |
| 6 | **Empty / no results** | Empty query: no API call or graceful empty state. Query with no matches: "No documents match" (or similar), no error. |
| 7 | **Search API** | `GET /api/search?q=...&scope=...` returns `results`, `total`, `page`, `pageSize`; snippets and document summary present. |

---

## How to Test

### 1. Search UI – basic

1. Go to **Search** (sidebar).
2. Enter a word you know appears in at least one processed document (e.g. a term from a filename or from the document content if OCR is done).
   - Example: if you uploaded "Budget_Memo.pdf", try **Budget** or **Memo**.
3. Click **Search**.
4. **Verify**
   - Loading indicator appears briefly.
   - Results list shows: document title (filename), custodian/date if present, snippet with highlighted terms, hit count, and a View button.
   - Result count line shows e.g. "N results for \"your query\"".

### 2. Scope toggles

1. **Content & metadata (default)**
   - Run a search that you know matches in **content** (e.g. a word only in the body of a doc).
   - Run the same search with scope **Document content only** → same or similar results if all matches are in content.
2. **Metadata only**
   - Search for a term that appears only in **filename** or **custodian** (e.g. the exact filename or custodian name).
   - Switch to **Metadata only** → results should still appear (metadata is indexed).
   - Switch to **Document content only** → if the term is only in metadata, you may get fewer or no results.
3. **Verify** that changing scope can change the result set or snippet source (content vs metadata).

### 3. Snippets (KWIC)

1. Run a search that returns at least one result.
2. **Verify**
   - Snippet text is readable (no raw HTML except highlights).
   - Matching terms are **highlighted** (styled, e.g. with a background; the backend wraps them in `<mark>`).
   - Snippet length is reasonable (a fragment of the document or metadata, not the whole doc).

### 4. Viewer link

1. From search results, click the **View** (eye) button on one row.
2. **Verify**
   - Browser navigates to `/viewer?id=<documentId>`.
   - Viewer page loads and shows the same document (by id).

### 5. Pagination

1. Run a search that returns **more than 20 results** (or your page size).
   - If you don’t have enough data, use a very common term or reduce page size in API tests.
2. **Verify**
   - "Page 1 of N" (or similar) appears at the bottom.
   - **Next** loads the next page of results; **Previous** goes back.
   - Page number and list content update correctly.

### 6. Empty query and no results

1. **Empty query**
   - Leave the search box empty and click **Search** (or press Enter).
   - **Verify**: Either no request is sent, or the API returns empty results and the UI shows an empty state (no crash).
2. **No results**
   - Enter a query that cannot match any document (e.g. `xyznonexistent123`).
   - **Verify**: Message like "No documents match your search" (or similar); no server error in UI.

### 7. Search API (optional)

Use the backend base URL (e.g. `http://localhost:3000`).

- **Basic search**
  - `GET /api/search?q=budget&scope=both&page=1&pageSize=20`
  - Expect: `200`, body `{ success: true, data: { results: [ ... ], total, page, pageSize } }`.
  - Each result: `documentId`, `snippet`, `hitCount`, `document` (id, original_filename, filename, custodian, created_at, file_type, matter_id, family_id).

- **Scopes**
  - `GET /api/search?q=test&scope=content` → only content (extracted text) matches.
  - `GET /api/search?q=test&scope=metadata` → only metadata matches.
  - `GET /api/search?q=test&scope=both` → matches in either.

- **Matter filter**
  - `GET /api/search?q=test&matter_id=<uuid>` → only documents in that matter.

- **Empty query**
  - `GET /api/search?q=` or `GET /api/search?q=%20` → `200`, `results: []`, `total: 0`.

- **Pagination**
  - `GET /api/search?q=test&page=2&pageSize=10` → second page of 10 results.

---

## Quick smoke checklist

- [ ] Phase 5 migration applied; backend starts without errors; no "MinWords must be less than MaxWords" when searching.
- [ ] Search page loads; search box and scope radios (Content & metadata / Document content only / Metadata only) are visible.
- [ ] Enter a term that exists in a processed doc → Search → results appear with snippets and View link.
- [ ] Snippets show highlighted (<mark>) terms where applicable.
- [ ] Click View on a result → viewer opens for that document.
- [ ] Change scope (e.g. to Metadata only) and search again → result set or snippets can change.
- [ ] Query with no matches → friendly "no results" message; no 500.
- [ ] If you have 20+ results, pagination (Next/Previous) works.

If all of the above pass, Phase 5 search behavior is in good shape.
