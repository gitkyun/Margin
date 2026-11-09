import type { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@montage-ui/core";

type HintPosition =
  | "top-center"
  | "bottom-center"
  | "right-center"
  | "left-center"
  | "bottom-end";

export interface HintProps {
  /** 툴팁 첫 줄(굵게). 아이콘 버튼이면 버튼 이름과 같게 둡니다. */
  label: ReactNode;
  /** 둘째 줄 요약. 메뉴 미리보기 등에 씁니다. */
  detail?: ReactNode;
  /** 단축키 표시(예: "⌘K"). */
  shortcut?: ReactNode;
  position?: HintPosition;
  /** 감싸는 요소의 배치. 메뉴 항목처럼 한 줄을 차지하면 block. */
  display?: "inline" | "block";
  children: ReactNode;
}

/**
 * 마진 공통 툴팁. 모양은 Montage Tooltip이 맡고, 마진은 ‘이름 + 한 줄 요약’ 구성만 정합니다.
 * 이름은 접근성 이름을 대신하지 않으니 버튼에는 aria-label을 그대로 둡니다.
 */
export function Hint({
  label,
  detail,
  shortcut,
  position = "bottom-center",
  display = "inline",
  children,
}: HintProps) {
  return (
    <Tooltip enterDelay={350} leaveDelay={80}>
      {/* 트리거는 span으로 감쌉니다. Slot이 NavLink 같은 함수형 className을
          문자열로 합쳐 버리지 않게 하기 위해서입니다. */}
      <TooltipTrigger>
        <span className={`margin-hint-anchor is-${display}`}>{children}</span>
      </TooltipTrigger>
      <TooltipContent
        size="small"
        position={position}
        shortcut={shortcut}
        className="margin-hint"
      >
        {detail ? (
          <span className="margin-hint-body">
            <strong>{label}</strong>
            <span>{detail}</span>
          </span>
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  );
}
