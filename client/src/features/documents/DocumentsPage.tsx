import { useState, useRef, useMemo } from "react";
import { formatDate } from "@/utils/format";
import { useAuthStore } from "@/store/auth.store";
import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { toast } from "sonner";
import type { Document } from "@/api/documents.api";
import {
  useDocuments,
  useCreateDocument,
  useDeleteDocument,
} from "@/hooks/useDocuments";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Eye, Download, Plus, Loader2, Trash2 } from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { FileUploadField } from "@/components/common/FileUploadField";
import { useListParams } from "@/hooks/useListParams";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { UploadResult } from "@/api/upload.api";

const ALL_TYPES_VALUE = "__all__";

const createDocSchema = z.object({
  name: z.string().min(1, "common.nameRequired"),
  description: z.string().optional(),
  type: z.enum(["CONTRACT", "DELIVERABLE", "GUIDE", "REPORT", "INVOICE", "OTHER", "WELCOME_LETTER", "SPECS", "CLIENT_BRIEF", "QUOTE", "INVOICE_DEPOSIT", "INVOICE_BALANCE", "ROADMAP"]),
  accessLevel: z.enum(["ADMIN_ONLY", "ADMIN_FREELANCER", "CLIENT_ADMIN", "ALL"]),
  tags: z.string().optional(),
});
type CreateDocForm = z.infer<typeof createDocSchema>;

