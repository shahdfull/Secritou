import { useCallback, useState } from "react";

export interface CrudDialogState<T> {
  createDialogOpen: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;
  editingEntity: T | null;
  deletingEntity: T | null;
}

export function useCrudDialogState<T>() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<T | null>(null);
  const [deletingEntity, setDeletingEntity] = useState<T | null>(null);

  const openCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const openEditDialog = useCallback((entity: T) => {
    setEditingEntity(entity);
    setEditDialogOpen(true);
  }, []);

  const closeEditDialog = useCallback(() => {
    setEditDialogOpen(false);
    setEditingEntity(null);
  }, []);

  const openDeleteDialog = useCallback((entity: T) => {
    setDeletingEntity(entity);
    setDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeletingEntity(null);
  }, []);

  return {
    createDialogOpen,
    editDialogOpen,
    deleteDialogOpen,
    editingEntity,
    deletingEntity,
    openCreateDialog,
    closeCreateDialog,
    openEditDialog,
    closeEditDialog,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
