import { useParams, useNavigate } from "react-router-dom";
import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { useClientSuccess, useCalculateClientSuccessScore } from "@/hooks/useClientSuccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Loader2 } from "lucide-react";

export function ClientSuccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const { data, isLoading, isError, refetch, isRefetching } = useClientSuccess(clientId!);
  const calculateMutation = useCalculateClientSuccessScore();

  if (isLoading) {
    return (
      <section className="container-page py-8">
        <div className="space-y-4">
          <Skeleton className="h-9 w-56" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32 rounded-2xl md:col-span-1" />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="container-page py-8">
        <div className="flex flex-col items-center justify-center gap-4 h-96">
          <p className="text-muted-foreground">{t("common.error")}</p>
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.retry")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="container-page py-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("common.back")}
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{t("clientSuccess.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("clientSuccess.subtitle")}
          </p>
        </div>
        <Button
          onClick={() => calculateMutation.mutate(clientId!)}
          disabled={calculateMutation.isPending}
        >
          {calculateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("clientSuccess.calculateScore")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>{t("clientSuccess.score")}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Backend never exposes a "calculated" flag, so we infer "never calculated"
                from createdAt === updatedAt (the record hasn't been touched since it was
                created with its default score of 0). Not perfect, but avoids showing a
                bare "0" that reads as an actual (bad) score. */}
            {data && data.createdAt !== data.updatedAt ? (
              <div className={calculateMutation.isPending ? "opacity-50 transition-opacity" : "transition-opacity"}>
                <span className="text-5xl font-bold">{data.score}</span>
                <span className="text-lg text-muted-foreground">/100</span>
              </div>
            ) : (
              <div className="text-lg text-muted-foreground">{t("clientSuccess.notCalculated")}</div>
            )}
            {calculateMutation.isPending && (
              <p className="text-xs text-muted-foreground mt-1">{t("clientSuccess.recalculating")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="objectives" className="w-full">
        <TabsList>
          <TabsTrigger value="objectives">
            {t("clientSuccess.objectives")}
          </TabsTrigger>
          <TabsTrigger value="metrics">
            {t("clientSuccess.metrics")}
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            {t("clientSuccess.recommendations")}
          </TabsTrigger>
          <TabsTrigger value="timeline">
            {t("clientSuccess.timeline")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="objectives" className="space-y-4 mt-4">
          {data?.objectives?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t("clientSuccess.noObjectives")}
              </CardContent>
            </Card>
          ) : (
            data?.objectives?.map((objective) => (
              <Card key={objective.id}>
                <CardHeader>
                  <CardTitle>{objective.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{objective.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="metrics" className="space-y-4 mt-4">
          {data?.metrics?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t("clientSuccess.noMetrics")}
              </CardContent>
            </Card>
          ) : (
            data?.metrics?.map((metric) => (
              <Card key={metric.id}>
                <CardHeader>
                  <CardTitle>{metric.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("clientSuccess.initialValue")}
                      </p>
                      <p className="text-lg font-bold">
                        {metric.initialValue} {metric.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {t("clientSuccess.currentValue")}
                      </p>
                      <p className="text-lg font-bold">
                        {metric.currentValue} {metric.unit}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="recommendations" className="space-y-4 mt-4">
          {data?.recommendations?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t("clientSuccess.noRecommendations")}
              </CardContent>
            </Card>
          ) : (
            data?.recommendations?.map((recommendation) => (
              <Card key={recommendation.id}>
                <CardHeader>
                  <CardTitle>{recommendation.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{recommendation.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="timeline" className="space-y-4 mt-4">
          {data?.timeline?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t("clientSuccess.noTimeline")}
              </CardContent>
            </Card>
          ) : (
            data?.timeline?.map((entry) => (
              <Card key={entry.id}>
                <CardHeader>
                  <CardTitle>{entry.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(entry.date)}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{entry.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}