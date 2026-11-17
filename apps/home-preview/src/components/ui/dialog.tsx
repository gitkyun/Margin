import { t } from "@/lib/i18n";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  IconButton,
  Modal,
  ModalContainer,
  ModalContent,
  ModalHeading,
  ModalSummary,
} from "@montage-ui/core";
import { IconClose } from "@montage-ui/icon";

/** 닫기 버튼이 대화상자를 닫을 수 있게 Dialog의 onOpenChange를 내려 줍니다. */
const DialogCloseContext = createContext<(() => void) | undefined>(undefined);

/**
 * 마진 공통 대화상자. 면·포커스 가두기·닫기 동작은 Montage Modal이 맡습니다.
 * 넓은 화면은 가운데 팝업(최대 520px), 768px 아래는 아래에서 올라오는 시트입니다.
 *
 * 안쪽 배치는 styles.css의 "대화상자 틀"이 맡습니다(docs/design/patterns.md §2-2):
 *
 *   <Dialog open={open} onOpenChange={setOpen}>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>제목</DialogTitle>
 *         <DialogDescription>설명</DialogDescription>
 *       </DialogHeader>
 *       <form onSubmit={save}>          // 폼이 아니면 form 없이 Body·Footer를 바로 둡니다
 *         <DialogBody>입력 묶음들(사이 20px)</DialogBody>
 *         <DialogFooter>
 *           <Button type="button" variant="outline" onClick={close}>취소</Button>
 *           <Button type="submit">주 행동</Button>
 *         </DialogFooter>
 *       </form>
 *     </DialogContent>
 *   </Dialog>
 *
 * 닫기 버튼은 제목과 같은 줄 오른쪽 위에 놓입니다. 내용이 길면 DialogBody만 스크롤됩니다.
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
    <DialogCloseContext.Provider value={() => onOpenChange?.(false)}>
      <Modal open={open} onOpenChange={onOpenChange}>
        {children}
      </Modal>
    </DialogCloseContext.Provider>
  );
}

export type DialogContentProps = Omit<
  ComponentProps<"div">,
  "color" | "style"
> & {
  style?: CSSProperties;
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
  style,
  ...rest
}: DialogContentProps) {
  const close = useContext(DialogCloseContext);
  return (
    <ModalContainer
      {...(rest as Record<string, unknown>)}
      className={className}
      data-slot="dialog-content"
      variant="bottom"
      sm={{ variant: "popup" }}
      size="xlarge"
      // 최대 폭은 styles.css의 --margin-dialog-max-width(기본 520px)가 정합니다.
      style={{ maxWidth: "var(--margin-dialog-max-width)", ...style }}
      disableEscapeKeyDownClose={disableEscapeKeyDownClose}
      disableOutsideClickClose={disableOutsideClickClose}
    >
      <ModalContent verticalPadding="none" horizontalPadding="none" gap="0px">
        <div
          className={
            showCloseButton ? "margin-dialog has-close" : "margin-dialog"
          }
        >
          {showCloseButton ? (
            <span className="margin-dialog-close">
              {/* Montage ModalNavigation의 닫기 버튼과 같은 부품·크기입니다. */}
              <IconButton
                variant="normal"
                size="xlarge"
                interactionEffect="dim"
                interactionOverflow
                aria-label={t("닫기")}
                onClick={close}
              >
                <IconClose />
              </IconButton>
            </span>
          ) : null}
          {children}
        </div>
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

/**
 * 대화상자 본문. 입력 묶음을 세로로 쌓고(사이 20px), 내용이 길면 이 칸만 스크롤됩니다.
 * 머리(DialogHeader) 아래 20px, 버튼 줄(DialogFooter) 위 24px는 틀이 잡습니다.
 */
export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={["margin-dialog-body", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}

/**
 * 대화상자 버튼 줄. 오른쪽 정렬, 순서는 [취소][주 행동], 사이 8px, 버튼 높이 40(Button 기본 크기).
 * 479px 이하에서는 버튼들이 같은 너비로 한 줄을 나눠 씁니다.
 */
export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={["margin-dialog-footer", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
