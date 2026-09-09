import * as React from "react"
import { X, CheckCircle2, AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ToastVariant } from "@/hooks/use-toast"

/** Bottom-right stack. */
export const ToastViewport = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2.5",
      className
    )}
    {...props}
  />
)

interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ToastVariant
  onDismiss?: () => void
}

export const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant = "default", onDismiss, children, ...props }, ref) => {
    const isError = variant === "destructive"
    const Icon = isError ? AlertCircle : CheckCircle2
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "pointer-events-auto relative flex w-[360px] max-w-[calc(100vw-48px)] items-start gap-3 overflow-hidden rounded-card border border-subtle bg-surface-overlay p-3.5 shadow-4 animate-fade-up",
          className
        )}
        {...props}
      >
        <span
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: isError ? "var(--status-failed)" : "var(--ink-500)" }}
        />
        <Icon
          className="mt-px h-4 w-4 shrink-0"
          style={{ color: isError ? "var(--status-failed)" : "var(--ink-300)" }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-sm p-0.5 text-fg-muted transition-colors duration-fast ease-standard hover:text-fg-primary focus-visible:outline-none focus-visible:shadow-focus"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

export const ToastTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-sm font-bold text-fg-primary", className)} {...props} />
)

export const ToastDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("text-xs text-fg-secondary text-pretty", className)} {...props} />
)

export const ToastProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>
