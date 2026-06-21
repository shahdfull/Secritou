import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateQuestion } from "@/hooks/useCustomQuestions";

type AskQuestionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AskQuestionDialog({ open, onOpenChange }: AskQuestionDialogProps) {
  const { t } = useTranslation();
  const { mutate: createQuestion, isPending } = useCreateQuestion();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createQuestion(
      { subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          setSubject("");
          setMessage("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("questions.dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("questions.dialog.description", "Nous vous répondrons personnellement sous 24–48h.")}{" "}
            <Link to="/client/questions" className="font-medium text-primary hover:underline">
              {t("questions.dialog.seeMine", "Voir mes questions")}
            </Link>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("questions.dialog.subjectLabel")}
            </label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("questions.dialog.subjectPlaceholder")}
              minLength={5}
              maxLength={255}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              {t("questions.dialog.messageLabel")}
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("questions.dialog.messagePlaceholder")}
              rows={5}
              minLength={10}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending || subject.trim().length < 5 || message.trim().length < 10}>
              {isPending ? t("common.sending", "Envoi…") : t("questions.dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
