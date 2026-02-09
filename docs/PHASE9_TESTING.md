# Phase 9 Testing Guide — AI-Assisted Review (Human-in-the-Loop)

Use this guide to verify Phase 9: embeddings, optional semantic search (find-similar), LLM summarization and suggestions, cost controls, and AI Review UI.

---

## Prerequisites

1. **Apply migrations through Phase 9**
   - Run migration `20250209140000_phase9_ai_assisted_review.sql` (enable pgvector, `document_embeddings`, `document_summaries`, `ai_usage`, `match_document_embeddings` RPC).
   - Supabase Dashboard → SQL Editor, or `supabase db push`.

2. **Backend dependencies**
   - In `backend`: `npm install` (includes `openai`).
   - Set `OPENAI_API_KEY` in `backend/.env` for AI endpoints. Optional: `OPENAI_SUMMARIZE_MODEL`, `OPENAI_SUGGESTIONS_MODEL`, `AI_USAGE_CAP_PER_MATTER_PER_MONTH`.

3. **Start backend and frontend**
   - Backend: `cd backend && npm run dev` (port 3000).
   - Frontend: `npm run dev` or `pnpm dev` (e.g. port 4000).
   - Ensure `NEXT_PUBLIC_API_URL` points to the backend.

4. **Documents with extracted text**
   - Upload documents and let processing complete (OCR/metadata) so `extracted_text` or `extracted_text_path` is set. Embeddings and summarization use this text.

---

## What to Test

| # | Area | What to verify |
|---|------|----------------|
| 1 | **AI Review page** | **AI Review** in sidebar opens; task selector: Summarize, Find similar, Suggestions; scope (folder / document IDs); Run runs the selected task. |
| 2 | **Summarize** | Scope by folder or document IDs → Run → summary returned (or cached); usage increases; cap shown (e.g. "AI usage this month: X / 10000 units"). |
| 3 | **Find similar** | Enter one document ID → Run → list of similar document IDs with links to viewer; requires embedding (generated on first use or via Embed). |
| 4 | **Suggestions** | Document IDs + optional query → Run → issue tag suggestions or relevance ranking with links to docs; human applies tags/order. |
| 5 | **Embed** | POST `/api/ai/embed` with `documentIds` or `folderId` → embeddings generated and cached; then Find similar works for those docs. |
| 6 | **Usage & cap** | GET `/api/ai/usage` returns `used`, `cap`, `period`; exceeding cap returns 429 with message. |
| 7 | **No automated decisions** | UI and API do not set relevance/privilege automatically; AI only suggests; human confirms. |

---

## API Quick Reference

- **POST /api/ai/summarize** — Body: `{ documentIds?, folderId?, matter_id?, includeSubfolders? }`. Returns `summary`, `cached`, `documentCount`.
- **POST /api/ai/similar** — Body: `{ documentId, limit?, matter_id? }`. Returns `similarDocumentIds`.
- **POST /api/ai/suggestions** — Body: `{ documentIds, type?: 'issue_tags' | 'relevance_ranking', query? }`. Returns suggestions or ranking.
- **POST /api/ai/embed** — Body: `{ documentIds?, folderId?, includeSubfolders? }`. Returns `requested`, `embedded`, `results`.
- **GET /api/ai/usage** — Query: `matter_id?`, `user_id?`. Returns `used`, `cap`, `period`.

---

## Deliverable Checklist (Phase 9)

- [x] Embeddings: one-time or on-demand per doc; stored in pgvector; cached.
- [x] Optional semantic search: find-similar only when user explicitly requests.
- [x] LLM: explicit user-initiated only (summarize, suggest issue tags, relevance ranking); no automated privilege/relevance.
- [x] Cost controls: cached embeddings and summaries; AI usage tracked; cap per matter (configurable).
- [x] API: `/api/ai/summarize`, `/api/ai/similar`, `/api/ai/suggestions`, `/api/ai/embed`, `/api/ai/usage`.
- [x] UI: AI Review panel with task selector, scope, trigger; results linked to source docs.
