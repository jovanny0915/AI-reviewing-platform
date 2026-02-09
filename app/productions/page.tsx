"use client";

import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Stamp,
  Plus,
  Download,
  Play,
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  listProductions,
  createProduction,
  startProduction,
  getProductionDownload,
  getProductionAuditReport,
  listFolders,
  type ProductionRecord,
  type FolderNode,
} from "@/lib/api-client";

function flattenFolders(nodes: FolderNode[], level = 0): { id: string; name: string; indent: string }[] {
  const out: { id: string; name: string; indent: string }[] = [];
  for (const n of nodes) {
    out.push({ id: n.id, name: n.name, indent: "—".repeat(level) });
    out.push(...flattenFolders(n.children, level + 1));
  }
  return out;
}

export default function ProductionsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [productions, setProductions] = useState<ProductionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrefix, setFormPrefix] = useState("PROD");
  const [formStart, setFormStart] = useState(1);
  const [formFolderId, setFormFolderId] = useState<string | null>(null);
  const [formIncludeSubfolders, setFormIncludeSubfolders] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);

  const fetchProductions = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const res = await listProductions();
    if (res.success) {
      setProductions(res.data.productions);
      setTotal(res.data.total);
    }
    if (showLoading) setLoading(false);
  }, []);

  useEffect(() => {
    fetchProductions();
  }, [fetchProductions]);

  // Poll while any production is pending or processing so status updates (pending → processing → complete) are visible
  const hasActiveJob = productions.some(
    (p) => p.status === "pending" || p.status === "processing"
  );
  useEffect(() => {
    if (!hasActiveJob) return;
    const interval = setInterval(() => {
      fetchProductions(false);
    }, 2000);
    return () => clearInterval(interval);
  }, [hasActiveJob, fetchProductions]);

  useEffect(() => {
    if (createOpen) {
      listFolders().then((res) => {
        if (res.success) setFolders(res.data.folders);
      });
    }
  }, [createOpen]);

  const handleCreateAndStart = async () => {
    if (!formName.trim()) {
      setCreateError("Production name is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const createRes = await createProduction({
        name: formName.trim(),
        bates_prefix: formPrefix.trim() || "PROD",
        bates_start_number: formStart,
        source_folder_id: formFolderId || null,
        include_subfolders: formIncludeSubfolders,
      });
      if (!createRes.success) {
        setCreateError(createRes.error);
        return;
      }
      const startRes = await startProduction(createRes.data.id);
      if (!startRes.success) {
        setCreateError(startRes.error);
        return;
      }
      setCreateOpen(false);
      setFormName("");
      setFormPrefix("PROD");
      setFormStart(1);
      setFormFolderId(null);
      setFormIncludeSubfolders(true);
      await fetchProductions();
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async (id: string) => {
    setStartingId(id);
    try {
      const res = await startProduction(id);
      if (res.success) await fetchProductions();
    } finally {
      setStartingId(null);
    }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const res = await getProductionDownload(id);
      if (res.success && res.data.loadfile_dat_url) {
        window.open(res.data.loadfile_dat_url, "_blank");
      }
      if (res.success && res.data.loadfile_opt_url) {
        window.open(res.data.loadfile_opt_url, "_blank");
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleAuditReport = async (id: string) => {
    setAuditId(id);
    try {
      const res = await getProductionAuditReport(id);
      if (res.success) {
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `production-audit-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setAuditId(null);
    }
  };

  const flatFolders = flattenFolders(folders);
  const progressValue = (p: ProductionRecord) =>
    p.status === "complete" ? 100 : p.status === "processing" ? 50 : 0;

  type ProductionWithCounts = ProductionRecord & { document_count?: number; page_count?: number };
  const batesEnd = (p: ProductionWithCounts) => {
    const pc = p.page_count ?? 0;
    if (pc === 0) return null;
    return p.bates_prefix + String(p.bates_start_number + pc - 1).padStart(6, "0");
  };

  return (
    <AppShell title="Productions">
      <Tabs defaultValue="outgoing" className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50 p-1 rounded-lg border border-border/50">
            <TabsTrigger value="outgoing" className="rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm">Bates / Produce</TabsTrigger>
            <TabsTrigger value="incoming" className="rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm">Import Load Files</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="outgoing" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Bates stamp and produce in single-page TIFF with DAT/OPT load files
            </p>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Production
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Production</DialogTitle>
                  <DialogDescription>
                    Configure Bates stamping and output. Documents come from the selected folder (or all in matter if none).
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <div>
                    <Label htmlFor="prod-name">Production name</Label>
                    <Input
                      id="prod-name"
                      placeholder="e.g. First Production - Responsive"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="prod-prefix">Bates prefix</Label>
                      <Input
                        id="prod-prefix"
                        placeholder="e.g. PROD"
                        value={formPrefix}
                        onChange={(e) => setFormPrefix(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="prod-start">Start number</Label>
                      <Input
                        id="prod-start"
                        type="number"
                        min={1}
                        value={formStart}
                        onChange={(e) => setFormStart(parseInt(e.target.value, 10) || 1)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Source folder (optional)</Label>
                    <Select
                      value={formFolderId ?? "__none__"}
                      onValueChange={(v) => setFormFolderId(v === "__none__" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All documents (no folder)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">All documents (no folder)</SelectItem>
                        {flatFolders.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.indent} {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="include-sub"
                      checked={formIncludeSubfolders}
                      onChange={(e) => setFormIncludeSubfolders(e.target.checked)}
                    />
                    <Label htmlFor="include-sub">Include subfolders</Label>
                  </div>
                  {createError && (
                    <div className="flex items-center gap-2 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {createError}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Single-page TIFF + DAT/OPT. Natives and unsupported types get a placeholder TIFF with native path in the load file.
                  </p>
                  <Button onClick={handleCreateAndStart} disabled={creating}>
                    {creating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Create &amp; Start Production
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="shadow-card rounded-xl border-border/80 overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading productions…</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Production</TableHead>
                      <TableHead className="w-36">Bates</TableHead>
                      <TableHead className="w-16">Docs</TableHead>
                      <TableHead className="w-16">Pages</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-32">Progress</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productions.length === 0 && !loading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No productions yet. Create one to Bates stamp and produce TIFFs + load files.
                        </TableCell>
                      </TableRow>
                    )}
                    {productions.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Stamp className="h-4 w-4 text-primary" />
                            <div>
                              <p className="text-sm font-medium text-foreground">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(p.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.bates_prefix}
                          {String(p.bates_start_number).padStart(6, "0")}
                          {batesEnd(p as ProductionWithCounts) != null
                            ? ` - ${batesEnd(p as ProductionWithCounts)}`
                            : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(p as ProductionWithCounts).document_count ?? 0}
                        </TableCell>
                        <TableCell className="text-sm">
                          {(p as ProductionWithCounts).page_count ?? 0}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              p.status === "complete"
                                ? "secondary"
                                : p.status === "failed"
                                  ? "destructive"
                                  : "default"
                            }
                            className="text-xs"
                          >
                            {p.status}
                          </Badge>
                          {p.status === "failed" && p.error_message && (
                            <p className="text-xs text-destructive mt-1 truncate max-w-[120px]" title={p.error_message}>
                              {p.error_message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={progressValue(p)}
                              className="h-2 w-20"
                            />
                            <span className="text-xs text-muted-foreground">
                              {progressValue(p)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStart(p.id)}
                              disabled={startingId === p.id}
                            >
                              {startingId === p.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {p.status === "complete" && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(p.id)}
                                disabled={downloadingId === p.id}
                                title="Download load files"
                              >
                                {downloadingId === p.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAuditReport(p.id)}
                                disabled={auditId === p.id}
                                title="Export audit report (hash validation)"
                              >
                                {auditId === p.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FileText className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incoming" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Import opposing party productions with DAT/OPT load files (Phase 8)
            </p>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Production
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Import Load Files</DialogTitle>
                  <DialogDescription>
                    Upload DAT and OPT files from opposing party production. Coming in Phase 8.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <Input placeholder="Production name" disabled />
                  <Input placeholder="Producing party" disabled />
                  <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
                    <FileText className="mx-auto h-6 w-6 text-muted-foreground" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Drop DAT + OPT files here (Phase 8)
                    </p>
                    <Button variant="outline" size="sm" className="mt-2 bg-transparent" disabled>
                      Browse
                    </Button>
                  </div>
                  <Select disabled>
                    <SelectTrigger>
                      <SelectValue placeholder="TIFF volume path" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vol1">VOL001/</SelectItem>
                      <SelectItem value="vol2">VOL002/</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setImportOpen(false)} disabled>
                    <Upload className="mr-2 h-4 w-4" />
                    Start Import
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Production</TableHead>
                    <TableHead className="w-24">Party</TableHead>
                    <TableHead className="w-24">DAT</TableHead>
                    <TableHead className="w-24">OPT</TableHead>
                    <TableHead className="w-16">Docs</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-24">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Inbound production import will be available in Phase 8.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
