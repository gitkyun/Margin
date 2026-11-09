import type { KeyboardEvent, ReactNode } from "react";
import {
  HandleRoot,
  Item,
  Provider,
  Root,
} from "react-compare-slider/components";
import { useReactCompareSlider } from "react-compare-slider/hooks";
import { Icon } from "./icons";
import "./version-compare.css";

/** 방향키 한 번에 움직이는 양 */
const KEYBOARD_STEP = "5%";
/** PageUp·PageDown 한 번에 움직이는 양(%) */
const PAGE_STEP = 10;

/** 라이브러리가 다루지 않는 슬라이더 키(Home·End·PageUp·PageDown)의 다음 위치 */
function nextPosition(key: string, current: number): number | null {
  switch (key) {
    case "Home":
      return 0;
    case "End":
      return 100;
    case "PageUp":
      return Math.max(0, current - PAGE_STEP);
    case "PageDown":
      return Math.min(100, current + PAGE_STEP);
    default:
      return null;
  }
}

interface VersionCompareSliderProps {
  /** 왼쪽(이전) 판 */
  before: ReactNode;
  /** 오른쪽(이후) 판 */
  after: ReactNode;
  /** 스크린리더가 읽는 이름 */
  label?: string;
  className?: string;
  defaultPosition?: number;
}

/**
 * 두 버전을 겹쳐 놓고 가운데 손잡이를 좌우로 밀어 비교합니다(react-compare-slider v4).
 * 끌기·누르기·방향키(5%)는 라이브러리가, Home·End·PageUp·PageDown(10%)과
 * 손잡이 모양·한국어 이름은 마진이 맡습니다.
 * 소개 페이지 미리보기와 글쓰기 버전 비교가 같이 씁니다.
 */
export function VersionCompareSlider({
  before,
  after,
  label = "이전 버전과 수정 버전 비교",
  className = "",
  defaultPosition = 50,
}: VersionCompareSliderProps) {
  const slider = useReactCompareSlider({
    defaultPosition,
    keyboardIncrement: KEYBOARD_STEP,
  });
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextPosition(event.key, slider.position.current ?? 50);
    if (next === null) return;
    event.preventDefault();
    slider.setPosition(next);
  }
  return (
    <Provider {...slider}>
      <Root className={`version-compare ${className}`}>
        <Item item="itemOne">{before}</Item>
        <Item item="itemTwo">{after}</Item>
        <HandleRoot
          className="version-compare-handle-root"
          aria-label={label}
          onKeyDown={onKeyDown}
        >
          <span className="version-compare-line" aria-hidden="true" />
          <span className="version-compare-knob" aria-hidden="true">
            <Icon name="chevron-left" size={15} />
            <Icon name="chevron-right" size={15} />
          </span>
          <span className="version-compare-line" aria-hidden="true" />
        </HandleRoot>
      </Root>
    </Provider>
  );
}

/** 글쓰기 버전 비교용 글 판: 위에 버전 이름, 아래에 본문 글자 그대로 */
export function VersionSheet({
  label,
  text,
  tone,
}: {
  label: string;
  text: string;
  tone: "before" | "after";
}) {
  return (
    <div className={`version-sheet is-${tone}`}>
      <span className="version-sheet-label">{label}</span>
      <div className="version-sheet-text">{text || "내용이 없어요."}</div>
    </div>
  );
}
