import { format } from "date-fns";
import { Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "./StarRating";
import type { FreelancerRating } from "@/types/rating";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ReviewListProps {
  reviews: FreelancerRating[];
  currentUserId?: string;
  isAdmin?: boolean;
  onEdit?: (review: FreelancerRating) => void;
  onDelete?: (id: string) => void;
}

export function ReviewList({
  reviews,
  currentUserId,
  isAdmin,
  onEdit,
  onDelete,
}: ReviewListProps) {
  const { t } = useTranslation();

  if (reviews.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">{t("ratings.noReviews")}</p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const canModify = isAdmin || review.reviewerId === currentUserId;
        return (
          <div key={review.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {review.reviewer.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{review.reviewer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("ratings.forMission")}: {review.mission.title}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <StarRating value={review.score} size="sm" />
                <span className="text-xs text-muted-foreground ml-1">
                  {format(new Date(review.createdAt), "MMM d, yyyy")}
                </span>
                {canModify && (
                  <>
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(review)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(review.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            {review.comment && (
              <p className="text-sm text-muted-foreground leading-relaxed pl-10">
                {review.comment}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
