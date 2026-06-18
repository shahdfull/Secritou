import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (value: number) => void;
  className?: string;
}

const sizeMap = { sm: 14, md: 18, lg: 24 };

export function StarRating({
  value,
  max = 5,
  size = "md",
  interactive = false,
  onChange,
  className,
}: StarRatingProps) {
  const px = sizeMap[size];

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i + 1 <= Math.round(value);
        return (
          <Star
            key={i}
            width={px}
            height={px}
            className={cn(
              "transition-colors",
              filled ? "fill-yellow-400 text-yellow-400" : "fill-none text-gray-300",
              interactive && "cursor-pointer hover:fill-yellow-300 hover:text-yellow-300"
            )}
            onClick={() => interactive && onChange?.(i + 1)}
          />
        );
      })}
    </div>
  );
}
