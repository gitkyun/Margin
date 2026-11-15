import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { t } from "@/lib/i18n";
import {
  holdProgress,
  isSlideComplete,
  keyProgress,
  slideProgress,
} from "@/lib/slide-confirm";
import { Icon } from "./icons";
import "./slide-to-confirm.css";

export interface SlideToConfirmProps {
  /** 밀기 전 안내이자 접근성 이름. 예: ‘밀어서 공유 중지’ */
  label: string;
  /** 끝까지 민 뒤 실행되는 동안 보여 줄 말. 예: ‘공유를 중지하는 중’ */
  confirmLabel?: string;
  onConfirm(): void | Promise<void>;
  disabled?: boolean;
  tone?: "danger" | "default";
}

/** 손잡이 지름 + 양쪽 여백(px). slide-to-confirm.css의 값과 같아야 해요. */
const HANDLE_SPACE = 48;

/**
 * 밀어서 확인. 되돌리기 어려운 동작(공유 중지·연구 완전 삭제)에 씁니다.
 * - 손잡이를 끝까지 밀어야 실행돼요. 중간에 놓으면 처음으로 돌아가요.
 * - 키보드: 포커스한 뒤 Enter(또는 Space)를 길게 누르거나 →로 끝까지 옮겨요.
 * - 실행 중에는 다시 밀 수 없고, 실패하면 처음으로 돌아가요.
 */
export function SlideToConfirm({
  label,
  confirmLabel,
  onConfirm,
  disabled = false,
  tone = "default",
}: SlideToConfirmProps) {
  const hintId = useId();
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; start: number } | null>(null);
  const hold = useRef<{ frame: number; started: number } | null>(null);
  const mounted = useRef(true);
  const [progress, setProgressState] = useState(0);
  // 손을 떼는 순간의 값을 바로 읽으려고 최신 진행도를 따로 둬요.
  const latest = useRef(0);
  function setProgress(value: number) {
    latest.current = value;
    setProgressState(value);
  }
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const blocked = disabled || running;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (hold.current) cancelAnimationFrame(hold.current.frame);
    };
  }, []);

  function travel(): number {
    return Math.max(0, (track.current?.clientWidth ?? 0) - HANDLE_SPACE);
  }

  async function confirm() {
    setProgress(1);
    setRunning(true);
    try {
      await onConfirm();
    } finally {
      // 성공해도 화면이 남아 있으면 다시 쓸 수 있게 처음으로 돌려요.
      if (mounted.current) {
        setRunning(false);
        setProgress(0);
      }
    }
  }

  function settle(next: number) {
    if (isSlideComplete(next)) void confirm();
    else setProgress(0);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (blocked || event.button !== 0) return;
    event.preventDefault(); // 끄는 동안 글자가 선택되지 않게
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, start: latest.current };
    setDragging(true);
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setProgress(
      slideProgress(
        drag.current.start,
        event.clientX - drag.current.x,
        travel(),
      ),
    );
  }
  function up() {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    settle(latest.current);
  }

  function stopHold(complete: boolean) {
    if (!hold.current) return;
    cancelAnimationFrame(hold.current.frame);
    hold.current = null;
    setDragging(false);
    if (complete) void confirm();
    else setProgress(0);
  }
  function startHold() {
    const started = performance.now();
    setDragging(true);
    const tick = (now: number) => {
      const next = holdProgress(now - started);
      setProgress(next);
      if (isSlideComplete(next)) stopHold(true);
      else if (hold.current) hold.current.frame = requestAnimationFrame(tick);
    };
    hold.current = { started, frame: requestAnimationFrame(tick) };
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (blocked) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!event.repeat && !hold.current) startHold();
      return;
    }
    const next = keyProgress(latest.current, event.key);
    if (next === null) return;
    event.preventDefault();
    if (isSlideComplete(next)) void confirm();
    else setProgress(next);
  }
  function keyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") stopHold(false);
  }

  const percent = Math.round(progress * 100);
  return (
    <div
      ref={track}
      className="slide-confirm"
      data-tone={tone}
      data-dragging={dragging || undefined}
      data-running={running || undefined}
      aria-disabled={disabled || undefined}
      style={{ "--slide-progress": progress } as CSSProperties}
    >
      <span className="slide-confirm-fill" aria-hidden="true" />
      <span className="slide-confirm-label" aria-hidden="true">
        {running ? (confirmLabel ?? label) : label}
      </span>
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        className="slide-confirm-handle"
        aria-label={label}
        aria-describedby={hintId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={
          running
            ? (confirmLabel ?? label)
            : t("{percent}% 밀었어요", { percent })
        }
        aria-disabled={blocked || undefined}
        aria-busy={running || undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={keyDown}
        onKeyUp={keyUp}
        onBlur={() => stopHold(false)}
      >
        {running ? (
          <span className="spinner" aria-hidden="true" />
        ) : (
          <Icon name="arrow-right" size={18} />
        )}
      </div>
      <span id={hintId} className="sr-only">
        {t(
          "끝까지 밀어야 실행돼요. 키보드로는 Enter를 길게 누르거나 오른쪽 화살표로 끝까지 옮겨요.",
        )}
      </span>
    </div>
  );
}
