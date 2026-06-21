import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { freelancersApi } from "@/api/freelancers.api";
import { queryKeys } from "@/lib/query-keys";
import { Loader2, ArrowLeft, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FreelancerRatingSection } from "@/components/ratings/FreelancerRatingSection";
import { StarRating } from "@/components/ratings/StarRating";
import { useAuthStore } from "@/store/auth.store";
import { useTranslation } from "react-i18next";
import { useMissions } from "@/hooks/useMissions";

export function FreelancerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { t } = useTranslation();

  const { data: freelancer, isLoading } = useQuery({
    queryKey: queryKeys.freelancer(id!),
    queryFn: () => freelancersApi.getById(id!),
    enabled: !!id,
  });

  const { data: missionsResult, isLoading: missionsLoading } = useMissions({
    freelancerId: id,
    pageSize: 100,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!freelancer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{t("freelancers.notFound")}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/app/freelancers">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Link>
        </Button>
      </div>
    );
  }

  const initials = freelancer.user.name.slice(0, 2).toUpperCase();
  const missions = missionsResult?.data ?? [];

  const STATUS_COLORS: Record<string, string> = {
    OPEN: "bg-blue-100 text-blue-800",
    ASSIGNED: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-purple-100 text-purple-800",
    COMPLETED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/freelancers">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("common.back")}
          </Link>
        </Button>
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold">{freelancer.user.name}</h1>
                  <p className="text-muted-foreground">{freelancer.user.email}</p>
                </div>
                <Badge variant={freelancer.availability ? "default" : "secondary"}>
                  {freelancer.availability ? t("freelancers.available") : t("freelancers.busy")}
                </Badge>
              </div>

              {(freelancer.rating || freelancer.reviewCount > 0) && (
                <div className="flex items-center gap-2">
                  <StarRating value={freelancer.rating ?? 0} size="md" />
                  <span className="font-semibold">{freelancer.rating?.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">
                    ({freelancer.reviewCount} {t("ratings.reviews")})
                  </span>
                </div>
              )}

              {freelancer.hourlyRate && (
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {freelancer.hourlyRate} TND/h
                </div>
              )}

              {freelancer.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed">{freelancer.bio}</p>
              )}

              {freelancer.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {freelancer.skills.map((skill) => (
                    <Badge key={skill.id} variant="outline">{skill.name}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="missions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="missions">Missions</TabsTrigger>
          <TabsTrigger value="ratings">{t("ratings.title")}</TabsTrigger>
        </TabsList>

        <TabsContent value="missions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Missions</CardTitle>
            </CardHeader>
            <CardContent>
              {missionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : missions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune mission assignée.</p>
              ) : (
                <div className="space-y-3">
                  {missions.map((mission) => (
                    <div key={mission.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium text-sm">{mission.title}</p>
                        {mission.budget && (
                          <p className="text-xs text-muted-foreground">{mission.budget} TND</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[mission.status] ?? "bg-gray-100 text-gray-800"}`}>
                        {mission.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ratings">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("ratings.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <FreelancerRatingSection freelancerId={freelancer.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
