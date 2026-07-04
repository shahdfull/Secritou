import { useState } from "react";
import { formatDate, formatDateTime } from "@/utils/format";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  useMyQuestions,
  useQuestion,
  useAddQuestionMessage,
} from "@/hooks/useCustomQuestions";
import type { CustomQuestionStatus } from "@/api/customQuestions.api";

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

function QuestionThread({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: question, isLoading } = useQuestion(id);
  const { mutate: addMessage, isPending } = useAddQuestionMessage(id);
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
        onClick={() => navigate("/client/questions")}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("common.back", "Retour")}
      </button>

      <Card className="rounded-3xl border border-border shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-xl font-bold text-ink">{question.subject}</CardTitle>
            <Badge className={statusColor(question.status)}>
              {t(`questions.status.${question.status}`)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {question.messages?.map((m) => {
            const fromStaff = m.authorRole === "ADMIN" || m.authorRole === "MANAGER";
            return (
              <div
                key={m.id}
                className={`flex flex-col ${fromStaff ? "items-start" : "items-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    fromStaff
                      ? "bg-surface-warm/60 text-ink"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold opacity-80">
                    {fromStaff ? t("questions.thread.support") : t("questions.thread.you")}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>
                <span className="mt-1 text-[11px] text-muted-foreground">
                  {formatDateTime(m.createdAt)}
                </span>
              </div>
            );
          })}

          {isClosed ? (
            <p className="pt-2 text-center text-sm text-muted-foreground">
              {t("questions.thread.closed", "Cette conversation est clôturée.")}
            </p>
          ) : (
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
                  {t("questions.thread.send")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QuestionsList() {
  const { t } = useTranslation();
  const { data, isLoading } = useMyQuestions();

  if (isLoading) return <Spinner />;

  const questions = data?.data ?? [];

  return (
    <div className="space-y-4">
      {questions.length === 0 ? (
        <Card className="rounded-3xl border border-border shadow-soft">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">{t("questions.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        questions.map((q) => (
          <Link key={q.id} to={`/client/questions/${q.id}`} className="block">
            <Card className="rounded-3xl border border-border shadow-soft transition-shadow hover:shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg font-bold text-ink">{q.subject}</CardTitle>
                  <Badge className={statusColor(q.status)}>
                    {t(`questions.status.${q.status}`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {q.messages?.[0] && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {q.messages[0].content}
                  </p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  {formatDate(q.updatedAt)} ·{" "}
                  {t("questions.messageCount", { count: q._count?.messages ?? 0 })}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))
      )}
    </div>
  );
}

export function QuestionsClientPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();

  return (
    <div className="container-page mx-auto max-w-4xl py-8">
      <h1 className="mb-8 text-3xl font-bold text-ink">{t("questions.title")}</h1>
      {id ? <QuestionThread id={id} /> : <QuestionsList />}
    </div>
  );
}
