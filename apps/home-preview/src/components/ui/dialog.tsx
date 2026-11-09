import { useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import {
  Modal,
  ModalContainer,
  ModalContent,
  ModalHeading,
  ModalNavigation,
  ModalNavigationButton,
  ModalSummary,
} from "@montage-ui/core";

/**
 * 마진 공통 대화상자. 모양·포커스 가두기·닫기 동작은 Montage Modal이 맡습니다.
 * 넓은 화면은 가운데 팝업(xlarge 560px), 768px 아래는 아래에서 올라오는 시트입니다.
 *
 * 상태로 여는 대화상자는 Montage가 연 버튼을 알 수 없어서(자동 포커스 입력이 먼저
 * 포커스를 가져감) 열리는 순간의 포커스를 기억해 닫힐 때 돌려줍니다(WCAG 2.4.3).
 */
export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}) {
  const returnTo = useRef<Element | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") {
    returnTo.current = document.activeElement;
  }
  useEffect(() => {
    if (wasOpen.current && !open) {
      const target = returnTo.current;
      // Montage가 포커스를 정리한 다음 프레임에 돌려줍니다.
      const frame = requestAnimationFrame(() => {
        if (
          target instanceof HTMLElement &&
          target !== document.body &&
          target.isConnected
        )
          target.focus();
      });
      wasOpen.current = false;
      return () => cancelAnimationFrame(frame);
    }
    wasOpen.current = open;
  }, [open]);
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {children}
    </Modal>
  );
}

export type DialogContentProps = Omit<ComponentProps<"div">, "color"> & {
  /** 오른쪽 위 닫기 버튼. 저장 중에는 false로 숨깁니다. */
  showCloseButton?: boolean;
  /** 저장 중처럼 Esc로 닫히면 안 될 때 */
  disableEscapeKeyDownClose?: boolean;
  /** 바깥을 눌러도 닫히지 않게 할 때 */
  disableOutsideClickClose?: boolean;
};

export function DialogContent({
  className,
  children,
  showCloseButton = true,
  disableEscapeKeyDownClose = false,
  disableOutsideClickClose = false,
  ...props
}: DialogContentProps) {
  return (
    <ModalContainer
      {...(props as Record<string, unknown>)}
      className={className}
      data-slot="dialog-content"
      variant="bottom"
      sm={{ variant: "popup" }}
      size="xlarge"
      disableEscapeKeyDownClose={disableEscapeKeyDownClose}
      disableOutsideClickClose={disableOutsideClickClose}
    >
      <ModalNavigation
        trailingContent={
          showCloseButton ? (
            <ModalNavigationButton variant="close-button" aria-label="닫기" />
          ) : null
        }
      />
      <ModalContent verticalPadding="bottom-only" gap="20px">
        {children}
      </ModalContent>
    </ModalContainer>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={["margin-dialog-header", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <ModalHeading as="h2" className={className} data-slot="dialog-title">
      {children}
    </ModalHeading>
  );
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <ModalSummary as="p" className={className} data-slot="dialog-description">
      {children}
    </ModalSummary>
  );
}
