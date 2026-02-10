import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { success, error } from "@/lib/api-response";

const BACKEND = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL;

/**
 * GET /api/documents
 * When backend is configured: proxy to backend so folderId, expand=families, and all filters apply.
 * Otherwise: list documents from Supabase with pagination only (no folder filter).
 */
export async function GET(request: NextRequest) {
  if (BACKEND) {
    const base = BACKEND.replace(/\/$/, "");
    const url = new URL(request.url);
    const target = `${base}/api/documents${url.search}`;
    const headers = new Headers(request.headers);
    headers.delete("host");
    const res = await fetch(target, { method: "GET", headers });
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (contentType.includes("application/json")) {
      try {
        return NextResponse.json(JSON.parse(text), { status: res.status });
      } catch {
        // fallback
      }
    }
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": contentType || "text/plain" },
    });
  }

  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count: totalCount, error: dbError } = await supabase
      .from("documents")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

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
