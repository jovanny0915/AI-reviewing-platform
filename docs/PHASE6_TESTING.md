# Phase 6 Testing Guide — Redactions

Use this guide to verify Phase 6: redactions stored as coordinates + reason codes, viewer overlay, CRUD API with audit log, and burn-in for production.

---

## Prerequisites

1. **Apply the Phase 6 migration**
   - Run migration `20250209120000_phase6_redactions.sql` against your Supabase database (Supabase Dashboard → SQL Editor, or `supabase db push`).
   - Ensure the `redactions` table exists with columns: `id`, `document_id`, `page_number`, `x`, `y`, `width`, `height`, `reason_code`, `polygon`, `created_at`.

2. **Start backend and frontend**
   - Backend: `cd backend && npm run dev` (port 3000).
   - Frontend: `npm run dev` or `pnpm dev` (e.g. port 4000).
   - Ensure `NEXT_PUBLIC_API_URL` (or `BACKEND_API_URL`) points to the backend.

3. **Have at least one viewable document**
   - Upload a document via **Documents** (e.g. a PDF or image) so you can open it in the viewer. Images and PDFs both support the redaction overlay.

---

## What to Test

| # | Area | What to verify |
|---|------|----------------|
| 1 | **Viewer – load redactions** | Open a document in Viewer → Redactions section in sidebar loads (empty or list); no errors. |
| 2 | **Viewer – overlay** | Redactions for the current page appear as black rectangles with reason label on top of the document (image or PDF). |
| 3 | **Draw new redaction** | Select Redact tool, choose reason (e.g. Attorney-Client Privilege), draw a rectangle on the document → redaction is saved and appears in overlay + sidebar. |
| 4 | **Delete redaction** | In sidebar, click trash on a redaction → it is removed from overlay and list. |
| 5 | **Redaction API** | GET list, POST create, PATCH update, DELETE; all mutations write to `audit_log` with `action_type: 'redact'`. |
| 6 | **Burn-in (optional)** | If `sharp` is installed in backend, `burnInRedactions(buffer, redactions, w, h)` returns image with black rectangles; otherwise clear error. |

---

## How to Test

### 1. Viewer – load redactions

1. Go to **Documents**, open a document in the viewer (click View / open `/viewer?id=<documentId>`).
2. **Verify**
   - Document loads (signed URL for preview).
   - In the right **Metadata** panel, the **Redactions** section appears.
   - If there are no redactions yet, it shows "No redactions. Use Redact tool to add." (or a count and list if you already added some).
   - No console or network errors.

### 2. Viewer – overlay

1. With a document open, add at least one redaction (see step 3) or use the API to insert one (see step 5).
2. **Verify**
   - On the document area (image or PDF), black rectangles appear over the redacted regions.
   - Each rectangle shows the **reason label** (e.g. "Attorney-Client Privilege", "Work Product") inside or as tooltip.
   - Coordinates are normalized (0–1), so rectangles scale with zoom/resize.

### 3. Draw new redaction

1. Open a document in the **Viewer** (image or PDF).
2. In the toolbar, click **Redact** (tool becomes active).
3. Select a **reason** from the dropdown (e.g. Attorney-Client Privilege, Work Product, Confidential, Personal Information).
4. In the document area, **click and drag** to draw a rectangle.
5. **Verify**
   - While dragging, a preview rectangle (e.g. red border) appears.
   - On mouse release, a short "Saving…" indicator may appear.
   - A new **black rectangle** appears in the overlay with the chosen reason.
   - The **Redactions** list in the sidebar updates with the new entry (reason + page number).
   - Refreshing the page and reopening the document shows the same redaction (persisted).

### 4. Delete redaction

1. In the Viewer sidebar, under **Redactions**, find one redaction.
2. Click the **trash** (Trash2) icon on that row.
3. **Verify**
   - The redaction disappears from the sidebar list.
   - The black rectangle disappears from the document overlay.
   - No errors in console or network.

### 5. Redaction API (optional)

Use the backend base URL (e.g. `http://localhost:3000`). Replace `<documentId>` with a real document UUID.

- **List redactions**
  - `GET /api/redactions?documentId=<documentId>`
  - Expect: `200`, body `{ success: true, data: { redactions: [ ... ] } }`.
  - Each item: `id`, `document_id`, `page_number`, `x`, `y`, `width`, `height`, `reason_code`, `polygon`, `created_at`.

- **Create redaction**
  - `POST /api/redactions` with body (JSON):
    ```json
    {
      "document_id": "<documentId>",
      "page_number": 1,
      "x": 0.1, "y": 0.2, "width": 0.3, "height": 0.05,
      "reason_code": "Attorney-Client Privilege"
    }
    ```
  - Expect: `201`, `data` is the created redaction row.
  - In Supabase (or DB): `audit_log` has a new row with `action_type = 'redact'` and `metadata_snapshot` containing `redaction_id`, `action: 'create'`, `reason_code`.

- **Update redaction**
  - `PATCH /api/redactions/<redactionId>` with body e.g. `{ "reason_code": "Work Product" }`.
  - Expect: `200`, updated redaction; audit_log has `action: 'update'`.

- **Delete redaction**
  - `DELETE /api/redactions/<redactionId>`
  - Expect: `200`, `{ success: true, data: { deleted: true } }`; audit_log has `action: 'delete'`.

- **Validation**
  - POST without `document_id` or with invalid `reason_code` → `400` with message.
  - GET/PATCH/DELETE with non-existent id → `404`.

### 6. Burn-in (optional)

Burn-in is used in the **production pipeline (Phase 7)** when generating TIFFs. You can unit-test it if `sharp` is installed:

1. **Install sharp** (optional): `cd backend && npm install sharp`.
2. In Node/backend, call:
   - `burnInRedactions(imageBuffer, [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }], 800, 600)`
   - Expect: buffer of the same image with a black rectangle at the given normalized region.
3. If **sharp** is not installed, calling `burnInRedactions` should throw an error that says to install `sharp` for production TIFF generation.

---

## Quick smoke checklist

- [ ] Phase 6 migration applied; `redactions` table exists; backend starts without errors.
- [ ] Open a document in Viewer → Redactions section in sidebar loads (empty or list).
- [ ] Click **Redact**, choose a reason, draw a rectangle on the document → redaction saves and appears in overlay and sidebar.
- [ ] Refresh viewer page → redaction still visible (persisted).
- [ ] Delete a redaction from sidebar (trash icon) → it disappears from overlay and list.
- [ ] `GET /api/redactions?documentId=<id>` returns list; POST creates a row and an `audit_log` entry with `action_type: 'redact'`.
- [ ] (Optional) With `sharp` installed, `burnInRedactions(buffer, redactions, w, h)` returns image with black rectangles.

If all of the above pass, Phase 6 redactions are in good shape.
