import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  MoreHorizontal,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  UserCheck,
  Loader2,
  List,
  KanbanSquare,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  useConvertLeadToClient,
} from "@/hooks/useLeads";
import type { Lead } from "@/types/lead";
import { LeadsKanban } from "./LeadsKanban";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { SortableTableHead } from "@/components/common/SortableTableHead";
import { useListParams } from "@/hooks/useListParams";
import {
  createLeadSchema,
  updateLeadSchema,
  type CreateLeadForm,
  type UpdateLeadForm,
} from "@/schemas/lead.schema";
import { useDebouncedValue } from "@/hooks/shared/useDebouncedValue";
import { useCrudDialogState } from "@/hooks/shared/useCrudDialogState";
import { useTranslation } from "react-i18next";

const STATUS_OPTIONS = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
const SOURCE_OPTIONS = ["Website", "LinkedIn", "Referral", "Email", "Inbound Call", "Other"] as const;
const ALL_STATUSES_VALUE = "__all__";

export function LeadsPage() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES_VALUE);
  const [searchInput, setSearchInput] = useState("");
  const [view, setView] = useState<"list" | "kanban">("list");

  const { page, pageSize, orderBy, orderDir, search, params, setPage, setSearch, setSort, updateParams } = useListParams(10);
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch, setSearch]);

  useEffect(() => {
    updateParams({ status: statusFilter === ALL_STATUSES_VALUE ? undefined : statusFilter, page: 1 });
  }, [statusFilter, updateParams]);

  const listParams = useMemo(
    () => ({
      ...params,
      pageSize: view === "kanban" ? 200 : pageSize,
      page: view === "kanban" ? 1 : page,
      orderBy: orderBy ?? "createdAt",
      orderDir,
      search,
      status: statusFilter === ALL_STATUSES_VALUE ? undefined : statusFilter,
    }),
    [params, view, pageSize, page, orderBy, orderDir, search, statusFilter],
  );

  const { data: leadsResult, isLoading } = useLeads(listParams);
  const filteredLeads = leadsResult?.data ?? [];
  const total = leadsResult?.total ?? 0;
  const { mutate: createLead, isPending: isCreating } = useCreateLead();
  const { mutate: updateLead, isPending: isUpdating } = useUpdateLead();
  const { mutate: deleteLead, isPending: isDeleting } = useDeleteLead();
  const { mutate: convertLead, isPending: isConverting } = useConvertLeadToClient();

  const {
    createDialogOpen,
    editDialogOpen,
    editingEntity: editingLead,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
  } = useCrudDialogState<Lead>();

  const createForm = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      status: "NEW",
    },
  });

  const editForm = useForm<UpdateLeadForm>({
    resolver: zodResolver(updateLeadSchema),
  });

  const handleCreate = useCallback(async (data: CreateLeadForm) => {
    createLead(data, {
      onSuccess: () => {
        closeCreateDialog();
        createForm.reset();
      },
    });
  }, [createForm, createLead, closeCreateDialog]);

  const handleEdit = useCallback((lead: Lead) => {
    openEditDialog(lead);
    editForm.reset(lead);
  }, [editForm, openEditDialog]);

  const handleUpdate = useCallback(async (data: UpdateLeadForm) => {
    if (!editingLead) return;
    updateLead(
      { id: editingLead.id, data },
      {
        onSuccess: () => {
          closeEditDialog();
        },
      }
    );
  }, [editingLead, updateLead, closeEditDialog]);

  const handleDelete = useCallback((lead: Lead) => {
    if (confirm(`Are you sure you want to delete ${lead.name}?`)) {
      deleteLead(lead.id);
    }
  }, [deleteLead]);

  const handleConvert = useCallback((lead: Lead) => {
    if (confirm(`Are you sure you want to convert ${lead.name} to a client?`)) {
      convertLead(lead.id);
    }
  }, [convertLead]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-blue-100 text-blue-800";
      case "CONTACTED":
        return "bg-yellow-100 text-yellow-800";
      case "QUALIFIED":
        return "bg-purple-100 text-purple-800";
      case "WON":
        return "bg-green-100 text-green-800";
      case "LOST":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSourceBadgeClass = (source: string) => {
    switch (source) {
      case "Website":
        return "bg-cyan-100 text-cyan-800";
      case "LinkedIn":
        return "bg-blue-100 text-blue-800";
      case "Referral":
        return "bg-green-100 text-green-800";
      case "Email":
        return "bg-pink-100 text-pink-800";
      case "Inbound Call":
        return "bg-orange-100 text-orange-800";
      case "Other":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      Website: t('leadsPage.sources.website'),
      LinkedIn: t('leadsPage.sources.linkedin'),
      Referral: t('leadsPage.sources.referral'),
      Email: t('leadsPage.sources.email'),
      "Inbound Call": t('leadsPage.sources.inboundCall'),
      Other: t('leadsPage.sources.other'),
    };
    return labels[source] || source;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      NEW: t('leadsPage.status.new'),
      CONTACTED: t('leadsPage.status.contacted'),
      QUALIFIED: t('leadsPage.status.qualified'),
      PROPOSAL: t('leadsPage.status.proposal'),
      WON: t('leadsPage.status.won'),
      LOST: t('leadsPage.status.lost'),
    };
    return labels[status] || status;
  };

  if (isLoading) {
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
          <h1 className="font-display text-2xl font-bold text-ink">{t('leadsPage.title')}</h1>
          <p className="text-muted-foreground">{t('leadsPage.subtitle')}</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={closeCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t('leadsPage.addLead')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('leadsPage.createLead')}</DialogTitle>
              <DialogDescription>{t('leadsPage.createLeadDesc')}</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('leadsPage.namePlaceholder')} {...field} />
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
                      <FormLabel>{t('common.email')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('leadsPage.emailPlaceholder')} type="email" {...field} />
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
                      <FormLabel>{t('common.phone')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('leadsPage.phonePlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('leadsPage.source')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('leadsPage.selectSource')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((source) => (
                            <SelectItem key={source} value={source}>
                              {getSourceLabel(source)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.notes')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('leadsPage.notesPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.status')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('leadsPage.selectStatus')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t('common.create')}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder={t('leadsPage.searchLeads')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('leadsPage.filterByStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES_VALUE}>{t('leadsPage.allStatuses')}</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as "list" | "kanban")}>
              <TabsList>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  {t('leadsPage.viewList')}
                </TabsTrigger>
                <TabsTrigger value="kanban" className="flex items-center gap-2">
                  <KanbanSquare className="h-4 w-4" />
                  {t('leadsPage.viewKanban')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {view === "list" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    column="name"
                    label={t('common.name')}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)}
                  />
                  <SortableTableHead
                    column="email"
                    label={t('common.email')}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)}
                  />
                  <TableHead>{t('common.phone')}</TableHead>
                  <SortableTableHead
                    column="source"
                    label={t('leadsPage.sourceLabel')}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)}
                  />
                  <SortableTableHead
                    column="status"
                    label={t('common.status')}
                    sortBy={orderBy ?? "createdAt"}
                    sortOrder={orderDir}
                    onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)}
                  />
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.email || "-"}</TableCell>
                    <TableCell>{lead.phone || "-"}</TableCell>
                    <TableCell>
                      {lead.source ? (
                        <Badge className={getSourceBadgeClass(lead.source)}>
                          {getSourceLabel(lead.source)}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                          lead.status
                        )}`}
                      >
                        {getStatusLabel(lead.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(lead)}>
                            <Edit className="h-4 w-4 mr-2" />
                            {t('common.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleConvert(lead)} disabled={isConverting}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            {t('leadsPage.convertToClient')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(lead)} disabled={isDeleting} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            {t('common.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <LeadsKanban filteredLeads={filteredLeads} />
          )}
          {view === "list" && (
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editingLead && (
        <Dialog open={editDialogOpen} onOpenChange={closeEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('leadsPage.editLead')}</DialogTitle>
              <DialogDescription>{t('leadsPage.editLeadDesc')}</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.name')}</FormLabel>
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
                      <FormLabel>{t('common.email')}</FormLabel>
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
                      <FormLabel>{t('common.phone')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('leadsPage.source')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('leadsPage.selectSource')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((source) => (
                            <SelectItem key={source} value={source}>
                              {source}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.notes')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('leadsPage.notesPlaceholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.status')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('leadsPage.selectStatus')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t('common.save')}
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
