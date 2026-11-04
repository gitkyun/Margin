import type { ComponentProps, FC } from "react";
export const Badge: FC<
  ComponentProps<"span"> & {
    variant?: "default" | "secondary" | "destructive" | "outline";
    asChild?: boolean;
  }
>;
export const badgeVariants: (props?: Record<string, unknown>) => string;
