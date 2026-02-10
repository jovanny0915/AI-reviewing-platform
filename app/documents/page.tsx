"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { List, FolderTree } from "lucide-react";
import { DocumentsTableView } from "@/components/documents/documents-table-view";
import { DocumentsTreeView } from "@/components/documents/documents-tree-view";

export type DocumentsViewMode = "table" | "tree";

function isValidViewMode(v: string | null): v is DocumentsViewMode {
  return v === "table" || v === "tree";
}

export default function DocumentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const viewMode: DocumentsViewMode = isValidViewMode(viewParam) ? viewParam : "table";

  const setViewMode = (mode: DocumentsViewMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", mode);
    router.replace(`/documents?${params.toString()}`, { scroll: false });
  };

  return (
    <AppShell title="Documents">
      <div className="flex flex-col gap-4">
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

        {viewMode === "table" ? <DocumentsTableView /> : <DocumentsTreeView />}
      </div>
    </AppShell>
  );
}
