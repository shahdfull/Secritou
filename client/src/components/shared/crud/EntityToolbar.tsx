import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye } from "lucide-react";

interface EntityToolbarProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  viewLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
  children?: ReactNode;
}

export function EntityToolbar({
  onView,
  onEdit,
  onDelete,
  isDeleting = false,
  viewLabel = "Voir",
  editLabel = "Modifier",
  deleteLabel = "Supprimer",
  children,
}: EntityToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      {onView && (
        <Button variant="ghost" size="icon" className="h-7 w-7" title={viewLabel} onClick={onView}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
      )}
      {onEdit && (
        <Button variant="ghost" size="icon" className="h-7 w-7" title={editLabel} onClick={onEdit}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
      )}
      {children}
      {onDelete && (
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" title={deleteLabel} onClick={onDelete} disabled={isDeleting}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
