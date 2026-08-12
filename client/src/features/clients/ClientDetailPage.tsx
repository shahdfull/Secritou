import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { formatNumber } from "@/utils/format";
import {
  useClient,
  useDeleteClient,
  useArchiveClient,
  useInviteClientUser,
  useGdprExportClient,
  useGdprEraseClient,
} from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchConsoleTab } from "./components/SearchConsoleTab";
import { useClientOnboardingByClientId, useCreateClientOnboarding } from "@/hooks/useClientOnboarding";
import { useProposals } from "@/hooks/useProposals";
import type { Proposal } from "@/api/proposals.api";
import { useInvoices } from "@/hooks/useInvoices";
import type { Invoice } from "@/api/invoices.api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2, Archive, Plus, Download, Star, ExternalLink, Mail, CheckCircle2, ShieldOff } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi, type Document } from "@/api/documents.api";
import { useTranslation } from "react-i18next";
import apiClient from "@/api/axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { AgGridReact } from "ag-grid-react";
import "@/lib/agGridModules";
import {
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileUploadField } from "@/components/common/FileUploadField";
import type { UploadResult } from "@/api/upload.api";
import { documentSchema } from "@secritou/shared";
import type { Project } from "@/types/project";
import { getServerErrorMessage, getServerRequestId } from "@/utils/apiError";

type CreditNote = {
  id: string;
  number: string;
  amount: number | string;
  reason?: string;
  appliedAt?: string | null;
  createdAt: string;
  invoice?: { number: string } | null;
  appliedToInvoice?: { number: string } | null;
};

type DocumentForm = z.infer<typeof documentFormSchema>;
const documentFormSchema = documentSchema.pick({ name: true, type: true });

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  VIEWED: "bg-yellow-100 text-yellow-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-orange-100 text-orange-800",
};

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  SENT: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  PARTIAL: "bg-yellow-100 text-yellow-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};


// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

