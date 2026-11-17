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
  DialogBody,
  DialogFooter,
} from "./ui/dialog";
import { RESEARCH_NAVIGATION } from "@/lib/command-items";
import { GO_SHORTCUTS } from "@/lib/go-shortcuts";
import "./shortcut-help.css";

const EXTRA_DESTINATIONS: Record<string, string> = {
  tasks: t("할 일"),
  assistant: t("연구 도우미"),
  settings: t("연구 설정"),
};

/** 단축키 목록은 GO_SHORTCUTS 한 곳에서 읽어, 실제 동작과 어긋나지 않게 합니다. */
function shortcutRows(): [keys: string[], label: string][] {
  const labelOf = (path: string) =>
    RESEARCH_NAVIGATION.find(([p]) => p === path)?.[2] ??
    EXTRA_DESTINATIONS[path] ??
    path;
  return [
    [["⌘", "K"], t("찾기와 바로 하기")],
    ...GO_SHORTCUTS.map(
      ([path, key]) =>
        [
          ["G", key.toUpperCase()],
          t("{destination} 이동", {
            destination:
              currentLang() === "ko"
                ? josa(labelOf(path), "으로/로") // i18n-ignore
                : labelOf(path),
          }),
        ] as [string[], string],
    ),
    [["⌘", "Z"], t("방금 완료한 할 일 되돌리기")],
    [["?"], t("이 목록 보기")],
  ];
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
        <DialogBody>
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
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t("닫기")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
