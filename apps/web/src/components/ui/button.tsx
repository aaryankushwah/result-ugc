import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { DitherButton } from "@/components/dither-kit/button"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-sans text-[15px] font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_canvas]:transition-opacity [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent text-foreground [&_canvas]:opacity-100",
        outline:
          "border-border bg-transparent text-foreground hover:[&_canvas]:opacity-45 dark:border-input [&_canvas]:opacity-20",
        secondary:
          "border-border bg-transparent text-secondary-foreground hover:[&_canvas]:opacity-55 [&_canvas]:opacity-30",
        ghost:
          "bg-transparent text-muted-foreground hover:text-foreground hover:[&_canvas]:opacity-30 [&_canvas]:opacity-0",
        destructive:
          "border-destructive/50 bg-transparent text-destructive focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [&_canvas]:opacity-75",
        link: "bg-transparent text-primary underline-offset-4 hover:underline hover:[&_canvas]:opacity-25 [&_canvas]:opacity-0",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  if (!asChild) {
    const dither = {
      default: { color: "purple" as const, variant: "gradient" as const, bloom: "low" as const },
      outline: { color: "grey" as const, variant: "dotted" as const, bloom: "off" as const },
      secondary: { color: "grey" as const, variant: "gradient" as const, bloom: "off" as const },
      ghost: { color: "grey" as const, variant: "dotted" as const, bloom: "off" as const },
      destructive: { color: "red" as const, variant: "hatched" as const, bloom: "low" as const },
      link: { color: "purple" as const, variant: "dotted" as const, bloom: "off" as const },
    }[variant ?? "default"]

    return (
      <DitherButton
        {...props}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        color={dither.color}
        variant={dither.variant}
        bloom={dither.bloom}
        className={cn(buttonVariants({ variant, size, className }))}
      />
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
