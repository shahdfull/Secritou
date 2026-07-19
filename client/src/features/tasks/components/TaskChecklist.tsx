import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ListChecks } from "lucide-react";
import {
  useTaskChecklist,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
} from "../hooks/useTaskChecklist";

interface TaskChecklistProps {
  taskId: string;
}

// SEC-075: mirrors the server-side cap (taskChecklist.service.ts#MAX_CHECKLIST_ITEMS_PER_TASK) —
// disabling the input client-side here is a UX courtesy only, the server remains the real gate.
const MAX_CHECKLIST_ITEMS_PER_TASK = 100;

// SEC-060 (sous-tâches, item 4 du constat P1 rapport Product Owner) : checklist plate sur une
// tâche (décision du porteur, session 2026-07-19) — un seul niveau, aucun assignee/statut/échéance
// propre, aucune règle de complétion automatique de la tâche parente : le pourcentage affiché ici
// est purement informatif, il n'influence jamais le statut de la tâche.
export function TaskChecklist({ taskId }: TaskChecklistProps) {
  const { data: items, isLoading } = useTaskChecklist(taskId);
  const { mutate: createItem, isPending: isCreating } = useCreateChecklistItem(taskId);
  const { mutate: updateItem } = useUpdateChecklistItem(taskId);
  const { mutate: deleteItem } = useDeleteChecklistItem(taskId);
  const [newItemTitle, setNewItemTitle] = useState("");

  const list = items ?? [];
  const doneCount = list.filter((item) => item.done).length;
  const progress = list.length > 0 ? Math.round((doneCount / list.length) * 100) : 0;
  const atLimit = list.length >= MAX_CHECKLIST_ITEMS_PER_TASK;

  const handleAdd = () => {
    if (!newItemTitle.trim()) return;
    createItem(newItemTitle.trim(), { onSuccess: () => setNewItemTitle("") });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <ListChecks className="h-4 w-4" />
          Sous-tâches
        </h3>
        {list.length > 0 && (
          <span className="text-xs text-muted-foreground">{doneCount}/{list.length}</span>
        )}
      </div>

      {list.length > 0 && <Progress value={progress} className="h-1.5" />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : list.length > 0 ? (
        <ul className="space-y-1.5">
          {list.map((item) => (
            <li key={item.id} className="flex items-center gap-2 group">
              <Checkbox
                checked={item.done}
                onCheckedChange={(checked) => updateItem({ itemId: item.id, data: { done: checked === true } })}
                aria-label={`Marquer "${item.title}" comme ${item.done ? "non terminée" : "terminée"}`}
              />
              <span className={"flex-1 text-sm " + (item.done ? "line-through text-muted-foreground" : "")}>
                {item.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 hover:bg-red-50"
                aria-label="Supprimer"
                onClick={() => deleteItem(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucune sous-tâche.</p>
      )}

      {atLimit ? (
        <p className="text-xs text-muted-foreground">
          Limite de {MAX_CHECKLIST_ITEMS_PER_TASK} sous-tâches atteinte pour cette tâche.
        </p>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Ajouter une sous-tâche..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="h-8 text-sm"
          />
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleAdd} disabled={!newItemTitle.trim() || isCreating}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
