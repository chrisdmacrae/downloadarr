import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Badges are pills. Every tone here is monochrome except `accent` and
 * `danger` — status and content type are told apart by value, not hue.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill border border-transparent px-2.5 h-[22px] text-2xs font-bold uppercase tracking-wide whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-brand-500 text-fg-accent",
        neutral: "bg-white/[.05] text-fg-secondary border-subtle",
        secondary: "bg-white/[.08] text-fg-body",
        outline: "bg-transparent text-fg-secondary border-strong",
        glass: "glass text-fg-primary border-strong",
        destructive: "bg-brand-tint text-status-failed",
        // Content-type tones: white / ink-100 / ink-300.
        movie: "bg-white/[.12] text-tone-brightest",
        tv: "bg-white/[.08] text-tone-bright",
        game: "bg-white/[.08] text-tone-mid",
        other: "bg-white/[.05] text-tone-dim",
        count: "bg-brand-500 text-fg-accent font-mono min-w-[20px] justify-center px-1.5",
      },
      size: {
        default: "h-[22px] px-2.5 text-2xs",
        sm: "h-[18px] px-[7px] text-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
