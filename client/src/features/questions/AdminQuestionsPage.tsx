import { useCallback, useMemo, useState } from "react";
import { formatDate, formatDateTime } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type RowClickedEvent,
} from "ag-grid-community";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAllQuestions,
  useQuestion,
  useAddQuestionMessage,
  useUpdateQuestionStatus,
} from "@/hooks/useCustomQuestions";
import type { CustomQuestion, CustomQuestionStatus } from "@/api/customQuestions.api";

ModuleRegistry.registerModules([AllCommunityModule]);

// Cohérent avec la migration AG Grid de TasksListView.tsx (mêmes tokens, thème clair unique).
const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e",
  headerBackgroundColor: "#f8fafc",
  headerTextColor: "#334155",
  rowHoverColor: "#f1f5f9",
  borderColor: "#e2e8f0",
  fontFamily: "inherit",
});

const STATUSES: CustomQuestionStatus[] = ["OPEN", "ANSWERED", "CLOSED"];

function statusColor(status: CustomQuestionStatus): string {
  switch (status) {
    case "ANSWERED":
      return "bg-green-100 text-green-800";
    case "CLOSED":
      return "bg-blue-100 text-blue-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function Spinner() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function AdminThread({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: question, isLoading } = useQuestion(id);
  const { mutate: addMessage, isPending } = useAddQuestionMessage(id);
  const { mutate: updateStatus } = useUpdateQuestionStatus(id);
  const [reply, setReply] = useState("");

  if (isLoading) return <Spinner />;
  if (!question) {
    return (
      <Card className="rounded-3xl border border-border shadow-soft">
        <CardContent className="p-8 text-center text-muted-foreground">
          {t("questions.notFound", "Question introuvable.")}
        </CardContent>
      </Card>
    );
  }

  const isClosed = question.status === "CLOSED";

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    addMessage(reply.trim(), { onSuccess: () => setReply("") });
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/app/questions")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back", "Retour")}
      </button>

      <Card className="rounded-3xl border border-border shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-bold text-ink">{question.subject}</CardTitle>
              {question.user && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {question.user.name} · {question.user.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={statusColor(question.status)}>
                {t(`questions.status.${question.status}`)}
              </Badge>
              <Select
                value={question.status}
                onValueChange={(v) => updateStatus(v as CustomQuestionStatus)}
              >
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`questions.status.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {question.messages?.map((m) => {
            const fromStaff = m.authorRole === "ADMIN" || m.authorRole === "MANAGER";
            return (
              <div key={m.id} className={`flex flex-col ${fromStaff ? "items-end" : "items-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    fromStaff
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-warm/60 text-ink"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold opacity-80">
                    {fromStaff
                      ? t("questions.thread.support")
                      : question.user?.name ?? t("questions.thread.client", "Client")}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                </span>
              </div>
            );
          })}

          {!isClosed && (
            <form onSubmit={handleSend} className="space-y-3 border-t border-border pt-4">
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={t("questions.thread.replyPlaceholder")}
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isPending || !reply.trim()}>
                  <Send className="mr-1.5 h-4 w-4" />
                  {t("questions.thread.reply", "Répondre")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionsTable() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const { data, isLoading } = useAllQuestions(
    statusFilter === "ALL" ? undefined : statusFilter
  );

  const questions = data?.data ?? [];

  const userRenderer = useCallback((params: ICellRendererParams<CustomQuestion>) => {
    const user = params.data?.user;
    if (!user) return <span className="text-muted-foreground">:</span>;
    return (
      <div className="flex h-full flex-col justify-center text-muted-foreground">
        <span>{user.name}</span>
        <span className="text-xs">{user.email}</span>
      </div>
    );
  }, []);

  const statusRenderer = useCallback(
    (params: ICellRendererParams<CustomQuestion>) => {
      const q = params.data;
      if (!q) return null;
      return (
        <div className="flex h-full items-center">
          <Badge className={statusColor(q.status)}>{t(`questions.status.${q.status}`)}</Badge>
        </div>
      );
    },
    [t]
  );

  const columnDefs = useMemo<ColDef<CustomQuestion>[]>(
    () => [
      { headerName: t("questions.admin.subject", "Sujet"), field: "subject", flex: 2, cellClass: "font-medium text-ink" },
      { headerName: t("questions.admin.user", "Utilisateur"), cellRenderer: userRenderer, flex: 1 },
      { headerName: t("questions.admin.status", "Statut"), cellRenderer: statusRenderer, flex: 1 },
      { headerName: t("questions.admin.date", "Date"), valueFormatter: (p) => formatDate(p.data!.updatedAt), field: "updatedAt", flex: 1, cellClass: "text-muted-foreground" },
    ],
    [t, userRenderer, statusRenderer]
  );

  const handleRowClicked = useCallback(
    (event: RowClickedEvent<CustomQuestion>) => {
      if (event.data) navigate(`/app/questions/${event.data.id}`);
    },
    [navigate]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{t("questions.admin.filter", "Filtrer")}</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("questions.admin.allStatuses", "Tous les statuts")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`questions.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-3xl border border-border shadow-soft">
        <CardContent className="p-0">
          {isLoading ? (
            <Spinner />
          ) : (
            <div style={{ height: 500 }}>
              <AgGridReact<CustomQuestion>
                theme={gridTheme}
                rowData={questions}
                columnDefs={columnDefs}
                onRowClicked={handleRowClicked}
                rowStyle={{ cursor: "pointer" }}
                suppressCellFocus
                overlayNoRowsTemplate={t("questions.admin.empty", "Aucune question.")}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminQuestionsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container-page mx-auto max-w-5xl py-8">
      <h1 className="mb-8 text-3xl font-bold text-ink">{t("questions.admin.title", "Questions")}</h1>
      {id ? <AdminThread id={id} /> : <QuestionsTable />}
    </div>
  );
}
