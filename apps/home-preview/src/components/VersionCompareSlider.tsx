import { t } from "@/lib/i18n";
import { useCallback, useRef, type KeyboardEvent, type ReactNode } from "react";
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
    // 기존 동작 유지: PageUp은 왼쪽(이전 버전 쪽), PageDown은 오른쪽으로 10%씩(tests/version-compare.test.tsx).
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
  /**
   * 위에 고정해 보여 줄 좌우 이름(예: 이전 버전 / 현재 버전).
   * 주면 슬라이더 위에 이름 줄을 그리고, 손잡이의 읽기 값도 이 이름으로 알려 줘요.
   */
  sideLabels?: { before: string; after: string };
}

/** 손잡이 위치를 화면 읽기 프로그램이 읽는 문장으로 */
export function compareValueText(
  position: number,
  labels: { before: string; after: string },
): string {
  const left = Math.round(Math.min(100, Math.max(0, position)));
  return t("{before} {left}% · {after} {right}% 보여요", {
    before: labels.before,
    left,
    after: labels.after,
    right: 100 - left,
  });
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
  label = t("이전 버전과 수정 버전 비교"),
  className = "",
  defaultPosition = 50,
  sideLabels,
}: VersionCompareSliderProps) {
  const names = sideLabels ?? {
    before: t("이전 버전"),
    after: t("수정 버전"),
  };
  // 위치 콜백은 바뀌지 않아야 해요. 바뀌면 라이브러리가 손잡이를 처음 위치로 되돌려요.
  const namesRef = useRef(names);
  namesRef.current = names;
  const sliderRef = useRef<ReturnType<typeof useReactCompareSlider> | null>(
    null,
  );
  const onPositionChange = useCallback(
    (position: number) =>
      sliderRef.current?.handleRootRef.current?.setAttribute(
        "aria-valuetext",
        compareValueText(position, namesRef.current),
      ),
    [],
  );
  const slider = useReactCompareSlider({
    defaultPosition,
    keyboardIncrement: KEYBOARD_STEP,
    // 라이브러리는 숫자(aria-valuenow)만 바꿔서, 어느 판이 얼마나 보이는지 문장으로 덧붙여요.
    onPositionChange,
  });
  sliderRef.current = slider;
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = nextPosition(event.key, slider.position.current ?? 50);
    if (next === null) return;
    event.preventDefault();
    slider.setPosition(next);
  }
  const stage = (
    <Provider {...slider}>
      <Root className={`version-compare ${className}`}>
        <Item item="itemOne">{before}</Item>
        <Item item="itemTwo">{after}</Item>
        <HandleRoot
          className="version-compare-handle-root"
          aria-label={label}
          aria-valuetext={compareValueText(defaultPosition, names)}
          aria-keyshortcuts="ArrowLeft ArrowRight Home End PageUp PageDown"
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
  if (!sideLabels) return stage;
  return (
    <div className="version-compare-frame">
      <div className="version-compare-sides" aria-hidden="true">
        <span className="is-before">
          <Icon name="chevron-left" size={14} />
          {sideLabels.before}
        </span>
        <span className="is-after">
          {sideLabels.after}
          <Icon name="chevron-right" size={14} />
        </span>
      </div>
      {stage}
    </div>
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
      <div className="version-sheet-text">{text || t("내용이 없어요.")}</div>
    </div>
  );
}
