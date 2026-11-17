import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { RecordList } from "./RecordList";

/**
 * 판 폭 864~1023px에서 접힌 기록 목록(IA v2 04 §1). 기록 위의 [기록 목록 ▾]를 누르면
 * 같은 목록이 팝오버로 뜹니다. 다른 기록으로 가거나 Esc·바깥을 누르면 닫힙니다.
 * 보이는 폭은 CSS(컨테이너 쿼리)가 정합니다.
 */
export function RecordListToggle() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest("[data-radix-popper-content-wrapper], [role='menu']"))
        return;
      if (!root.current?.contains(target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);
  return (
    <div className="record-list-toggle" ref={root}>
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls="record-list-popover"
        onClick={() => setOpen(!open)}
      >
        <Icon name="list" size={16} />
        {t("기록 목록")}
        <Icon name="chevron-down" size={14} />
      </Button>
      {open && (
        <div id="record-list-popover" className="record-list-popover">
          <RecordList />
        </div>
      )}
    </div>
  );
}
