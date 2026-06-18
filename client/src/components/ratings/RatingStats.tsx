import { StarRating } from "./StarRating";
import type { RatingStats } from "@/types/rating";
import { useTranslation } from "react-i18next";

interface RatingStatsProps {
  stats: RatingStats;
}

export function RatingStatsCard({ stats }: RatingStatsProps) {
  const { t } = useTranslation();
  const { averageScore, reviewCount, distribution } = stats;

  return (
    <div className="flex flex-col sm:flex-row gap-6 p-4 bg-muted/40 rounded-lg">
      {/* Big average */}
      <div className="flex flex-col items-center justify-center min-w-[100px]">
        <span className="text-5xl font-bold">{averageScore.toFixed(1)}</span>
        <StarRating value={averageScore} size="md" className="mt-1" />
        <span className="text-sm text-muted-foreground mt-1">
          {t("ratings.reviewCount", { count: reviewCount })}
        </span>
      </div>

      {/* Distribution bars */}
      <div className="flex-1 flex flex-col gap-1">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = distribution[String(star) as keyof typeof distribution] ?? 0;
          const pct = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-right">{star}</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-muted-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
