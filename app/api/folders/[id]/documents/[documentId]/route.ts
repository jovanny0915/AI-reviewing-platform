import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { success, error } from "@/lib/api-response";

/** DELETE /api/folders/:id/documents/:documentId */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const { id: folderId, documentId } = await params;
    const supabase = createServerSupabaseClient();
    const { error: dbError } = await supabase
      .from("document_folders")
      .delete()
      .eq("folder_id", folderId)
      .eq("document_id", documentId);
    if (dbError) {
      return error(dbError.message, 500, (dbError as { code?: string }).code ?? "DB_ERROR");
    }
    return success({ removed: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}
