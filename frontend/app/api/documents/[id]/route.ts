import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSignedUrl } from "@/lib/storage";
import { success, error } from "@/lib/api-response";

/**
 * GET /api/documents/[id]
 * Fetch a single document by ID, optionally with signed URL for viewing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const includeUrl = searchParams.get("signedUrl") === "true";

    const { data: doc, error: dbError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

    if (dbError || !doc) {
      return error(dbError?.message ?? "Document not found", 404, "NOT_FOUND");
    }

    let signedUrl: string | null = null;
    if (includeUrl && doc.storage_path) {
      const { url } = await createSignedUrl(doc.storage_path);
      signedUrl = url;
    }

    return success({ ...doc, signedUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}
