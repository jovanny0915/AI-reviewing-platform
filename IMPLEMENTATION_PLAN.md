# Document Processing Platform — Implementation Plan

**Relativity-Equivalent E-Discovery Platform**

This plan implements a litigation-grade e-discovery and document management platform functionally equivalent to Relativity. The goal is **defensibility**, **scalability**, and **cost discipline**. The platform supports active litigation use: ingestion, review, redaction, production, and inbound productions, while remaining auditable and predictable under court scrutiny.

This document merges the client’s updated requirements with a phased implementation order so each phase delivers a working slice (backend + UI) and respects dependencies.

---

## 1. Purpose & Scope

- **Purpose:** Litigation-grade technical architecture for e-discovery and document management.
- **Scope:** Ingestion → review → redaction → production → inbound productions; full auditability.
- **Not in scope:** Experimental AI; AI never replaces human decisions on relevance or privilege.

---

## 2. Core Design Principles

| Principle | Meaning |
|-----------|--------|
| **Defensibility First** | Every system action is reproducible, logged, and explainable. |
| **Human-in-the-Loop AI** | AI assists review; humans decide relevance and privilege. |
| **Hybrid Search Architecture** | Keyword and metadata search are primary; AI augments. |
| **Immutable Originals** | Native files are never modified. |
| **Cost Predictability** | AI usage is explicit, cached, and bounded. |

---

## 3. Implementation Principles

- **Incremental delivery:** Each phase produces a working slice (backend + UI) for that requirement.
- **Dependency order:** Foundation and document pipeline first; search, productions, and AI build on top.
- **Stack alignment:** See §4 High-Level Architecture.

---

## 4. High-Level System Architecture (Target)

| Component | Technology |
|-----------|------------|
| **Object Storage** | AWS S3 (natives, TIFFs, extracted text, load files). *Current option: Supabase Storage; migrate to S3 when scaling.* |
| **Metadata Store** | PostgreSQL (Supabase). Documents, families, productions, audit logs. |
| **Search Engine** | OpenSearch (keyword + metadata + optional vector fields). *Phase 0–5 may use Postgres FTS; migrate to OpenSearch for parity.* |
| **AI Services** | OCR: Tesseract (default), AWS Textract (selective). Embeddings: OpenAI / Azure OpenAI / Hugging Face. LLMs: Only for explicit user-initiated actions. |
| **Compute** | AWS Lambda (ingestion, OCR, text extraction); ECS (batch TIFFing, productions, redaction burn-in). *Early phases: Node backend + workers.* |
| **Frontend** | React / Next.js review interface. |

---

## 5. Data Model (Simplified)

### 5.1 Document Entity

- `document_id` (UUID), `matter_id`, `parent_id` (family linkage)
- `custodian`, `file_type`, `original_filename`
- `md5_hash` / `sha1_hash`
- `extracted_text_path` (e.g. S3/Supabase path)
- `metadata` (JSONB), `created_at` / `processed_at`

### 5.2 Review & Coding

- `relevance_flag`, `privilege_flag`, `issue_tags`
- `reviewer_id`, `coding_timestamp`

### 5.3 Audit Log (Append-Only)

- `event_id`, `user_id`, `document_id`, `action_type` (view, tag, redact, produce), `timestamp`, `metadata_snapshot`

---

## Phase 0: Foundation (Do First)

**Goal:** PostgreSQL (Supabase) schema, storage, API structure, matter isolation, and audit scaffolding so all later features have a defensible backend.

