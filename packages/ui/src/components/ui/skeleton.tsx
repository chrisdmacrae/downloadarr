import { cn } from "@/lib/utils"

/** Shimmers at 1.6s; the shimmer is dropped under prefers-reduced-motion. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton rounded-md", className)} {...props} />
}

export { Skeleton }
