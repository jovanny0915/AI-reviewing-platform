import { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { success, error } from "@/lib/api-response";

/** GET /api/folders/:id */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const { data: folder, error: dbError } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .single();
    if (dbError || !folder) {
      return error(dbError?.message ?? "Folder not found", 404, "NOT_FOUND");
    }
    return success(folder);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}

/** PATCH /api/folders/:id - Body: { name } */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return error("name is required", 400, "VALIDATION");
    }
    const supabase = createServerSupabaseClient();
    const { data: folder, error: dbError } = await supabase
      .from("folders")
      .update({ name })
      .eq("id", id)
      .select()
      .single();
    if (dbError) {
      return error(dbError.message, 500, (dbError as { code?: string }).code ?? "DB_ERROR");
    }
    if (!folder) {
      return error("Folder not found", 404, "NOT_FOUND");
    }
    return success(folder);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}

/** DELETE /api/folders/:id */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();
    const { error: dbError } = await supabase.from("folders").delete().eq("id", id);
    if (dbError) {
      return error(dbError.message, 500, (dbError as { code?: string }).code ?? "DB_ERROR");
    }
    return success({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}
