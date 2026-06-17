import { useParams, useNavigate } from "react-router-dom";
import { useClient, useDeleteClient } from "@/hooks/useClients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Edit, Trash2, Plus, Download } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi, type Document } from "@/api/documents.api";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const documentSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["INVOICE", "CONTRACT", "OTHER"]),
  url: z.string().url("URL invalide"),
});

type DocumentForm = z.infer<typeof documentSchema>;

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: client, isLoading } = useClient(id || "");
  const { mutate: deleteClient, isPending: isDeleting } = useDeleteClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addDocumentDialogOpen, setAddDocumentDialogOpen] = useState(false);

  const { data: documents } = useQuery({
    queryKey: ["clientDocuments", id],
    queryFn: () => id ? documentsApi.getClientDocuments(id) : Promise.resolve([]),
    enabled: !!id,
  });

  const addDocumentMutation = useMutation({
    mutationFn: (data: Omit<Document, "id" | "createdAt" | "updatedAt" | "companyId">) =>
      documentsApi.createDocument({ ...data, clientId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientDocuments", id] });
      toast.success("Document ajouté avec succès");
      setAddDocumentDialogOpen(false);
      documentForm.reset();
    },
  });

  const documentForm = useForm<DocumentForm>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      name: "",
      type: "OTHER",
      url: "",
    },
  });

  const handleDelete = () => {
    if (id) {
      deleteClient(id, {
        onSuccess: () => {
          navigate("/app/clients");
        },
      });
    }
  };

  const handleAddDocument = (data: DocumentForm) => {
    addDocumentMutation.mutate(data);
  };

  const getDocumentTypeLabel = (type: Document['type']) => {
    switch (type) {
      case 'INVOICE': return 'Facture';
      case 'CONTRACT': return 'Contrat';
      case 'OTHER': return 'Autre';
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
        <h2 className="text-xl font-bold">Client not found</h2>
        <Button onClick={() => navigate("/app/clients")} className="mt-4">
          Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">{client.name}</h1>
          <p className="text-muted-foreground">Client details</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/app/clients/${client.id}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer le client
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informations du client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <span className="font-medium">Email:</span> {client.email || "-"}
          </div>
          <div>
            <span className="font-medium">Téléphone:</span> {client.phone || "-"}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Projets</CardTitle>
        </CardHeader>
        <CardContent>
          {client.projects && client.projects.length > 0 ? (
            <div className="space-y-2">
              {client.projects.map((project) => (
                <div key={project.id} className="p-3 border rounded-md">
                  <div className="font-medium">{project.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {project.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">--</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents</CardTitle>
          <Button size="sm" onClick={() => setAddDocumentDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un document
          </Button>
        </CardHeader>
        <CardContent>
          {documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getDocumentTypeLabel(doc.type)}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => window.open(doc.url, '_blank')}>
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">Aucun document</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={addDocumentDialogOpen} onOpenChange={setAddDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
            <DialogDescription>
              Ajoutez un document pour ce client
            </DialogDescription>
          </DialogHeader>
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit(handleAddDocument)} className="space-y-4">
              <FormField
                control={documentForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du document</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Facture 2024" {...field} />
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
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="INVOICE">Facture</SelectItem>
                        <SelectItem value="CONTRACT">Contrat</SelectItem>
                        <SelectItem value="OTHER">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={documentForm.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL du document</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/document.pdf" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={addDocumentMutation.isPending}>
                  {addDocumentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Ajouter
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le client</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