| # | Task | Details |
|---|------|--------|
| 0.1 | **Supabase project + schema** | Create project. Migrations: `documents` table with `document_id` (UUID), `matter_id`, `parent_id`, `storage_path`, `original_filename`, `file_type`, `custodian`, `md5_hash`, `sha1_hash`, `extracted_text_path`, `metadata` (JSONB), `created_at`, `processed_at`; review/coding columns or separate table; `audit_log` append-only table. Tenants/matters for isolation. |
| 0.2 | **Storage** | Bucket (e.g. `documents`) in Supabase Storage (or S3). RLS/policies as needed. Upload API in Node backend; use for natives and extracted text paths. |
| 0.3 | **Node backend + API layout** | Express/Fastify with routes: `GET/POST /api/documents`, `POST /api/upload`, etc. Standardized JSON and error handling. Frontend uses `NEXT_PUBLIC_API_URL`. |
| 0.4 | **Audit scaffolding** | Every mutation (upload, tag, redact, produce) writes to `audit_log` with user_id, document_id, action_type, timestamp, metadata_snapshot. |
| 0.5 | **Auth (optional)** | Supabase Auth; protect API via JWT/session. RBAC and matter-level data isolation when required. |

**Deliverable:** DB and Storage connected; Node backend serves APIs; hashes and audit pattern in place; frontend calls backend.

**Phase 0 implementation status:** Schema extended with `matter_id`, `parent_id`, `original_filename`, `file_type`, `custodian`, `md5_hash`, `sha1_hash`, `extracted_text_path`, `processed_at`, and review/coding columns; `audit_log` append-only table added; upload computes MD5/SHA-1 and writes to `audit_log`; GET document logs "view"; GET list supports `matter_id` filter; optional auth middleware (Supabase JWT → `req.userId`) when `SUPABASE_ANON_KEY` is set; frontend uses `NEXT_PUBLIC_API_URL` or `BACKEND_API_URL` and supports `matter_id`/`custodian` on upload and list.

---

## Phase 1: Upload, OCR, and Metadata (Ingestion Pipeline)

**Goal:** Upload natives → hash (MD5/SHA-1) → metadata extraction → OCR (Tesseract → Textract if low confidence) → text indexing. Text extraction cached (never re-run unless forced).

| # | Task | Details |
|---|------|--------|
| 1.1 | **Upload API** | Accept multipart uploads; save to storage; compute and store `md5_hash`/`sha1_hash`; create `documents` row with `storage_path`, `extracted_text_path` (populated later). |
| 1.2 | **Metadata extraction** | Use Tika or equivalent; store in `metadata` JSONB. |
| 1.3 | **OCR pipeline** | Tesseract (default); optionally AWS Textract for low-confidence or selected docs. Store extracted text at `extracted_text_path`; cache so same doc is not re-OCR’d unless forced. |
| 1.4 | **Jobs / queue** | Async processing (Bull/BullMQ, or Lambda/workers later); upload returns quickly; processing runs in background. |
| 1.5 | **UI** | Upload to API; show processing status (pending / OCR / metadata complete); display hashes and metadata. |

**Deliverable:** Upload with end-to-end hash preservation; OCR and metadata stored and visible; text extraction cached.

---

## Phase 2: Family Linking (Emails + Attachments)

**Goal:** Family detection; emails + attachments share same family; families always processed and displayed together.

| # | Task | Details |
|---|------|--------|
| 2.1 | **Schema** | `parent_id` (FK to documents), `family_id` (e.g. UUID), optional `family_index`. |
| 2.2 | **Email parsing** | MSG/EML parser; detect attachments; one document per attachment; same `family_id`, `parent_id` → email. |
| 2.3 | **Linking on ingest** | On email processing, create child records; non-email docs get new single-doc family. |
| 2.4 | **API** | Fetch by id; list with `family_id` or `expand=families`; return parent/children for grid. |
| 2.5 | **UI** | Grid: expandable rows for families (parent + children). |

**Deliverable:** Families linked in DB and displayed in grid; families processed together.

---

## Phase 3: Metadata Grid and Filtering (Review Grid Equivalent)

**Goal:** Column-based document grid with Boolean keyword search, date range, metadata filters, family-aware sorting, saved searches, foldering/batching. Coding panel: relevance, privilege, issue tags. All actions logged.

