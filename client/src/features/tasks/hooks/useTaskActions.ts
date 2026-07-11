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
import { useTaskCommentMutation } from "./useTaskCommentMutation";

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

  const runCreate = useCallback(
    (data: CreateTaskForm) => {
      createTask(data, {
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
        { id: editingTask.id, data },
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
  };
}