export function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const hasGscCallbackParams = searchParams.has("gscPendingId") || searchParams.has("gscError");
  const queryClient = useQueryClient();
  const { data: client, isLoading } = useClient(id ?? "");
  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient();
  const { mutate: archiveClient, isPending: isArchiving } = useArchiveClient();
  const { mutate: gdprExportClient, isPending: isGdprExporting } = useGdprExportClient();
  const { mutate: gdprEraseClient, isPending: isGdprErasing } = useGdprEraseClient();
  const inviteClientUser = useInviteClientUser(id ?? "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [gdprEraseDialogOpen, setGdprEraseDialogOpen] = useState(false);
  const [addDocumentDialogOpen, setAddDocumentDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [selectedOnboardingProjectId, setSelectedOnboardingProjectId] = useState<string>("");
  const { data: onboarding, isLoading: onboardingLoading } = useClientOnboardingByClientId(id ?? "");
  const createOnboarding = useCreateClientOnboarding();

  const { data: proposalsResult, isLoading: proposalsLoading } = useProposals({
    clientId: id,
    pageSize: 50,
  });
  const proposals = proposalsResult?.data ?? [];

  const { data: invoicesResult, isLoading: invoicesLoading } = useInvoices({
    clientId: id,
    pageSize: 50,
  });
  const invoices = invoicesResult?.data ?? [];

  const uploadedFile = useRef<UploadResult | null>(null);

  const { data: documentsResult } = useQuery({
    queryKey: ["clientDocuments", id],
    queryFn: () => (id ? documentsApi.getDocuments({ clientId: id }) : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 10 })),
    enabled: !!id,
  });
  const documents = documentsResult?.data ?? [];

  const { data: creditNotesResult, isLoading: creditNotesLoading } = useQuery({
    queryKey: ["clientCreditNotes", id],
    queryFn: async () => {
      if (!id) return { data: [] };
      const res = await apiClient.get<{ data: CreditNote[] }>(`/clients/${id}/credit-notes`);
      return res.data;
    },
    enabled: !!id,
  });
  const creditNotes = creditNotesResult?.data ?? [];

  const addDocumentMutation = useMutation({
    mutationFn: (data: Parameters<typeof documentsApi.createDocument>[0]) =>
      documentsApi.createDocument({ ...data, clientId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientDocuments", id] });
      toast.success(t("toasts.documentAdded"));
      setAddDocumentDialogOpen(false);
      documentForm.reset();
      uploadedFile.current = null;
    },
  });

  const documentForm = useForm<DocumentForm>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: { name: "", type: "OTHER" },
  });

  const downloadDocumentMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.getDownloadUrl(documentId),
    onSuccess: ({ url }) => window.open(url, "_blank"),
  });

  const handleDelete = () => {
    if (id) {
      deleteClient(id, {
        onSuccess: () => navigate("/app/crm"),
        onError: (err) => {
          // Backend blocks deletion when the client has invoices (CLIENT_HAS_INVOICES).
          // Steer the user toward archiving, which preserves the financial records.
          const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
          if (code === "CLIENT_HAS_INVOICES") {
            toast.error(t("clientsPage.detail.deleteBlockedHasInvoices"));
          } else if (code === "CLIENT_HAS_PROJECTS") {
            toast.error(t("clientsPage.errors.hasProjects"));
          } else {
            toast.error(t("clientsPage.errors.deleteFailed", "Une erreur est survenue."));
          }
          setDeleteDialogOpen(false);
        },
      });
    }
  };

  const handleArchive = () => {
    if (id) {
      archiveClient(id, {
        onSuccess: () => {
          setArchiveDialogOpen(false);
          navigate("/app/crm");
        },
      });
    }
  };

  const handleGdprExport = () => {
    if (id) gdprExportClient(id);
  };

  const handleGdprErase = () => {
    if (id) {
      gdprEraseClient(id, {
        onSuccess: (result) => {
          setGdprEraseDialogOpen(false);
          if (result.mode === "deleted") navigate("/app/crm");
        },
      });
    }
  };

  const portalUser = client?.users?.[0];

  function openInviteDialog() {
    setInviteEmail(client?.email ?? "");
    setInviteName(client?.name ?? "");
    setInviteDialogOpen(true);
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteName) return;
    try {
      await inviteClientUser.mutateAsync({ email: inviteEmail, name: inviteName });
      setInviteDialogOpen(false);
    } catch (error) {
      const message = getServerErrorMessage(error) ?? t("toasts.genericError");
      const requestId = getServerRequestId(error);
      toast.error(requestId ? `${message} (ref. ${requestId})` : message);
    }
  }

  const handleAddDocument = (data: DocumentForm) => {
    if (!uploadedFile.current) {
      toast.error(t("toasts.uploadFileFirst"));
      return;
    }
    addDocumentMutation.mutate({
      name: data.name,
      title: data.name,
      type: data.type,
      url: uploadedFile.current.url,
      fileUrl: uploadedFile.current.url,
      fileKey: uploadedFile.current.key,
      clientId: id,
      version: 1,
      tags: [],
      accessLevel: "CLIENT_ADMIN",
    });
  };

  const getDocumentTypeLabel = useCallback(
    (doc: Document) => {
      switch (doc.type) {
        case "INVOICE": return t("clientsPage.detail.typeInvoice");
        case "CONTRACT": return t("clientsPage.detail.typeContract");
        case "OTHER": return t("clientsPage.detail.typeOther");
        default: return "Document";
      }
    },
    [t]
  );

  const proposalStatusRenderer = useCallback((params: ICellRendererParams<Proposal>) => {
    const p = params.data;
    if (!p) return null;
    return (
      <div className="flex h-full items-center">
        <Badge className={PROPOSAL_STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-800"}>{p.status}</Badge>
      </div>
    );
  }, []);

  const proposalColumnDefs = useMemo<ColDef<Proposal>[]>(
    () => [
      { headerName: t("common.title"), field: "title", flex: 1, cellClass: "font-medium" },
      { headerName: t("invoices.amount"), valueGetter: (p) => (p.data?.amount != null ? `${p.data.amount} ${p.data.currency}` : ":"), flex: 1 },
      { headerName: t("applications.date"), valueFormatter: (p) => format(new Date(p.data!.createdAt), "dd/MM/yyyy", { locale: fr }), field: "createdAt", flex: 1 },
      { headerName: t("common.status"), cellRenderer: proposalStatusRenderer, flex: 1 },
    ],
    [t, proposalStatusRenderer]
  );

  const invoiceStatusRenderer = useCallback((params: ICellRendererParams<Invoice>) => {
    const inv = params.data;
    if (!inv) return null;
    return (
      <div className="flex h-full items-center">
        <Badge className={INVOICE_STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-800"}>{inv.status}</Badge>
      </div>
    );
  }, []);

  const invoiceColumnDefs = useMemo<ColDef<Invoice>[]>(
    () => [
      { headerName: t("clientsPage.detail.number"), field: "number", flex: 1, cellClass: "font-mono text-sm" },
      { headerName: t("common.title"), field: "title", flex: 1, cellClass: "font-medium" },
      { headerName: t("invoices.amount"), valueFormatter: (p) => `${p.data!.amount} ${p.data!.currency}`, field: "amount", flex: 1 },
      { headerName: t("clientsPage.detail.dueDate"), valueFormatter: (p) => (p.data?.dueDate ? format(new Date(p.data.dueDate), "dd/MM/yyyy", { locale: fr }) : ":"), field: "dueDate", flex: 1 },
      { headerName: t("common.status"), cellRenderer: invoiceStatusRenderer, flex: 1 },
    ],
    [t, invoiceStatusRenderer]
  );

  const documentTypeRenderer = useCallback(
    (params: ICellRendererParams<Document>) => {
      const doc = params.data;
      if (!doc) return null;
      return (
        <div className="flex h-full items-center">
          <Badge variant="outline">{getDocumentTypeLabel(doc)}</Badge>
        </div>
      );
    },
    [getDocumentTypeLabel]
  );

  const documentActionRenderer = useCallback(
    (params: ICellRendererParams<Document>) => {
      const doc = params.data;
      if (!doc) return null;
      return (
        <div className="flex h-full items-center justify-end">
          <Button variant="ghost" size="sm" onClick={() => downloadDocumentMutation.mutate(doc.id)}>
            <Download className="h-4 w-4 mr-2" />
            {t("clientsPage.detail.download")}
          </Button>
        </div>
      );
    },
    [t, downloadDocumentMutation]
  );

  const documentColumnDefs = useMemo<ColDef<Document>[]>(
    () => [
      { headerName: t("common.name"), field: "name", flex: 1, cellClass: "font-medium" },
      { headerName: t("documents.type"), cellRenderer: documentTypeRenderer, flex: 1 },
      { headerName: t("applications.date"), valueFormatter: (p) => format(new Date(p.data!.createdAt), "dd/MM/yyyy", { locale: fr }), field: "createdAt", flex: 1 },
      { headerName: t("clientsPage.detail.action"), cellRenderer: documentActionRenderer, width: 160, sortable: false, resizable: false },
    ],
    [t, documentTypeRenderer, documentActionRenderer]
  );

  const creditNoteAppliedRenderer = useCallback(
    (params: ICellRendererParams<CreditNote>) => {
      const cn = params.data;
      if (!cn) return null;
      return (
        <div className="flex h-full items-center">
          {cn.appliedAt ? (
            <Badge className="bg-green-100 text-green-800">
              {t("clientsPage.detail.creditNotes.appliedOn", { date: format(new Date(cn.appliedAt), "dd/MM/yyyy", { locale: fr }) })}
            </Badge>
          ) : (
            <Badge className="bg-yellow-100 text-yellow-800">{t("clientsPage.detail.creditNotes.available")}</Badge>
          )}
        </div>
      );
    },
    [t]
  );

  const creditNoteColumnDefs = useMemo<ColDef<CreditNote>[]>(
    () => [
      { headerName: t("clientsPage.detail.creditNotes.number"), field: "number", flex: 1, cellClass: "font-mono text-sm" },
      { headerName: t("clientsPage.detail.creditNotes.amount"), valueFormatter: (p) => `${formatNumber(Number(p.data!.amount), { minimumFractionDigits: 2 })} TND`, field: "amount", flex: 1, cellClass: "font-semibold text-emerald-600" },
      { headerName: t("clientsPage.detail.creditNotes.reason"), field: "reason", flex: 1, tooltipField: "reason" },
      { headerName: t("clientsPage.detail.creditNotes.originInvoice"), valueGetter: (p) => p.data?.invoice?.number || "-", flex: 1, cellClass: "font-mono text-sm" },
      { headerName: t("clientsPage.detail.creditNotes.appliedInvoice"), valueGetter: (p) => p.data?.appliedToInvoice?.number || "-", flex: 1, cellClass: "font-mono text-sm" },
      { headerName: t("clientsPage.detail.creditNotes.applicationStatus"), cellRenderer: creditNoteAppliedRenderer, flex: 1 },
      { headerName: t("clientsPage.detail.creditNotes.issueDate"), valueFormatter: (p) => format(new Date(p.data!.createdAt), "dd/MM/yyyy", { locale: fr }), field: "createdAt", flex: 1 },
    ],
    [t, creditNoteAppliedRenderer]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <h2 className="text-xl font-bold">{t("clientsPage.detail.notFound")}</h2>
        <Button onClick={() => navigate("/app/crm")} className="mt-4">
          {t("clientsPage.detail.backToClients")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink">{client.name}</h1>
            {portalUser ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <CheckCircle2 className="h-3 w-3" />
                {t("clientsPage.detail.portalActive")}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground">
            {client.email && <span className="mr-4">{client.email}</span>}
            {client.phone && <span>{client.phone}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {!portalUser && (
            <Button variant="outline" onClick={openInviteDialog}>
              <Mail className="h-4 w-4 mr-2" />
              {t("clientsPage.detail.inviteToPortalBtn")}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/app/client-success/${client.id}`)}>
            <Star className="h-4 w-4 mr-2" />
            {t("clientsPage.detail.clientSuccess")}
          </Button>
          <Button variant="outline" onClick={() => setArchiveDialogOpen(true)} disabled={isArchiving}>
            {isArchiving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
            {t("clientsPage.detail.archive")}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t("clientsPage.detail.delete")}
          </Button>
          <Button variant="outline" onClick={handleGdprExport} disabled={isGdprExporting}>
            {isGdprExporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {t("clientsPage.detail.gdprExport")}
          </Button>
          <Button variant="destructive" onClick={() => setGdprEraseDialogOpen(true)}>
            <ShieldOff className="h-4 w-4 mr-2" />
            {t("clientsPage.detail.gdprErase")}
          </Button>
        </div>
      </div>

      {/* Hub Tabs */}
      <Tabs defaultValue={hasGscCallbackParams ? "performance" : "info"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="info">{t("clientsPage.detail.tabInfo")}</TabsTrigger>
          <TabsTrigger value="proposals">
            {t("clientsPage.detail.proposals")}
            {proposals.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px]">{proposals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="invoices">
            {t("clientsPage.detail.invoices")}
            {invoices.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px]">{invoices.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="projects">
            {t("clientsPage.detail.projects")}
            {client.projects && client.projects.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px]">{client.projects.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="onboarding">{t("clientsPage.detail.tabOnboarding")}</TabsTrigger>
          <TabsTrigger value="documents">
            {t("clientsPage.detail.documents")}
            {documents && documents.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px]">{documents.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="credit-notes">
            {t("clientsPage.detail.tabCreditNotes")}
            {creditNotes.length > 0 && (
              <Badge className="ml-1.5 h-4 px-1.5 text-[10px]">{creditNotes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="performance">{t("clientsPage.detail.tabPerformance")}</TabsTrigger>
        </TabsList>

        {/* ── Informations ── */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle>{t("clientsPage.detail.clientInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("common.name")}</p>
                  <p className="font-medium">{client.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("common.email")}</p>
                  <p className="font-medium">{client.email || ":"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("common.phone")}</p>
                  <p className="font-medium">{client.phone || ":"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clientsPage.detail.clientSince")}</p>
                  <p className="font-medium">
                    {client.createdAt ? format(new Date(client.createdAt), "dd MMM yyyy", { locale: fr }) : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("clientsPage.detail.creditBalance")}</p>
                  <p className="font-medium text-emerald-600 font-mono">
                    {formatNumber(Number(client.creditBalance || 0), { minimumFractionDigits: 2 })} TND
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Propositions ── */}
        <TabsContent value="proposals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("clientsPage.detail.proposals")}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => navigate("/app/commercial")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("clientsPage.detail.manageInCommercial")}
              </Button>
            </CardHeader>
            <CardContent>
              {proposalsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : proposals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("clientsPage.detail.noProposals")}</p>
              ) : (
                <div style={{ height: 350 }}>
                  <AgGridReact<Proposal>
                    theme={gridTheme}
                    rowData={proposals}
                    columnDefs={proposalColumnDefs}
                    suppressCellFocus
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Factures ── */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("clientsPage.detail.invoices")}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => navigate("/app/commercial")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("clientsPage.detail.manageInCommercial")}
              </Button>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("clientsPage.detail.noInvoices")}</p>
              ) : (
                <div style={{ height: 350 }}>
                  <AgGridReact<Invoice>
                    theme={gridTheme}
                    rowData={invoices}
                    columnDefs={invoiceColumnDefs}
                    suppressCellFocus
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Projets ── */}
        <TabsContent value="projects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("clientsPage.detail.projects")}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => navigate("/app/projects")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                {t("clientsPage.detail.viewAllProjects")}
              </Button>
            </CardHeader>
            <CardContent>
              {client.projects && client.projects.length > 0 ? (
                <div className="space-y-2">
                  {client.projects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{project.name}</p>
                        <p className="text-sm text-muted-foreground">{project.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{t("clientsPage.detail.noProjects")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Onboarding ── */}
        <TabsContent value="onboarding">
          <Card>
            <CardHeader>
              <CardTitle>{t("clientsPage.detail.tabOnboarding")}</CardTitle>
            </CardHeader>
            <CardContent>
              {onboardingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : onboarding ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t("clientsPage.detail.projectLabel", { name: onboarding.project?.name ?? ":" })}</p>
                      <p className="text-sm text-muted-foreground">
                        {t("clientsPage.detail.createdOn", { date: format(new Date(onboarding.createdAt), "dd/MM/yyyy", { locale: fr }) })}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => navigate(`/app/client-onboarding/${onboarding.id}`)}>
                      {t("clientsPage.detail.viewDetail")}
                    </Button>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    {onboarding.steps?.map((step) => (
                      <div key={step.id} className="flex items-center justify-between p-3 border rounded-md">
                        <span className="font-medium text-sm">{step.title}</span>
                        <Badge
                          className={
                            step.status === "COMPLETED" ? "bg-green-100 text-green-800"
                            : step.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800"
                            : step.status === "REJECTED" ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                          }
                        >
                          {step.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <p className="text-muted-foreground">{t("clientsPage.detail.noOnboarding")}</p>
                  {client.projects && client.projects.length > 0 ? (
                    <div className="flex flex-col gap-2 w-full max-w-xs">
                      <Select value={selectedOnboardingProjectId} onValueChange={setSelectedOnboardingProjectId}>
                        <SelectTrigger>
                          <SelectValue placeholder={t("common.selectProject")} />
                        </SelectTrigger>
                        <SelectContent>
                          {client.projects.map((p: Project) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() =>
                          createOnboarding.mutate(
                            { projectId: selectedOnboardingProjectId },
                            { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clientOnboardingByClient", id] }) }
                          )
                        }
                        disabled={!selectedOnboardingProjectId || createOnboarding.isPending}
                      >
                        {createOnboarding.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Plus className="h-4 w-4 mr-2" />
                        {t("clientsPage.detail.createOnboarding")}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("clientsPage.detail.linkProjectFirst")}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("clientsPage.detail.documents")}</CardTitle>
              <Button size="sm" onClick={() => setAddDocumentDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("clientsPage.detail.add")}
              </Button>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div style={{ height: 350 }}>
                  <AgGridReact<Document>
                    theme={gridTheme}
                    rowData={documents}
                    columnDefs={documentColumnDefs}
                    suppressCellFocus
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{t("clientsPage.detail.noDocuments")}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Avoirs ── */}
        <TabsContent value="credit-notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("clientsPage.detail.creditNotes.title")}</CardTitle>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">{t("clientsPage.detail.creditNotes.availableBalance")}</span>
                <p className="text-lg font-bold text-emerald-600 font-mono">
                  {formatNumber(Number(client.creditBalance || 0), { minimumFractionDigits: 2 })} TND
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {creditNotesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : creditNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t("clientsPage.detail.creditNotes.empty")}</p>
              ) : (
                <div style={{ height: 350 }}>
                  <AgGridReact<CreditNote>
                    theme={gridTheme}
                    rowData={creditNotes}
                    columnDefs={creditNoteColumnDefs}
                    suppressCellFocus
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Performance (Search Console) ── */}
        <TabsContent value="performance">
          <SearchConsoleTab clientId={client.id} />
        </TabsContent>
      </Tabs>

      {/* Add document dialog */}
      <Dialog
        open={addDocumentDialogOpen}
        onOpenChange={(open) => {
          setAddDocumentDialogOpen(open);
          if (!open) { documentForm.reset(); uploadedFile.current = null; }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clientsPage.detail.addDocument")}</DialogTitle>
            <DialogDescription>{t("clientsPage.detail.addDocumentDesc")}</DialogDescription>
          </DialogHeader>
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit(handleAddDocument)} className="space-y-4">
              <FormField
                control={documentForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("clientsPage.detail.documentName")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("clientsPage.detail.documentNamePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={documentForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("documents.type")}</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("clientsPage.detail.selectType")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INVOICE">{t("clientsPage.detail.typeInvoice")}</SelectItem>
                        <SelectItem value="CONTRACT">{t("clientsPage.detail.typeContract")}</SelectItem>
                        <SelectItem value="OTHER">{t("clientsPage.detail.typeOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>{t("clientsPage.detail.file")}</FormLabel>
                <FileUploadField
                  context="document"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                  label={t("clientsPage.detail.uploadFileLabel")}
                  uploadImmediately={true}
                  onUploaded={(result) => { uploadedFile.current = result as UploadResult; }}
                />
              </FormItem>
              <DialogFooter>
                <Button type="submit" disabled={addDocumentMutation.isPending}>
                  {addDocumentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("clientsPage.detail.add")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Invite to portal dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => !open && setInviteDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("clientsPage.detail.inviteToPortal")}</DialogTitle>
            <DialogDescription>
              {t("clientsPage.detail.inviteEmailDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="invite-name">{t("common.name")}</label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={t("clientsPage.detail.contactNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="invite-email">{t("common.email")}</label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder={t("clientsPage.detail.emailPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={handleInvite}
              disabled={inviteClientUser.isPending || !inviteEmail || !inviteName}
            >
              {inviteClientUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Mail className="h-4 w-4 mr-2" />
              {t("clientsPage.detail.sendInvitation")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive client dialog */}
      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clientsPage.detail.archiveClientTitle")}</DialogTitle>
            <DialogDescription>
              {t("clientsPage.detail.archiveClientDesc", { name: client.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleArchive} disabled={isArchiving}>
              {isArchiving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Archive className="h-4 w-4 mr-2" />
              {t("clientsPage.detail.archive")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete client dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clientsPage.detail.deleteClient")}</DialogTitle>
            <DialogDescription>
              {t("clientsPage.detail.deleteClientDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GDPR erase dialog (RG-025) */}
      <Dialog open={gdprEraseDialogOpen} onOpenChange={setGdprEraseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clientsPage.detail.gdprErase")}</DialogTitle>
            <DialogDescription>
              {t("clientsPage.detail.gdprEraseDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGdprEraseDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={handleGdprErase} disabled={isGdprErasing}>
              {isGdprErasing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("clientsPage.detail.gdprErase")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
