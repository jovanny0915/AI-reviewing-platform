"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Eye,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronRight,
  Mail,
  Paperclip,
  Tag,
  FolderOpen,
} from "lucide-react";
import {
  listDocuments,
  getExtractedText,
  updateDocumentCoding,
  type DocumentRecord,
  type FamilyGroup,
  type ProcessingStatus,
  type ListDocumentsParams,
} from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function formatHash(hash: string | null): string {
  if (!hash) return "—";
  return hash.length > 12 ? `${hash.slice(0, 8)}…` : hash;
}

function statusLabel(s: ProcessingStatus | null): string {
  if (!s) return "Pending";
  const map: Record<ProcessingStatus, string> = {
    pending: "Pending",
    processing: "Processing",
    metadata_extracted: "Metadata done",
    ocr_complete: "Complete",
    failed: "Failed",
  };
  return map[s] ?? s;
}

function StatusBadge({ status, error }: { status: ProcessingStatus | null; error: string | null }) {
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        Failed
      </Badge>
    );
  }
  if (status === "ocr_complete" || status === "metadata_extracted") {
    return (
      <Badge variant="default" className="gap-1 bg-green-600">
        <CheckCircle2 className="h-3 w-3" />
        {statusLabel(status)}
      </Badge>
    );
  }
  if (status === "processing") {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

export type DocumentsTableViewProps = {
  appliedFilters: ListDocumentsParams;
  refreshTrigger?: number;
  selectedDocIds: Set<string>;
  setSelectedDocIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onOpenUpload: () => void;
};

export function DocumentsTableView({
  appliedFilters,
  refreshTrigger = 0,
  selectedDocIds,
  setSelectedDocIds,
  onOpenUpload,
}: DocumentsTableViewProps) {
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = appliedFilters.pageSize ?? 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailDoc, setDetailDoc] = useState<DocumentRecord | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extractedTextLoading, setExtractedTextLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [codingDoc, setCodingDoc] = useState<DocumentRecord | null>(null);
  const [codingRelevance, setCodingRelevance] = useState<boolean | null>(null);
  const [codingPrivilege, setCodingPrivilege] = useState<boolean | null>(null);
  const [codingIssueTags, setCodingIssueTags] = useState<string>("");
  const [codingSaving, setCodingSaving] = useState(false);

  const fetchDocuments = useCallback(
    async (opts?: { silent?: boolean; overrides?: Partial<ListDocumentsParams> }) => {
      if (!opts?.silent) {
        setLoading(true);
        setError(null);
      }
      const params: ListDocumentsParams = { ...appliedFilters, page, pageSize, ...opts?.overrides };
      const result = await listDocuments(params);
      if (result.success) {
        if ("familyGroups" in result.data) {
          setFamilyGroups(result.data.familyGroups);
          setTotal(result.data.total);
        } else if ("documents" in result.data) {
          const docs = result.data.documents;
          const roots = docs.filter((d) => !d.parent_id);
          const familyGroupsFallback: FamilyGroup[] = roots.map((r) => ({
            id: r.family_id ?? r.id,
            parent: r,
            children: docs.filter((d) => d.parent_id === r.id),
          }));
          setFamilyGroups(familyGroupsFallback);
          setTotal(result.data.total);
        }
      } else if (!opts?.silent) {
        setError(result.error);
      }
      if (!opts?.silent) setLoading(false);
    },
    [appliedFilters, page, pageSize]
  );

  const openCodingPanel = (doc: DocumentRecord) => {
    setCodingDoc(doc);
    setCodingRelevance(doc.relevance_flag ?? null);
    setCodingPrivilege(doc.privilege_flag ?? null);
    setCodingIssueTags(Array.isArray(doc.issue_tags) ? (doc.issue_tags as string[]).join(", ") : "");
  };

  const saveCoding = async () => {
    if (!codingDoc) return;
    setCodingSaving(true);
    const tags = codingIssueTags.trim() ? codingIssueTags.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const res = await updateDocumentCoding(codingDoc.id, {
      relevance_flag: codingRelevance,
      privilege_flag: codingPrivilege,
      issue_tags: tags,
    });
    setCodingSaving(false);
    if (res.success) {
      setCodingDoc(null);
      toast({ title: "Coding saved" });
      fetchDocuments({ silent: true });
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const toggleFamily = (familyId: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  };

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (refreshTrigger > 0) fetchDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when parent signals upload success
  }, [refreshTrigger]);

  useEffect(() => {
    if (!detailDoc?.id || !(detailDoc.extracted_text_path || detailDoc.processing_status === "ocr_complete")) {
      return;
    }
    setExtractedText(null);
    setExtractedTextLoading(true);
    getExtractedText(detailDoc.id).then((result) => {
      setExtractedTextLoading(false);
      if (result.success) setExtractedText(result.data.text);
    });
  }, [detailDoc?.id, detailDoc?.extracted_text_path, detailDoc?.processing_status]);

  const POLL_INTERVAL_MS = 5000;
  const POLL_MAX_MS = 10 * 60 * 1000;
  const allDocs = familyGroups.flatMap((fg) => [fg.parent, ...fg.children]);
  useEffect(() => {
    const hasPending = allDocs.some(
      (d) => d.processing_status === "pending" || d.processing_status === "processing"
    );
    if (!hasPending) {
      setPolling(false);
      return;
    }
    setPolling(true);
    const startedAt = Date.now();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchDocuments({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - startedAt > POLL_MAX_MS) return;
      fetchDocuments({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      clearInterval(t);
    };
  }, [familyGroups, fetchDocuments]);

  const openViewer = (doc: DocumentRecord) => {
    window.open(`/viewer?id=${doc.id}`, "_blank");
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const ids = familyGroups.flatMap((fg) => [fg.parent.id, ...fg.children.map((c) => c.id)]);
    setSelectedDocIds(new Set(ids));
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="flex items-center gap-2 py-3">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card rounded-xl border-border/80 overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-sm text-foreground">
            <FileText className="h-4 w-4 text-primary" />
            Documents ({total})
            {polling && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading documents…</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={familyGroups.length > 0 && familyGroups.flatMap((fg) => [fg.parent.id, ...fg.children.map((c) => c.id)]).every((id) => selectedDocIds.has(id))}
                      onChange={(e) => {
                        if (e.target.checked) selectAllOnPage();
                        else setSelectedDocIds(new Set());
                      }}
                      title="Select all on page"
                    />
                  </TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-20">Relevance</TableHead>
                  <TableHead className="w-20">Privilege</TableHead>
                  <TableHead className="w-28">Issue tags</TableHead>
                  <TableHead className="w-24">Size</TableHead>
                  <TableHead className="w-24">MD5</TableHead>
                  <TableHead className="w-32">Created</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {familyGroups.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-4">
                        <img src="/docs-illustration.svg" alt="" className="h-36 w-auto opacity-90" />
                        <p className="text-muted-foreground font-medium">No documents yet</p>
                        <p className="text-sm text-muted-foreground">Upload files to get started.</p>
                        <Button onClick={onOpenUpload} size="sm">
                          <Upload className="mr-2 h-4 w-4" />
                          Upload Documents
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  familyGroups.map((fg) => (
                    <React.Fragment key={fg.id}>
                      <TableRow className={`transition-colors hover:bg-muted/40 ${fg.children.length > 0 ? "bg-muted/25" : ""}`}>
                        <TableCell className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedDocIds.has(fg.parent.id)}
                            onChange={() => toggleDocSelection(fg.parent.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {fg.children.length > 0 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => toggleFamily(fg.id)}
                                aria-expanded={expandedFamilies.has(fg.id)}
                              >
                                {expandedFamilies.has(fg.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            ) : (
                              <span className="w-6" />
                            )}
                            {fg.children.length > 0 ? (
                              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-sm">{fg.parent.original_filename ?? fg.parent.filename}</span>
                            {fg.children.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                +{fg.children.length} attachment{fg.children.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={fg.parent.processing_status ?? "pending"}
                            error={fg.parent.processing_error}
                          />
                          {fg.parent.processing_error && (
                            <p className="mt-1 max-w-[120px] truncate text-xs text-destructive" title={fg.parent.processing_error}>
                              {fg.parent.processing_error}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fg.parent.file_type ?? fg.parent.mime_type ?? "—"}
                        </TableCell>
                        <TableCell>
                          {fg.parent.relevance_flag === true && <Badge variant="default" className="bg-green-600">Relevant</Badge>}
                          {fg.parent.relevance_flag === false && <Badge variant="secondary">Not relevant</Badge>}
                          {fg.parent.relevance_flag == null && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {fg.parent.privilege_flag === true && <Badge variant="default" className="bg-amber-600">Privileged</Badge>}
                          {fg.parent.privilege_flag === false && <Badge variant="outline">Not privileged</Badge>}
                          {fg.parent.privilege_flag == null && <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                          {Array.isArray(fg.parent.issue_tags) && (fg.parent.issue_tags as string[]).length > 0
                            ? (fg.parent.issue_tags as string[]).join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatFileSize(fg.parent.size)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground" title={fg.parent.md5_hash ?? undefined}>
                          {formatHash(fg.parent.md5_hash)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(fg.parent.created_at)}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCodingPanel(fg.parent)}
                            title="Code (relevance, privilege, tags)"
                          >
                            <Tag className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailDoc(fg.parent)}
                            title="Hashes & metadata"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewer(fg.parent)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedFamilies.has(fg.id) &&
                        fg.children.map((doc) => (
                          <TableRow key={doc.id} className="bg-muted/20">
                            <TableCell className="w-10">
                              <input
                                type="checkbox"
                                checked={selectedDocIds.has(doc.id)}
                                onChange={() => toggleDocSelection(doc.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2 pl-10">
                                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="truncate text-sm">{doc.original_filename ?? doc.filename}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                status={doc.processing_status ?? "pending"}
                                error={doc.processing_error}
                              />
                              {doc.processing_error && (
                                <p className="mt-1 max-w-[120px] truncate text-xs text-destructive" title={doc.processing_error}>
                                  {doc.processing_error}
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {doc.file_type ?? doc.mime_type ?? "—"}
                            </TableCell>
                            <TableCell>
                              {doc.relevance_flag === true && <Badge variant="default" className="bg-green-600">Relevant</Badge>}
                              {doc.relevance_flag === false && <Badge variant="secondary">Not relevant</Badge>}
                              {doc.relevance_flag == null && <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell>
                              {doc.privilege_flag === true && <Badge variant="default" className="bg-amber-600">Privileged</Badge>}
                              {doc.privilege_flag === false && <Badge variant="outline">Not privileged</Badge>}
                              {doc.privilege_flag == null && <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="max-w-[120px] truncate text-xs text-muted-foreground">
                              {Array.isArray(doc.issue_tags) && (doc.issue_tags as string[]).length > 0
                                ? (doc.issue_tags as string[]).join(", ")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatFileSize(doc.size)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground" title={doc.md5_hash ?? undefined}>
                              {formatHash(doc.md5_hash)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(doc.created_at)}
                            </TableCell>
                            <TableCell className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCodingPanel(doc)}
                                title="Code (relevance, privilege, tags)"
                              >
                                <Tag className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDetailDoc(doc)}
                                title="Hashes & metadata"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openViewer(doc)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          )}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between border-t border-border/50 bg-muted/20 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!codingDoc} onOpenChange={(open) => !open && setCodingDoc(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Coding</SheetTitle>
            <SheetDescription>
              {codingDoc?.original_filename ?? codingDoc?.filename}
            </SheetDescription>
          </SheetHeader>
          {codingDoc && (
            <div className="mt-6 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Relevance</label>
                <Select
                  value={codingRelevance === null ? "unset" : codingRelevance ? "relevant" : "not_relevant"}
                  onValueChange={(v) => setCodingRelevance(v === "unset" ? null : v === "relevant")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    <SelectItem value="relevant">Relevant</SelectItem>
                    <SelectItem value="not_relevant">Not relevant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Privilege</label>
                <Select
                  value={codingPrivilege === null ? "unset" : codingPrivilege ? "privileged" : "not_privileged"}
                  onValueChange={(v) => setCodingPrivilege(v === "unset" ? null : v === "privileged")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    <SelectItem value="privileged">Privileged</SelectItem>
                    <SelectItem value="not_privileged">Not privileged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Issue tags (comma-separated)</label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Confidential, HR, Finance"
                  value={codingIssueTags}
                  onChange={(e) => setCodingIssueTags(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={saveCoding} disabled={codingSaving}>
                  {codingSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
                <Button variant="outline" onClick={() => setCodingDoc(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!detailDoc}
        onOpenChange={(open) => {
          if (!open) {
            setDetailDoc(null);
            setExtractedText(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailDoc?.original_filename ?? detailDoc?.filename}</DialogTitle>
            <DialogDescription>Hashes, metadata, and extracted text (OCR)</DialogDescription>
          </DialogHeader>
          {detailDoc && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-muted-foreground">MD5</p>
                <p className="break-all font-mono">{detailDoc.md5_hash ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">SHA-1</p>
                <p className="break-all font-mono">{detailDoc.sha1_hash ?? "—"}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground">Status</p>
                <StatusBadge status={detailDoc.processing_status ?? "pending"} error={detailDoc.processing_error} />
              </div>
              {detailDoc.extracted_text_path || detailDoc.processing_status === "ocr_complete" ? (
                <div>
                  <p className="font-medium text-muted-foreground">Extracted text (OCR result)</p>
                  {extractedText !== null ? (
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-muted/50 p-3 text-xs">
                      {extractedText || "(empty)"}
                    </pre>
                  ) : extractedTextLoading ? (
                    <div className="flex items-center gap-2 rounded border bg-muted/50 p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading…</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!detailDoc?.id) return;
                        setExtractedTextLoading(true);
                        const result = await getExtractedText(detailDoc.id);
                        setExtractedTextLoading(false);
                        if (result.success) setExtractedText(result.data.text);
                        else toast({ title: result.error, variant: "destructive" });
                      }}
                    >
                      View extracted text
                    </Button>
                  )}
                </div>
              ) : null}
              {Object.keys(detailDoc.metadata ?? {}).length > 0 && (
                <div>
                  <p className="font-medium text-muted-foreground">Metadata</p>
                  <pre className="max-h-48 overflow-auto rounded border bg-muted/50 p-2 text-xs">
                    {JSON.stringify(detailDoc.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
