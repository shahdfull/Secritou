import { memo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { commentFormSchema, type CommentForm } from "@/schemas/task.schema";
import type { Comment } from "@/types/comment";
import { Loader2, Send } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface CommentsSectionProps {
  comments: Comment[];
  onCreateComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
}

const CommentForm = memo(function CommentForm({
  onCreateComment,
  createCommentMutation,
}: {
  onCreateComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
}) {
  const commentForm = useForm<CommentForm>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { content: "" },
  });

  const onSubmit = (data: CommentForm) => {
    onCreateComment(data.content);
    commentForm.reset();
  };

  return (
    <Form {...commentForm}>
      <form onSubmit={commentForm.handleSubmit(onSubmit)} className="flex gap-2">
        <FormField
          control={commentForm.control}
          name="content"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Textarea
                  placeholder="Écrire un commentaire..."
                  className="flex-1"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={commentForm.formState.isSubmitting || createCommentMutation.isPending}>
          {createCommentMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Form>
  );
});

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function CommentsSection({ comments, onCreateComment, createCommentMutation }: CommentsSectionProps) {
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);
  const commentsVirtualizer = useVirtualizer({
    count: comments.length,
    getScrollElement: () => commentsScrollRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Commentaires ({comments.length})</h3>
      </div>
      <CommentForm onCreateComment={onCreateComment} createCommentMutation={createCommentMutation} />
      <div
        ref={commentsScrollRef}
        className="max-h-[400px] overflow-auto space-y-3"
      >
        <div style={{ height: commentsVirtualizer.getTotalSize(), position: "relative" }}>
          {commentsVirtualizer.getVirtualItems().map((virtualRow) => {
            const comment = comments[virtualRow.index];
            if (!comment) return null;

            return (
              <div
                key={comment.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                  <Avatar className="h-8 w-8 text-xs shrink-0">
                    <span>{getInitials(comment.author?.name || "U")}</span>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{comment.author?.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
