import { memo, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getTaskStatusBadgeClass } from "@/utils/statusColors";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Send, Loader2 } from "lucide-react";
import { commentFormSchema, type CommentForm as CommentFormValues } from "@/schemas/task.schema";
import type { Task } from "@/types/task";
import type { User } from "@/types/auth";
import type { Comment } from "@/types/comment";
import { getInitials, getStatusLabel } from "../taskUtils";

const CommentForm = memo(function CommentForm({
  onCreateComment,
  createCommentMutation,
}: {
  onCreateComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
}) {
  const { t } = useTranslation();
  const commentForm = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { content: "" },
  });

  const onSubmit = useCallback(
    (data: CommentFormValues) => {
      onCreateComment(data.content);
      commentForm.reset();
    },
    [commentForm, onCreateComment]
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
                <Textarea
                  placeholder={t("common.writeComment")}
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

interface TaskDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  projectName: string | undefined;
  userById: Map<string, User>;
  comments: Comment[];
  onAddComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
}

export function TaskDetailDrawer({
  open,
  onOpenChange,
  task,
  projectName,
  userById,
  comments,
  onAddComment,
  createCommentMutation,
}: TaskDetailDrawerProps) {
  const { t } = useTranslation();
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);
  const commentsVirtualizer = useVirtualizer({
    count: comments.length,
    getScrollElement: () => commentsScrollRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });

  if (!task) return null;

  const assignee = task.assigneeId ? userById.get(task.assigneeId) : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>
            {task.description ?? "Pas de description"}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Statut</p>
              <Badge className={getTaskStatusBadgeClass(task.status)}>
                {getStatusLabel(task.status, t)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Projet</p>
              <p>{projectName ?? "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Assigné à</p>
              {assignee ? (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 text-xs">
                    <span>{getInitials(assignee.name)}</span>
                  </Avatar>
                  <span className="text-sm">{assignee.name}</span>
                </div>
              ) : (
                "-"
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Date d'échéance</p>
              {task.dueDate ? (
                <p className={isPast(new Date(task.dueDate)) ? "text-red-600 font-medium" : ""}>
                  {format(new Date(task.dueDate), "dd MMM yyyy")}
                </p>
              ) : (
                "-"
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Commentaires</h3>
            <ScrollArea className="h-80 border rounded-lg p-0">
              <div ref={commentsScrollRef} className="h-80 overflow-auto p-4">
                {comments.length > 0 ? (
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
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div className="flex gap-3 py-2">
                            <Avatar className="h-8 w-8 text-xs">
                              <span>{getInitials(comment.author.name)}</span>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{comment.author.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(comment.createdAt), {
                                    addSuffix: true,
                                    locale: fr,
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Aucun commentaire</p>
                )}
              </div>
            </ScrollArea>
            <CommentForm
              onCreateComment={onAddComment}
              createCommentMutation={createCommentMutation}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
