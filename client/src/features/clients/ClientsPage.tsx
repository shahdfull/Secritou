import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClientSchema,
  updateClientSchema,
  type CreateClientForm,
  type UpdateClientForm,
} from "@secritou/shared";
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useRestoreClient,
  useClientTrash,
} from "@/hooks/useClients";
import type { Client } from "@/types/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { toast } from "sonner";
import { useListParams } from "@/hooks/useListParams";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useCrudDialogState } from "@/hooks/shared/useCrudDialogState";

export function ClientsPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const {
    createDialogOpen,
    editDialogOpen,
    editingEntity: editingClient,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
  } = useCrudDialogState<Client>();

  const { page, pageSize, orderBy, orderDir, params, setPage, updateParams } = useListParams(12);
  const { data: clientsResult, isLoading: clientsLoading } = useClients({ ...params, includeArchived });
  const clients = clientsResult?.data ?? [];
  const total = clientsResult?.total ?? 0;
  const { mutate: createClient, isPending: isCreating } = useCreateClient();
  const { mutate: updateClient, isPending: isUpdating } = useUpdateClient();
  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient();
  const { mutate: restoreClient, isPending: isRestoring } = useRestoreClient();
  const { data: trashResult, isLoading: trashLoading } = useClientTrash({ ...params, includeArchived });

  const filteredClients = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(q) ||
        (client.email?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [clients, deferredSearchQuery]);
  const trashedClients = trashResult?.data ?? [];

  const createForm = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  const editForm = useForm<UpdateClientForm>({
    resolver: zodResolver(updateClientSchema),
  });

  const handleCreate = useCallback(async (data: CreateClientForm) => {
    createClient(data, {
      onSuccess: () => {
        closeCreateDialog();
        createForm.reset();
      },
    });
  }, [createClient, createForm, closeCreateDialog]);

  const handleEdit = useCallback((client: Client) => {
    openEditDialog(client);
    editForm.reset(client);
  }, [editForm, openEditDialog]);

  const handleUpdate = useCallback(async (data: UpdateClientForm) => {
    if (!editingClient) return;
    updateClient(
      { id: editingClient.id, data },
      {
        onSuccess: () => {
          closeEditDialog();
        },
      }
    );
  }, [editingClient, updateClient, closeEditDialog]);

  const handleDelete = useCallback((client: Client) => {
    setDeleteTarget(client);
  }, []);

  const handleRestore = useCallback((client: Client) => {
    restoreClient(client.id);
  }, [restoreClient]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteClient(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error: any) => {
        const code = error?.response?.data?.error?.code;
        if (code === "CLIENT_HAS_PROJECTS") {
          toast.error(t("clientsPage.errors.hasProjects"));
        } else if (code === "CLIENT_HAS_INVOICES") {
          toast.error(t("clientsPage.errors.hasInvoices"));
        } else {
          toast.error(t("clientsPage.errors.deleteFailed"));
        }
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, deleteClient, t]);



  if (clientsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{t("clientsPage.title")}</h1>
          <p className="text-muted-foreground">{t("clientsPage.subtitle")}</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(open) => (open ? openCreateDialog() : closeCreateDialog())}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              {t("clientsPage.addClient")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("clientsPage.createClient")}</DialogTitle>
              <DialogDescription>{t("clientsPage.createClientDesc")}</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.name")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("clientsPage.namePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("clientsPage.emailLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("clientsPage.emailPlaceholder")} type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("clientsPage.phoneLabel")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("clientsPage.phonePlaceholder")} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("common.create")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("clientsPage.searchClients")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant={includeArchived ? "default" : "ghost"} onClick={() => setIncludeArchived(!includeArchived)}>
          {t("clientsPage.showArchived")}
        </Button>
        <Button variant={showTrash ? "default" : "ghost"} onClick={() => setShowTrash(!showTrash)}>
          {t("common.trash")}
        </Button>
        <Select
          value={`${orderBy ?? "createdAt"}-${orderDir}`}
          onValueChange={(v) => {
            const [col, dir] = v.split("-") as [string, "asc" | "desc"];
            updateParams({ orderBy: col, orderDir: dir, page: 1 });
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t("common.sortBy")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">{t("common.sort.nameAsc")}</SelectItem>
            <SelectItem value="name-desc">{t("common.sort.nameDesc")}</SelectItem>
            <SelectItem value="createdAt-desc">{t("common.sort.mostRecent")}</SelectItem>
            <SelectItem value="createdAt-asc">{t("common.sort.leastRecent")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showTrash ? (
        <div className="space-y-4 rounded-xl border border-dashed p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">{t("common.trash")}</h2>
              <p className="text-sm text-muted-foreground">{t("clientsPage.trashDesc")}</p>
            </div>
          </div>
          {trashLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : trashedClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("clientsPage.trashEmpty")}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trashedClients.map((client) => (
                <Card key={client.id} className="border-dashed">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{client.name}</CardTitle>
                      <Button variant="secondary" size="sm" onClick={() => handleRestore(client)} disabled={isRestoring}>
                        {t("common.restore")}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {client.email && <div className="text-sm text-muted-foreground">{client.email}</div>}
                    {client.phone && <div className="text-sm text-muted-foreground">{client.phone}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    <Link
                      to={`/app/clients/${client.id}`}
                      className="hover:underline"
                    >
                      {client.name}
                    </Link>
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title={t("common.edit")} onClick={(e) => { e.stopPropagation(); handleEdit(client); }}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title={t("common.delete")} onClick={(e) => { e.stopPropagation(); handleDelete(client); }} disabled={isDeleting}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {client.email && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t("clientsPage.emailLabel")}:</span> {client.email}
                </div>
              )}
              {client.phone && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{t("clientsPage.phoneLabel")}:</span> {client.phone}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {/* Edit Dialog */}
      {editingClient && (
        <Dialog open={editDialogOpen} onOpenChange={closeEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("clientsPage.editClient")}</DialogTitle>
              <DialogDescription>{t("clientsPage.editClientDesc")}</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.name")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("clientsPage.emailLabel")}</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("clientsPage.phoneLabel")}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleConfirmDelete}
        title={`${t("clientsPage.deleteTitle")} "${deleteTarget?.name}" ?`}
        description={t("clientsPage.deleteDescription")}
        isDeleting={isDeleting}
      />
    </div>
  );
}
