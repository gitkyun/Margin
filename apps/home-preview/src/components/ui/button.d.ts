import type { ComponentProps, FC } from "react";
export type ButtonProps = ComponentProps<"button"> & {
  asChild?: boolean;
  variant?:
    "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?:
    "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";
};
export const Button: FC<ButtonProps>;
export const buttonVariants: (
  props?: Pick<ButtonProps, "variant" | "size" | "className">,
) => string;
