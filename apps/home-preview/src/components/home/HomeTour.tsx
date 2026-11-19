import { t } from "@/lib/i18n";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { TOUR_STEPS, placeCard, type Box, type TourStep } from "@/lib/tour";
import "./home-tour.css";

interface HomeTourProps {
  /** 끝까지 봤거나 닫았을 때 */
  onDone(): void;
  /** 짚어 줄 자리가 하나도 없을 때. 봤다고 기록하지 않고 닫습니다. */
  onUnavailable?(): void;
  steps?: TourStep[];
}

const PAD = 6;

/** 요소의 자리. `display: contents`처럼 자기 상자가 없는 묶음은 자식들을 감싸는 자리를 씁니다. */
function targetRect(element: Element): DOMRect {
  const own = element.getBoundingClientRect();
  if (own.width > 0 && own.height > 0) return own;
  const rects = [...element.children]
    .map((child) => child.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (!rects.length) return own;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

function visibleTarget(selector: string): HTMLElement | null {
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = targetRect(element);
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < window.innerWidth
    )
      return element;
  }
  return null;
}

/**
 * 연구 홈에 처음 들어왔을 때의 화면 안내. 화면에 실제로 보이는 자리만 차례로 짚어 주고
 * (좁은 화면에서 숨은 아이콘 줄 같은 항목은 건너뜀), 고리가 다음 자리로 옮겨 갑니다.
 * 아무것도 저장하지 않고, Esc나 ‘안내 끝내기’로 언제든 닫습니다.
 */
export function HomeTour({
  onDone,
  onUnavailable,
  steps = TOUR_STEPS,
}: HomeTourProps) {
  // 열 때 화면에 보이는 단계만 고릅니다.
  const [available] = useState(() =>
    steps.filter((step) => visibleTarget(step.selector)),
  );
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const card = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<Element | null>(null);
  const step = available[index];
  const last = index === available.length - 1;

  const measure = useCallback(() => {
    if (!step) return;
    const target = visibleTarget(step.selector);
    if (!target) return;
    const rect = targetRect(target);
    const next = {
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
    };
    setBox(next);
    if (card.current)
      setPosition(
        placeCard(
          next,
          {
            width: card.current.offsetWidth,
            height: card.current.offsetHeight,
          },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      );
  }, [step]);

  useEffect(() => {
    if (!available.length) (onUnavailable ?? onDone)();
  }, [available.length, onDone, onUnavailable]);

  useLayoutEffect(() => {
    if (!step) return;
    visibleTarget(step.selector)?.scrollIntoView?.({ block: "nearest" });
    measure();
    card.current?.focus();
  }, [step, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    return () => {
      if (returnFocus.current instanceof HTMLElement)
        returnFocus.current.focus();
    };
  }, []);

  if (!step) return null;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onDone();
      return;
    }
    if (event.key !== "Tab" || !card.current) return;
    // 안내가 떠 있는 동안 초점은 카드 안에서만 돕니다.
    const buttons = [...card.current.querySelectorAll<HTMLElement>("button")];
    const first = buttons[0];
    const final = buttons[buttons.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === card.current)
    ) {
      event.preventDefault();
      final?.focus();
    } else if (!event.shiftKey && document.activeElement === final) {
      event.preventDefault();
      first?.focus();
    }
  }

  return createPortal(
    <div className="tour" onKeyDown={onKeyDown}>
      <div className="tour-block" />
      {box && (
        <div
          className="tour-ring"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
        />
      )}
      <div
        ref={card}
        className="tour-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        tabIndex={-1}
        style={
          position ? { top: position.top, left: position.left } : { opacity: 0 }
        }
      >
        <div className="tour-copy" key={step.key}>
          <p className="tour-count">
            {t("화면 안내 {current} / {total}", {
              current: index + 1,
              total: available.length,
            })}
          </p>
          <h2 id="tour-title">{step.title}</h2>
          <p id="tour-text">{step.text}</p>
        </div>
        <div className="tour-actions">
          {!last && (
            <button type="button" className="tour-skip" onClick={onDone}>
              {t("안내 끝내기")}
            </button>
          )}
          {index > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIndex(index - 1)}
            >
              {t("이전")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={last ? onDone : () => setIndex(index + 1)}
          >
            {last ? t("안내 마치기") : t("다음")}
            {!last && <Icon name="arrow-right" size={16} />}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
