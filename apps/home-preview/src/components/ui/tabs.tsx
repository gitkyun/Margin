import type { ReactNode } from "react";
import { ContentBadge, Tab, TabList, TabListItem } from "@montage-ui/core";

export type TabOption = { value: string; label: ReactNode; count?: number };

/**
 * 화면 안 탭(미팅 준비·기록, 피드백·할 일 등). 모양·키보드 이동·밑줄 표시는
 * Montage Tab이 맡습니다. 보기 전환 토글은 Segments, 화면 이동 탭은 이 컴포넌트를 씁니다.
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
    <Tab value={value} onValueChange={onChange}>
      <TabList
        aria-label={label}
        size={size}
        horizontalPadding={false}
        className={className}
      >
        {options.map((o) => (
          <TabListItem key={o.value} value={o.value}>
            {o.label}
            {o.count ? (
              <ContentBadge
                size="xsmall"
                color="neutral"
                className="margin-tab-count"
              >
                {o.count}
              </ContentBadge>
            ) : null}
          </TabListItem>
        ))}
      </TabList>
    </Tab>
  );
}