export function DocumentsPage() {
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);
  const isFreelancer = currentUser?.role === "FREELANCER";
  const docSchema = z.object({
    name: z.string().min(1, t("common.nameRequired")),
    description: z.string().optional(),
    type: z.enum(["CONTRACT", "DELIVERABLE", "GUIDE", "REPORT", "INVOICE", "OTHER", "WELCOME_LETTER", "SPECS", "CLIENT_BRIEF", "QUOTE", "INVOICE_DEPOSIT", "INVOICE_BALANCE", "ROADMAP"]),
    accessLevel: z.enum(["ADMIN_ONLY", "ADMIN_FREELANCER", "CLIENT_ADMIN", "ALL"]),
    tags: z.string().optional(),
  });
  const { page, pageSize, search, status, updateParams } = useListParams(10);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDocTarget, setDeleteDocTarget] = useState<Document | null>(null);
  const uploadedFile = useRef<UploadResult | null>(null);

  const { data: documentsResult, isLoading } = useDocuments({
    page,
    pageSize,
    search,
    type: status,
  });

  const documents = useMemo(
    () => Array.isArray(documentsResult?.data) ? documentsResult.data : [],
    [documentsResult?.data]
  );

  const deleteMutation = useDeleteDocument();
  const createMutation = useCreateDocument();

  const form = useForm<CreateDocForm>({
    resolver: zodResolver(docSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "OTHER",
      accessLevel: "CLIENT_ADMIN",
      tags: "",
    },
  });

  const handleCreate = (data: CreateDocForm) => {
    if (!uploadedFile.current) {
      toast.error(t("toasts.uploadFileFirst"));
      return;
    }

    createMutation.mutate(
      {
        name: data.name,
        title: data.name,
        description: data.description,
        type: data.type,
        accessLevel: data.accessLevel,
        url: uploadedFile.current.url,
        fileUrl: uploadedFile.current.url,
        fileKey: uploadedFile.current.key,
        tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          form.reset();
          uploadedFile.current = null;
        },
      }
    );
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("documents.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("documents.subtitle")}
          </p>
        </div>
        {!isFreelancer && (
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-ink text-white hover:bg-ink/90 rounded-full">
            <Plus className="h-4 w-4 mr-2" />
            {t("documents.add")}
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={t("documents.search")}
          value={search || ""}
          onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
          className="max-w-sm"
        />
        <Select
          value={status || ALL_TYPES_VALUE}
          onValueChange={(value) =>
            updateParams({ status: value === ALL_TYPES_VALUE ? undefined : value, page: 1 })
          }
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder={t("documents.filterByType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES_VALUE}>{t("documents.allTypes")}</SelectItem>
            <SelectItem value="CONTRACT">{t("documents.types.contract")}</SelectItem>
            <SelectItem value="DELIVERABLE">{t("documents.types.deliverable")}</SelectItem>
            <SelectItem value="GUIDE">{t("documents.types.guide")}</SelectItem>
            <SelectItem value="REPORT">{t("documents.types.report")}</SelectItem>
            <SelectItem value="INVOICE">{t("documents.types.invoice")}</SelectItem>
            <SelectItem value="OTHER">{t("documents.types.other")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("documents.name")}</TableHead>
              <TableHead>{t("documents.client")}</TableHead>
              <TableHead>{t("documents.type")}</TableHead>
              <TableHead>{t("documents.version")}</TableHead>
              <TableHead>{t("documents.tags")}</TableHead>
              <TableHead>{t("documents.date")}</TableHead>
              <TableHead className="text-right">{t("documents.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : documents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  {t("documents.empty")}
                </TableCell>
              </TableRow>
            ) : (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  <TableCell>{doc.client?.name || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {t(`documents.types.${doc.type?.toLowerCase() || 'other'}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{doc.version}</TableCell>
                  <TableCell>
                    {doc.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="mr-1">
                        {tag}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    {formatDate(doc.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("documents.view")} onClick={() => window.open(doc.url, "_blank")}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title={t("documents.download")} onClick={() => { const a = document.createElement("a"); a.href = doc.url; a.download = doc.name; a.target = "_blank"; a.click(); }}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {!isFreelancer && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title={t("documents.delete")} onClick={() => setDeleteDocTarget(doc)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {documentsResult && Number.isFinite(documentsResult.total) && (
        <DataTablePagination
          page={documentsResult.page}
          pageSize={documentsResult.pageSize}
          total={documentsResult.total}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
        />
      )}

      {/* Create document dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            form.reset();
            uploadedFile.current = null;
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("documents.addTitle")}</DialogTitle>
            <DialogDescription>{t("documents.addDescription")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("documents.name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("documents.namePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("documents.descriptionLabel")}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("documents.type")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="CONTRACT">{t("documents.types.contract")}</SelectItem>
                          <SelectItem value="DELIVERABLE">{t("documents.types.deliverable")}</SelectItem>
                          <SelectItem value="GUIDE">{t("documents.types.guide")}</SelectItem>
                          <SelectItem value="REPORT">{t("documents.types.report")}</SelectItem>
                          <SelectItem value="INVOICE">{t("documents.types.invoice")}</SelectItem>
                          <SelectItem value="OTHER">{t("documents.types.other")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accessLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("documents.accessLevel")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ADMIN_ONLY">Admin only</SelectItem>
                          <SelectItem value="ADMIN_FREELANCER">Admin + Freelancer</SelectItem>
                          <SelectItem value="CLIENT_ADMIN">Client + Admin</SelectItem>
                          <SelectItem value="ALL">All</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("documents.tagsLabel")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("documents.tagsPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* File upload */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("documents.file")}</label>
                <FileUploadField
                  context="document"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                  label={t("documents.uploadFile")}
                  uploadImmediately={true}
                  onUploaded={(result) => {
                    if (result && 'key' in result) {
                      uploadedFile.current = result as UploadResult;
                    }
                  }}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteDocTarget}
        onOpenChange={(open) => { if (!open) setDeleteDocTarget(null); }}
        onConfirm={() => {
          if (!deleteDocTarget) return;
          deleteMutation.mutate(deleteDocTarget.id, {
            onSuccess: () => { setDeleteDocTarget(null); toast.success("Document supprimé."); },
            onError: () => { toast.error("Erreur lors de la suppression."); setDeleteDocTarget(null); },
          });
        }}
        title={`Supprimer "${deleteDocTarget?.name}" ?`}
        description="Cette action est irréversible. Le document sera définitivement supprimé."
        isDeleting={deleteMutation.isPending}
      />
    </section>
  );
}