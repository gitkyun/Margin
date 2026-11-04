import type { ComponentProps, FC } from "react";
import type { Dialog as Primitive } from "radix-ui";
export const Sheet: FC<ComponentProps<typeof Primitive.Root>>;
export const SheetTrigger: FC<ComponentProps<typeof Primitive.Trigger>>;
export const SheetPortal: FC<ComponentProps<typeof Primitive.Portal>>;
export const SheetClose: FC<ComponentProps<typeof Primitive.Close>>;
export const SheetOverlay: FC<ComponentProps<typeof Primitive.Overlay>>;
export const SheetContent: FC<
  ComponentProps<typeof Primitive.Content> & {
    side?: "top" | "bottom" | "left" | "right";
    showCloseButton?: boolean;
  }
>;
export const SheetHeader: FC<ComponentProps<"div">>;
export const SheetFooter: FC<ComponentProps<"div">>;
export const SheetTitle: FC<ComponentProps<typeof Primitive.Title>>;
export const SheetDescription: FC<ComponentProps<typeof Primitive.Description>>;
