"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Square,
  Loader2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { getDocument, listRedactions, createRedaction, deleteRedaction, type DocumentWithFamily, type RedactionRecord } from "@/lib/api-client";

const REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "Attorney-Client Privilege", label: "Attorney-Client Privilege" },
  { value: "Work Product", label: "Work Product" },
  { value: "Confidential", label: "Confidential" },
  { value: "Personal Information", label: "Personal Information" },
];

const documentMeta = {
  begBates: "ABC000001",
  endBates: "ABC000003",
  title: "Email RE: Project Alpha Update",
  custodian: "John Smith",
  from: "john.smith@example.com",
  to: "jane.doe@example.com",
  date: "2024-03-15",
  subject: "RE: Project Alpha Update",
  docType: "Email",
  pages: 3,
  familyId: "FAM-001",
};

type PendingRect = { startX: number; startY: number; endX: number; endY: number } | null;

export default function ViewerPage() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("id");
  const [doc, setDoc] = useState<DocumentWithFamily | null>(null);
  const [docLoading, setDocLoading] = useState(!!documentId);
  const [docError, setDocError] = useState<string | null>(null);

  const [redactions, setRedactions] = useState<RedactionRecord[]>([]);
  const [redactionsLoading, setRedactionsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [tool, setTool] = useState<"select" | "redact">("select");
  const [redactionReason, setRedactionReason] = useState(REASON_OPTIONS[0].value);
  const [pendingRect, setPendingRect] = useState<PendingRect>(null);
  const [savingRedaction, setSavingRedaction] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!documentId) {
      setDocLoading(false);
      return;
    }
    setDocLoading(true);
    setDocError(null);
    getDocument(documentId, { signedUrl: true })
      .then((res) => {
        if (res.success) setDoc(res.data);
        else setDocError(res.error);
      })
      .finally(() => setDocLoading(false));
  }, [documentId]);

  useEffect(() => {
    if (!documentId) {
      setRedactions([]);
      return;
    }
    setRedactionsLoading(true);
    listRedactions(documentId)
      .then((res) => {
        if (res.success) setRedactions(res.data.redactions);
        else setRedactions([]);
      })
      .finally(() => setRedactionsLoading(false));
  }, [documentId]);

  const meta = doc
    ? {
        title: doc.original_filename ?? doc.filename,
        custodian: doc.custodian ?? "—",
        date: doc.created_at ? new Date(doc.created_at).toISOString().slice(0, 10) : "—",
        docType: doc.file_type ?? doc.mime_type ?? "—",
        familyId: doc.family_id ?? "—",
      }
    : documentMeta;

  const mime = (doc?.file_type ?? doc?.mime_type ?? "").toLowerCase();
  const isImage = mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(doc?.original_filename ?? doc?.filename ?? "");
  const isPdf = mime.includes("pdf");
  const isEmail = mime.includes("message/rfc822") || mime.includes("application/vnd.ms-outlook") || /\.(msg|eml)$/i.test(doc?.original_filename ?? doc?.filename ?? "");

  const totalPages = doc ? (isImage ? 1 : 1) : documentMeta.pages;

  const redactionsForCurrentPage = redactions.filter((r) => r.page_number === currentPage);

  const handleOverlayMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (tool !== "redact" || !documentId || !doc) return;
      const el = overlayRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setPendingRect({ startX: x, startY: y, endX: x, endY: y });
    },
    [tool, documentId, doc]
  );

  const handleOverlayMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pendingRect) return;
      const el = overlayRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setPendingRect((prev) => (prev ? { ...prev, endX: x, endY: y } : null));
    },
    [pendingRect]
  );

  const handleOverlayMouseUp = useCallback(() => {
    if (!pendingRect || !documentId) {
      setPendingRect(null);
      return;
    }
    const { startX, startY, endX, endY } = pendingRect;
    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);
    setPendingRect(null);
    if (width < 0.01 || height < 0.01) return;
    setSavingRedaction(true);
    createRedaction({
      document_id: documentId,
      page_number: currentPage,
      x,
      y,
      width,
      height,
      reason_code: redactionReason,
    })
      .then((res) => {
        if (res.success) setRedactions((prev) => [...prev, res.data]);
      })
      .finally(() => setSavingRedaction(false));
  }, [pendingRect, documentId, currentPage, redactionReason]);

  const handleDeleteRedaction = useCallback((id: string) => {
    deleteRedaction(id).then((res) => {
      if (res.success) setRedactions((prev) => prev.filter((r) => r.id !== id));
    });
  }, []);

  return (
    <AppShell title="Document Viewer">
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Document Panel */}
        <div className="flex flex-1 flex-col gap-3">
          {/* Toolbar */}
          <Card className="shadow-card rounded-xl border-border/80">
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="min-w-16 text-center text-sm text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setZoom(Math.max(25, zoom - 25))}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="min-w-12 text-center text-xs text-muted-foreground">{zoom}%</span>
                <Button variant="ghost" size="sm" onClick={() => setZoom(Math.min(200, zoom + 25))}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-6" />

              <Button variant={tool === "redact" ? "default" : "ghost"} size="sm" onClick={() => setTool(tool === "redact" ? "select" : "redact")}>
                <Square className="mr-1 h-4 w-4" />
                Redact
              </Button>

              {tool === "redact" && (
                <Select value={redactionReason} onValueChange={setRedactionReason}>
                  <SelectTrigger className="h-8 w-52"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {savingRedaction && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </span>
              )}
            </CardContent>
          </Card>

          {/* Document Canvas: signed URL when doc loaded from grid (Phase 3.3) */}
          <Card className="flex-1 overflow-auto shadow-card rounded-xl border-border/80">
            <CardContent className="flex h-full flex-col items-center justify-center gap-4 p-6">
              {docLoading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Loading document…
                </div>
              )}
              {docError && (
                <p className="text-sm text-destructive">{docError}</p>
              )}
              {!docLoading && doc?.signedUrl && (
                <>
                  {isEmail && (
                    <p className="text-center text-sm text-muted-foreground max-w-md">
                      Email files (.msg, .eml) cannot be previewed in the browser. Use the button below to download or open in your email client.
                    </p>
                  )}
                  <Button asChild>
                    <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" download={doc.original_filename ?? doc.filename}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {isEmail ? "Download / open in email client" : "Open document in new tab"}
                    </a>
                  </Button>
                  {isPdf && (
                    <div className="relative w-full max-w-4xl flex-1 min-h-[600px]">
                      <iframe
                        src={doc.signedUrl}
                        title={doc.original_filename ?? doc.filename}
                        className="h-full min-h-[600px] w-full rounded border"
                      />
                      <div
                        ref={overlayRef}
                        className="absolute inset-0 cursor-crosshair rounded border border-transparent"
                        style={{ pointerEvents: tool === "redact" ? "auto" : "none" }}
                        onMouseDown={handleOverlayMouseDown}
                        onMouseMove={handleOverlayMouseMove}
                        onMouseUp={handleOverlayMouseUp}
                        onMouseLeave={handleOverlayMouseUp}
                      >
                        {redactionsForCurrentPage.map((r) => (
                          <div
                            key={r.id}
                            className="absolute bg-black flex items-center justify-center"
                            style={{
                              left: `${r.x * 100}%`,
                              top: `${r.y * 100}%`,
                              width: `${r.width * 100}%`,
                              height: `${r.height * 100}%`,
                            }}
                            title={r.reason_code}
                          >
                            <span className="text-[10px] text-white/80 px-0.5 truncate max-w-full">{r.reason_code}</span>
                          </div>
                        ))}
                        {pendingRect && (
                          <div
                            className="absolute border-2 border-destructive bg-destructive/20"
                            style={{
                              left: `${Math.min(pendingRect.startX, pendingRect.endX) * 100}%`,
                              top: `${Math.min(pendingRect.startY, pendingRect.endY) * 100}%`,
                              width: `${Math.abs(pendingRect.endX - pendingRect.startX) * 100}%`,
                              height: `${Math.abs(pendingRect.endY - pendingRect.startY) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  {isImage && !isPdf && (
                    <div className="relative inline-block max-h-full max-w-full">
                      <img
                        src={doc.signedUrl}
                        alt={doc.original_filename ?? doc.filename}
                        className="max-h-full max-w-full object-contain block rounded border shadow-sm"
                      />
                      <div
                        ref={overlayRef}
                        className="absolute inset-0 cursor-crosshair rounded border border-transparent"
                        style={{ pointerEvents: tool === "redact" ? "auto" : "none" }}
                        onMouseDown={handleOverlayMouseDown}
                        onMouseMove={handleOverlayMouseMove}
                        onMouseUp={handleOverlayMouseUp}
                        onMouseLeave={handleOverlayMouseUp}
                      >
                        {redactionsForCurrentPage.map((r) => (
                          <div
                            key={r.id}
                            className="absolute bg-black flex items-center justify-center"
                            style={{
                              left: `${r.x * 100}%`,
                              top: `${r.y * 100}%`,
                              width: `${r.width * 100}%`,
                              height: `${r.height * 100}%`,
                            }}
                            title={r.reason_code}
                          >
                            <span className="text-[10px] text-white/80 px-0.5 truncate max-w-full">{r.reason_code}</span>
                          </div>
                        ))}
                        {pendingRect && (
                          <div
                            className="absolute border-2 border-destructive bg-destructive/20"
                            style={{
                              left: `${Math.min(pendingRect.startX, pendingRect.endX) * 100}%`,
                              top: `${Math.min(pendingRect.startY, pendingRect.endY) * 100}%`,
                              width: `${Math.abs(pendingRect.endX - pendingRect.startX) * 100}%`,
                              height: `${Math.abs(pendingRect.endY - pendingRect.startY) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
              {!docLoading && !documentId && (
                <p className="text-sm text-muted-foreground">Open a document from the Documents grid to view it here.</p>
              )}
              {!docLoading && documentId && !doc?.signedUrl && !docError && doc && (
                <p className="text-sm text-muted-foreground">No preview URL for this document. Use the link from the grid to download.</p>
              )}
              {!documentId && (
                <div
                  className="relative border bg-card shadow-sm"
                  style={{ width: `${(612 * zoom) / 100}px`, height: `${(792 * zoom) / 100}px` }}
                >
                  <div className="absolute inset-0 p-8" style={{ fontSize: `${(14 * zoom) / 100}px` }}>
                    <div className="flex flex-col gap-2 text-foreground">
                      <p className="font-bold">From: john.smith@example.com</p>
                      <p>To: jane.doe@example.com</p>
                      <p>Date: March 15, 2024</p>
                      <p className="font-bold">Subject: RE: Project Alpha Update</p>
                      <hr className="my-2 border-border" />
                      <p>Hi Team,</p>
                      <p className="mt-2">Please find attached the Q1 report and budget memo as discussed.</p>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-4 font-mono text-muted-foreground" style={{ fontSize: `${(10 * zoom) / 100}px` }}>
                    {documentMeta.begBates}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Metadata Panel */}
        <div className="w-72 shrink-0">
          <Card className="h-full overflow-auto shadow-card rounded-xl border-border/80">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-semibold text-foreground">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {Object.entries({
                  Title: meta.title,
                  Custodian: meta.custodian,
                  Date: meta.date,
                  "Doc type": meta.docType,
                  "Family ID": meta.familyId,
                }).map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={`text-sm text-foreground break-words ${label === "Family ID" ? "font-mono" : ""}`}>{value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Type:</span>
                  <Badge variant="secondary" className="text-xs">{meta.docType}</Badge>
                </div>

                {doc && (doc.relevance_flag != null || doc.privilege_flag != null || (Array.isArray(doc.issue_tags) && doc.issue_tags.length > 0)) && (
                  <>
                    <Separator className="my-2" />
                    <h4 className="text-xs font-semibold text-foreground">Coding</h4>
                    <div className="flex flex-wrap gap-1">
                      {doc.relevance_flag === true && <Badge className="bg-green-600">Relevant</Badge>}
                      {doc.relevance_flag === false && <Badge variant="secondary">Not relevant</Badge>}
                      {doc.privilege_flag === true && <Badge className="bg-amber-600">Privileged</Badge>}
                      {doc.privilege_flag === false && <Badge variant="outline">Not privileged</Badge>}
                      {Array.isArray(doc.issue_tags) && (doc.issue_tags as string[]).map((t) => (
                        <Badge key={t} variant="outline">{t}</Badge>
                      ))}
                    </div>
                  </>
                )}

                {doc && (
                  <>
                    <Separator className="my-2" />
                    <h4 className="text-xs font-semibold text-foreground">
                      Redactions ({redactions.length})
                      {redactionsLoading && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
                    </h4>
                    {redactions.length === 0 && !redactionsLoading && (
                      <p className="text-xs text-muted-foreground">No redactions. Use Redact tool to add.</p>
                    )}
                    {redactions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{r.reason_code}</p>
                          <p className="text-xs text-muted-foreground">Page {r.page_number}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteRedaction(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
