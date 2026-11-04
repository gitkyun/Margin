import type { ComponentProps, FC } from "react";
import type { DropdownMenu as Primitive } from "radix-ui";
export const DropdownMenu: FC<
  ComponentProps<typeof Primitive.Root> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuPortal: FC<
  ComponentProps<typeof Primitive.Portal> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuTrigger: FC<
  ComponentProps<typeof Primitive.Trigger> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuContent: FC<
  ComponentProps<typeof Primitive.Content> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuGroup: FC<
  ComponentProps<typeof Primitive.Group> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuItem: FC<
  ComponentProps<typeof Primitive.Item> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuCheckboxItem: FC<
  ComponentProps<typeof Primitive.CheckboxItem> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuRadioGroup: FC<
  ComponentProps<typeof Primitive.RadioGroup> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuRadioItem: FC<
  ComponentProps<typeof Primitive.RadioItem> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuLabel: FC<
  ComponentProps<typeof Primitive.Label> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuSeparator: FC<
  ComponentProps<typeof Primitive.Separator> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuSub: FC<
  ComponentProps<typeof Primitive.Sub> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuSubTrigger: FC<
  ComponentProps<typeof Primitive.SubTrigger> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuSubContent: FC<
  ComponentProps<typeof Primitive.SubContent> & {
    inset?: boolean;
    variant?: "default" | "destructive";
  }
>;
export const DropdownMenuShortcut: FC<ComponentProps<"span">>;
