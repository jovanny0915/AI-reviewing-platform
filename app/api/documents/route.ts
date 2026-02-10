import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { success, error } from "@/lib/api-response";

/**
 * Phase 4: Get folder ID and all descendant folder IDs when includeSubfolders is true.
 * Per IMPLEMENTATION_PLAN.md: list by folder with optional subfolders.
 */
async function getFolderIdsForFilter(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  folderId: string,
  includeSubfolders: boolean
): Promise<string[]> {
  if (!includeSubfolders) return [folderId];

  const { data: folder, error: folderErr } = await supabase
    .from("folders")
    .select("id, matter_id")
    .eq("id", folderId)
    .single();
  if (folderErr || !folder) return [folderId];

  const matterId = (folder as { matter_id: string | null }).matter_id ?? null;
  let foldersQuery = supabase.from("folders").select("id, parent_id");
  if (matterId !== null) {
    foldersQuery = foldersQuery.eq("matter_id", matterId);
  } else {
    foldersQuery = foldersQuery.is("matter_id", null);
  }
  const { data: rows } = await foldersQuery;
  const flat = (rows ?? []) as { id: string; parent_id: string | null }[];

  const byParent = new Map<string, string[]>();
  for (const r of flat) {
    const p = r.parent_id ?? "";
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(r.id);
  }

  const result: string[] = [];
  const stack: string[] = [folderId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    result.push(id);
    for (const childId of byParent.get(id) ?? []) {
      stack.push(childId);
    }
  }
  return result;
}

/**
 * Phase 4: Get document IDs that are in any of the given folders.
 */
async function getDocumentIdsInFolders(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  folderIds: string[]
): Promise<string[]> {
  if (folderIds.length === 0) return [];
  const { data } = await supabase
    .from("document_folders")
    .select("document_id")
    .in("folder_id", folderIds);
  const rows = (data ?? []) as { document_id: string }[];
  return [...new Set(rows.map((r) => r.document_id))];
}

/**
 * GET /api/documents
 * List documents with optional pagination and filters (Phase 3/4).
 * Query: matter_id, custodian, dateFrom, dateTo, keyword, docType, familyId, folderId, includeSubfolders, page, pageSize.
 * expand=families: return family groups (parent + children).
 * When folderId is set: only return documents assigned to that folder (and subfolders if includeSubfolders).
 * Empty folder returns empty list.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const folderId = searchParams.get("folderId") ?? undefined;
    const includeSubfolders = searchParams.get("includeSubfolders") === "true";
    const expandFamilies = searchParams.get("expand") === "families";
    const matterId = searchParams.get("matter_id") ?? undefined;
    const custodian = searchParams.get("custodian") ?? undefined;
    const dateFrom = searchParams.get("dateFrom") ?? undefined;
    const dateTo = searchParams.get("dateTo") ?? undefined;
    const keyword = searchParams.get("keyword") ?? undefined;
    const docType = searchParams.get("docType") ?? undefined;
    const familyId = searchParams.get("family_id") ?? undefined;

    // Phase 4: When folderId is set, restrict to documents in that folder (and optionally subfolders).
    // If the folder has no documents, return empty immediately.
    let documentIdsInFolder: string[] | null = null;
    if (folderId) {
      const folderIds = await getFolderIdsForFilter(supabase, folderId, includeSubfolders);
      const docIds = await getDocumentIdsInFolders(supabase, folderIds);
      if (docIds.length === 0) {
        if (expandFamilies) {
          return success({ familyGroups: [], total: 0, page, pageSize });
        }
        return success({ documents: [], total: 0, page, pageSize });
      }
      documentIdsInFolder = docIds;
    }

    // Build base query with filters
    let query = supabase
      .from("documents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (matterId) query = query.eq("matter_id", matterId);
    if (custodian) query = query.eq("custodian", custodian);
    if (dateFrom) query = query.gte("created_at", dateFrom);
    if (dateTo) query = query.lte("created_at", dateTo);
    if (docType) query = query.eq("file_type", docType);
    if (familyId) query = query.eq("family_id", familyId);
    if (documentIdsInFolder && documentIdsInFolder.length > 0) {
      query = query.in("id", documentIdsInFolder);
    }
    if (keyword?.trim()) {
      const term = keyword.trim().replace(/,/g, " ");
      const k = `%${term}%`;
      query = query.or(
        `original_filename.ilike.${k},filename.ilike.${k},custodian.ilike.${k}`
      );
    }

    if (expandFamilies) {
      // Return family groups: roots only, with children nested
      query = query.is("parent_id", null);
      const { data: roots, error: rootsErr, count: totalCount } = await query
        .range(from, to);

      if (rootsErr) {
        return error(rootsErr.message, 500, "DB_ERROR");
      }

      const familyIds = [
        ...new Set(
          (roots ?? []).map((r: { family_id?: string; id: string }) => r.family_id ?? r.id)
        ),
      ];
      const { data: childrenRows } = await supabase
        .from("documents")
        .select("*")
        .not("parent_id", "is", null)
        .in("family_id", familyIds)
        .order("family_index", { ascending: true });

      const childrenByFamily = new Map<string, (typeof childrenRows)[number][]>();
      for (const c of childrenRows ?? []) {
        const fid = (c as { family_id?: string }).family_id ?? "";
        if (!childrenByFamily.has(fid)) childrenByFamily.set(fid, []);
        childrenByFamily.get(fid)!.push(c);
      }

      const familyGroups = (roots ?? []).map((root: { family_id?: string; id: string }) => ({
        id: (root as { family_id?: string }).family_id ?? root.id,
        parent: root,
        children:
          childrenByFamily.get((root as { family_id?: string }).family_id ?? root.id) ?? [],
      }));

      return success({
        familyGroups,
        total: totalCount ?? familyGroups.length,
        page,
        pageSize,
      });
    }

    const { data, error: dbError, count: totalCount } = await query.range(from, to);

    if (dbError) {
      return error(dbError.message, 500, "DB_ERROR");
    }

    return success({
      documents: data ?? [],
      total: totalCount ?? data?.length ?? 0,
      page,
      pageSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}
