import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useCrudDialogState } from "@/hooks/shared/useCrudDialogState";
import {
  createTaskSchema,
  updateTaskSchema,
  type CreateTaskForm,
  type UpdateTaskForm,
} from "@/schemas/task.schema";
import type { Task } from "@/types/task";
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
  const createCommentMutation = useTaskCommentMutation();

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
      dueDate: "",
    },
  });

  const editForm = useForm<UpdateTaskForm>({
    resolver: zodResolver(updateTaskSchema),
  });

  const handleCreate = useCallback(
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

  const handleEditTask = useCallback(
    (task: Task) => {
      openEditDialog(task);
      editForm.reset({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
      });
    },
    [editForm, openEditDialog]
  );

  const handleUpdate = useCallback(
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
    // comments
    createCommentMutation,
    handleAddComment,
  };
}
