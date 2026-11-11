import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Tabs as TabsRoot,
  TabsList,
  TabsTab,
  type TabsSize,
} from "./coss/tabs";

export type TabOption = { value: string; label: ReactNode; count?: number };

const SIZES: Record<"small" | "medium" | "large", TabsSize> = {
  small: "default",
  medium: "lg",
  large: "lg",
};

/**
 * 화면 안 탭(미팅 준비·기록, 피드백·할 일 등). coss ui(Base UI) 탭을 씁니다(2026-11-11 결정).
 * 키보드 이동은 Base UI가 맡고, 선택 밑줄은 다음 탭으로 미끄러져 이동합니다.
 * 색·글자는 styles.css의 @theme가 연결한 마진 토큰을 그대로 받습니다.
 * 보기 전환 토글은 Segments, 화면 이동 탭은 이 컴포넌트를 씁니다.
 */
export function Tabs({
  value,
  onChange,
  options,
  label,
  size = "small",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: TabOption[];
  label: string;
  size?: "small" | "medium" | "large";
  className?: string;
}) {
  return (
    <TabsRoot
      value={value}
      onValueChange={(next) => onChange(String(next))}
      className="margin-tabs"
    >
      <TabsList
        aria-label={label}
        variant="underline"
        size={SIZES[size]}
        className={cn("margin-tabs-list", className)}
      >
        {options.map((option) => (
          <TabsTab
            key={option.value}
            value={option.value}
            className="margin-tabs-tab"
          >
            {option.label}
            {option.count ? (
              <span className="margin-tab-count">{option.count}</span>
            ) : null}
          </TabsTab>
        ))}
      </TabsList>
    </TabsRoot>
  );
}
