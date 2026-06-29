import { useParams, Link } from "react-router-dom";
import { formatDate } from "@/utils/format";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { freelancersApi } from "@/api/freelancers.api";
import { ratingsApi } from "@/api/ratings.api";
import { queryKeys } from "@/lib/query-keys";
import { Loader2, ArrowLeft, Clock, Star, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTranslation } from "react-i18next";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMe } from "@/hooks/useAuth";

export function FreelancerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useMe();
  const queryClient = useQueryClient();
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [newScore, setNewScore] = useState(5);
  const [newComment, setNewComment] = useState("");

  const { data: freelancer, isLoading } = useQuery({
    queryKey: queryKeys.freelancer(id!),
    queryFn: () => freelancersApi.getById(id!),
    enabled: !!id,
  });

  const { data: ratings, isLoading: ratingsLoading, isError: ratingsError } = useQuery({
    queryKey: queryKeys.freelancerRatings(id!),
    queryFn: () => ratingsApi.getByFreelancerId(id!),
    enabled: !!id,
  });

  const addRatingMutation = useMutation({
    mutationFn: (data: { score: number; comment?: string }) =>
      ratingsApi.add(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.freelancerRatings(id!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.freelancer(id!) });
      setRatingDialogOpen(false);
      setNewScore(5);
      setNewComment("");
    },
  });

  if (isLoading || ratingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!freelancer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{t("freelancers.notFound")}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/app/talent">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Link>
        </Button>
      </div>
    );
  }

  const initials = freelancer.user.name.slice(0, 2).toUpperCase();
  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isFreelancer = user?.role === "FREELANCER";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/app/talent">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t("common.back")}
          </Link>
        </Button>
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h1 className="text-2xl font-bold">{freelancer.user.name}</h1>
                  {!isFreelancer && freelancer.user.email && (
                    <p className="text-muted-foreground">{freelancer.user.email}</p>
                  )}
                </div>
                <Badge variant={freelancer.availability ? "default" : "secondary"}>
                  {freelancer.availability ? t("freelancers.available") : t("freelancers.busy")}
                </Badge>
              </div>

              {freelancer.hourlyRate && (
                <div className="flex items-center gap-1 text-sm font-medium">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {freelancer.hourlyRate} TND/h
                </div>
              )}

              {freelancer.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed">{freelancer.bio}</p>
              )}

              {freelancer.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {freelancer.skills.map((skill) => (
                    <Badge key={skill.id} variant="outline">{skill.name}</Badge>
                  ))}
                </div>
              )}

              {isAdminOrManager && (
                <Button onClick={() => setRatingDialogOpen(true)} variant="secondary" size="sm" className="mt-4">
                  <Star className="h-4 w-4 mr-1" />
                  {t("freelancers.rateFreelancer")}
                </Button>
              )}
              {isFreelancer && (
                <p className="text-xs text-muted-foreground mt-2">{t("freelancers.infoOnlyAdmins")}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ratings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("freelancers.ratingsAndReviews")}</CardTitle>
            {freelancer.reviewCount > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="text-xl font-bold">{freelancer.rating}</span>
                <span className="text-muted-foreground">({freelancer.reviewCount})</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ratingsError ? (
            <p className="text-sm text-destructive">{t("freelancers.ratingsLoadError", "Failed to load ratings")}</p>
          ) : ratings && ratings.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("freelancers.noRatings")}</p>
          ) : (
            ratings?.map((rating) => (
              <div key={rating.id} className="space-y-1 border-b last:border-0 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {rating.ratedByUser?.name || "Anonymous"}
                  </div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < rating.score ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                </div>
                {rating.comment && (
                  <p className="text-sm text-muted-foreground">{rating.comment}</p>
                )}
                <p className="text-xs text-gray-400">
                  {formatDate(rating.createdAt)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Rating Dialog */}
      <Dialog open={ratingDialogOpen} onOpenChange={setRatingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("freelancers.rateFreelancer")}</DialogTitle>
            <DialogDescription>
              {t("freelancers.rateDialogDesc", { name: freelancer.user.name })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map((score) => (
                <Button
                  key={score}
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewScore(score)}
                >
                  <Star
                    className={`h-6 w-6 ${score <= newScore ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                  />
                </Button>
              ))}
            </div>
            <Textarea
              placeholder={t("freelancers.commentOptional")}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRatingDialogOpen(false)}>{t("freelancers.cancel")}</Button>
            <Button
              onClick={() => addRatingMutation.mutate({ score: newScore, comment: newComment.trim() || undefined })}
              disabled={addRatingMutation.isPending}
            >
              {addRatingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              {t("freelancers.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
