import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL;

/**
 * Proxy /api/* to the Express backend when BACKEND_API_URL (or NEXT_PUBLIC_API_URL) is set.
 * Requests that match more specific Next.js API routes (e.g. app/api/documents, app/api/upload) are handled there first.
 * This catch-all handles backend-only routes: saved-searches, folders, search, redactions, productions, ai, etc.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(request, await params);
}

async function proxy(request: NextRequest, { path }: { path: string[] }) {
  if (!BACKEND) {
    return NextResponse.json(
      { success: false, error: "Backend not configured. Set BACKEND_API_URL or deploy the backend." },
      { status: 503 }
    );
  }
  const base = BACKEND.replace(/\/$/, "");
  const pathStr = path.length ? path.join("/") : "";
  const url = new URL(request.url);
  const target = `${base}/api/${pathStr}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.text();
  const res = await fetch(target, {
    method: request.method,
    headers,
    body,
  });
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
