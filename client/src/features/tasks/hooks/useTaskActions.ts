import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateTask, useUpdateTask, useDeleteTask, useCheckFreelancerAvailability } from "@/hooks/useTasks";
import { useCrudDialogState } from "@/hooks/shared/useCrudDialogState";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskForm,
  type UpdateTaskForm,
} from "@/schemas/task.schema";
import type { Task, FreelancerConflict } from "@/types/task";
import { useTaskCommentMutation, useUpdateTaskComment, useDeleteTaskComment } from "./useTaskCommentMutation";

/**
 * Owns all task CRUD + comment state and handlers: the create/edit forms, the
 * three task mutations, the create/edit dialog state, the detail-drawer
 * selection, the delete-confirmation target, and the comment mutation.
 *
 * Extracted from TasksPage unchanged in behaviour — the page now only wires
 * these into its layout.
 */
export function useTaskActions() {
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);
  const selectedTaskId = selectedTask?.id ?? null;

  const { mutate: createTask, isPending: isCreating } = useCreateTask();
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask();
  const { mutateAsync: checkAvailability, isPending: isCheckingAvailability } = useCheckFreelancerAvailability();
  const createCommentMutation = useTaskCommentMutation();
  const updateCommentMutation = useUpdateTaskComment();
  const deleteCommentMutation = useDeleteTaskComment();

  // Conflict-confirmation state, shared by create + edit: holds the conflicts found for the
  // pending submission (create has no excludeTaskId, edit excludes the task being edited so it
  // doesn't flag itself) and which form the pending submit came from.
  const [pendingConflicts, setPendingConflicts] = useState<FreelancerConflict[] | null>(null);
  const [pendingSubmit, setPendingSubmit] = useState<{
    kind: "create" | "update";
    data: CreateTaskForm | UpdateTaskForm;
  } | null>(null);

  const {
    createDialogOpen,
    editDialogOpen,
    editingEntity: editingTask,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
  } = useCrudDialogState<Task>();

  const createForm = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "TODO",
      priority: "NORMAL",
      projectId: "",
      startDate: "",
      dueDate: "",
    },
  });

  const editForm = useForm<UpdateTaskForm>({
    resolver: zodResolver(updateTaskSchema),
  });

  // SEC-079: the date inputs default to "" (never omitted), but the server schema only treats
  // startDate/dueDate as optional when the key is truly absent — an empty string fails its
  // `refine(isValidDateString)` with "Invalid date". Strip empty date strings here, at the single
  // point both create and update funnel through, rather than in the server schema (which would
  // also have to special-case "" for every other optional string field it might grow later).
  const stripEmptyDates = <T extends { startDate?: string; dueDate?: string }>(data: T): T => ({
    ...data,
    startDate: data.startDate || undefined,
    dueDate: data.dueDate || undefined,
  });

  const runCreate = useCallback(
    (data: CreateTaskForm) => {
      createTask(stripEmptyDates(data), {
        onSuccess: () => {
          closeCreateDialog();
          createForm.reset();
        },
      });
    },
    [createForm, createTask, closeCreateDialog]
  );

  const runUpdate = useCallback(
    (data: UpdateTaskForm) => {
      if (!editingTask) return;
      updateTask(
        { id: editingTask.id, data: stripEmptyDates(data) },
        {
          onSuccess: () => {
            closeEditDialog();
          },
        }
      );
    },
    [editingTask, updateTask, closeEditDialog]
  );

  // Shared by create/update: only worth checking when there's an assignee AND a real date range
  // to compare against (a task with just a dueDate, or no assignee, is never "double-booked").
  const checkConflictsThen = useCallback(
    async (
      data: CreateTaskForm | UpdateTaskForm,
      kind: "create" | "update",
      excludeTaskId: string | undefined,
      proceed: () => void
    ) => {
      const { assigneeId, startDate, dueDate } = data;
      if (!assigneeId || !startDate || !dueDate) {
        proceed();
        return;
      }
      const conflicts = await checkAvailability({ freelancerId: assigneeId, startDate, endDate: dueDate, excludeTaskId });
      if (conflicts.length > 0) {
        setPendingConflicts(conflicts);
        setPendingSubmit({ kind, data });
        return;
      }
      proceed();
    },
    [checkAvailability]
  );

  const handleCreate = useCallback(
    (data: CreateTaskForm) => {
      void checkConflictsThen(data, "create", undefined, () => runCreate(data));
    },
    [checkConflictsThen, runCreate]
  );

  // SEC-055 (F5): the "Partir du template" button on ProjectDetailPage only appears once a
  // project has zero tasks — once it has at least one, there was no contextualized way to add
  // another from that page. This lets ProjectDetailPage open the create dialog directly, with
  // projectId pre-filled, instead of sending the user to the global /app/tasks page to pick the
  // project by hand from a selector already known to truncate past 100 (SEC-053).
  const openCreateDialogForProject = useCallback(
    (projectId: string) => {
      createForm.reset({
        title: "",
        description: "",
        status: "TODO",
        priority: "NORMAL",
        projectId,
        startDate: "",
        dueDate: "",
      });
      openCreateDialog();
    },
    [createForm, openCreateDialog]
  );

  const handleEditTask = useCallback(
    (task: Task) => {
      openEditDialog(task);
      editForm.reset({
        ...task,
        startDate: task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : "",
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      });
    },
    [editForm, openEditDialog]
  );

  const handleUpdate = useCallback(
    (data: UpdateTaskForm) => {
      if (!editingTask) return;
      void checkConflictsThen(data, "update", editingTask.id, () => runUpdate(data));
    },
    [editingTask, checkConflictsThen, runUpdate]
  );

  const handleConfirmAssignAnyway = useCallback(() => {
    if (!pendingSubmit) return;
    if (pendingSubmit.kind === "create") {
      runCreate(pendingSubmit.data as CreateTaskForm);
    } else {
      runUpdate(pendingSubmit.data as UpdateTaskForm);
    }
    setPendingConflicts(null);
    setPendingSubmit(null);
  }, [pendingSubmit, runCreate, runUpdate]);

  const handleCancelConflict = useCallback(() => {
    setPendingConflicts(null);
    setPendingSubmit(null);
  }, []);

  const handleDelete = useCallback((task: Task) => {
    setDeleteTaskTarget(task);
  }, []);

  const handleConfirmDeleteTask = useCallback(() => {
    if (!deleteTaskTarget) return;
    deleteTask(deleteTaskTarget.id, {
      onSuccess: () => setDeleteTaskTarget(null),
      onError: () => {
        toast.error("Une erreur est survenue lors de la suppression.");
        setDeleteTaskTarget(null);
      },
    });
  }, [deleteTaskTarget, deleteTask]);

  const handleView = useCallback((task: Task) => {
    setSelectedTask(task);
    setDetailSheetOpen(true);
  }, []);

  const handleAddComment = useCallback(
    (content: string) => {
      if (!selectedTaskId || !content.trim()) return;
      createCommentMutation.mutate({ taskId: selectedTaskId, content });
    },
    [createCommentMutation, selectedTaskId]
  );

  // SEC-059: edit/delete for a task comment, mirroring the meeting edit/delete flow (SEC-055/F6).
  const handleUpdateComment = useCallback(
    (commentId: string, content: string) => {
      if (!selectedTaskId || !content.trim()) return;
      updateCommentMutation.mutate({ taskId: selectedTaskId, commentId, content });
    },
    [updateCommentMutation, selectedTaskId]
  );

  const handleDeleteComment = useCallback(
    (commentId: string) => {
      if (!selectedTaskId) return;
      deleteCommentMutation.mutate({ taskId: selectedTaskId, commentId });
    },
    [deleteCommentMutation, selectedTaskId]
  );

  return {
    // selection / drawer
    selectedTask,
    selectedTaskId,
    detailSheetOpen,
    setDetailSheetOpen,
    // delete confirmation
    deleteTaskTarget,
    setDeleteTaskTarget,
    isDeleting,
    handleConfirmDeleteTask,
    // create
    createForm,
    createDialogOpen,
    openCreateDialog,
    openCreateDialogForProject,
    closeCreateDialog,
    isCreating,
    handleCreate,
    // edit
    editForm,
    editingTask,
    editDialogOpen,
    closeEditDialog,
    isUpdating,
    handleEditTask,
    handleUpdate,
    // row actions
    handleView,
    handleDelete,
    // freelancer conflict confirmation
    pendingConflicts,
    isCheckingAvailability,
    isConfirmingConflict: isCreating || isUpdating,
    handleConfirmAssignAnyway,
    handleCancelConflict,
    // comments
    createCommentMutation,
    handleAddComment,
    handleUpdateComment,
    handleDeleteComment,
    isUpdatingComment: updateCommentMutation.isPending,
    isDeletingComment: deleteCommentMutation.isPending,
  };
}
