import { useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  type HTMLMotionProps,
} from "motion/react";
import { t } from "@/lib/i18n";
import { shouldToggleOnSwipe } from "@/lib/swipe-toggle";
import { UNDO_MS } from "@/lib/use-task-completion";
import { Icon } from "./icons";

interface TaskRowFrameProps {
  className: string;
  /** 목록에서 빠질 때의 움직임(task-row-motion.ts) */
  rowMotion: HTMLMotionProps<"div">;
  /** 767px 이하에서만 true. 데스크톱은 밀기가 없어요. */
  swipeable: boolean;
  done: boolean;
  onSwipe(): void;
  children: ReactNode;
}

/**
 * 할 일 한 줄. 좁은 화면에서는 오른쪽으로 밀어 완료를 바꿀 수 있어요.
 * 민 뒤에는 체크박스로 바꾼 것과 똑같이 되돌리기 알림·행 버튼이 남아요.
 * 밀다가 놓은 손이 줄 안의 링크를 누른 것으로 처리되지 않게 막아요.
 */
export function TaskRowFrame({
  className,
  rowMotion,
  swipeable,
  done,
  onSwipe,
  children,
}: TaskRowFrameProps) {
  const x = useMotionValue(0);
  const hintOpacity = useTransform(x, [0, 72], [0, 1]);
  const dragged = useRef(false);
  if (!swipeable)
    return (
      <motion.div {...rowMotion} className={className}>
        {children}
      </motion.div>
    );
  return (
    <motion.div {...rowMotion} className="task-swipe">
      <motion.span
        className="task-swipe-hint"
        aria-hidden="true"
        style={{ opacity: hintOpacity }}
      >
        <Icon name={done ? "undo" : "check"} size={16} />
        {done ? t("완료 취소") : t("완료")}
      </motion.span>
      <motion.div
        className={className}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.6 }}
        dragSnapToOrigin
        onPointerDown={() => {
          dragged.current = false;
        }}
        onDragStart={() => {
          dragged.current = true;
        }}
        onDragEnd={(event, info) => {
          const width =
            (event.target as HTMLElement | null)?.closest(".task-swipe")
              ?.clientWidth ?? 0;
          if (shouldToggleOnSwipe(info.offset.x, info.velocity.x, width))
            onSwipe();
        }}
        onClickCapture={(event) => {
          if (!dragged.current) return;
          event.preventDefault();
          event.stopPropagation();
          dragged.current = false;
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/**
 * 완료 직후 몇 초 동안 행 안에 두는 ‘되돌리기’. 아래 막대가 남은 시간만큼 줄어들어요.
 * 알림의 되돌리기와 같은 동작이에요.
 */
export function RowUndoButton({
  title,
  completedAt,
  onUndo,
}: {
  title: string;
  completedAt: number;
  onUndo(): void;
}) {
  // 처음 그릴 때의 남은 시간에 막대를 맞춰요(다시 그려도 처음부터 줄지 않게).
  const [elapsed] = useState(() =>
    Math.min(UNDO_MS, Math.max(0, Date.now() - completedAt)),
  );
  return (
    <button
      type="button"
      className="task-row-undo"
      aria-label={t("{title} 완료 되돌리기", { title })}
      onClick={onUndo}
    >
      <Icon name="undo" size={14} />
      {t("되돌리기")}
      <span
        className="task-row-undo-timer"
        aria-hidden="true"
        style={{
          animationDuration: `${UNDO_MS}ms`,
          animationDelay: `-${elapsed}ms`,
        }}
      />
    </button>
  );
}
