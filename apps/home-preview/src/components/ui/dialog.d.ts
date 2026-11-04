import type { ComponentProps, FC } from "react";
import type { Dialog as Primitive } from "radix-ui";
export const Dialog: FC<ComponentProps<typeof Primitive.Root>>;
export const DialogTrigger: FC<ComponentProps<typeof Primitive.Trigger>>;
export const DialogPortal: FC<ComponentProps<typeof Primitive.Portal>>;
export const DialogClose: FC<ComponentProps<typeof Primitive.Close>>;
export const DialogOverlay: FC<ComponentProps<typeof Primitive.Overlay>>;
export const DialogContent: FC<
  ComponentProps<typeof Primitive.Content> & { showCloseButton?: boolean }
>;
export const DialogHeader: FC<ComponentProps<"div">>;
export const DialogFooter: FC<
  ComponentProps<"div"> & { showCloseButton?: boolean }
>;
export const DialogTitle: FC<ComponentProps<typeof Primitive.Title>>;
export const DialogDescription: FC<
  ComponentProps<typeof Primitive.Description>
>;
