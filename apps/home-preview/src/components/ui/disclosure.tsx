import type { ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { cn } from "@/lib/utils";

export interface DisclosureProps {
  summary: ReactNode;
  children?: ReactNode;
  className?: string;
  summaryClassName?: string;
  panelClassName?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  id?: string;
}

/**
 * 화면 안 접힘·펼침(보관 폴더, 전사문 수정·비교, 크레딧 이력, FAQ 등).
 * Base UI Collapsible(Collapsible.Root / Trigger / Panel)을 씁니다.
 *
 * 키보드(Enter/Space)와 aria-expanded는 Base UI가 처리하며,
 * Panel은 hiddenUntilFound와 keepMounted를 써서 브라우저 페이지 내 검색(Ctrl+F)으로
 * 접힌 내용을 찾아 펼칠 수 있게 합니다.
 */
export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  panelClassName,
  open,
  defaultOpen,
  onOpenChange,
  disabled,
  id,
}: DisclosureProps) {
  return (
    <Collapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      disabled={disabled}
      id={id}
      className={cn("disclosure-root", className)}
    >
      <Collapsible.Trigger
        type="button"
        className={cn("disclosure-trigger", summaryClassName)}
      >
        {summary}
      </Collapsible.Trigger>
      <Collapsible.Panel
        keepMounted
        hiddenUntilFound
        className={cn("disclosure-panel", panelClassName)}
      >
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
