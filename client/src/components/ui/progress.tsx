"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";
import styles from "./progress.module.css";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
    {...props}
  >
    {(() => {
      const clampedValue = Math.max(0, Math.min(100, Math.round(value ?? 0)));
      const bucketedValue = Math.round(clampedValue / 5) * 5;

      return (
    <ProgressPrimitive.Indicator
          className={cn(
            "h-full bg-primary transition-all",
            styles.indicator,
            styles[`value${bucketedValue}` as keyof typeof styles],
          )}
    />
      );
    })()}
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
