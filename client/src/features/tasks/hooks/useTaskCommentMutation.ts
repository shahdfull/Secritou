import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commentsApi } from "@/api/comments.api";
import { useAuthStore } from "@/store/auth.store";
import type { User } from "@/types/auth";
import type { Comment } from "@/types/comment";

/**
 * Comment creation with optimistic insert + rollback, scoped to a task's
 * ["taskComments", taskId] query. Extracted from TasksPage unchanged.
 */
export function useTaskCommentMutation() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (data: { taskId: string; content: string }) =>
      commentsApi.create(data.taskId, { content: data.content }),
    onMutate: async (vars: { taskId: string; content: string }) => {
      await queryClient.cancelQueries({ queryKey: ["taskComments", vars.taskId] });
      const previous = queryClient.getQueryData<Comment[]>(["taskComments", vars.taskId]) ?? [];

      const optimistic: Comment = {
        id: `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        content: vars.content,
        createdAt: new Date().toISOString(),
        taskId: vars.taskId,
        authorId: currentUser?.id ?? "me",
        author:
          currentUser ??
          ({
            id: "me",
            email: "me@local",
            name: "You",
            role: "ADMIN",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as User),
      };

      queryClient.setQueryData<Comment[]>(["taskComments", vars.taskId], [optimistic, ...previous]);
      return { previous, taskId: vars.taskId };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      queryClient.setQueryData(["taskComments", ctx.taskId], ctx.previous);
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ["taskComments", vars.taskId] });
    },
  });
}

// SEC-059: comment edit/delete, mirroring useProjectMeetings' update/delete mutations
// (SEC-055/F6) — the server is the real authority (403 COMMENT_NOT_YOURS), these just invalidate
// the task's comment list on success.
export function useUpdateTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId, content }: { taskId: string; commentId: string; content: string }) =>
      commentsApi.update(taskId, commentId, content),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["taskComments", vars.taskId] });
    },
  });
}

export function useDeleteTaskComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      commentsApi.delete(taskId, commentId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["taskComments", vars.taskId] });
    },
  });
}
