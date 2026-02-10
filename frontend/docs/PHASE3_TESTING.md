# Phase 3 Testing Guide — Metadata Grid and Filtering

Use this guide to verify Phase 3 (review grid, filters, coding panel, saved searches, signed URLs).

---

## Prerequisites

1. **Apply the Phase 3 migration**
   - Run migration `20250209000000_phase3_indexes_saved_searches.sql` against your Supabase database (e.g. Supabase Dashboard → SQL Editor, or `supabase db push`).

2. **Start backend and frontend**
   - Backend: `cd backend && npm run dev` (or `npm start`) — typically port 3000.
   - Frontend: `cd <project-root> && pnpm dev` (or `npm run dev`) — typically port 4000 or 3001.
   - Ensure `NEXT_PUBLIC_API_URL` (or `BACKEND_API_URL`) points to the backend URL.

3. **Have some documents**
   - Upload a few documents via the Documents page so you can filter and code them (different custodians/dates/types help).

---

## What to Test

| # | Area | What to verify |
|---|------|----------------|
| 1 | **Filters** | Custodian, date range, keyword, doc type filter the grid; Apply/Clear work; pagination respects filters. |
| 2 | **Grid & columns** | Relevance, Privilege, Issue tags columns show; family expand/collapse still works. |
| 3 | **Coding panel** | Open Code → set Relevance/Privilege/Issue tags → Save; values appear in grid and in audit. |
| 4 | **Saved searches** | Save current filters as a search; run a saved search; delete a saved search. |
| 5 | **Viewer + signed URL** | Open document from grid in viewer; document loads (open in new tab / PDF iframe). |
| 6 | **APIs directly** | Optional: call list with query params, PATCH coding, saved-searches CRUD. |

---

## How to Test

### 1. Filters (UI)

1. Go to **Documents**.
2. Enter a **Custodian** (e.g. a value you set on upload), click **Apply**.
   - Grid should show only documents with that custodian.
3. Set **Date from** / **Date to** (e.g. last week), click **Apply**.
   - Grid should show only documents in that range.
4. Enter a **Keyword** (e.g. part of a filename or custodian), click **Apply**.
   - Grid should show only matching rows.
5. Enter a **Doc type** (e.g. `application/pdf`), click **Apply**.
   - Grid should show only that type.
6. Click **Clear**.
   - All filter fields clear and grid shows unfiltered list again.

### 2. Pagination

1. If you have more than one page of results (e.g. > 20 docs), use **Previous** / **Next**.
2. Check that the list and the “Page X of Y (total)” text update correctly.
3. Apply a filter that returns fewer results; confirm pagination resets (e.g. page 1) and total updates.

### 3. Grid columns and coding (UI)

1. Confirm columns: **Relevance**, **Privilege**, **Issue tags** (and existing columns).
2. Click the **tag icon (Code)** on a row.
3. In the coding panel:
   - Set **Relevance** to “Relevant” or “Not relevant”.
   - Set **Privilege** to “Privileged” or “Not privileged”.
   - Add **Issue tags** (comma-separated, e.g. `Confidential, HR`).
4. Click **Save**.
5. Close the panel and check the same row: badges for Relevance/Privilege and issue tags text should match what you set.
6. Open **Viewer** for that document (e.g. via eye icon → `/viewer?id=<id>`). In the metadata panel, confirm **Coding** shows the same Relevance/Privilege/Issue tags.

### 4. Audit (coding)

- **Option A — DB:** In Supabase, open `audit_log`. After saving coding, there should be a row with `action_type = 'tag'` and `metadata_snapshot` containing `relevance_flag`, `privilege_flag`, `issue_tags`, `coding_timestamp`.
- **Option B — Backend:** Ensure no errors in backend logs when saving coding.

### 5. Saved searches (UI)

1. Set some filters (e.g. custodian + date range), click **Apply**.
2. Open **Saved searches** dropdown → **Save current search**.
3. Enter a name (e.g. “Q1 Custodian A”), click **Save**.
4. Change filters and click **Apply** (grid changes).
5. Open **Saved searches** → click the saved search you created.
   - Grid and filter fields should restore to that search (same custodian, dates, etc.).
6. In **Saved searches** dropdown, click the **trash** on that saved search.
   - It should disappear from the list; running another saved search should still work.

### 6. Viewer and signed URL

1. On the Documents grid, click the **eye icon** on a document.
2. Viewer opens (e.g. new tab) with `?id=<documentId>`.
3. You should see:
   - “Open document in new tab” (link uses signed URL from API).
   - For PDFs: document may also load in the iframe.
   - Metadata panel: title, custodian, date, doc type, family ID; if the doc is coded, **Coding** section with Relevance/Privilege/Issue tags.
4. Click “Open document in new tab”: the native file should open (or download) using the signed URL.

### 7. APIs (optional, e.g. with curl or Postman)

- **List with filters**
  - `GET /api/documents?page=1&pageSize=10&expand=families&custodian=John&dateFrom=2025-01-01&dateTo=2025-12-31&keyword=report&docType=application/pdf`
  - Check response: `familyGroups` or `documents`, `total`, `page`, `pageSize`; only matching docs.

- **Coding**
  - `PATCH /api/documents/<document-id>/coding`
  - Body: `{ "relevance_flag": true, "privilege_flag": false, "issue_tags": ["HR", "Confidential"] }`
  - Check: 200, body returns updated document; `audit_log` has new `tag` event.

- **Saved searches**
  - `POST /api/saved-searches` — Body: `{ "name": "Test", "params": { "custodian": "John" } }` → 200, returns saved search with `id`.
  - `GET /api/saved-searches` → 200, list includes the new saved search.
  - `GET /api/saved-searches/<id>` → 200, returns that saved search.
  - `DELETE /api/saved-searches/<id>` → 200; `GET` list no longer includes it.

---

## Quick smoke checklist

- [ ] Migration applied; backend starts without errors.
- [ ] Documents page loads; grid shows documents (with Phase 3 columns).
- [ ] Apply at least one filter (e.g. custodian or keyword); grid updates.
- [ ] Clear filters; grid shows full list again.
- [ ] Open coding panel, set Relevance/Privilege/Issue tags, Save; grid and viewer show values.
- [ ] Save current search; run it from dropdown; grid and filters restore.
- [ ] Open a document in viewer from grid; “Open document in new tab” works (signed URL).
- [ ] Pagination works when there are enough documents.

If all of the above pass, Phase 3 behavior is in good shape.