| # | Task | Details |
|---|------|--------|
| 3.1 | **Indexes** | Index key filter fields (custodian, date, doc_type, family_id); full-text on metadata/title if using Postgres. |
| 3.2 | **List API with filters** | `GET /api/documents` with `custodian`, `dateFrom`, `dateTo`, `keyword`, `docType`, `familyId`, `folderId`, `page`, `pageSize`. Paginated results. |
| 3.3 | **Signed URLs** | Storage signed URLs for “View” / “Open” in viewer. |
| 3.4 | **Coding panel API** | Set relevance_flag, privilege_flag, issue_tags; store reviewer_id, coding_timestamp; write to audit_log. |
| 3.5 | **Saved searches** | Persist search name + params; list/run saved searches. |
| 3.6 | **UI** | Grid with filters, links to viewer, coding panel (relevance, privilege, issue tags), saved searches. |

**Deliverable:** Grid with real data, filters, coding panel, saved searches; all coding actions audited.

---

## Phase 4: Folders and Batching (Culling)

**Goal:** Folders/subfolders; assign documents to folders; list by folder; use for culling and scoped production/AI.

| # | Task | Details |
|---|------|--------|
| 4.1 | **Schema** | `folders` (id, name, parent_id); `document_folders` junction (document_id, folder_id). |
| 4.2 | **Folder API** | CRUD folders; list tree; add/remove documents from folder. |
| 4.3 | **List by folder** | `GET /api/documents?folderId=...` (optional subfolders). |
| 4.4 | **UI** | Folder tree; move docs between folders; “Cull to folder” from grid. |

**Deliverable:** Folders and document assignment; list by folder.

---

## Phase 5: Search (Primary: Keyword + Metadata)

**Goal:** Primary search = keyword + metadata (OpenSearch or Postgres FTS). Zero AI cost per query; fully defensible. Optional later: vector/semantic as augment.

| # | Task | Details |
|---|------|--------|
| 5.1 | **Search backend** | OpenSearch (preferred) or Postgres FTS: index extracted text + metadata. Ingest: when text/metadata ready, index/update. |
| 5.2 | **Query parsing** | Boolean (AND/OR/NOT); scope: content only, metadata only, both. |
| 5.3 | **Search API** | `GET /api/search?q=...&scope=...` returning document ids, snippets (KWIC), hit counts. No LLM calls for default queries. |
| 5.4 | **UI** | Search box, scope toggles; results with snippets and links to viewer. |

**Deliverable:** Boolean keyword + metadata search; no AI cost for default search.

---

## Phase 6: Redactions (Relativity Redact Equivalent)

**Goal:** Redactions stored as coordinates + reasons; originals never altered; burn-in only at production time. Privilege reason codes and redaction audit log.

| # | Task | Details |
|---|------|--------|
| 6.1 | **Schema** | `redactions` (id, document_id, page_number, x, y, width, height or polygon, reason_code e.g. Attorney-Client, Work Product). |
| 6.2 | **Redaction API** | CRUD redactions per document; all changes written to audit_log. |
| 6.3 | **Viewer overlay** | Load redactions from API; render as overlay (e.g. black rectangles + reason label). |
| 6.4 | **Burn-in** | In production pipeline only: when generating TIFFs, render redaction rectangles into image. Reproducible outputs. |

**Deliverable:** Redactions with reason codes; overlay in viewer; burn-in only in production.

---

## Phase 7: Bates Stamp and Production (Relativity Production Equivalent)

**Goal:** Single-page TIFFs, sequential Bates numbering, placeholder TIFFs for natives, native file linkage, DAT/OPT load files. Post-production hash validation; exportable audit report.

| # | Task | Details |
|---|------|--------|
| 7.1 | **TIFF conversion** | LibreOffice → PDF; Ghostscript/ImageMagick → single-page TIFFs (or converter API). |
| 7.2 | **Bates stamping** | Prefix + sequential number (e.g. PROD000001); store production_id, doc_id, page_no → Bates. |
| 7.3 | **Placeholders** | For native-only items: single TIFF “Document produced in native” + link to native in load file. |
| 7.4 | **Load files** | DAT (Concordance-style), OPT (Opticon); volume/path to TIFF and native path. |
| 7.5 | **Production job** | Production = name, source folder/matter, Bates prefix/range. Job: select docs → convert → stamp → write TIFFs + DAT/OPT to storage. |
| 7.6 | **Validation & audit** | Post-production hash validation; exportable production audit report. |
| 7.7 | **UI** | Productions wizard (prefix, source, options); run job; progress and download/link output. |

