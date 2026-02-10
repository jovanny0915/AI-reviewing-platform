import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { success, error } from "@/lib/api-response";

type FolderRow = {
  id: string;
  matter_id: string | null;
  name: string;
  parent_id: string | null;
  created_at: string;
};

type FolderNode = FolderRow & {
  children: FolderNode[];
  document_count?: number;
};

function buildFolderTree(rows: FolderRow[], parentId: string | null): FolderNode[] {
  return rows
    .filter((r) => (r.parent_id ?? null) === parentId)
    .map((row) => ({
      ...row,
      children: buildFolderTree(rows, row.id),
      document_count: 0,
    }));
}

/** GET /api/folders - list folder tree with optional matter_id */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const matterId = searchParams.get("matter_id") ?? undefined;

    let query = supabase.from("folders").select("*").order("name", { ascending: true });
    if (matterId) query = query.eq("matter_id", matterId);
    const { data: rows, error: dbError } = await query;

    if (dbError) {
      return error(dbError.message, 500, (dbError as { code?: string }).code ?? "DB_ERROR");
    }
    const flat = (rows ?? []) as FolderRow[];
    const tree = buildFolderTree(flat, null);

    const folderIds = flat.map((f) => f.id);
    if (folderIds.length === 0) {
      return success({ folders: tree });
    }

    const { data: counts } = await supabase
      .from("document_folders")
      .select("folder_id")
      .in("folder_id", folderIds);
    const countByFolder = new Map<string, number>();
    for (const f of folderIds) countByFolder.set(f, 0);
    for (const row of counts ?? []) {
      const r = row as { folder_id: string };
      countByFolder.set(r.folder_id, (countByFolder.get(r.folder_id) ?? 0) + 1);
    }
    function setCounts(nodes: FolderNode[]): void {
      for (const n of nodes) {
        n.document_count = countByFolder.get(n.id) ?? 0;
        setCounts(n.children);
      }
    }
    setCounts(tree);

    return success({ folders: tree });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}

/** POST /api/folders - create folder. Body: { name, parent_id?, matter_id? } */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; parent_id?: string | null; matter_id?: string | null };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return error("name is required", 400, "VALIDATION");
    }
    const insert: Record<string, unknown> = { name };
    if (body.parent_id != null) insert.parent_id = body.parent_id || null;
    if (body.matter_id != null) insert.matter_id = body.matter_id || null;

    const supabase = createServerSupabaseClient();
    const { data: folder, error: dbError } = await supabase
      .from("folders")
      .insert(insert)
      .select()
      .single();

    if (dbError) {
      return error(dbError.message, 500, (dbError as { code?: string }).code ?? "DB_ERROR");
    }
    return success(folder, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}
