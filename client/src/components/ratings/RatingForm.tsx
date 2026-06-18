import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { StarRating } from "./StarRating";
import { useTranslation } from "react-i18next";
import type { FreelancerRating } from "@/types/rating";

const schema = z.object({
  score: z.number().int().min(1, "Select a score").max(5),
  comment: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof schema>;

interface RatingFormProps {
  freelancerId: string;
  missionId: string;
  existing?: FreelancerRating;
  onSubmit: (values: FormValues) => Promise<void>;
  onCancel?: () => void;
}

export function RatingForm({
  existing,
  onSubmit,
  onCancel,
}: RatingFormProps) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      score: existing?.score ?? 0,
      comment: existing?.comment ?? "",
    },
  });

  const score = form.watch("score");

  async function handleSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="score"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ratings.score")}</FormLabel>
              <FormControl>
                <StarRating
                  value={field.value}
                  interactive
                  size="lg"
                  onChange={field.onChange}
                />
              </FormControl>
              {score > 0 && (
                <p className="text-sm text-muted-foreground">
                  {t(`ratings.scoreLabel.${score}`)}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("ratings.comment")} ({t("common.optional")})</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("ratings.commentPlaceholder")}
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2 justify-end">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          )}
          <Button type="submit" disabled={submitting || score === 0}>
            {submitting
              ? t("common.saving")
              : existing
              ? t("ratings.updateReview")
              : t("ratings.submitReview")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
