import { useCallback, useRef, useState, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** 확인 버튼 이름. 무엇을 하는지 동사로 씁니다(예: '초대 취소'). */
  confirmLabel: string;
  /** 되돌리기 어려운 동작이면 빨간 버튼으로 둡니다. */
  destructive?: boolean;
}

/**
 * 브라우저 기본 confirm 대신 쓰는 확인 창(감사 B6).
 * `const [confirmDialog, confirm] = useConfirm();` 후 화면에 `{confirmDialog}`를 두고
 * `if (!(await confirm({...}))) return;`처럼 씁니다.
 */
export function useConfirm(): [
  ReactNode,
  (options: ConfirmOptions) => Promise<boolean>,
] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  }, []);
  const ask = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const element = (
    <Dialog
      open={options !== null}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <DialogContent className="student-dialog">
        <DialogHeader>
          <DialogTitle>{options?.title}</DialogTitle>
          {options?.description && (
            <DialogDescription>{options.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            {t("닫기")}
          </Button>
          <Button
            variant={options?.destructive ? "destructive" : undefined}
            onClick={() => close(true)}
          >
            {options?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return [element, ask];
}
