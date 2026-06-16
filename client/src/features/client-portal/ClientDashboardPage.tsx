import { useTranslation } from "react-i18next";
import { useProjects } from "@/hooks/useProjects";
import { useClientServiceRequests } from "@/hooks/useServiceRequests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function ClientDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: requests } = useClientServiceRequests();

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
  ];

  return (
    <div className="container-page max-w-6xl mx-auto py-8">
      <h1 className="text-3xl font-bold text-ink mb-8">Tableau de bord</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="rounded-3xl border border-border shadow-soft hover:shadow-md transition-shadow cursor-pointer" onClick={stat.onClick}>
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
    </div>
  );
}
