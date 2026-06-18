import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onView && (
          <DropdownMenuItem onClick={onView}>
            <Eye className="h-4 w-4 mr-2" />
            {viewLabel}
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            {editLabel}
          </DropdownMenuItem>
        )}
        {children}
        {onDelete && (
          <DropdownMenuItem onClick={onDelete} disabled={isDeleting} className="text-red-600">
            <Trash2 className="h-4 w-4 mr-2" />
            {deleteLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
