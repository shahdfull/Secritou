import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/utils/format";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Loader2, Download, FileText, CheckCircle2, ArrowRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { documentsApi, Document, DocumentType } from "@/api/documents.api";
import { announce } from "@/lib/a11yAnnounce";

type PortalDocument = Document;

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

function useClientDocuments(projectId?: string) {
  return useQuery({
    queryKey: ["client-documents", projectId],
    queryFn: () => documentsApi.getDocuments({ projectId, pageSize: 100 }),
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

function DownloadButton({ doc }: { doc: PortalDocument }) {
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
  doc: PortalDocument;
  open: boolean;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const signMutation = useSignDocument();

  const handleSign = () => {
    signMutation.mutate(doc.id, {
      onSuccess: () => {
        toast.success("Contrat signé avec succès.");
        announce("Contrat signé avec succès.");
        onClose();
      },
      onError: () => {
        toast.error("La signature a échoué. Veuillez réessayer.");
        announce("La signature du contrat a échoué.");
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
            {(doc.project?.name || doc.projectId) && (
              <p><span className="font-medium">Projet lié :</span> {doc.project?.name ?? doc.projectId}</p>
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
            aria-label="Signer électroniquement le contrat"
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

function DocumentRow({ doc }: { doc: PortalDocument }) {
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
            <Button size="sm" onClick={() => setSignOpen(true)} aria-label={`Signer le contrat ${doc.title}`}>
              Signer
            </Button>
            <SignContractDialog doc={doc} open={signOpen} onClose={() => setSignOpen(false)} />
          </>
        )}
      </div>
    </div>
  );
}

export function DocumentsClientPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;
  const { data, isLoading, isError, refetch } = useClientDocuments(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-20">
        <p className="text-muted-foreground">{t("errors.loadFailed")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const docs = (data?.data ?? []) as PortalDocument[];
  const loadedTotal = data?.data.length ?? 0;
  const totalAvailable = data?.total ?? loadedTotal;
  const grouped = new Map<DocumentType, Document[]>();
  for (const type of DOC_TYPE_ORDER) {
    const items = docs.filter((d) => d.type === type);
    if (items.length > 0) grouped.set(type, items);
  }

  const completed = docs.filter((d) => d.fileKey && (d.type !== "CONTRACT" || !!d.signedAt)).length;
  const hasContract = docs.some((d) => d.type === "CONTRACT");

  return (
    <section className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mes documents</h1>
        {loadedTotal > 0 && (
          <Badge variant="outline" className="text-base px-3 py-1">
            {totalAvailable > loadedTotal
              ? `${completed}/${loadedTotal} document${loadedTotal > 1 ? "s" : ""} complétés (${totalAvailable} au total)`
              : `${completed}/${loadedTotal} document${loadedTotal > 1 ? "s" : ""} complétés`}
          </Badge>
        )}
      </div>

      {grouped.size === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-4">
            <FileText className="h-10 w-10 mx-auto opacity-30" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">Aucun document disponible pour le moment.</p>
              <p className="text-sm max-w-md mx-auto">
                Les documents apparaissent au fil du projet, après la proposition, la préparation du contrat et les étapes de validation.
              </p>
            </div>
            {!hasContract && (
              <p className="text-xs">
                Si vous venez d'accepter une proposition, le contrat peut encore être en cours de génération.
              </p>
            )}
            <Button variant="outline" onClick={() => navigate("/client/projects")}>
              Voir mes projets
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
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