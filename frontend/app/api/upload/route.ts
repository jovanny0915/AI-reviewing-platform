import { NextRequest } from "next/server";
import { createHash, randomUUID } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { uploadDocument } from "@/lib/storage";
import { success, error } from "@/lib/api-response";

/**
 * POST /api/upload
 * Accept multipart file upload; save to Supabase Storage and create documents row (Phase 1).
 * If BACKEND_API_URL is set, triggers backend processing (metadata + OCR) so the doc does not stay pending.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || !(file instanceof File)) {
      return error("No file provided or invalid file", 400, "MISSING_FILE");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const md5_hash = createHash("md5").update(buffer).digest("hex");
    const sha1_hash = createHash("sha1").update(buffer).digest("hex");

    const supabase = createServerSupabaseClient();
    const id = randomUUID();
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${id}/${filename}`;

    const { path: uploadedPath, error: uploadErr } = await uploadDocument(
      buffer,
      storagePath,
      { contentType: file.type }
    );

    if (uploadErr || !uploadedPath) {
      return error(uploadErr ?? "Upload failed", 500, "UPLOAD_ERROR");
    }

    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        id,
        storage_path: storagePath,
        filename: file.name,
        original_filename: file.name,
        mime_type: file.type || null,
        file_type: file.type || null,
        size: file.size,
        metadata: {},
        md5_hash,
        sha1_hash,
        extracted_text_path: null,
        processing_status: "pending",
      })
      .select()
      .single();

    if (insertErr) {
      return error(insertErr.message, 500, "DB_ERROR");
    }

    const backendUrl = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL;
    if (backendUrl) {
      try {
        await fetch(`${backendUrl.replace(/\/$/, "")}/api/documents/${id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (triggerErr) {
        console.warn("[upload] Failed to trigger backend processing:", (triggerErr as Error).message);
      }
    }

    return success({ id: doc.id, document: doc }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return error(message, 500, "INTERNAL_ERROR");
  }
}
