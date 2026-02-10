"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Search, FileText, Eye, Sparkles, Loader2 } from "lucide-react";
import { search, type SearchScope, type SearchResultItem } from "@/lib/api-client";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("both");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    results: SearchResultItem[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);

  const handleSearch = async (page = 1) => {
    const q = query.trim();
    if (!q) return;
    setError(null);
    setLoading(true);
    const res = await search({ q, scope, page, pageSize: 20 });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      setData(null);
      return;
    }
    setData({
      results: res.data.results,
      total: res.data.total,
      page: res.data.page,
      pageSize: res.data.pageSize,
    });
  };

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 0;

  return (
    <AppShell title="Search">
      <div className="flex flex-col gap-6">
        <Card className="shadow-card rounded-xl border-border/80">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder='Search (e.g. "budget" or "quarterly review"; use -word to exclude)'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9 rounded-lg border-border focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>
                <Button onClick={() => handleSearch()} disabled={loading || !query.trim()} className="shadow-sm">
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">Search in:</span>
                <RadioGroup
                  value={scope}
                  onValueChange={(v) => setScope(v as SearchScope)}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="both" id="scope-both" />
                    <Label htmlFor="scope-both" className="text-sm font-normal cursor-pointer">
                      Content &amp; metadata
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="content" id="scope-content" />
                    <Label htmlFor="scope-content" className="text-sm font-normal cursor-pointer">
                      Document content only
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="metadata" id="scope-metadata" />
                    <Label htmlFor="scope-metadata" className="text-sm font-normal cursor-pointer">
                      Metadata only
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {!data && !error && !loading && (
          <Card className="shadow-card rounded-xl border-border/80 border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-16">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Find documents fast</p>
              <p className="text-sm text-muted-foreground text-center max-w-sm">
                Enter a search query to find documents (keyword + metadata)
              </p>
            </CardContent>
          </Card>
        )}

        {loading && !data && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Searching…</p>
            </CardContent>
          </Card>
        )}

        {data && (
          <Card className="shadow-card rounded-xl border-border/80 overflow-hidden animate-in-slide">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-sm font-semibold text-foreground">
                {data.total} result{data.total !== 1 ? "s" : ""} for &quot;{query.trim()}&quot;
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.results.length === 0 ? (
                <div className="px-6 pb-6 text-sm text-muted-foreground">
                  No documents match your search. Try different terms or scope.
                </div>
              ) : (
                <div className="flex flex-col">
                  {data.results.map((result) => (
                    <div
                      key={result.documentId}
                      className="flex items-start gap-4 border-b border-border/50 p-4 last:border-0 transition-colors hover:bg-muted/30"
                    >
                      <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {result.document?.original_filename ?? result.document?.filename ?? result.documentId}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {result.hitCount} hit{result.hitCount !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {result.document?.custodian && (
                            <span>{result.document.custodian}</span>
                          )}
                          {result.document?.created_at && (
                            <span>{formatDate(result.document.created_at)}</span>
                          )}
                        </div>
                        {result.snippet && (
                          <p
                            className="mt-1 text-sm text-foreground [&_mark]:rounded [&_mark]:bg-chart-4/30 [&_mark]:px-0.5"
                            dangerouslySetInnerHTML={{ __html: result.snippet }}
                          />
                        )}
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/viewer?id=${result.documentId}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 px-6 py-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    Page {data.page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page <= 1 || loading}
                      onClick={() => handleSearch(data.page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={data.page >= totalPages || loading}
                      onClick={() => handleSearch(data.page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