**Deliverable:** Productions with TIFFs, Bates, DAT/OPT, placeholders; hash validation and audit report.

**Phase 7 implementation status:** Backend and UI for *outgoing* productions are implemented: create production, start job, TIFF conversion (or placeholder), Bates stamping, DAT/OPT *generation* and write to storage, download signed URLs for load files, export audit report. Production job runs via queue; load file *generation* is in `lib/loadfile.ts` (backend). **Note:** “Importing” load files (reading opposing-party DAT/OPT) is Phase 8, not Phase 7.

---

## Phase 8: Inbound Productions (Opposing Party)

**Goal:** Import TIFF + DAT/OPT; reconstruct metadata and families; preserve original Bates; overlay additional fields; review alongside internal documents.

| # | Task | Details |
|---|------|--------|
| 8.1 | **DAT/OPT parser** | Parse Concordance DAT and Opticon OPT; map to internal metadata (Bates, custodian, date, image path); validate and report errors. |
| 8.2 | **TIFF handling** | Resolve image paths; store or link TIFFs; associate pages to document/metadata rows; preserve Bates. |
| 8.3 | **Import API** | `POST /api/productions/import`: load file(s) + TIFF location; create documents and metadata; attach TIFF pages; support overlay fields. |
| 8.4 | **UI** | Import tab: upload DAT/OPT and TIFF location; run import; history and errors; inbound docs in same grid/search. |

**Deliverable:** Inbound productions imported with metadata and families; Bates preserved; reviewable with internal docs.

**Phase 8 implementation status:** **Implemented.** The productions page has an “Import Load Files” tab as a stub only (disabled form, placeholder message). **Database:** Migration `20250209135000_phase8_inbound_productions.sql` adds `inbound_productions`, `inbound_production_documents`, and `documents.inbound_production_id` for import jobs and Bates-preserved linkage. **Still required:** (8.1) DAT/OPT *parser* in backend (e.g. `lib/loadfile-parser.ts`) to *read* Concordance DAT and Opticon OPT and map to internal metadata (Bates, custodian, date, image path); (8.2) TIFF handling—resolve image paths, store or link TIFFs, associate pages to document rows, preserve Bates; (8.3) `POST /api/productions/import` accepting load file(s) + TIFF location, creating documents and metadata, attaching TIFF pages; (8.4) Import UI—working form and import history with status/errors. See §11 and `docs/PHASE8_TESTING.md` for checklist.

---

## Phase 9: AI-Assisted Review (Human-in-the-Loop)

**Goal:** AI augments only; humans decide relevance and privilege. Permitted: relevance ranking, issue classification suggestions, similarity clustering, summaries of user-selected sets. Prohibited: automated privilege determinations, AI-only relevance decisions. Cached embeddings and summaries; explicit user triggers for LLM actions.

| # | Task | Details |
|---|------|--------|
| 9.1 | **Embeddings** | One-time embedding generation per doc (or on-demand); store in vector store (pgvector or OpenSearch). Cached; no per-query embedding by default. |
| 9.2 | **Optional semantic search** | Vector similarity, near-duplicate detection, find-similar only when user explicitly requests; augments keyword search. |
| 9.3 | **LLM integration** | Explicit user-initiated only: summarize selected docs, suggest issue tags, relevance ranking suggestions. No automated privilege or relevance decisions. |
| 9.4 | **Cost controls** | Cached embeddings; cached summaries; AI usage caps per matter/user; target ~$5–$15 per 1,000 documents. |
| 9.5 | **API** | e.g. `POST /api/ai/summarize`, `POST /api/ai/similar`, `POST /api/ai/suggestions`; scope by folder/matter. |
| 9.6 | **UI** | AI review panel: task selector (summarize, similar, suggestions); user confirms scope and triggers; results linked to source docs. |

**Deliverable:** AI used only for explicit tasks; no automated privilege/relevance; caching and caps in place.

