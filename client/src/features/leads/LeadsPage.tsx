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
import { z } from "zod";
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

const createLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.enum(["Site web", "LinkedIn", "Recommandation", "Email", "Appel entrant", "Autre"]).optional(),
  notes: z.string().optional(),
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"]).default("NEW"),
});

const updateLeadSchema = createLeadSchema.partial();

type CreateLeadForm = z.infer<typeof createLeadSchema>;
type UpdateLeadForm = z.infer<typeof updateLeadSchema>;

export function LeadsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");

  const { page, pageSize, orderBy, orderDir, search, params, setPage, setSearch, setSort, updateParams } = useListParams(10);

  useEffect(() => {
    updateParams({ status: statusFilter === "All" ? undefined : statusFilter, page: 1 });
  }, [statusFilter, updateParams]);

  const listParams = useMemo(
    () => ({
      ...params,
      pageSize: view === "kanban" ? 200 : pageSize,
      page: view === "kanban" ? 1 : page,
      orderBy: orderBy ?? "createdAt",
      orderDir,
      search,
      status: statusFilter === "All" ? undefined : statusFilter,
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

  const createForm = useForm<CreateLeadForm>({
    resolver: zodResolver(createLeadSchema) as any,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      status: "NEW",
    },
  });

  const editForm = useForm<UpdateLeadForm>({
    resolver: zodResolver(updateLeadSchema) as any,
  });

  const handleCreate = useCallback(async (data: CreateLeadForm) => {
    createLead(data, {
      onSuccess: () => {
        setCreateDialogOpen(false);
        createForm.reset();
      },
    });
  }, [createForm, createLead]);

  const handleEdit = useCallback((lead: Lead) => {
    setEditingLead(lead);
    editForm.reset(lead);
    setEditDialogOpen(true);
  }, [editForm]);

  const handleUpdate = useCallback(async (data: UpdateLeadForm) => {
    if (!editingLead) return;
    updateLead(
      { id: editingLead.id, data },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          setEditingLead(null);
        },
      }
    );
  }, [editingLead, updateLead]);

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
      case "Site web":
        return "bg-cyan-100 text-cyan-800";
      case "LinkedIn":
        return "bg-blue-100 text-blue-800";
      case "Recommandation":
        return "bg-green-100 text-green-800";
      case "Email":
        return "bg-pink-100 text-pink-800";
      case "Appel entrant":
        return "bg-orange-100 text-orange-800";
      case "Autre":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
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
          <h1 className="font-display text-2xl font-bold text-ink">Leads</h1>
          <p className="text-muted-foreground">Manage and track your sales leads</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Lead</DialogTitle>
              <DialogDescription>Add a new lead to your pipeline</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="john@example.com" type="email" {...field} />
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1234567890" {...field} />
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
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Site web">Site web</SelectItem>
                          <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                          <SelectItem value="Recommandation">Recommandation</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Appel entrant">Appel entrant</SelectItem>
                          <SelectItem value="Autre">Autre</SelectItem>
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
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notes internes..." {...field} />
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
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="CONTACTED">Contacted</SelectItem>
                          <SelectItem value="QUALIFIED">Qualified</SelectItem>
                          <SelectItem value="PROPOSAL">Proposal</SelectItem>
                          <SelectItem value="WON">Won</SelectItem>
                          <SelectItem value="LOST">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
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
                placeholder="Search leads..."
                value={search ?? ""}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Statuses</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="QUALIFIED">Qualified</SelectItem>
                <SelectItem value="WON">Won</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as "list" | "kanban")}>
              <TabsList>
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="h-4 w-4" />
                  Liste
                </TabsTrigger>
                <TabsTrigger value="kanban" className="flex items-center gap-2">
                  <KanbanSquare className="h-4 w-4" />
                  Kanban
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
                <SortableTableHead column="name" label="Name" sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)} />
                <SortableTableHead column="email" label="Email" sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)} />
                <TableHead>Phone</TableHead>
                <SortableTableHead column="source" label="Source" sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)} />
                <SortableTableHead column="status" label="Status" sortBy={orderBy ?? "createdAt"} sortOrder={orderDir} onSort={(col) => setSort(col, orderBy ?? "createdAt", orderDir)} />
                <TableHead className="text-right">Actions</TableHead>
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
                          {lead.source}
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
                        {lead.status}
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
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleConvert(lead)} disabled={isConverting}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Convert to Client
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(lead)} disabled={isDeleting} className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
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
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>Update lead information</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Phone</FormLabel>
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
                      <FormLabel>Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Site web">Site web</SelectItem>
                          <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                          <SelectItem value="Recommandation">Recommandation</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Appel entrant">Appel entrant</SelectItem>
                          <SelectItem value="Autre">Autre</SelectItem>
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
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notes internes..." {...field} />
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
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="CONTACTED">Contacted</SelectItem>
                          <SelectItem value="QUALIFIED">Qualified</SelectItem>
                          <SelectItem value="PROPOSAL">Proposal</SelectItem>
                          <SelectItem value="WON">Won</SelectItem>
                          <SelectItem value="LOST">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save
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
