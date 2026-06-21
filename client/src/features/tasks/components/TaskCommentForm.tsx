import { memo, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { commentFormSchema, type CommentForm } from "@/schemas/task.schema";
import { useTranslation } from "react-i18next";

export const TaskCommentForm = memo(function TaskCommentForm({
  onCreateComment,
  isPending,
}: {
  onCreateComment: (content: string) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const commentForm = useForm<CommentForm>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { content: "" },
  });

  const onSubmit = useCallback(
    (data: CommentForm) => {
      onCreateComment(data.content);
      commentForm.reset();
    },
    [commentForm, onCreateComment],
  );

  return (
    <Form {...commentForm}>
      <form onSubmit={commentForm.handleSubmit(onSubmit)} className="flex gap-2">
        <FormField
          control={commentForm.control}
          name="content"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Textarea placeholder={t("common.writeComment")} className="flex-1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={commentForm.formState.isSubmitting || isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Form>
  );
});
