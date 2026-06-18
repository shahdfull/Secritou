import { DetailDrawer } from "@/components/shared/crud/DetailDrawer";
import { StatusBadge } from "@/components/shared/crud/StatusBadge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import type { Task } from "@/types/task";
import type { Project } from "@/types/project";
import type { User } from "@/types/auth";
import { format, isPast } from "date-fns";
import { CommentsSection } from "./CommentsSection";
import type { Comment } from "@/types/comment";

interface TaskDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  projects: Project[];
  users: User[];
  comments: Comment[];
  onCreateComment: (content: string) => void;
  createCommentMutation: { isPending: boolean };
  onEdit: (task: Task) => void;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  projects,
  users,
  comments,
  onCreateComment,
  createCommentMutation,
  onEdit,
}: TaskDetailSheetProps) {
  if (!task) return null;

  const projectName = projects.find((p) => p.id === task.projectId)?.name;
  const assignee = task.assigneeId ? users.find((u) => u.id === task.assigneeId) : undefined;
  const dueDateColor = task.dueDate && isPast(new Date(task.dueDate)) ? "text-red-600 font-medium" : "";

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={task.title}
      description={`Projet: ${projectName || "-"}`}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <StatusBadge status={task.status} />
          <Button variant="outline" size="sm" onClick={() => onEdit(task)}>
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
        </div>

        {task.description && (
          <div>
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground">{task.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Assigné à</h4>
            {assignee ? (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6 text-xs">
                  <span>{getInitials(assignee.name)}</span>
                </Avatar>
                <span className="text-sm">{assignee.name}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div>
            <h4 className="text-sm font-medium mb-2">Date d'échéance</h4>
            <span className={`text-sm ${dueDateColor}`}>
              {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "-"}
            </span>
          </div>
        </div>

        <CommentsSection
          comments={comments}
          onCreateComment={onCreateComment}
          createCommentMutation={createCommentMutation}
        />
      </div>
    </DetailDrawer>
  );
}
