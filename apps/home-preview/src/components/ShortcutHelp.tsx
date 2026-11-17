import { currentLang, t } from "@/lib/i18n";
import { josa } from "es-hangul";
import { useHotkeys } from "react-hotkeys-hook";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { GO_SHORTCUTS } from "@/lib/go-shortcuts";
import "./shortcut-help.css";

/** 단축키 목록은 GO_SHORTCUTS 한 곳에서 읽어, 실제 동작과 어긋나지 않게 합니다. */
function shortcutRows(): [keys: string[], label: string][] {
  return [
    [["⌘", "K"], t("찾기와 바로 하기")],
    ...GO_SHORTCUTS.map(
      ({ key, label }) =>
        [
          ["G", key.toUpperCase()],
          t("{destination} 이동", {
            destination:
              currentLang() === "ko"
                ? josa(label, "으로/로") // i18n-ignore
                : label,
          }),
        ] as [string[], string],
    ),
    [["]"], t("사이드 창 열기·닫기")],
    [["⌘", "Z"], t("방금 완료한 할 일 되돌리기")],
    [["?"], t("이 목록 보기")],
  ];
}

/** 단축키 표. 도움말 창과 설정 창 '단축키' 칸이 함께 씁니다(IA v2 07 §1). */
export function ShortcutList() {
  return (
    <dl className="shortcut-help">
      {shortcutRows().map(([keys, label]) => (
        <div key={keys.join("+")}>
          <dt>
            {keys.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
          </dt>
          <dd>{label}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * ? 키로 여는 단축키 도움말. 입력 칸·편집기 안이나 한글 조합 중에는 열리지 않습니다.
 * G 단축키는 연구 안에서만 동작한다는 점을 함께 알립니다.
 */
export function ShortcutHelp({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  useHotkeys("shift+slash", () => onOpenChange(true), {
    preventDefault: true,
    ignoreEventWhen: (event) => event.isComposing,
    useKey: true,
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("키보드 단축키")}</DialogTitle>
          <DialogDescription>
            {t(
              "G 단축키는 연구 안에서 G를 누른 뒤 1초 안에 글자를 누르면 돼요. 한글 자판 상태여도 같은 자리를 누르면 돼요.",
            )}
          </DialogDescription>
        </DialogHeader>
        <ShortcutList />
        <Button onClick={() => onOpenChange(false)}>{t("닫기")}</Button>
      </DialogContent>
    </Dialog>
  );
}
