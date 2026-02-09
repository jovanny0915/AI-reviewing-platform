/**
 * API client for Document Processing Platform backend.
 * Uses NEXT_PUBLIC_API_URL (client) or BACKEND_API_URL (server) when set.
 * When unset in the browser, uses same-origin so Next.js can proxy to backend (see app/api/[...path]/route.ts).
 * When unset on server, uses localhost:3000 for local backend.
 */

function getBackendApiUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "";
  }
  return process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

const BACKEND_API_URL = getBackendApiUrl();

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string; code?: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${BACKEND_API_URL}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  } catch (err) {
    const message =
      err instanceof TypeError && err.message === "Failed to fetch"
        ? "Backend unreachable. Is the API server running?"
        : err instanceof Error
          ? err.message
          : "Network error";
    return { success: false, error: message, code: "NETWORK_ERROR" };
  }
  let json: ApiResponse<T> | { error?: string };
  try {
    json = (await res.json()) as ApiResponse<T> | { error?: string };
  } catch {
    return { success: false, error: "Invalid response from server", code: "INVALID_RESPONSE" };
  }
  if (!res.ok) {
    const err = json as ApiError;
    return { success: false, error: err.error ?? "Request failed", code: err.code };
  }
  return json as ApiSuccess<T>;
}

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "metadata_extracted"
  | "ocr_complete"
  | "failed";

export type DocumentRecord = {
  id: string;
  matter_id: string | null;
  parent_id: string | null;
  family_id: string | null;
  family_index: number | null;
  storage_path: string;
  filename: string;
  original_filename: string | null;
  mime_type: string | null;
  file_type: string | null;
  custodian: string | null;
  md5_hash: string | null;
  sha1_hash: string | null;
  extracted_text_path: string | null;
  size: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
  processing_status: ProcessingStatus | null;
  processing_error: string | null;
  relevance_flag: boolean | null;
  privilege_flag: boolean | null;
  issue_tags: unknown;
  reviewer_id: string | null;
  coding_timestamp: string | null;
};

export type DocumentsListResponse = {
  documents: DocumentRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type FamilyGroup = {
  id: string;
  parent: DocumentRecord;
  children: DocumentRecord[];
};

export type DocumentsListFamiliesResponse = {
  familyGroups: FamilyGroup[];
  total: number;
  page: number;
  pageSize: number;
};

/** Phase 3: list filters for review grid */
export type ListDocumentsParams = {
  page?: number;
  pageSize?: number;
  matter_id?: string;
  family_id?: string;
  custodian?: string;
  dateFrom?: string;
  dateTo?: string;
  keyword?: string;
  docType?: string;
  folderId?: string;
  /** Phase 4: when folderId is set, include docs in subfolders */
  includeSubfolders?: boolean;
  expand?: "families";
};

export async function listDocuments(
  params?: ListDocumentsParams
): Promise<ApiResponse<DocumentsListResponse | DocumentsListFamiliesResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.page != null) searchParams.set("page", String(params.page));
  if (params?.pageSize != null) searchParams.set("pageSize", String(params.pageSize));
  if (params?.matter_id) searchParams.set("matter_id", params.matter_id);
  if (params?.family_id) searchParams.set("family_id", params.family_id);
  if (params?.custodian) searchParams.set("custodian", params.custodian);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.keyword) searchParams.set("keyword", params.keyword);
  if (params?.docType) searchParams.set("docType", params.docType);
  if (params?.folderId) searchParams.set("folderId", params.folderId);
  if (params?.includeSubfolders === true) searchParams.set("includeSubfolders", "true");
  if (params?.expand === "families") searchParams.set("expand", "families");
  const qs = searchParams.toString();
  return request<DocumentsListResponse | DocumentsListFamiliesResponse>(`/api/documents${qs ? `?${qs}` : ""}`);
}

/** Phase 3.4: Update coding (relevance, privilege, issue tags); audited. */
export async function updateDocumentCoding(
  documentId: string,
  coding: {
    relevance_flag?: boolean | null;
    privilege_flag?: boolean | null;
    issue_tags?: string[] | null;
  }
): Promise<ApiResponse<DocumentRecord>> {
  return request<DocumentRecord>(`/api/documents/${documentId}/coding`, {
    method: "PATCH",
    body: JSON.stringify(coding),
  });
}

