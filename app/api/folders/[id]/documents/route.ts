import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { success, error } from "@/lib/api-response";

/** POST /api/folders/:id/documents - Body: { documentIds: string[] } */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: folderId } = await params;
    const body = (await request.json()) as { documentIds?: string[] };
    const documentIds = Array.isArray(body.documentIds) ? body.documentIds : [];
    if (documentIds.length === 0) {
      return success({ added: 0, folder_id: folderId });
    }

    const supabase = createServerSupabaseClient();
    const { data: folder, error: folderErr } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .single();
    if (folderErr || !folder) {
      return error("Folder not found", 404, "NOT_FOUND");
    }

    const rows = documentIds.map((docId) => ({ folder_id: folderId, document_id: docId }));
    const { error: insertErr } = await supabase.from("document_folders").upsert(rows, {
      onConflict: "document_id,folder_id",
      ignoreDuplicates: true,
    });
    if (insertErr) {
      return error(insertErr.message, 500, (insertErr as { code?: string }).code ?? "DB_ERROR");
    }
    return success({ added: documentIds.length, folder_id: folderId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}
