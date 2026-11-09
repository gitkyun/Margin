import type { ComponentProps, ReactNode } from "react";
import {
  ModalContainer,
  ModalNavigation,
  ModalNavigationButton,
} from "@montage-ui/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./dialog";

/**
 * 옆에서 여는 판(휴대폰 연구 메뉴, 알림). Montage에는 옆 서랍이 없어 Modal로 엽니다.
 * - side="left": 휴대폰 연구 메뉴. 화면 전체(Montage Modal full).
 * - side="right"(기본): 알림. 다른 대화상자와 같이 넓은 화면은 팝업, 좁은 화면은 아래 시트.
 * 열 때의 포커스 기억·복귀는 Dialog가 맡습니다.
 */
export const Sheet = Dialog;

export function SheetContent({
  side = "right",
  className,
  children,
}: {
  side?: "left" | "right";
  className?: string;
  children?: ReactNode;
}) {
  if (side === "right")
    return <DialogContent className={className}>{children}</DialogContent>;
  return (
    <ModalContainer
      className={className}
      data-slot="sheet-content"
      variant="full"
    >
      <ModalNavigation
        trailingContent={
          <ModalNavigationButton variant="close-button" aria-label="닫기" />
        }
      />
      <div className="margin-sheet-body">{children}</div>
    </ModalContainer>
  );
}

export function SheetHeader(props: ComponentProps<"div">) {
  return <DialogHeader {...props} />;
}

export const SheetTitle = DialogTitle;
export const SheetDescription = DialogDescription;
