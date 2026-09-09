import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

/** 40×22 track; on goes brand red, the knob travels 18px. */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          "relative inline-flex shrink-0 items-center",
          disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer"
        )}
      >
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          ref={ref}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div
          className={cn(
            "h-[22px] w-10 rounded-pill border border-subtle bg-ink-700 transition-colors duration-fast ease-standard",
            "after:absolute after:left-[3px] after:top-[3px] after:h-4 after:w-4 after:rounded-pill after:bg-ink-200 after:transition-transform after:duration-fast after:ease-standard after:content-['']",
            "peer-checked:border-[color:var(--accent)] peer-checked:bg-brand-500",
            "peer-checked:after:translate-x-[18px] peer-checked:after:bg-white",
            "peer-focus-visible:shadow-focus",
            className
          )}
        />
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
