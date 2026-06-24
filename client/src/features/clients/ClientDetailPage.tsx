import { useParams, useNavigate } from "react-router-dom";
import { useClient, useDeleteClient, useArchiveClient, useInviteClientUser } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientOnboardingByClientId, useCreateClientOnboarding } from "@/hooks/useClientOnboarding";
import { useProposals } from "@/hooks/useProposals";
import { useInvoices } from "@/hooks/useInvoices";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Edit, Trash2, Archive, Plus, Download, Star, ExternalLink, Mail, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi, type Document } from "@/api/documents.api";
import { useTranslation } from "react-i18next";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { FileUploadField } from "@/components/common/FileUploadField";
import type { UploadResult } from "@/api/upload.api";

type DocumentForm = {
  name: string;
  type: "INVOICE" | "CONTRACT" | "OTHER";
};

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

export function ClientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: client, isLoading } = useClient(id ?? "");
  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient();
  const { mutate: archiveClient, isPending: isArchiving } = useArchiveClient();
  const inviteClientUser = useInviteClientUser(id ?? "");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addDocumentDialogOpen, setAddDocumentDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
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

  const addDocumentMutation = useMutation({
    mutationFn: (data: Omit<Document, "id" | "createdAt" | "updatedAt">) =>
      documentsApi.createDocument({ ...data, clientId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientDocuments", id] });
      toast.success(t("toasts.documentAdded"));
      setAddDocumentDialogOpen(false);
      documentForm.reset();
      uploadedFile.current = null;
    },
  });

  const documentFormSchema = z.object({
    name: z.string().min(1, t("common.nameRequired")),
    type: z.enum(["INVOICE", "CONTRACT", "OTHER"]),
  });
  const documentForm = useForm<DocumentForm>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: { name: "", type: "OTHER" },
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
            toast.error(
              t(
                "clientsPage.detail.deleteBlockedHasInvoices",
                "Ce client a des factures et ne peut pas être supprimé. Archivez-le à la place."
              )
            );
            setDeleteDialogOpen(false);
          }
        },
      });
    }
  };

  const handleArchive = () => {
    if (id) {
      archiveClient(id, {
        onSuccess: () => navigate("/app/crm"),
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
    await inviteClientUser.mutateAsync({ email: inviteEmail, name: inviteName });
    setInviteDialogOpen(false);
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
      accessLevel: "CLIENT_ADMIN" as any,
      uploadedById: "",
    });
  };

  const getDocumentTypeLabel = (doc: Document) => {
    switch (doc.type) {
      case "INVOICE": return t("clientsPage.detail.typeInvoice");
      case "CONTRACT": return t("clientsPage.detail.typeContract");
      case "OTHER": return t("clientsPage.detail.typeOther");
      default: return "Document";
    }
  };

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
          Retour aux clients
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
                Portail actif
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
              Inviter au portail
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate(`/app/client-success/${client.id}`)}>
            <Star className="h-4 w-4 mr-2" />
            Client Success
          </Button>
          <Button variant="outline" onClick={handleArchive} disabled={isArchiving}>
            {isArchiving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
            {t("clientsPage.detail.archive", "Archiver")}
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
        </div>
      </div>

      {/* Hub Tabs */}
      <Tabs defaultValue="info" className="space-y-4">
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
                    {client.createdAt ? format(new Date(client.createdAt), "dd MMM yyyy", { locale: fr }) : ":"}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.title")}</TableHead>
                      <TableHead>{t("invoices.amount")}</TableHead>
                      <TableHead>{t("applications.date")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposals.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.title}</TableCell>
                        <TableCell>{p.amount != null ? `${p.amount} ${p.currency}` : ":"}</TableCell>
                        <TableCell>{format(new Date(p.createdAt), "dd/MM/yyyy", { locale: fr })}</TableCell>
                        <TableCell>
                          <Badge className={PROPOSAL_STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-800"}>
                            {p.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("clientsPage.detail.number")}</TableHead>
                      <TableHead>{t("common.title")}</TableHead>
                      <TableHead>{t("invoices.amount")}</TableHead>
                      <TableHead>{t("clientsPage.detail.dueDate")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.number}</TableCell>
                        <TableCell className="font-medium">{inv.title}</TableCell>
                        <TableCell>{inv.amount} {inv.currency}</TableCell>
                        <TableCell>
                          {inv.dueDate ? format(new Date(inv.dueDate), "dd/MM/yyyy", { locale: fr }) : ":"}
                        </TableCell>
                        <TableCell>
                          <Badge className={INVOICE_STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-800"}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
                    <Button
                      onClick={() =>
                        createOnboarding.mutate(
                          { projectId: client.projects![0].id },
                          { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["clientOnboardingByClient", id] }) }
                        )
                      }
                      disabled={createOnboarding.isPending}
                    >
                      {createOnboarding.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Plus className="h-4 w-4 mr-2" />
                      {t("clientsPage.detail.createOnboarding")}
                    </Button>
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.name")}</TableHead>
                      <TableHead>{t("enhancedDocuments.type")}</TableHead>
                      <TableHead>{t("applications.date")}</TableHead>
                      <TableHead className="text-right">{t("clientsPage.detail.action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((doc: Document) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getDocumentTypeLabel(doc)}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(doc.createdAt), "dd/MM/yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => window.open(doc.url, "_blank")}>
                            <Download className="h-4 w-4 mr-2" />
                            {t("clientsPage.detail.download")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">{t("clientsPage.detail.noDocuments")}</p>
              )}
            </CardContent>
          </Card>
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
                    <FormLabel>{t("enhancedDocuments.type")}</FormLabel>
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
    </div>
  );
}
