import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useClientServiceRequests, useCreateClientServiceRequest } from "@/hooks/useServiceRequests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const getStatusColor = (status: string) => {
  switch (status) {
    case "NEW":
      return "bg-blue-100 text-blue-800";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-800";
    case "DONE":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case "NEW":
      return "Nouveau";
    case "IN_PROGRESS":
      return "En cours";
    case "DONE":
      return "Terminé";
    default:
      return status;
  }
};

export function ServiceRequestsClientPage() {
  const { t } = useTranslation();
  const { data: requests, isLoading } = useClientServiceRequests();
  const { mutate: createRequest, isPending } = useCreateClientServiceRequest();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRequest({ title, description });
    setTitle("");
    setDescription("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="container-page max-w-6xl mx-auto py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-ink">Mes Demandes</h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="rounded-3xl border border-border shadow-soft">
            <CardHeader>
              <CardTitle>Nouvelle Demande</CardTitle>
              <CardDescription>Décrivez votre besoin, nous vous répondrons rapidement.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Titre</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titre de la demande"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1">Description</label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Décrivez votre demande en détail..."
                    rows={4}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? "Envoi en cours..." : "Envoyer la demande"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {requests?.length === 0 ? (
            <Card className="rounded-3xl border border-border shadow-soft">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Vous n'avez pas encore de demande de service.</p>
              </CardContent>
            </Card>
          ) : (
            requests?.map((request) => (
              <Card key={request.id} className="rounded-3xl border border-border shadow-soft">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl font-bold text-ink">{request.title}</CardTitle>
                    <Badge className={getStatusColor(request.status)}>
                      {getStatusText(request.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {request.description && (
                    <p className="text-muted-foreground">{request.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-3">
                    Créée le {new Date(request.createdAt).toLocaleDateString("fr-FR")}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