export type DocumentWithFamily = DocumentRecord & {
  signedUrl?: string | null;
  parent?: DocumentRecord | null;
  children?: DocumentRecord[];
};

export async function getDocument(
  id: string,
  options?: { signedUrl?: boolean; expand?: "family" }
): Promise<ApiResponse<DocumentWithFamily>> {
  const sp = new URLSearchParams();
  if (options?.signedUrl) sp.set("signedUrl", "true");
  if (options?.expand === "family") sp.set("expand", "family");
  const qs = sp.toString();
  return request<DocumentWithFamily>(`/api/documents/${id}${qs ? `?${qs}` : ""}`);
}

/** Fetch OCR/extracted text for a document. Returns the raw text or error. */
export async function getExtractedText(
  id: string
): Promise<ApiResponse<{ text: string }>> {
  const url = `${BACKEND_API_URL}/api/documents/${id}/extracted-text`;
  const res = await fetch(url);
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as ApiError;
    return {
      success: false,
      error: json.error ?? "No extracted text",
      code: json.code,
    };
  }
  const text = await res.text();
  return { success: true, data: { text } };
}

export type UploadResponse = {
  id: string;
  document: DocumentRecord;
};

export async function uploadDocument(
  file: File,
  options?: { matter_id?: string; custodian?: string }
): Promise<ApiResponse<UploadResponse>> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.matter_id) formData.append("matter_id", options.matter_id);
  if (options?.custodian) formData.append("custodian", options.custodian);
  const url = `${BACKEND_API_URL}/api/upload`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    // Do not set Content-Type - browser sets it with boundary for multipart
    headers: {},
  });
  const json = (await res.json()) as ApiResponse<UploadResponse> | ApiError;
  if (!res.ok) {
    return {
      success: false,
      error: (json as ApiError).error ?? "Upload failed",
      code: (json as ApiError).code,
    };
  }
  return json as ApiSuccess<UploadResponse>;
}

// --- Phase 3.5: Saved searches ---

export type SavedSearchParams = Record<string, unknown> & Partial<ListDocumentsParams>;

export type SavedSearch = {
  id: string;
  matter_id: string | null;
  user_id: string | null;
  name: string;
  params: SavedSearchParams;
  created_at: string;
};

export async function listSavedSearches(params?: {
  matter_id?: string;
}): Promise<ApiResponse<{ savedSearches: SavedSearch[] }>> {
  const sp = new URLSearchParams();
  if (params?.matter_id) sp.set("matter_id", params.matter_id);
  const qs = sp.toString();
  return request<{ savedSearches: SavedSearch[] }>(
    `/api/saved-searches${qs ? `?${qs}` : ""}`
  );
}

