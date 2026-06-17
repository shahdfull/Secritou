import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchApi, type SearchResults } from "@/api/search.api";

const EMPTY_RESULTS: SearchResults = {
  leads: [],
  clients: [],
  projects: [],
  tasks: [],
  freelancers: [],
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(EMPTY_RESULTS);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    searchApi
      .search(debouncedQuery)
      .then((data) => {
        if (!cancelled) setResults(data);
      })
      .catch(() => {
        if (!cancelled) setResults(EMPTY_RESULTS);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasResults =
    results.leads.length > 0 ||
    results.clients.length > 0 ||
    results.projects.length > 0 ||
    results.tasks.length > 0 ||
    results.freelancers.length > 0;

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher leads, clients, projets..."
            className="pl-10 bg-muted/50 border-muted-foreground/20"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : debouncedQuery.length < 2 ? (
          <p className="p-4 text-sm text-muted-foreground">Tapez au moins 2 caractères</p>
        ) : !hasResults ? (
          <p className="p-4 text-sm text-muted-foreground">Aucun résultat</p>
        ) : (
          <div className="max-h-80 overflow-y-auto p-2">
            {results.leads.length > 0 && (
              <ResultGroup
                title={`Leads (${results.leads.length})`}
                items={results.leads.map((l) => ({
                  id: l.id,
                  label: l.name ?? "",
                  sub: l.email,
                  path: `/app/leads`,
                }))}
                onNavigate={handleNavigate}
              />
            )}
            {results.clients.length > 0 && (
              <ResultGroup
                title={`Clients (${results.clients.length})`}
                items={results.clients.map((c) => ({
                  id: c.id,
                  label: c.name ?? "",
                  sub: c.email,
                  path: `/app/clients/${c.id}`,
                }))}
                onNavigate={handleNavigate}
              />
            )}
            {results.projects.length > 0 && (
              <ResultGroup
                title={`Projets (${results.projects.length})`}
                items={results.projects.map((p) => ({
                  id: p.id,
                  label: p.name ?? "",
                  path: `/app/projects`,
                }))}
                onNavigate={handleNavigate}
              />
            )}
            {results.tasks.length > 0 && (
              <ResultGroup
                title={`Tâches (${results.tasks.length})`}
                items={results.tasks.map((t) => ({
                  id: t.id,
                  label: t.title ?? "",
                  path: `/app/tasks`,
                }))}
                onNavigate={handleNavigate}
              />
            )}
            {results.freelancers.length > 0 && (
              <ResultGroup
                title={`Freelancers (${results.freelancers.length})`}
                items={results.freelancers.map((f) => ({
                  id: f.id,
                  label: f.user?.name ?? "",
                  sub: f.user?.email,
                  path: `/app/freelancers`,
                }))}
                onNavigate={handleNavigate}
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ResultGroup({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: { id: string; label: string; sub?: string; path: string }[];
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="mb-3">
      <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">{title}</p>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="w-full text-left px-2 py-2 rounded-md hover:bg-muted transition-colors"
          onClick={() => onNavigate(item.path)}
        >
          <div className="text-sm font-medium">{item.label}</div>
          {item.sub && <div className="text-xs text-muted-foreground">{item.sub}</div>}
        </button>
      ))}
    </div>
  );
}