---

## 6. Security & Compliance

- **RBAC:** Role-based access control at API and UI.
- **Matter-level isolation:** Data scoped by matter; enforce in queries and storage paths.
- **Encryption:** At rest and in transit (TLS, storage encryption).
- **Immutable audit logs:** Append-only; no edits or deletes; exportable for discovery.

Security enforced at ingestion, review, and production layers.

---

## 7. Cost Management Strategy

- S3 (or storage) lifecycle rules for cold matters.
- Hybrid OCR: Tesseract first; Textract selective.
- Keyword-first search (no AI cost per query).
- AI usage caps per matter/user; target AI cost ~$5–$15 per 1,000 documents.

---

## 8. Relativity Parity Summary

| Capability | Status |
|------------|--------|
| Processing equivalent | ✓ |
| Review grid equivalent | ✓ |
| Analytics | Equivalent / improved |
| Redactions | Equivalent |
| Productions | Equivalent |
| Auditability | Equivalent |
| Cost control | Improved |

---

## 9. Suggested Implementation Order (Summary)

| Order | Phase | Focus | Rationale |
|-------|--------|--------|------------|
| 0 | Foundation | DB, storage, API, audit, matter isolation | Needed by all |
| 1 | Upload / OCR / Metadata | Pipeline, hashes, cache | Core pipeline |
| 2 | Family linking | Emails + attachments | Grid and productions |
| 3 | Grid + filters + coding | Review grid, saved searches | Primary way to work |
| 4 | Folders | Culling, batching | Scoped production/AI |
| 5 | Search | Keyword + metadata | Primary search; no AI |
| 6 | Redactions | Overlay + burn-in at production | Before production |
| 7 | Bates + production | TIFFs, load files, validation | Core output |
| 8 | Import productions | Inbound TIFF + DAT/OPT | Same domain |
| 9 | AI-assisted review | Human-in-the-loop only | After search and grid |

**Parallelism:** After Phase 3, Folders (4) and Search (5) can run in parallel. After Phase 6, Production (7) and Import (8) can be parallelized. AI (9) after embeddings/search pipeline.

---

## 10. Risks and Clarifications

- **Storage:** Supabase Storage for initial build; plan S3 migration for scale and cost (lifecycle, cold tiers).
- **Search:** Postgres FTS acceptable for Phase 5; OpenSearch for full parity and optional vector search.
- **Compute:** Node backend + workers (e.g. Bull + Redis) for now; Lambda/ECS for production scale.
- **TIFF/PDF:** LibreOffice + Ghostscript + ImageMagick in backend or container; confirm deployment model.
- **DAT/OPT:** Confirm Concordance/Opticon variants and delimiters with client.
- **AI:** Data privacy—confirm whether external LLM APIs are allowed or on-prem/local only.

---

## 11. File and Module Hints

- **Node backend:** Routes: `/api/documents`, `/api/upload`, `/api/folders`, `/api/search`, `/api/redactions`, `/api/productions`, `/api/productions/import`, `/api/ai`. Use Supabase server client; optional Prisma/Drizzle.
- **Frontend:** `fetch(NEXT_PUBLIC_API_URL + '/api/...')` for all document/folder/search/production/AI; Supabase client only for auth if used.
- **Supabase:** RLS on documents, folders, audit_log; matter_id in all relevant tables.
- **Services (backend):** e.g. `lib/storage.ts`, `lib/ocr.ts` (Tesseract/Textract), `lib/tika.ts`, `lib/email-parser.ts`, `lib/search.ts`, `lib/production-tiff.ts`, `lib/loadfile.ts` (Phase 7: DAT/OPT *generation*), `lib/loadfile-parser.ts` (Phase 8: DAT/OPT *parsing* for inbound productions), `lib/embeddings.ts`, `lib/llm.ts`, `lib/audit.ts`.
- **Jobs:** `lib/jobs/` or `workers/` for OCR, metadata, production (Phase 7), **production import** (Phase 8), embedding.

Use this plan as the single source of truth when implementing features. Adjust phase order or task splits to match team size and client priorities.
