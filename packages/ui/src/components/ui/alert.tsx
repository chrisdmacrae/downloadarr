import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Tones are monochrome tints over the card surface; only `destructive`
 * carries chroma, because failure is the one state that does.
 */
const alertVariants = cva(
  "relative w-full rounded-card border p-4 text-fg-body [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "border-subtle bg-surface-card [&>svg]:text-fg-secondary",
        info: "border-subtle bg-white/[.05] [&>svg]:text-ink-200",
        success: "border-subtle bg-white/[.08] [&>svg]:text-ink-100",
        warning: "border-subtle bg-white/[.08] [&>svg]:text-ink-300",
        destructive:
          "border-[color:var(--brand-tint-16)] bg-[color:var(--brand-tint-16)] text-status-failed [&>svg]:text-status-failed",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 text-sm font-bold leading-snug text-fg-primary", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-fg-secondary text-pretty [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
