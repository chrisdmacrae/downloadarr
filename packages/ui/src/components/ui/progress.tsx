import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** Fill colour. Defaults to the accent; status bars pass a status tone. */
  indicatorColor?: string
  /** In-flight bars carry slow diagonal stripes. */
  striped?: boolean
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorColor, striped, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-1.5 w-full overflow-hidden rounded-pill bg-ink-700",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full rounded-pill transition-[width] duration-slow ease-standard",
        striped && "progress-striped"
      )}
      style={{
        width: `${Math.max(0, Math.min(100, value || 0))}%`,
        background: indicatorColor || "var(--accent)",
      }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
