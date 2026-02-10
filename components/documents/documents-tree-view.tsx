"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  FileText,
  MoveRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  FolderInput,
  Eye,
} from "lucide-react";
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  addDocumentsToFolder,
  removeDocumentFromFolder,
  listDocuments,
  type FolderNode,
  type FamilyGroup,
  type DocumentRecord,
} from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

function getFileTypeCategory(doc: DocumentRecord): "document" | "pdf" | "image" {
  const mime = (doc.file_type ?? doc.mime_type ?? "").toLowerCase();
  const name = doc.original_filename ?? doc.filename ?? "";
  if (mime.includes("pdf") || /\.pdf$/i.test(name)) return "pdf";
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(name)) return "image";
  return "document";
}

function FolderTreeItem({
  folder,
  depth = 0,
  expanded,
  onToggle,
  selected,
  onSelect,
  onRename,
  onDelete,
  onAddSubfolder,
}: {
  folder: FolderNode;
  depth?: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selected: string | null;
  onSelect: (id: string) => void;
  onRename: (folder: FolderNode) => void;
  onDelete: (folder: FolderNode) => void;
  onAddSubfolder: (parent: FolderNode) => void;
}) {
  const hasChildren = folder.children.length > 0;
  const isExpanded = expanded.has(folder.id);

  return (
    <div>
      <div
        className={`flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent group ${
          selected === folder.id ? "bg-accent text-accent-foreground" : "text-foreground"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className="flex flex-1 items-center gap-2 truncate text-left min-w-0"
        >
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{folder.name}</span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {(folder.document_count ?? 0).toLocaleString()}
          </Badge>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle(folder.id);
          }}
          className="shrink-0 p-0.5"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(folder)}>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAddSubfolder(folder)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New subfolder
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(folder)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isExpanded &&
        folder.children.map((child) => (
          <FolderTreeItem
            key={child.id}
            folder={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            selected={selected}
            onSelect={onSelect}
            onRename={onRename}
            onDelete={onDelete}
            onAddSubfolder={onAddSubfolder}
          />
        ))}
    </div>
  );
}

function FolderDocRow({
  doc,
  isParent,
  selected,
  onToggle,
  onRemove,
  folderId,
}: {
  doc: DocumentRecord;
  isParent?: boolean;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
  folderId: string;
}) {
  const openViewer = () => window.open(`/viewer?id=${doc.id}`, "_blank");

  return (
    <div
      className={`flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 transition-colors hover:bg-muted/50 ${selected ? "bg-muted/50" : ""}`}
      style={isParent ? {} : { marginLeft: 24 }}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} className="rounded" />
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{doc.original_filename ?? doc.filename}</p>
        <p className="truncate text-xs text-muted-foreground">{doc.custodian ?? doc.id}</p>
      </div>
      <Badge variant="secondary" className="text-xs shrink-0">
        {doc.file_type ?? doc.mime_type ?? "—"}
      </Badge>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={openViewer} title="Open in viewer">
        <Eye className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" className="shrink-0" onClick={onRemove} title="Remove from folder">
        <FolderInput className="h-4 w-4" />
      </Button>
    </div>
  );
}

function FolderPickItem({
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
          <FolderPickItem
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

export type DocumentsTreeViewProps = {
  selectedDocIds: Set<string>;
  setSelectedDocIds: React.Dispatch<React.SetStateAction<Set<string>>>;
};

export function DocumentsTreeView({ selectedDocIds, setSelectedDocIds }: DocumentsTreeViewProps) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [createSaving, setCreateSaving] = useState(false);
  const [renameFolder, setRenameFolder] = useState<FolderNode | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null>(null);
  const [folderDocs, setFolderDocs] = useState<FamilyGroup[]>([]);
  const [folderDocsLoading, setFolderDocsLoading] = useState(false);
  const [moveDocsSaving, setMoveDocsSaving] = useState(false);
  const [includeSubfolders, setIncludeSubfolders] = useState(false);
  const { toast } = useToast();

  const loadFolders = useCallback(async () => {
    setLoading(true);
    const res = await listFolders({});
    if (res.success) {
      setFolders(res.data.folders);
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  const loadFolderDocuments = useCallback(
    async (folderId: string) => {
      setFolderDocsLoading(true);
      const res = await listDocuments({
        folderId,
        includeSubfolders,
        page: 1,
        pageSize: 100,
        expand: "families",
      });
      setFolderDocsLoading(false);
      if (res.success && "familyGroups" in res.data) {
        setFolderDocs(res.data.familyGroups);
      } else if (res.success && "documents" in res.data) {
        const docs = res.data.documents;
        const roots = docs.filter((d) => !d.parent_id);
        setFolderDocs(
          roots.map((r) => ({
            id: r.family_id ?? r.id,
            parent: r,
            children: docs.filter((d) => d.parent_id === r.id),
          }))
        );
      } else {
        setFolderDocs([]);
      }
    },
    [includeSubfolders]
  );

  useEffect(() => {
    if (selected) loadFolderDocuments(selected);
    else setFolderDocs([]);
  }, [selected, loadFolderDocuments, includeSubfolders]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateFolder = async () => {
    if (!createName.trim()) {
      toast({ title: "Enter folder name", variant: "destructive" });
      return;
    }
    setCreateSaving(true);
    const res = await createFolder({
      name: createName.trim(),
      parent_id: createParentId || null,
    });
    setCreateSaving(false);
    if (res.success) {
      toast({ title: "Folder created" });
      setCreateOpen(false);
      setCreateName("");
      setCreateParentId(null);
      loadFolders();
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const openRename = (folder: FolderNode) => {
    setRenameFolder(folder);
    setRenameName(folder.name);
  };

  const handleRename = async () => {
    if (!renameFolder || !renameName.trim()) return;
    setRenameSaving(true);
    const res = await updateFolder(renameFolder.id, { name: renameName.trim() });
    setRenameSaving(false);
    if (res.success) {
      toast({ title: "Folder renamed" });
      setRenameFolder(null);
      loadFolders();
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const handleDeleteFolder = async (folder: FolderNode) => {
    if (!confirm(`Delete folder "${folder.name}"? This will remove document assignments and subfolders.`))
      return;
    const res = await deleteFolder(folder.id);
    if (res.success) {
      toast({ title: "Folder deleted" });
      if (selected === folder.id) setSelected(null);
      loadFolders();
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const openAddSubfolder = (parent: FolderNode) => {
    setCreateParentId(parent.id);
    setCreateName("");
    setCreateOpen(true);
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const selectAllInFolder = () => {
    const ids = folderDocs.flatMap((fg) => [fg.parent.id, ...fg.children.map((c) => c.id)]);
    setSelectedDocIds(new Set(ids));
  };

  const handleMoveToFolder = async (targetFolderId: string) => {
    if (selectedDocIds.size === 0) {
      toast({ title: "Select at least one document", variant: "destructive" });
      return;
    }
    setMoveDocsSaving(true);
    const res = await addDocumentsToFolder(targetFolderId, Array.from(selectedDocIds));
    setMoveDocsSaving(false);
    if (res.success) {
      toast({ title: `Added ${res.data.added} document(s) to folder` });
      setMoveTargetFolderId(null);
      setSelectedDocIds(new Set());
      if (selected === targetFolderId) loadFolderDocuments(targetFolderId);
      loadFolders();
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const handleRemoveFromFolder = async (docId: string) => {
    if (!selected) return;
    const res = await removeDocumentFromFolder(selected, docId);
    if (res.success) {
      toast({ title: "Document removed from folder" });
      setSelectedDocIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      loadFolderDocuments(selected);
      loadFolders();
    } else {
      toast({ title: res.error, variant: "destructive" });
    }
  };

  const allDocs = folderDocs.flatMap((fg) => [fg.parent, ...fg.children]);
  const fileTypeCounts = React.useMemo(() => {
    let document = 0,
      pdf = 0,
      image = 0;
    for (const doc of allDocs) {
      const cat = getFileTypeCategory(doc);
      if (cat === "document") document++;
      else if (cat === "pdf") pdf++;
      else image++;
    }
    return { document, pdf, image };
  }, [allDocs]);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <Card className="w-72 shrink-0 overflow-auto shadow-card rounded-xl border-border/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50 bg-muted/30">
          <CardTitle className="text-sm font-semibold text-foreground">Folder structure</CardTitle>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreateParentId(null); }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" title="New folder">
                <FolderPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-xl shadow-lg">
              <DialogHeader>
                <DialogTitle>{createParentId ? "New subfolder" : "Create folder"}</DialogTitle>
                <DialogDescription>
                  {createParentId
                    ? "Create a subfolder under the selected folder."
                    : "Create a new folder for organizing documents."}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <Input
                  placeholder="Folder name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <Button onClick={handleCreateFolder} disabled={createSaving || !createName.trim()}>
                  {createSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-2">
          {selected && allDocs.length > 0 && (
            <div className="mb-3 rounded-md border border-border/50 bg-muted/20 px-2 py-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">File types in this folder</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground">Documents</span>
                  <Badge variant="secondary" className="text-xs">{fileTypeCounts.document}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground">PDF</span>
                  <Badge variant="secondary" className="text-xs">{fileTypeCounts.pdf}</Badge>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-foreground">Images</span>
                  <Badge variant="secondary" className="text-xs">{fileTypeCounts.image}</Badge>
                </div>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No folders yet. Create one to get started.</p>
          ) : (
            folders.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                expanded={expanded}
                onToggle={toggleExpand}
                selected={selected}
                onSelect={setSelected}
                onRename={openRename}
                onDelete={handleDeleteFolder}
                onAddSubfolder={openAddSubfolder}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-card rounded-xl border-border/80">
        <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0 border-b border-border/50 bg-muted/30">
          <CardTitle className="text-sm font-semibold text-foreground">Folder contents</CardTitle>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeSubfolders}
                onChange={(e) => setIncludeSubfolders(e.target.checked)}
              />
              Include subfolders
            </label>
            {selected && (
              <>
                <Button variant="outline" size="sm" onClick={selectAllInFolder}>
                  Select all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMoveTargetFolderId(selected)}
                  disabled={selectedDocIds.size === 0}
                >
                  <MoveRight className="mr-2 h-3 w-3" />
                  Move {selectedDocIds.size > 0 ? `(${selectedDocIds.size})` : ""} to folder
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto p-0">
          {!selected ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FolderOpen className="h-12 w-12 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">Select a folder to view contents</p>
            </div>
          ) : folderDocsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          ) : allDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileText className="h-12 w-12 text-muted-foreground/60" />
              <p className="text-sm font-medium text-muted-foreground">No documents in this folder</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-2">
              {folderDocs.map((fg) => (
                <React.Fragment key={fg.id}>
                  <FolderDocRow
                    doc={fg.parent}
                    isParent
                    selected={selectedDocIds.has(fg.parent.id)}
                    onToggle={() => toggleDocSelection(fg.parent.id)}
                    onRemove={() => handleRemoveFromFolder(fg.parent.id)}
                    folderId={selected!}
                  />
                  {fg.children.map((doc) => (
                    <FolderDocRow
                      key={doc.id}
                      doc={doc}
                      selected={selectedDocIds.has(doc.id)}
                      onToggle={() => toggleDocSelection(doc.id)}
                      onRemove={() => handleRemoveFromFolder(doc.id)}
                      folderId={selected!}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!renameFolder} onOpenChange={(open) => !open && setRenameFolder(null)}>
        <DialogContent className="rounded-xl shadow-lg">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Enter a new name for the folder.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Input
              placeholder="Folder name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <div className="flex gap-2">
              <Button onClick={handleRename} disabled={renameSaving || !renameName.trim()}>
                {renameSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
              <Button variant="outline" onClick={() => setRenameFolder(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveTargetFolderId} onOpenChange={(open) => !open && setMoveTargetFolderId(null)}>
        <DialogContent className="rounded-xl shadow-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <DialogDescription>Select the folder to add the selected documents to.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1 py-2">
            {folders.map((f) => (
              <FolderPickItem
                key={f.id}
                folder={f}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                selectedId={moveTargetFolderId}
                onSelect={(id) => setMoveTargetFolderId(id)}
              />
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => moveTargetFolderId && handleMoveToFolder(moveTargetFolderId)}
              disabled={!moveTargetFolderId || moveDocsSaving || selectedDocIds.size === 0}
            >
              {moveDocsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add {selectedDocIds.size} doc(s) to folder
            </Button>
            <Button variant="outline" onClick={() => setMoveTargetFolderId(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
