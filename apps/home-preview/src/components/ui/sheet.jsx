"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";

const ReturnFocusContext = React.createContext(null);

/**
 * Controlled dialogs (opened from state, not a Trigger) lose their way back:
 * inputs with autoFocus take focus before Radix records the opener, so on
 * close focus fell to <body>. Remember the focused element in the render
 * where `open` turns true — before any child mounts — and return to it on
 * close (WCAG 2.4.3). Uncontrolled dialogs keep Radix's own trigger focus.
 */
function Sheet({ open, ...props }) {
  const returnTo = React.useRef(null);
  const wasOpen = React.useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") {
    returnTo.current = document.activeElement;
  }
  wasOpen.current = !!open;
  return (
    <ReturnFocusContext.Provider value={open === undefined ? null : returnTo}>
      <SheetPrimitive.Root data-slot="sheet" open={open} {...props} />
    </ReturnFocusContext.Provider>
  );
}

function SheetTrigger({ ...props }) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    />
  );
}

function useReturnFocus(onCloseAutoFocus) {
  const returnTo = React.useContext(ReturnFocusContext);
  return (event) => {
    onCloseAutoFocus?.(event);
    if (event.defaultPrevented || !returnTo) return;
    const target = returnTo.current;
    if (
      target instanceof HTMLElement &&
      target !== document.body &&
      target.isConnected
    ) {
      event.preventDefault();
      target.focus();
    }
  };
}

function SheetContent({
  className,
  children,
  onCloseAutoFocus,
  side = "right",
  showCloseButton = true,
  ...props
}) {
  const returnFocus = useReturnFocus(onCloseAutoFocus);
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        onCloseAutoFocus={returnFocus}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-1.5 right-1.5 inline-flex size-11 items-center justify-center rounded-md opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary">
            <XIcon className="size-4" />
            <span className="sr-only">닫기</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
