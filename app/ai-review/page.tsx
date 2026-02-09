"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Brain, Send, Sparkles, Loader2, AlertCircle } from "lucide-react";
import {
  aiSummarize,
  aiSimilar,
  aiSuggestions,
  aiUsage,
  listFolders,
  type FolderNode,
} from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

type TaskType = "summarize" | "similar" | "suggestions";

export default function AIReviewPage() {
  const [taskType, setTaskType] = useState<TaskType>("summarize");
  const [scopeType, setScopeType] = useState<"folder" | "documents">("folder");
  const [folderId, setFolderId] = useState<string>("");
  const [documentIdsRaw, setDocumentIdsRaw] = useState("");
  const [queryHint, setQueryHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [usage, setUsage] = useState<{ used: number; cap: number } | null>(null);
  const [result, setResult] = useState<{
    task: TaskType;
    summary?: string;
    cached?: boolean;
    documentCount?: number;
    similarDocumentIds?: string[];
    sourceDocumentId?: string;
    suggestions?: { documentId: string; suggestedTags: string[] }[];
    relevanceRanking?: { documentIds: string[]; explanation?: string };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    listFolders().then((r) => {
      if (r.success && r.data.folders) setFolders(r.data.folders);
    });
    aiUsage().then((r) => {
      if (r.success) setUsage({ used: r.data.used, cap: r.data.cap });
    });
  }, []);

  async function runAnalysis() {
    setError(null);
    setResult(null);

    if (taskType === "summarize") {
      setLoading(true);
      const params: Parameters<typeof aiSummarize>[0] =
        scopeType === "folder" && folderId
          ? { folderId, includeSubfolders: true }
          : { documentIds: documentIdsRaw.trim().split(/[\s,]+/).filter(Boolean) };
      if (!("folderId" in params && params.folderId) && !(params.documentIds?.length)) {
        setError("Select a folder or enter at least one document ID.");
        setLoading(false);
        return;
      }
      const res = await aiSummarize(params);
      setLoading(false);
      if (!res.success) {
        setError(res.error);
        toast({ title: "Summarize failed", description: res.error, variant: "destructive" });
        return;
      }
      setResult({
        task: "summarize",
        summary: res.data.summary,
        cached: res.data.cached,
        documentCount: res.data.documentCount,
      });
      if (usage) setUsage({ ...usage, used: usage.used + res.data.documentCount });
      return;
    }

    if (taskType === "similar") {
      const docId = documentIdsRaw.trim();
      if (!docId) {
        setError("Enter a document ID to find similar documents.");
        return;
      }
      setLoading(true);
      const res = await aiSimilar({ documentId: docId, limit: 20 });
      setLoading(false);
      if (!res.success) {
        setError(res.error);
        toast({ title: "Find similar failed", description: res.error, variant: "destructive" });
        return;
      }
      setResult({
        task: "similar",
        sourceDocumentId: res.data.documentId,
        similarDocumentIds: res.data.similarDocumentIds,
      });
      return;
    }

    if (taskType === "suggestions") {
      const ids = documentIdsRaw.trim().split(/[\s,]+/).filter(Boolean);
      if (!ids.length) {
        setError("Enter at least one document ID for suggestions.");
        return;
      }
      setLoading(true);
      const type = queryHint.toLowerCase().includes("rank") ? "relevance_ranking" : "issue_tags";
      const res = await aiSuggestions({
        documentIds: ids,
        type,
        query: type === "relevance_ranking" ? queryHint || undefined : undefined,
      });
      setLoading(false);
      if (!res.success) {
        setError(res.error);
        toast({ title: "Suggestions failed", description: res.error, variant: "destructive" });
        return;
      }
      if (res.data.type === "issue_tags") {
        setResult({
          task: "suggestions",
          suggestions: res.data.suggestions,
        });
      } else {
        setResult({
          task: "suggestions",
          relevanceRanking: {
            documentIds: res.data.documentIds,
            explanation: res.data.explanation,
          },
        });
      }
      return;
    }
  }

  return (
    <AppShell title="AI Review">
      <div className="flex flex-col gap-6">
        <Card className="shadow-card rounded-xl border-border/80 overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="rounded-lg bg-primary/10 p-2">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              AI-Assisted Document Review
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Human-in-the-loop only: AI suggests; you decide relevance and privilege.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Task</label>
                  <Select
                    value={taskType}
                    onValueChange={(v) => {
                      setTaskType(v as TaskType);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summarize">Summarize collection</SelectItem>
                      <SelectItem value="similar">Find similar documents</SelectItem>
                      <SelectItem value="suggestions">Suggest issue tags / relevance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {taskType === "summarize" && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Scope</label>
                      <Select
                        value={scopeType}
                        onValueChange={(v) => setScopeType(v as "folder" | "documents")}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="folder">Folder</SelectItem>
                          <SelectItem value="documents">Document IDs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {scopeType === "folder" && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Folder</label>
                        <Select value={folderId} onValueChange={setFolderId}>
                          <SelectTrigger className="w-56">
                            <SelectValue placeholder="Select folder" />
                          </SelectTrigger>
                          <SelectContent>
                            {folders.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.name}
                                {f.document_count != null ? ` (${f.document_count})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                {(taskType === "similar" || taskType === "suggestions") && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">
                      {taskType === "similar" ? "Source document ID" : "Document IDs (comma/space)"}
                    </label>
                    <Input
                      className="w-72 font-mono text-sm"
                      placeholder={
                        taskType === "similar"
                          ? "e.g. uuid"
                          : "e.g. id1, id2 id3"
                      }
                      value={documentIdsRaw}
                      onChange={(e) => setDocumentIdsRaw(e.target.value)}
                    />
                  </div>
                )}

                {taskType === "suggestions" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Query (optional, for ranking)</label>
                    <Input
                      className="w-56"
                      placeholder="e.g. budget approval Q1"
                      value={queryHint}
                      onChange={(e) => setQueryHint(e.target.value)}
                    />
                  </div>
                )}

                {taskType === "summarize" && scopeType === "documents" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Document IDs</label>
                    <Input
                      className="w-72 font-mono text-sm"
                      placeholder="id1, id2, id3"
                      value={documentIdsRaw}
                      onChange={(e) => setDocumentIdsRaw(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {usage != null && (
                <p className="text-xs text-muted-foreground">
                  AI usage this month: {usage.used} / {usage.cap} units
                </p>
              )}

              <div className="flex justify-end">
                <Button onClick={runAnalysis} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Run
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-2 py-3">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!result && !error && (
          <Card className="shadow-card rounded-xl border-border/80 border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Ready for AI analysis</p>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Choose a task and scope, then run to see results.
              </p>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="shadow-card rounded-xl border-border/80 overflow-hidden animate-in-slide">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-sm font-semibold text-foreground">
                {result.task === "summarize" && "Summary"}
                {result.task === "similar" && "Similar documents"}
                {result.task === "suggestions" && "Suggestions"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.task === "summarize" && (
                <>
                  {result.cached && (
                    <p className="text-xs text-muted-foreground mb-2">(Cached)</p>
                  )}
                  {result.documentCount != null && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {result.documentCount} document(s)
                    </p>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {result.summary || "No summary generated."}
                  </div>
                </>
              )}

              {result.task === "similar" && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground">
                    Source:{" "}
                    <Link
                      href={`/viewer?documentId=${result.sourceDocumentId}`}
                      className="text-primary hover:underline"
                    >
                      {result.sourceDocumentId}
                    </Link>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {(result.similarDocumentIds ?? []).map((id) => (
                      <li key={id}>
                        <Link
                          href={`/viewer?documentId=${id}`}
                          className="text-primary hover:underline"
                        >
                          {id}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {(!result.similarDocumentIds?.length) && (
                    <p className="text-sm text-muted-foreground">No similar documents found.</p>
                  )}
                </div>
              )}

              {result.task === "suggestions" && result.suggestions && (
                <div className="flex flex-col gap-3">
                  {result.suggestions.map((s) => (
                    <div key={s.documentId} className="rounded border p-2 text-sm">
                      <Link
                        href={`/viewer?documentId=${s.documentId}`}
                        className="text-primary hover:underline font-mono"
                      >
                        {s.documentId}
                      </Link>
                      <span className="ml-2">
                        {s.suggestedTags.length ? s.suggestedTags.join(", ") : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {result.task === "suggestions" && result.relevanceRanking && (
                <div className="flex flex-col gap-2">
                  {result.relevanceRanking.explanation && (
                    <p className="text-sm text-muted-foreground">
                      {result.relevanceRanking.explanation}
                    </p>
                  )}
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    {result.relevanceRanking.documentIds.map((id) => (
                      <li key={id}>
                        <Link
                          href={`/viewer?documentId=${id}`}
                          className="text-primary hover:underline"
                        >
                          {id}
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
