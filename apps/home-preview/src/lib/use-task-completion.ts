import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Task } from "./domain";
import { toggleDone } from "./task-status";
import { t } from "@/lib/i18n";
import { playCue } from "@/lib/ui-sound";

/** 완료 표시 뒤 줄 그은 채 제자리에 두는 시간(그다음 목록에서 접힘) */
export const COMPLETE_HOLD_MS = 400;
/** ‘되돌리기’를 누를 수 있는 시간 */
export const UNDO_MS = 6000;

type SaveTask = (kind: "tasks", value: Task) => Promise<Task>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

function withId(set: ReadonlySet<string>, id: string, present: boolean) {
  const next = new Set(set);
  if (present) next.add(id);
  else next.delete(id);
  return next;
}

/**
 * 할 일 완료·되돌리기. 홈과 할 일 화면이 같이 씁니다.
 * - 완료하면 COMPLETE_HOLD_MS 동안 `held`에 남겨 목록이 바로 다시 정렬되지 않게 합니다.
 * - ‘완료했어요 · 되돌리기’ 알림을 UNDO_MS 동안 띄우고, ⌘Z(Ctrl+Z)로도 되돌립니다.
 *   입력 칸에서 누른 ⌘Z는 글자 되돌리기라 건드리지 않습니다.
 * - 되돌리기는 save가 돌려준 최신 기록에 이전 상태만 다시 넣습니다.
 * - 같은 UNDO_MS 동안 `recent`에 완료 시각을 남겨, 할 일 행 자체의 ‘되돌리기’ 버튼이
 *   남은 시간을 보여 줄 수 있게 합니다. `undo(id)`는 알림·행·⌘Z 어디서 눌러도 같은 동작이에요.
 */
export function useTaskCompletion(save: SaveTask) {
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());
  /** 되돌릴 수 있는 할 일 id → 완료한 시각(ms) */
  const [recent, setRecent] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
  const pendingUndo = useRef<(() => Promise<void>) | null>(null);
  const undoers = useRef(new Map<string, () => Promise<void>>());
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const undo = pendingUndo.current;
      if (!undo || event.isComposing || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z")
        return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      void undo();
    };
    window.addEventListener("keydown", onKey);
    const pending = timers.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      pending.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const hold = useCallback((id: string) => {
    setHeld((set) => withId(set, id, true));
    timers.current.push(
      window.setTimeout(
        () => setHeld((set) => withId(set, id, false)),
        COMPLETE_HOLD_MS,
      ),
    );
  }, []);

  const forget = useCallback((id: string) => {
    undoers.current.delete(id);
    setRecent((map) => {
      if (!map.has(id)) return map;
      const next = new Map(map);
      next.delete(id);
      return next;
    });
  }, []);

  const offerUndo = useCallback(
    (saved: Task, previous: Task["status"]) => {
      let toastId: string | number = "";
      const undo = async () => {
        if (undoers.current.get(saved.id) !== undo) return;
        if (pendingUndo.current === undo) pendingUndo.current = null;
        forget(saved.id);
        toast.dismiss(toastId);
        try {
          await save("tasks", { ...saved, status: previous });
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : t("되돌리지 못했어요. 다시 시도해 주세요."),
          );
        }
      };
      const clear = () => {
        if (pendingUndo.current === undo) pendingUndo.current = null;
      };
      pendingUndo.current = undo;
      undoers.current.set(saved.id, undo);
      setRecent((map) => new Map(map).set(saved.id, Date.now()));
      timers.current.push(
        window.setTimeout(() => {
          if (undoers.current.get(saved.id) === undo) forget(saved.id);
        }, UNDO_MS),
      );
      toastId = toast(t("할 일을 완료했어요"), {
        description: saved.title,
        duration: UNDO_MS,
        action: { label: t("되돌리기"), onClick: () => void undo() },
        onAutoClose: clear,
        onDismiss: clear,
      });
    },
    [save, forget],
  );

  const toggle = useCallback(
    async (task: Task) => {
      const next = toggleDone(task.status);
      // 되돌리기 시간 안에 직접 완료를 풀면 그 되돌리기는 더 쓰지 않아요.
      if (next !== "done") forget(task.id);
      setBusy((set) => withId(set, task.id, true));
      try {
        const saved = await save("tasks", { ...task, status: next });
        if (next === "done") {
          playCue("task-done");
          hold(task.id);
          offerUndo(saved, task.status);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("할 일 상태를 저장하지 못했어요. 다시 시도해 주세요."),
        );
      } finally {
        setBusy((set) => withId(set, task.id, false));
      }
    },
    [save, hold, offerUndo, forget],
  );

  /** 알림이 아닌 곳(할 일 행의 버튼)에서 누르는 되돌리기 */
  const undo = useCallback(async (id: string) => {
    await undoers.current.get(id)?.();
  }, []);

  return { toggle, held, busy, recent, undo };
}
