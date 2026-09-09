import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-control border border-subtle bg-surface-input px-3 text-sm text-fg-primary transition-[background-color,border-color,box-shadow] duration-fast ease-standard",
          "placeholder:text-fg-muted",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg-body",
          "hover:enabled:bg-surface-input-hover hover:enabled:border-strong",
          // Inputs take a red border and a 3px red tint halo on focus.
          "focus:outline-none focus:border-[color:var(--accent)] focus:bg-surface-input-hover focus:shadow-[0_0_0_3px_var(--brand-tint-16)]",
          "disabled:cursor-not-allowed disabled:opacity-45",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
