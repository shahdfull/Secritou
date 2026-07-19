import { useState } from "react";
import { formatDate } from "@/utils/format";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Download, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { documentsApi, Document, DocumentType } from "@/api/documents.api";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  WELCOME_LETTER: "Lettre de bienvenue",
  CONTRACT: "Contrat de service",
  SPECS: "Cahier des charges",
  CLIENT_BRIEF: "Questionnaire brief",
  QUOTE: "Devis",
  INVOICE_DEPOSIT: "Facture d'acompte",
  INVOICE_BALANCE: "Facture de solde",
  ROADMAP: "Roadmap projet",
  DELIVERABLE: "Livrable",
  GUIDE: "Guide",
  REPORT: "Rapport",
  INVOICE: "Facture",
  OTHER: "Autre",
};

const DOC_TYPE_ORDER: DocumentType[] = [
  "WELCOME_LETTER",
  "CONTRACT",
  "SPECS",
  "CLIENT_BRIEF",
  "QUOTE",
  "INVOICE_DEPOSIT",
  "INVOICE_BALANCE",
  "ROADMAP",
  "DELIVERABLE",
  "GUIDE",
  "REPORT",
  "INVOICE",
  "OTHER",
];

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useClientDocuments(projectId?: string) {
  return useQuery({
    queryKey: ["client-documents", projectId],
    queryFn: () =>
      documentsApi.getDocuments({ projectId, pageSize: 100 }),
    staleTime: 30_000,
  });
}

function useSignDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.signDocument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-documents"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DownloadButton({ doc }: { doc: Document }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { url, filename } = await documentsApi.getDownloadUrl(doc.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    } catch {
      toast.error("Impossible de télécharger le document.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      <span className="ml-1">Télécharger</span>
    </Button>
  );
}

function SignContractDialog({
  doc,
  open,
  onClose,
}: {
  doc: Document;
  open: boolean;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const signMutation = useSignDocument();

  const handleSign = () => {
    signMutation.mutate(doc.id, {
      onSuccess: () => {
        toast.success("Contrat signé avec succès.");
        onClose();
      },
      onError: () => {
        toast.error("La signature a échoué. Veuillez réessayer.");
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Signer le contrat</DialogTitle>
          <DialogDescription>
            Veuillez lire le résumé ci-dessous avant de signer électroniquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-muted p-4 space-y-1">
            <p><span className="font-medium">Prestataire :</span> Secritou</p>
            <p><span className="font-medium">Document :</span> {doc.title}</p>
            {doc.projectId && (
              <p><span className="font-medium">Projet lié :</span> {doc.projectId}</p>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            En cochant la case ci-dessous, vous confirmez avoir lu l'intégralité du contrat de prestation de services et en accepter les termes. Cette signature électronique a valeur contractuelle.
          </p>
          <div className="flex items-start gap-3 pt-1">
            <Checkbox
              id="accept-terms"
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
            />
            <label htmlFor="accept-terms" className="text-sm leading-snug cursor-pointer">
              J'ai lu et j'accepte les termes du contrat de service Secritou
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            onClick={handleSign}
            disabled={!checked || signMutation.isPending}
          >
            {signMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Signature en cours…</>
            ) : (
              "Signer électroniquement"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentRow({ doc }: { doc: Document }) {
  const [signOpen, setSignOpen] = useState(false);
  const isSigned = !!doc.signedAt;
  const isContract = doc.type === "CONTRACT";
  const signedDate = doc.signedAt ? formatDate(doc.signedAt) : null;

  return (
    <div className="flex items-center justify-between py-3 px-1 gap-3 border-b last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{doc.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(doc.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isContract && isSigned && (
          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 gap-1 hidden sm:flex">
            <CheckCircle2 className="h-3 w-3" />
            Signé le {signedDate}
          </Badge>
        )}
        <DownloadButton doc={doc} />
        {isContract && !isSigned && (
          <>
            <Button size="sm" onClick={() => setSignOpen(true)}>
              Signer
            </Button>
            <SignContractDialog doc={doc} open={signOpen} onClose={() => setSignOpen(false)} />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DocumentsClientPage() {
  // The client sees docs scoped to their own clientId : backend enforces this.
  // No projectId filter here: show all docs across all their projects.
  const { data, isLoading, isError } = useClientDocuments();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-muted-foreground text-center py-20">
        Impossible de charger les documents.
      </p>
    );
  }

  const docs = data?.data ?? [];

  // Group by DocumentType, preserving the canonical order
  const grouped = new Map<DocumentType, Document[]>();
  for (const type of DOC_TYPE_ORDER) {
    const items = docs.filter((d) => d.type === type);
    if (items.length > 0) grouped.set(type, items);
  }

  const total = docs.length;
  // "Completed" = downloaded (has a fileKey) and, for CONTRACT, signed
  const completed = docs.filter((d) => d.fileKey && (d.type !== "CONTRACT" || !!d.signedAt)).length;

  return (
    <section className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes documents</h1>
        {total > 0 && (
          <Badge variant="outline" className="text-base px-3 py-1">
            {completed}/{total} document{total > 1 ? "s" : ""} complétés
          </Badge>
        )}
      </div>

      {grouped.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucun document disponible pour le moment.
          </CardContent>
        </Card>
      ) : (
        Array.from(grouped.entries()).map(([type, items]) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{DOC_TYPE_LABELS[type]}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {items.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </section>
  );
}
