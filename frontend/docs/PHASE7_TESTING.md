# Phase 7 Testing Guide — Bates Stamp and Production

Use this guide to verify Phase 7: productions with single-page TIFFs, Bates numbering, placeholders for natives, DAT/OPT load files, production job, and exportable audit report.

---

## Prerequisites

1. **Apply migrations through Phase 7**
   - Run migration `20250209130000_phase7_productions.sql` against your Supabase database (Supabase Dashboard → SQL Editor, or `supabase db push`).
   - Ensure tables exist: `productions`, `production_documents`, `production_pages`.

2. **Backend dependencies**
   - In `backend`: `npm install` (includes `sharp` for TIFF/placeholder generation).
   - Optional: `pdf2pic` + GraphicsMagick for PDF→TIFF; without it, PDFs get a placeholder TIFF.

3. **Start backend and frontend**
   - Backend: `cd backend && npm run dev` (port 3000).
   - Frontend: `npm run dev` or `pnpm dev` (e.g. port 4000).
   - Ensure `NEXT_PUBLIC_API_URL` (or `BACKEND_API_URL`) points to the backend.

4. **Have documents to produce**
   - Upload a few documents via **Documents** (images or PDFs work best for TIFF conversion).
   - For “source folder” testing: create a folder and add documents to it via **Folders** (Phase 4).

---

## What to Test

| # | Area | What to verify |
|---|------|----------------|
| 1 | **Productions list** | Productions page loads; table shows productions (empty at first); no errors. |
| 2 | **Create & start production** | New Production → name, Bates prefix, start number, optional source folder → Create & Start → job runs; status moves to processing then complete. |
| 3 | **Bates and output** | Completed production shows correct Bates range, doc count, page count; TIFFs and load files written to storage. |
| 4 | **Download load files** | For a complete production, Download opens signed URLs for loadfile.dat and loadfile.opt. |
| 5 | **Audit report** | Export audit report (FileText icon) downloads a JSON with production + documents (Bates, hashes for validation). |
| 6 | **Placeholders** | Documents that are not images/PDF (e.g. Excel, native-only) get a single placeholder TIFF and native path in load file. |
| 7 | **API** | GET list, POST create, POST start, GET audit-report, GET download; produce events in audit_log. |

---

## How to Test

### 1. Productions list

1. Go to **Productions** (sidebar) → **Bates / Produce** tab.
2. **Verify**
   - Table headers: Production, Bates, Docs, Pages, Status, Progress, actions.
   - If no productions yet: “No productions yet. Create one to Bates stamp and produce TIFFs + load files.”
   - No console or network errors.

### 2. Create & start production

1. Click **New Production**.
2. Fill the dialog:
   - **Production name**: e.g. `Test Production 1`
   - **Bates prefix**: e.g. `PROD` (default)
   - **Start number**: e.g. `1`
   - **Source folder**: pick a folder that has documents, or leave “All documents (no folder)” if you have docs in the system.
   - **Include subfolders**: leave checked if using a folder.
3. Click **Create & Start Production**.
4. **Verify**
   - Dialog closes; new row appears in the table with status **pending** or **processing**.
   - After a short while (depends on doc count), status becomes **complete**.
   - If the source folder is empty or no documents exist, production still completes with 0 docs/pages.

### 3. Bates and output

1. After a production completes, check the table row:
   - **Bates**: e.g. `PROD000001 - PROD000003` (if 3 pages).
   - **Docs** / **Pages**: match the number of documents and TIFF pages produced.
2. In Supabase Storage (Dashboard → Storage → `documents` bucket):
   - Path `productions/<productionId>/tiff/` should contain `.tif` files (one per page).
   - Path `productions/<productionId>/loadfile.dat` and `loadfile.opt` should exist.

### 4. Download load files

1. For a **complete** production, click the **Download** (download icon) button in the actions column.
2. **Verify**
   - Two tabs/windows open (or two downloads): one for `loadfile.dat`, one for `loadfile.opt`.
   - Files are tab-delimited with header: BEGBATES, ENDBATES, IMAGEPATH, NATIVEPATH, PAGECOUNT.

### 5. Audit report

1. For a **complete** production, click the **FileText** (audit report) button.
2. **Verify**
   - A JSON file downloads (e.g. `production-audit-<id>.json`).
   - Content includes `production` (name, Bates prefix, status, etc.) and `documents` array with per-doc: `document_id`, `bates_begin`, `bates_end`, `page_count`, `is_placeholder`, `native_filename`, `md5_hash`, `sha1_hash`, `original_filename` for post-production hash validation.

### 6. Placeholders (optional)

1. Upload a non-image, non-PDF file (e.g. .xlsx or .docx) and add it to a folder.
2. Create a production from that folder and run it.
3. **Verify**
   - That document gets one placeholder TIFF (“Document produced in native format”) and the native filename appears in the load file NATIVEPATH column.

### 7. API (optional)

Use the backend base URL (e.g. `http://localhost:3000`).

- **List productions**
  - `GET /api/productions`
  - Optional query: `?matter_id=<uuid>`, `?status=complete`.
  - Expect: `200`, `{ success: true, data: { productions: [ ... ], total: N } }`.
  - Each production includes `document_count` and `page_count` when available.

- **Create production**
  - `POST /api/productions` with body (JSON):
    ```json
    {
      "name": "API Test Production",
      "bates_prefix": "ABC",
      "bates_start_number": 1,
      "source_folder_id": "<folderId>",
      "include_subfolders": true
    }
    ```
  - Omit `source_folder_id` to use all documents (optionally scope by `matter_id`).
  - Expect: `201`, `data` is the created production with `status: "pending"`.

- **Start production**
  - `POST /api/productions/<productionId>/start`
  - Expect: `202`, `{ success: true, message: "Production job started", production_id: "..." }`.
  - Job runs in background; poll `GET /api/productions/<id>` until `status` is `complete` or `failed`.

- **Audit report**
  - `GET /api/productions/<productionId>/audit-report`
  - Expect: `200`, `{ success: true, data: { production: {...}, documents: [ ... ] } }`.

- **Download**
  - `GET /api/productions/<productionId>/download`
  - Only when `status === "complete"`.
  - Expect: `200`, `data` has `loadfile_dat_url`, `loadfile_opt_url`, `expires_in_seconds`.

- **Audit log**
  - For each document in the production, `audit_log` should have a row with `action_type: 'produce'` and `metadata_snapshot` containing `production_id`, `bates_begin`, `bates_end`, `page_count`.

---

## Quick smoke checklist

- [ ] Phase 7 migration applied; `productions`, `production_documents`, `production_pages` exist; backend starts (with `sharp` installed).
- [ ] Productions page loads; “No productions yet” or list of productions.
- [ ] New Production → name, prefix, start number, optional folder → Create & Start → new row appears; status goes to processing then complete (or remains pending if no docs).
- [ ] Completed production shows Bates range, doc count, page count.
- [ ] Download button opens loadfile.dat and loadfile.opt (signed URLs).
- [ ] Audit report (FileText) downloads JSON with production + documents (Bates, hashes).
- [ ] Storage: `productions/<id>/tiff/*.tif` and `productions/<id>/loadfile.dat`, `loadfile.opt` exist.
- [ ] `GET /api/productions` and `POST /api/productions`, `POST /api/productions/:id/start` work; audit_log has `produce` entries.

If all of the above pass, Phase 7 productions are in good shape.
