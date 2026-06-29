import { useParams, useNavigate } from "react-router-dom";
import { formatDate } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { useClientSuccess, useCalculateClientSuccessScore } from "@/hooks/useClientSuccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";

export function ClientSuccessPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const { data, isLoading, isError } = useClientSuccess(clientId!);
  const calculateMutation = useCalculateClientSuccessScore();

  if (isLoading) {
    return (
      <section className="container-page py-8">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="container-page py-8">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">{t("common.error")}</p>
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
          {t("clientSuccess.calculateScore")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>{t("clientSuccess.score")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold">{data?.score || 0}</div>
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
