import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[96px] w-full resize-y rounded-control border border-subtle bg-surface-input px-3 py-2.5 text-sm leading-relaxed text-fg-primary transition-[background-color,border-color,box-shadow] duration-fast ease-standard",
          "placeholder:text-fg-muted",
          "hover:enabled:bg-surface-input-hover hover:enabled:border-strong",
          "focus:outline-none focus:border-[color:var(--accent)] focus:shadow-[0_0_0_3px_var(--brand-tint-16)]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
