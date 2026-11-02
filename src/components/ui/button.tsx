import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-foreground text-background hover:opacity-90",
  secondary: "border border-border bg-surface hover:bg-surface-muted",
  ghost: "hover:bg-surface-muted text-muted hover:text-foreground",
  danger: "text-danger hover:bg-danger/10",
};

type Size = "sm" | "default" | "lg" | "icon";

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  default: "h-9 px-3.5 text-sm",
  lg: "h-11 px-5 text-[15px]",
  icon: "size-9 text-sm",
};

export function buttonClass(variant: Variant = "secondary", extra = "", size: Size = "default") {
  return `inline-flex shrink-0 items-center justify-center gap-2 rounded-lg ${sizes[size]} font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "secondary",
  size = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, className, size)} {...props} />;
}
