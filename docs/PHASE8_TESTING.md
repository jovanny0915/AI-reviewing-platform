# Phase 8 Testing Guide — Inbound Productions (Import Load Files)

Use this guide to verify Phase 8: import opposing-party productions (DAT/OPT load files + TIFF location), create documents and metadata, preserve Bates, and review inbound docs in the grid/search.

Phase 8 is implemented.

---

## Prerequisites

1. **Apply migrations through Phase 8**
   - Run migration `20250209135000_phase8_inbound_productions.sql` so that `inbound_productions` and `inbound_production_documents` exist; `documents.inbound_production_id` is added.

2. **Backend**
   - DAT/OPT **parser** (e.g. `lib/loadfile-parser.ts`) to read Concordance-style DAT and Opticon OPT; map columns to internal metadata (Bates, image path, native path, custodian, date if present).
   - `POST /api/productions/import` (or equivalent) that accepts:
     - Production name, producing party
     - Load file(s): DAT and optionally OPT (upload or storage path)
     - TIFF volume/base path (where TIFFs are stored or will be linked)
   - Import job: create `inbound_productions` row (status pending → processing), parse load file(s), create `documents` rows (and optionally store/link TIFFs), create `inbound_production_documents` rows with Bates preserved, set status complete/failed and document_count.

3. **Frontend**
   - Productions page → **Import Load Files** tab: working form (name, producing party, DAT/OPT file upload or path, TIFF volume/path), “Start Import” button.
   - Table of import history: production name, party, DAT/OPT status, doc count, status, date; errors shown when failed.

---

## What to Test

| # | Area | What to verify |
|---|------|----------------|
| 1 | **Import list** | Import Load Files tab loads; table shows inbound production imports (empty at first or history). |
| 2 | **Upload and import** | Upload DAT (and optionally OPT); enter TIFF base path; run import; status moves to processing then complete (or failed with error message). |
| 3 | **Documents created** | After import, documents appear in Documents grid; filter or metadata indicates source is inbound production; Bates preserved (e.g. in metadata or via inbound_production_documents). |
| 4 | **Search and review** | Inbound docs are searchable and viewable alongside internal documents; Bates visible in grid or viewer. |
| 5 | **Errors** | Invalid DAT/OPT or missing TIFF path yields failed status and error message in UI and optionally in audit/import history. |

---

## API

- **List inbound imports**
  - `GET /api/productions/import` or `GET /api/inbound-productions`
  - Expect: `200`, `{ success: true, data: { imports: [ ... ], total: N } }`.

- **Start import**
  - `POST /api/productions/import` with body (multipart or JSON):
    - `name`, `producing_party`, `matter_id` (optional)
    - DAT file (and optionally OPT), or paths if already in storage
    - `tiff_base_path` (volume/path for TIFF images)
  - Expect: `202` or `201` with import job id; job runs async; poll until status is complete or failed.

- **Get import job**
  - `GET /api/productions/import/:id` or `GET /api/inbound-productions/:id`
  - Expect: `200`, job details plus document_count and error_message if failed.

---

## Quick checklist

- [ ] Phase 8 migration applied; `inbound_productions`, `inbound_production_documents` exist; `documents.inbound_production_id` present.
- [ ] Backend: DAT/OPT parser and `POST /api/productions/import` (or equivalent) implemented; import job creates documents and inbound_production_documents rows; Bates preserved.
- [ ] Import Load Files tab: form accepts name, party, DAT/OPT upload, TIFF path; Start Import runs job; table shows import history with status and errors.
- [ ] Imported documents appear in Documents grid and search; Bates visible; reviewable with internal docs.
