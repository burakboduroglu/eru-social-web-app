import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/cn"

const buttonVariants = cva(
  "feature-button inline-flex min-w-0 items-center justify-center gap-2 whitespace-normal rounded-md text-[14px] leading-5 font-semibold text-center ring-offset-[var(--x-bg)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--x-blue)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-neutral-100 text-black hover:bg-neutral-200",
        destructive:
          "bg-red-700 text-neutral-50 hover:bg-red-800 dark:bg-red-900 dark:text-neutral-50 dark:hover:bg-red-900/90",
        outline:
          "border border-[var(--x-border)] bg-transparent text-[var(--x-text)] hover:bg-[var(--x-surface)]",
        secondary:
          "bg-[var(--x-surface)] text-[var(--x-text)] hover:bg-neutral-800",
        ghost: "text-[var(--x-text)] hover:bg-[var(--x-surface)]",
        link: "text-[var(--x-blue)] underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2",
        sm: "min-h-11 px-3 py-2",
        lg: "min-h-12 px-6 py-3",
        icon: "h-11 w-11 shrink-0 p-0",
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
        data-variant={variant || "default"}
        data-size={size || "default"}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