export async function createSavedSearch(entry: {
  name: string;
  matter_id?: string;
  params?: SavedSearchParams;
}): Promise<ApiResponse<SavedSearch>> {
  return request<SavedSearch>("/api/saved-searches", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function getSavedSearch(id: string): Promise<ApiResponse<SavedSearch>> {
  return request<SavedSearch>(`/api/saved-searches/${id}`);
}

export async function deleteSavedSearch(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return request<{ deleted: boolean }>(`/api/saved-searches/${id}`, {
    method: "DELETE",
  });
}

// --- Phase 4: Folders ---

export type FolderRecord = {
  id: string;
  matter_id: string | null;
  name: string;
  parent_id: string | null;
  created_at: string;
};

export type FolderNode = FolderRecord & {
  children: FolderNode[];
  document_count?: number;
};

export async function listFolders(params?: {
  matter_id?: string;
}): Promise<ApiResponse<{ folders: FolderNode[] }>> {
  const sp = new URLSearchParams();
  if (params?.matter_id) sp.set("matter_id", params.matter_id);
  const qs = sp.toString();
  return request<{ folders: FolderNode[] }>(`/api/folders${qs ? `?${qs}` : ""}`);
}

export async function createFolder(entry: {
  name: string;
  parent_id?: string | null;
  matter_id?: string | null;
}): Promise<ApiResponse<FolderRecord>> {
  return request<FolderRecord>("/api/folders", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function getFolder(id: string): Promise<ApiResponse<FolderRecord>> {
  return request<FolderRecord>(`/api/folders/${id}`);
}

export async function updateFolder(
  id: string,
  entry: { name: string }
): Promise<ApiResponse<FolderRecord>> {
  return request<FolderRecord>(`/api/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(entry),
  });
}

export async function deleteFolder(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return request<{ deleted: boolean }>(`/api/folders/${id}`, {
    method: "DELETE",
  });
}

export async function addDocumentsToFolder(
  folderId: string,
  documentIds: string[]
): Promise<ApiResponse<{ added: number; folder_id: string }>> {
  return request<{ added: number; folder_id: string }>(`/api/folders/${folderId}/documents`, {
    method: "POST",
    body: JSON.stringify({ documentIds }),
  });
}

export async function removeDocumentFromFolder(
  folderId: string,
  documentId: string
): Promise<ApiResponse<{ removed: boolean }>> {
  return request<{ removed: boolean }>(
    `/api/folders/${folderId}/documents/${documentId}`,
    { method: "DELETE" }
  );
}

// --- Phase 5: Search (keyword + metadata FTS) ---

export type SearchScope = "content" | "metadata" | "both";

export type SearchResultItem = {
  documentId: string;
  snippet: string;
  hitCount: number;
  document: {
    id: string;
    original_filename: string | null;
    filename: string;
    custodian: string | null;
    created_at: string;
    file_type: string | null;
    matter_id: string | null;
    family_id: string | null;
  } | null;
};

export type SearchResponse = {
  results: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function search(params: {
  q: string;
  scope?: SearchScope;
  matter_id?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<SearchResponse>> {
  const sp = new URLSearchParams();
  sp.set("q", params.q.trim());
  if (params.scope) sp.set("scope", params.scope);
  if (params.matter_id) sp.set("matter_id", params.matter_id);
  if (params.page != null) sp.set("page", String(params.page));
  if (params.pageSize != null) sp.set("pageSize", String(params.pageSize));
  const qs = sp.toString();
  return request<SearchResponse>(`/api/search${qs ? `?${qs}` : ""}`);
}

// --- Phase 6: Redactions ---

export type RedactionRecord = {
  id: string;
  document_id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason_code: string;
  polygon: unknown;
  created_at: string;
};

export async function listRedactions(documentId: string): Promise<ApiResponse<{ redactions: RedactionRecord[] }>> {
  return request<{ redactions: RedactionRecord[] }>(`/api/redactions?documentId=${encodeURIComponent(documentId)}`);
}

export async function createRedaction(entry: {
  document_id: string;
  page_number: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reason_code: string;
  polygon?: unknown;
}): Promise<ApiResponse<RedactionRecord>> {
  return request<RedactionRecord>("/api/redactions", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function updateRedaction(
  id: string,
  updates: Partial<{
    page_number: number;
    x: number;
    y: number;
    width: number;
    height: number;
    reason_code: string;
    polygon: unknown;
  }>
): Promise<ApiResponse<RedactionRecord>> {
  return request<RedactionRecord>(`/api/redactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function deleteRedaction(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
  return request<{ deleted: boolean }>(`/api/redactions/${id}`, { method: "DELETE" });
}

// --- Phase 7: Productions (Bates + TIFF + load files) ---

export type ProductionRecord = {
  id: string;
  matter_id: string | null;
  name: string;
  bates_prefix: string;
  bates_start_number: number;
  source_folder_id: string | null;
  include_subfolders: boolean;
  status: "pending" | "processing" | "complete" | "failed";
  output_storage_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  document_count?: number;
  page_count?: number;
};

export type ProductionWithCounts = ProductionRecord & {
  document_count: number;
  page_count: number;
};

export async function listProductions(params?: {
  matter_id?: string;
  status?: string;
}): Promise<ApiResponse<{ productions: ProductionRecord[]; total: number }>> {
  const sp = new URLSearchParams();
  if (params?.matter_id) sp.set("matter_id", params.matter_id);
  if (params?.status) sp.set("status", params.status);
  const qs = sp.toString();
  return request<{ productions: ProductionRecord[]; total: number }>(
    `/api/productions${qs ? `?${qs}` : ""}`
  );
}

export async function createProduction(entry: {
  name: string;
  bates_prefix?: string;
  bates_start_number?: number;
  source_folder_id?: string | null;
  matter_id?: string | null;
  include_subfolders?: boolean;
}): Promise<ApiResponse<ProductionRecord>> {
  return request<ProductionRecord>("/api/productions", {
    method: "POST",
    body: JSON.stringify(entry),
  });
}

export async function getProduction(
  id: string
): Promise<ApiResponse<ProductionWithCounts>> {
  return request<ProductionWithCounts>(`/api/productions/${id}`);
}

export async function startProduction(
  id: string
): Promise<ApiResponse<{ message: string; production_id: string }>> {
  return request<{ message: string; production_id: string }>(
    `/api/productions/${id}/start`,
    { method: "POST" }
  );
}

export async function getProductionAuditReport(id: string): Promise<
  ApiResponse<{
    production: ProductionRecord;
    documents: Array<{
      document_id: string;
      bates_begin: string;
      bates_end: string;
      page_count: number;
      is_placeholder: boolean;
      native_filename: string | null;
      md5_hash: string | null;
      sha1_hash: string | null;
      original_filename: string | null;
    }>;
  }>
> {
  return request(`/api/productions/${id}/audit-report`);
}

export type ProductionDownloadUrls = {
  output_prefix: string;
  loadfile_dat_url: string | null;
  loadfile_opt_url: string | null;
  expires_in_seconds: number;
};

export async function getProductionDownload(
  id: string
): Promise<ApiResponse<ProductionDownloadUrls>> {
  return request<ProductionDownloadUrls>(`/api/productions/${id}/download`);
}

// --- Phase 9: AI-Assisted Review (human-in-the-loop only) ---

export type AiSummarizeParams = {
  documentIds?: string[];
  folderId?: string;
  matter_id?: string | null;
  includeSubfolders?: boolean;
};

export type AiSummarizeResponse = {
  summary: string;
  cached: boolean;
  documentCount: number;
};

export async function aiSummarize(
  params: AiSummarizeParams
): Promise<ApiResponse<AiSummarizeResponse>> {
  return request<AiSummarizeResponse>("/api/ai/summarize", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type AiSimilarParams = {
  documentId: string;
  limit?: number;
  matter_id?: string | null;
};

export type AiSimilarResponse = {
  documentId: string;
  similarDocumentIds: string[];
};

export async function aiSimilar(
  params: AiSimilarParams
): Promise<ApiResponse<AiSimilarResponse>> {
  return request<AiSimilarResponse>("/api/ai/similar", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type AiSuggestionsParams = {
  documentIds: string[];
  type?: "issue_tags" | "relevance_ranking";
  query?: string;
  matter_id?: string | null;
};

export type IssueTagSuggestion = {
  documentId: string;
  suggestedTags: string[];
};

export type AiSuggestionsResponse =
  | { type: "issue_tags"; suggestions: IssueTagSuggestion[] }
  | { type: "relevance_ranking"; documentIds: string[]; explanation?: string };

export async function aiSuggestions(
  params: AiSuggestionsParams
): Promise<ApiResponse<AiSuggestionsResponse>> {
  return request<AiSuggestionsResponse>("/api/ai/suggestions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type AiEmbedParams = {
  documentIds?: string[];
  folderId?: string;
  includeSubfolders?: boolean;
  matter_id?: string | null;
};

export type AiEmbedResult = {
  documentId: string;
  ok: boolean;
  error?: string;
};

export type AiEmbedResponse = {
  requested: number;
  embedded: number;
  results: AiEmbedResult[];
};

export async function aiEmbed(
  params: AiEmbedParams
): Promise<ApiResponse<AiEmbedResponse>> {
  return request<AiEmbedResponse>("/api/ai/embed", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type AiUsageResponse = {
  used: number;
  cap: number;
  period: string;
};

export async function aiUsage(params?: {
  matter_id?: string;
  user_id?: string;
}): Promise<ApiResponse<AiUsageResponse>> {
  const sp = new URLSearchParams();
  if (params?.matter_id) sp.set("matter_id", params.matter_id);
  if (params?.user_id) sp.set("user_id", params.user_id);
  const qs = sp.toString();
  return request<AiUsageResponse>(`/api/ai/usage${qs ? `?${qs}` : ""}`);
}
