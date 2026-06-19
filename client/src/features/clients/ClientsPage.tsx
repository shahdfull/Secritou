import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MoreHorizontal,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
} from "lucide-react";
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useListParams } from "@/hooks/useListParams";
import { DataTablePagination } from "@/components/common/DataTablePagination";

const createClientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
});

const updateClientSchema = createClientSchema.partial();

type CreateClientForm = z.infer<typeof createClientSchema>;
type UpdateClientForm = z.infer<typeof updateClientSchema>;

export function ClientsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const { page, pageSize, orderBy, orderDir, params, setPage, updateParams } = useListParams(12);
  const { data: clientsResult, isLoading: clientsLoading } = useClients(params);
  const clients = clientsResult?.data ?? [];
  const total = clientsResult?.total ?? 0;
  const { mutate: createClient, isPending: isCreating } = useCreateClient();
  const { mutate: updateClient, isPending: isUpdating } = useUpdateClient();
  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient();

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

  const createForm = useForm<CreateClientForm>({
    resolver: zodResolver(createClientSchema) as any,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
    },
  });

  const editForm = useForm<UpdateClientForm>({
    resolver: zodResolver(updateClientSchema) as any,
  });

  const handleCreate = useCallback(async (data: CreateClientForm) => {
    createClient(data, {
      onSuccess: () => {
        setCreateDialogOpen(false);
        createForm.reset();
      },
    });
  }, [createClient, createForm]);

  const handleEdit = useCallback((client: Client) => {
    setEditingClient(client);
    editForm.reset(client);
    setEditDialogOpen(true);
  }, [editForm]);

  const handleUpdate = useCallback(async (data: UpdateClientForm) => {
    if (!editingClient) return;
    updateClient(
      { id: editingClient.id, data },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setEditingClient(null);
        },
      }
    );
  }, [editingClient, updateClient]);

  const handleDelete = useCallback((client: Client) => {
    if (confirm(`Are you sure you want to delete ${client.name}?`)) {
      deleteClient(client.id);
    }
  }, [deleteClient]);

  const handleOpenClient = useCallback((id: string) => {
    navigate(`/app/clients/${id}`);
  }, [navigate]);

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
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
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
            <SelectItem value="name-asc">Nom (A-Z)</SelectItem>
            <SelectItem value="name-desc">Nom (Z-A)</SelectItem>
            <SelectItem value="createdAt-desc">Plus récents</SelectItem>
            <SelectItem value="createdAt-asc">Plus anciens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handleOpenClient(client.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{client.name}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(client);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {t("common.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(client);
                      }}
                      disabled={isDeleting}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("common.delete")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

      <DataTablePagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      {/* Edit Dialog */}
      {editingClient && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
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
    </div>
  );
}
