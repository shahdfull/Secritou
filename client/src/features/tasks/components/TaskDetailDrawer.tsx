import { memo, useCallback, useRef, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/shared/crud/ConfirmDeleteDialog";
import { Send, Loader2, Edit, Trash2, X } from "lucide-react";
import { commentFormSchema, type CommentForm as CommentFormValues } from "@/schemas/task.schema";
import type { Task } from "@/types/task";
import type { User } from "@/types/auth";
import type { Comment } from "@/types/comment";
import { getInitials, getStatusLabel } from "../taskUtils";
import { TaskAttachments } from "./TaskAttachments";
import { MentionTextarea } from "./MentionTextarea";
import { MentionText } from "./MentionText";
import { TaskChecklist } from "./TaskChecklist";

function canEditComment(comment: Comment, currentUserId: string | undefined, isAdmin: boolean): boolean {
  return isAdmin || (!!currentUserId && comment.authorId === currentUserId);
}

const CommentForm = memo(function CommentForm({
  onCreateComment,
  createCommentMutation,
  mentionableUsers,
}: {
  onCreateComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
  mentionableUsers: User[];
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
                <MentionTextarea
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("common.writeComment")}
                  className="flex-1"
                  mentionableUsers={mentionableUsers}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={commentForm.formState.isSubmitting || createCommentMutation.isPending} aria-label={t("common.send", "Envoyer")}>
          {createCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
  projectClientId: string | undefined;
  userById: Map<string, User>;
  comments: Comment[];
  onAddComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
  currentUserId: string | undefined;
  isAdmin: boolean;
  canManageAttachments: boolean;
  mentionableUsers: User[];
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  isUpdatingComment: boolean;
  isDeletingComment: boolean;
}

export function TaskDetailDrawer(props: TaskDetailDrawerProps) {
  const {
    open, onOpenChange, task, projectName, projectClientId, userById, comments,
    onAddComment, createCommentMutation, currentUserId, isAdmin, canManageAttachments,
    mentionableUsers, onUpdateComment, onDeleteComment, isUpdatingComment, isDeletingComment,
  } = props;
  const { t } = useTranslation();
  const commentsScrollRef = useRef<HTMLDivElement | null>(null);
  const commentsVirtualizer = useVirtualizer({
    count: comments.length,
    getScrollElement: () => commentsScrollRef.current,
    estimateSize: () => 84,
    overscan: 8,
  });
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  const startEditComment = useCallback((comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  }, []);
  const cancelEditComment = useCallback(() => { setEditingCommentId(null); setEditingContent(""); }, []);
  const submitEditComment = useCallback(() => {
    if (!editingCommentId || !editingContent.trim()) return;
    onUpdateComment(editingCommentId, editingContent);
    setEditingCommentId(null);
    setEditingContent("");
  }, [editingCommentId, editingContent, onUpdateComment]);
  const confirmDeleteComment = useCallback(() => {
    if (!deletingCommentId) return;
    onDeleteComment(deletingCommentId);
    setDeletingCommentId(null);
  }, [deletingCommentId, onDeleteComment]);

  if (!task) return null;
  const assignee = task.assigneeId ? userById.get(task.assigneeId) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>{task.description ?? "Pas de description"}</DialogDescription>
        </DialogHeader>
        <div className="p-6 overflow-y-auto max-h-[90vh]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{task.title}</h2>
              <p className="text-sm text-muted-foreground">{task.description ?? "Pas de description"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Fermer">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Statut</p>
                <Badge className={getTaskStatusBadgeClass(task.status)}>{getStatusLabel(task.status, t)}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Projet</p>
                <p>{projectName ?? "-"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assigné à</p>
                {assignee ? <div className="flex items-center gap-2"><Avatar className="h-6 w-6 text-xs"><span>{getInitials(assignee.name)}</span></Avatar><span className="text-sm">{assignee.name}</span></div> : "-"}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Date d'échéance</p>
                {task.dueDate ? <p className={isPast(new Date(task.dueDate)) ? "text-red-600 font-medium" : ""}>{format(new Date(task.dueDate), "dd MMM yyyy")}</p> : "-"}
              </div>
            </div>

            <TaskChecklist taskId={task.id} />
            <TaskAttachments taskId={task.id} projectId={task.projectId} clientId={projectClientId} canUpload={canManageAttachments} />

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
                          <div key={comment.id} style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${virtualRow.start}px)` }}>
                            <div className="flex gap-3 py-2">
                              <Avatar className="h-8 w-8 text-xs"><span>{getInitials(comment.author.name)}</span></Avatar>
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{comment.author.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: fr })}
                                      {comment.editedAt && <span title={new Date(comment.editedAt).toLocaleString("fr-FR")}> {" "}(modifié)</span>}
                                    </span>
                                    {canEditComment(comment, currentUserId, isAdmin) && editingCommentId !== comment.id && (
                                      <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t("common.edit")} onClick={() => startEditComment(comment)}><Edit className="h-3.5 w-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50" aria-label={t("common.delete")} onClick={() => setDeletingCommentId(comment.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {editingCommentId === comment.id ? (
                                  <div className="mt-1 space-y-2">
                                    <Textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={2} className="text-sm" />
                                    <div className="flex gap-2 justify-end">
                                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={cancelEditComment}><X className="h-3.5 w-3.5" />Annuler</Button>
                                      <Button size="sm" className="h-7 text-xs" onClick={submitEditComment} disabled={isUpdatingComment || !editingContent.trim()}>Enregistrer</Button>
                                    </div>
                                  </div>
                                ) : <p className="text-sm text-muted-foreground mt-1"><MentionText content={comment.content} /></p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-6">Aucun commentaire</p>}
                </div>
              </ScrollArea>
              <CommentForm onCreateComment={onAddComment} createCommentMutation={createCommentMutation} mentionableUsers={mentionableUsers} />
            </div>
          </div>
        </div>
      </DialogContent>

      <ConfirmDeleteDialog
        open={!!deletingCommentId}
        onOpenChange={(open) => { if (!open) setDeletingCommentId(null); }}
        onConfirm={confirmDeleteComment}
        title="Supprimer ce commentaire ?"
        description="Cette action est irréversible. Le commentaire sera définitivement supprimé."
        isDeleting={isDeletingComment}
      />
    </Dialog>
  );
}
