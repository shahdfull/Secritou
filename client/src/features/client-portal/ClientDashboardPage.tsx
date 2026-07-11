import { useTranslation } from "react-i18next";
import { useProjects } from "@/hooks/useProjects";
import { useClientServiceRequests } from "@/hooks/useServiceRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, MessageSquare, FileText, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { documentsApi, type Document } from "@/api/documents.api";
import { useAuthStore } from "@/store/auth.store";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function ClientDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const { data: projectsResult, isError: projectsError } = useProjects({ page: 1, pageSize: 100 });
  const projects = projectsResult?.data ?? [];
  const { data: requests, isError: requestsError } = useClientServiceRequests();
  const { data: documentsResult, isError: documentsError } = useQuery({
    queryKey: ["clientDocuments", user?.clientId],
    queryFn: () => user?.clientId ? documentsApi.getDocuments({ clientId: user.clientId }) : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 10 }),
    enabled: !!user?.clientId,
  });
  const documents = documentsResult?.data ?? [];
  const hasLoadError = projectsError || requestsError || documentsError;
  const downloadDocumentMutation = useMutation({
    mutationFn: (documentId: string) => documentsApi.getDownloadUrl(documentId),
    onSuccess: ({ url }) => window.open(url, "_blank"),
  });

  const stats = [
    {
      title: "Projets",
      value: projects?.length || 0,
      icon: Briefcase,
      color: "bg-blue-50 text-blue-600",
      onClick: () => navigate("/client/projects"),
    },
    {
      title: "Demandes",
      value: requests?.length || 0,
      icon: MessageSquare,
      color: "bg-purple-50 text-purple-600",
      onClick: () => navigate("/client/requests"),
    },
    {
      title: "Documents",
      value: documents?.length || 0,
      icon: FileText,
      color: "bg-green-50 text-green-600",
    },
  ];

  const getDocumentTypeLabel = (doc: Document) => {
    switch (doc.type) {
      case 'INVOICE': return 'Facture';
      case 'CONTRACT': return 'Contrat';
      case 'OTHER': return 'Autre';
      default: return 'Document';
    }
  };

  return (
    <div className="container-page max-w-6xl mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold text-ink">Tableau de bord</h1>

      {hasLoadError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {t("errors.loadFailed")}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="rounded-3xl border border-border shadow-soft hover:shadow-md transition-shadow cursor-pointer" onClick={stat.onClick}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`p-2 rounded-full ${stat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {documents && documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mes documents</CardTitle>
          </CardHeader>
          <CardContent>
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
                {documents.map((doc: Document) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getDocumentTypeLabel(doc)}</Badge>
                    </TableCell>
                    <TableCell>{format(new Date(doc.createdAt), 'dd/MM/yyyy', { locale: fr })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => downloadDocumentMutation.mutate(doc.id)}>
                        <Download className="h-4 w-4 mr-2" />
                        Télécharger
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
