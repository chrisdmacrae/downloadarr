import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold tracking-tight border border-transparent transition-[background-color,color,border-color,box-shadow,transform] duration-fast ease-standard active:scale-[.98] focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-45 disabled:cursor-not-allowed [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Brand red. Hover goes brighter and picks up the accent glow; press
        // goes deeper. Type on red is always white.
        default:
          "bg-brand-500 text-fg-accent hover:bg-brand-400 hover:shadow-glow active:bg-brand-600",
        // Failure is the one place chroma appears outside the accent.
        destructive:
          "bg-brand-400 text-fg-accent hover:bg-brand-300 active:bg-brand-600",
        outline:
          "bg-transparent text-fg-primary border-strong hover:bg-surface-input-hover hover:border-[color:var(--text-secondary)]",
        secondary:
          "bg-surface-raised text-fg-primary border-subtle hover:bg-ink-750 hover:border-strong",
        ghost: "bg-transparent text-fg-secondary hover:bg-surface-input hover:text-fg-primary",
        // Glass sits over artwork only — hero actions, poster overlays.
        glass:
          "glass text-fg-primary border-strong hover:bg-white/[.14]",
        link: "h-auto p-0 text-fg-body underline-offset-4 hover:text-fg-primary hover:underline",
      },
      size: {
        default: "h-10 px-4 text-sm",
        sm: "h-9 px-3 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-10 w-10 px-0",
        "icon-sm": "h-8 w-8 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
