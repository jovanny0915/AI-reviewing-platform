"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Upload,
  Filter,
  List,
  FolderTree,
  Loader2,
  Bookmark,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderInput,
  FolderOpen,
} from "lucide-react";
import {
  listDocuments,
  uploadDocument,
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  listFolders,
  addDocumentsToFolder,
  type ListDocumentsParams,
  type SavedSearch,
  type FolderNode,
} from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { DocumentsTableView } from "@/components/documents/documents-table-view";
import { DocumentsTreeView } from "@/components/documents/documents-tree-view";

export type DocumentsViewMode = "table" | "tree";

function isValidViewMode(v: string | null): v is DocumentsViewMode {
  return v === "table" || v === "tree";
}

function CullFolderPickItem({
  folder,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  folder: FolderNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const hasChildren = folder.children.length > 0;
  const isExpanded = expanded.has(folder.id);
  return (
    <div>
      <div className="flex items-center gap-1 rounded py-1" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(folder.id)} className="shrink-0">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className={`flex items-center gap-2 truncate text-left text-sm ${selectedId === folder.id ? "font-medium text-primary" : ""}`}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {isExpanded &&
        folder.children.map((c) => (
          <CullFolderPickItem
            key={c.id}
            folder={c}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const viewMode: DocumentsViewMode = isValidViewMode(viewParam) ? viewParam : "table";
  const { toast } = useToast();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadSuccessCount, setUploadSuccessCount] = useState(0);

  const [filterCustodian, setFilterCustodian] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterDocType, setFilterDocType] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<ListDocumentsParams>({ page: 1, pageSize: 20, expand: "families" });

  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [saveSearchOpen, setSaveSearchOpen] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [cullToFolderOpen, setCullToFolderOpen] = useState(false);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [cullTargetFolderId, setCullTargetFolderId] = useState<string | null>(null);
  const [cullSaving, setCullSaving] = useState(false);
  const [folderExpanded, setFolderExpanded] = useState<Set<string>>(new Set());

  const setViewMode = (mode: DocumentsViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.replace(`/documents?${params.toString()}`, { scroll: false });
  };

  const pageSize = 20;

  const applyFilters = () => {
    const next: ListDocumentsParams = {
      page: 1,
      pageSize,
      expand: "families",
    };
    if (filterCustodian.trim()) next.custodian = filterCustodian.trim();
    if (filterDateFrom) next.dateFrom = filterDateFrom;
    if (filterDateTo) next.dateTo = filterDateTo;
    if (filterKeyword.trim()) next.keyword = filterKeyword.trim();
    if (filterDocType.trim()) next.docType = filterDocType.trim();
    setAppliedFilters(next);
  };

  const clearFilters = () => {
    setFilterCustodian("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterKeyword("");
    setFilterDocType("");
    setAppliedFilters({ page: 1, pageSize, expand: "families" });
  };

  const loadSavedSearches = useCallback(async () => {
    const res = await listSavedSearches({});
    if (res.success) setSavedSearches(res.data.savedSearches);
  }, []);

  useEffect(() => {
    loadSavedSearches();
  }, [loadSavedSearches]);

  const runSavedSearch = (s: SavedSearch) => {
    const params: ListDocumentsParams = { ...(s.params as ListDocumentsParams), page: 1, pageSize, expand: "families" };
    setAppliedFilters(params);
    setFilterCustodian((params.custodian as string) ?? "");
    setFilterDateFrom((params.dateFrom as string) ?? "");
    setFilterDateTo((params.dateTo as string) ?? "");
    setFilterKeyword((params.keyword as string) ?? "");
    setFilterDocType((params.docType as string) ?? "");
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) {
      toast({ title: "Enter a name", variant: "destructive" });
      return;
    }
    const res = await createSavedSearch({ name: saveSearchName.trim(), params: appliedFilters });
    if (res.success) {
      toast({ title: "Saved search created" });
      setSaveSearchOpen(false);
      setSaveSearchName("");
      loadSavedSearches();
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const handleDeleteSavedSearch = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await deleteSavedSearch(id);
    if (res.success) {
      toast({ title: "Saved search deleted" });
      loadSavedSearches();
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast({ title: "No files selected", variant: "destructive" });
      return;
    }
    setUploading(true);
    let successCount = 0;
    let failCount = 0;
    for (const file of uploadFiles) {
      const result = await uploadDocument(file);
      if (result.success) successCount++;
      else failCount++;
    }
    setUploading(false);
    setUploadFiles([]);
    setUploadOpen(false);
    if (successCount > 0) {
      setUploadSuccessCount((c) => c + 1);
      toast({ title: `Uploaded ${successCount} document(s)` });
    }
    if (failCount > 0) {
      toast({ title: `Failed to upload ${failCount} file(s)`, variant: "destructive" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
  };

  const removeFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const loadFoldersForCull = useCallback(async () => {
    const res = await listFolders({});
    if (res.success) setFolderTree(res.data.folders);
  }, []);

  useEffect(() => {
    if (cullToFolderOpen) loadFoldersForCull();
  }, [cullToFolderOpen, loadFoldersForCull]);

  const handleCullToFolder = async () => {
    if (!cullTargetFolderId || selectedDocIds.size === 0) return;
    setCullSaving(true);
    const res = await addDocumentsToFolder(cullTargetFolderId, Array.from(selectedDocIds));
    setCullSaving(false);
    if (res.success) {
      toast({ title: `Added ${res.data.added} document(s) to folder` });
      setCullToFolderOpen(false);
      setCullTargetFolderId(null);
      setSelectedDocIds(new Set());
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const toggleFolderExpand = (id: string) => {
    setFolderExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppShell title="Documents">
      <div className="flex flex-col gap-6">
        {/* View mode: only affects table vs tree content below */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && isValidViewMode(v) && setViewMode(v)}
            className="rounded-lg border border-border/80 bg-muted/30 p-0.5 shadow-sm"
          >
            <ToggleGroupItem
              value="table"
              aria-label="Table view"
              className="rounded-md px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <List className="mr-2 h-4 w-4" />
              Table
            </ToggleGroupItem>
            <ToggleGroupItem
              value="tree"
              aria-label="Tree view"
              className="rounded-md px-4 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <FolderTree className="mr-2 h-4 w-4" />
              Tree
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Shared toolbar: always visible */}
        <div className="flex flex-wrap items-center gap-3">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-card hover:shadow-card-hover transition-shadow">
                <Upload className="mr-2 h-4 w-4" />
                Upload Documents
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-xl shadow-lg">
              <DialogHeader>
                <DialogTitle className="text-lg">Upload Documents</DialogTitle>
                <DialogDescription>
                  Upload documents for processing. OCR will be applied to scanned files automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/10">
                  <img src="/docs-illustration.svg" alt="" className="mx-auto h-32 w-auto object-contain mb-2" />
                  <p className="mt-2 text-sm font-medium text-foreground">Drag and drop files here or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, XLSX, MSG, EML, JPG, PNG, TIFF</p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.msg,.eml,.jpg,.jpeg,.png,.tiff,.tif"
                    onChange={handleFileChange}
                    className="mt-4 cursor-pointer text-sm"
                  />
                </div>
                {uploadFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Selected files:</p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                      {uploadFiles.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center justify-between rounded border px-2 py-1">
                          <span className="truncate">{f.name}</span>
                          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => removeFile(i)}>
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <Button className="w-full" onClick={handleUpload} disabled={uploading || uploadFiles.length === 0}>
                  {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Process and Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-lg shadow-sm">
                <Bookmark className="mr-2 h-4 w-4" />
                Saved searches
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {savedSearches.length === 0 ? (
                <DropdownMenuItem disabled>No saved searches</DropdownMenuItem>
              ) : (
                savedSearches.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onSelect={() => runSavedSearch(s)}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate flex-1">{s.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteSavedSearch(s.id, e); }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSaveSearchOpen(true)}>
                <Save className="mr-2 h-4 w-4" />
                Save current search
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog open={saveSearchOpen} onOpenChange={setSaveSearchOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Save search</DialogTitle>
                <DialogDescription>Save current filters as a named search.</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 py-2">
                <Input
                  placeholder="Search name"
                  value={saveSearchName}
                  onChange={(e) => setSaveSearchName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
                />
                <Button onClick={handleSaveSearch} disabled={!saveSearchName.trim()}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => setCullToFolderOpen(true)}
            disabled={selectedDocIds.size === 0}
            title={selectedDocIds.size === 0 ? "Select documents first" : "Add selected documents to a folder"}
            className="rounded-lg shadow-sm"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            Cull to folder {selectedDocIds.size > 0 ? `(${selectedDocIds.size})` : ""}
          </Button>
        </div>

        <Dialog open={cullToFolderOpen} onOpenChange={setCullToFolderOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cull to folder</DialogTitle>
              <DialogDescription>
                Select a folder to add the {selectedDocIds.size} selected document(s) to.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-64 overflow-y-auto space-y-1 py-2">
              {folderTree.length === 0 ? (
                <p className="text-sm text-muted-foreground">No folders yet. Create folders in the Tree view.</p>
              ) : (
                folderTree.map((folder) => (
                  <CullFolderPickItem
                    key={folder.id}
                    folder={folder}
                    depth={0}
                    expanded={folderExpanded}
                    onToggle={toggleFolderExpand}
                    selectedId={cullTargetFolderId}
                    onSelect={setCullTargetFolderId}
                  />
                ))
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCullToFolder} disabled={!cullTargetFolderId || cullSaving}>
                {cullSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add to folder
              </Button>
              <Button variant="outline" onClick={() => setCullToFolderOpen(false)}>Cancel</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shared filters: always visible */}
        <Card className="shadow-card rounded-xl border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4 text-primary" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Custodian</label>
              <Input placeholder="Custodian" value={filterCustodian} onChange={(e) => setFilterCustodian(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Date from</label>
              <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Date to</label>
              <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Keyword</label>
              <Input placeholder="Keyword" value={filterKeyword} onChange={(e) => setFilterKeyword(e.target.value)} className="w-48" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Doc type</label>
              <Input placeholder="e.g. application/pdf" value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)} className="w-40" />
            </div>
            <Button onClick={applyFilters}>Apply</Button>
            <Button variant="outline" onClick={clearFilters}>Clear</Button>
          </CardContent>
        </Card>

        {/* Only this area switches between table and tree */}
        {viewMode === "table" ? (
          <DocumentsTableView
            appliedFilters={appliedFilters}
            refreshTrigger={uploadSuccessCount}
            selectedDocIds={selectedDocIds}
            setSelectedDocIds={setSelectedDocIds}
            onOpenUpload={() => setUploadOpen(true)}
          />
        ) : (
          <DocumentsTreeView
            selectedDocIds={selectedDocIds}
            setSelectedDocIds={setSelectedDocIds}
          />
        )}
      </div>
    </AppShell>
  );
}
