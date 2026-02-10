# Phase 4 Testing Guide — Folders and Batching (Culling)

Use this guide to verify Phase 4 (folders, document assignment, list by folder, Cull to folder).

---

## Prerequisites

1. **Apply the Phase 4 migration**
   - Run migration `20250209100000_phase4_folders.sql` against your Supabase database (Supabase Dashboard → SQL Editor, or `supabase db push`).

2. **Start backend and frontend**
   - Backend: `cd backend && npm run dev` (port 3000).
   - Frontend: `cd <project-root> && pnpm dev` (e.g. port 4000).
   - Ensure `NEXT_PUBLIC_API_URL` points to the backend.

3. **Have some documents**
   - Upload a few documents via the **Documents** page so you can add them to folders.

---

## What to Test

| # | Area | What to verify |
|---|------|----------------|
| 1 | **Folder CRUD** | Create folder (root and subfolder), rename, delete; tree and counts update. |
| 2 | **Folders page – list by folder** | Select folder → contents load; “Include subfolders” changes the list. |
| 3 | **Move to folder** | In Folders page: select docs → “Move (N) to folder” → pick target → docs appear in that folder. |
| 4 | **Remove from folder** | In folder contents, click remove on a doc → doc disappears from folder (not deleted from DB). |
| 5 | **Cull to folder (Documents page)** | On Documents: select rows → “Cull to folder” → pick folder → docs are added to that folder. |
| 6 | **List API by folder** | `GET /api/documents?folderId=...` returns only docs in that folder; `includeSubfolders=true` includes subfolders. |

---

## How to Test

### 1. Folder CRUD (Folders page)

1. Go to **Folders** (sidebar).
2. **Create folder**
   - Click the **+** (FolderPlus) next to “Folder structure”.
   - Enter a name (e.g. “Responsive”), click **Create**.
   - Folder appears in the tree with count 0.
3. **Create subfolder**
   - Open the **⋯** menu on “Responsive” → **New subfolder**.
   - Enter name (e.g. “Hot Docs”), click **Create**.
   - “Hot Docs” appears under “Responsive”.
4. **Rename**
   - **⋯** on a folder → **Rename** → change name → **Save**.
   - Tree updates.
5. **Delete**
   - **⋯** on a folder (prefer a test subfolder) → **Delete folder** → confirm.
   - Folder and its document assignments are removed; subfolders are removed (CASCADE).

### 2. List by folder (Folders page)

1. Create at least one folder and add documents to it (see step 3 or 5).
2. In the folder tree, **click a folder**.
3. **Folder contents** panel should load documents in that folder (with family grouping).
4. Toggle **“Include subfolders”**.
   - With subfolders and docs in them, the list should change (more docs when checked if you have subfolder assignments).

### 3. Move to folder (Folders page)

1. Select a folder so its contents are visible.
2. **Select one or more documents** (checkboxes).
3. Click **“Move (N) to folder”**.
4. In the dialog, pick the **target folder** (same or another).
5. Click **“Add N doc(s) to folder”**.
6. **Verify**
   - Toast: “Added N document(s) to folder”.
   - If target was another folder, switch to that folder and confirm those docs appear.
   - Folder document counts in the tree update.

### 4. Remove from folder

1. In **Folder contents**, find a document row.
2. Click the **“Remove from folder”** control (folder-with-arrow icon) on that row.
3. **Verify**
   - Document disappears from the folder contents list.
   - Folder count in the tree decreases.
   - Document still exists in the system (e.g. still on Documents page).

### 5. Cull to folder (Documents page)

1. Go to **Documents**.
2. **Select documents** using the checkboxes (or “Select all on page” in the header).
3. Click **“Cull to folder (N)”**.
4. In the dialog, **pick a folder** from the tree.
5. Click **“Add to folder”**.
6. **Verify**
   - Toast: “Added N document(s) to folder”.
   - Go to **Folders** → open that folder; the documents appear in its contents.

### 6. List API by folder (optional)

- **Exact folder only**
  - `GET /api/documents?folderId=<folder-uuid>&page=1&pageSize=20&expand=families`
  - Response should contain only documents that are in that folder (via `document_folders`).

- **Include subfolders**
  - `GET /api/documents?folderId=<parent-folder-uuid>&includeSubfolders=true&page=1&pageSize=20`
  - Response should include docs in the folder and in any of its descendant folders.

- **Folder APIs**
  - `GET /api/folders` → `{ folders: [ ... ] }` (nested tree with `document_count`).
  - `POST /api/folders` — Body: `{ "name": "Test Folder" }` → 201, returns folder with `id`.
  - `PATCH /api/folders/<id>` — Body: `{ "name": "Renamed" }` → 200.
  - `POST /api/folders/<id>/documents` — Body: `{ "documentIds": ["<doc-uuid>", ...] }` → 200, `{ added: N }`.
  - `DELETE /api/folders/<id>/documents/<documentId>` → 200.
  - `DELETE /api/folders/<id>` → 200.

---

## Quick smoke checklist

- [ ] Phase 4 migration applied; backend starts without errors.
- [ ] Folders page loads; “No folders yet” or folder tree visible.
- [ ] Create a folder; it appears in the tree with count 0.
- [ ] Create a subfolder; it appears under the parent.
- [ ] On Documents: select 1+ docs → “Cull to folder” → pick folder → Add; docs appear in that folder on Folders page.
- [ ] On Folders: select a folder → contents show; select docs → “Move (N) to folder” → pick target → Add; counts and contents update.
- [ ] Remove a document from a folder; it disappears from folder contents; folder count decreases.
- [ ] Rename and delete a folder (test folder); tree updates.

If all of the above pass, Phase 4 behavior is in good shape.
