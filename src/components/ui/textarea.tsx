import * as React from "react"

import { cn } from "../../lib/cn"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm ring-offset-0 placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d9bf0]/50 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-950 dark:placeholder:text-neutral-400",
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
