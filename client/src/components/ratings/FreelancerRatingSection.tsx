import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";
import { RatingStatsCard } from "./RatingStats";
import { ReviewList } from "./ReviewList";
import { RatingForm } from "./RatingForm";
import {
  useFreelancerRatings,
  useCreateRating,
  useUpdateRating,
  useDeleteRating,
} from "@/hooks/useRatings";
import { useAuthStore } from "@/store/auth.store";
import type { FreelancerRating } from "@/types/rating";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { toast } from "sonner";

interface FreelancerRatingSectionProps {
  freelancerId: string;
  /** The mission ID to pre-fill when a client can rate (optional). */
  missionId?: string;
}

export function FreelancerRatingSection({
  freelancerId,
  missionId,
}: FreelancerRatingSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FreelancerRating | null>(null);

  const { data, isLoading } = useFreelancerRatings(freelancerId, { page, pageSize: 5 });
  const createRating = useCreateRating();
  const updateRating = useUpdateRating(freelancerId);
  const deleteRating = useDeleteRating(freelancerId);

  const canRate =
    !!missionId &&
    (user?.role === "CLIENT" || user?.role === "ADMIN");

  async function handleCreate(values: { score: number; comment?: string }) {
    if (!missionId) return;
    try {
      await createRating.mutateAsync({ freelancerId, missionId, ...values });
      setCreateOpen(false);
      toast.success(t("ratings.created"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    }
  }

  async function handleUpdate(values: { score?: number; comment?: string }) {
    if (!editTarget) return;
    try {
      await updateRating.mutateAsync({ id: editTarget.id, data: values });
      setEditTarget(null);
      toast.success(t("ratings.updated"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteRating.mutateAsync(id);
      toast.success(t("ratings.deleted"));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t("common.error"));
    }
  }

  const stats = data?.stats;
  const reviews = data?.data ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 5;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("ratings.title")}</h3>
        {canRate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                {t("ratings.writeReview")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("ratings.writeReview")}</DialogTitle>
              </DialogHeader>
              <RatingForm
                freelancerId={freelancerId}
                missionId={missionId!}
                onSubmit={handleCreate}
                onCancel={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {stats && stats.reviewCount > 0 && (
        <>
          <RatingStatsCard stats={stats} />
          <Separator />
        </>
      )}

      {isLoading ? (
        <p className="text-center text-muted-foreground py-4">{t("common.loading")}</p>
      ) : (
        <ReviewList
          reviews={reviews}
          currentUserId={user?.id}
          isAdmin={user?.role === "ADMIN"}
          onEdit={setEditTarget}
          onDelete={handleDelete}
        />
      )}

      {total > pageSize && (
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      )}

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ratings.editReview")}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <RatingForm
              freelancerId={freelancerId}
              missionId={editTarget.missionId}
              existing={editTarget}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
