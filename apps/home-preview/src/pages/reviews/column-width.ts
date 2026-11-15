import { useCallback, useState } from "react";

/**
 * 3열 검토 상세의 오른쪽(교수 응답·댓글) 열 너비. 이 열을 좁히면 가운데 PDF 열이 넓어져요.
 * null이면 화면 너비별 기본값(reviews.css)을 그대로 써요.
 */
export const RESPONSE_MIN_WIDTH = 280;
export const RESPONSE_MAX_WIDTH = 560;
export const RESPONSE_KEY_STEP = 24;
const STORAGE_KEY = "margin-review-response-width";

export function clampResponseWidth(width: number): number {
  return Math.round(
    Math.min(RESPONSE_MAX_WIDTH, Math.max(RESPONSE_MIN_WIDTH, width)),
  );
}

/**
 * 경계선 키보드 조작. ←는 경계를 왼쪽으로(응답 열 넓게), →는 오른쪽으로(PDF 열 넓게).
 * Home은 기본값으로. 다른 키면 undefined(기본 동작 유지).
 */
export function keyResponseWidth(
  current: number,
  key: string,
): number | null | undefined {
  if (key === "ArrowLeft")
    return clampResponseWidth(current + RESPONSE_KEY_STEP);
  if (key === "ArrowRight")
    return clampResponseWidth(current - RESPONSE_KEY_STEP);
  if (key === "Home") return null;
  return undefined;
}

function readStored(): number | null {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return raw ? clampResponseWidth(raw) : null;
  } catch {
    return null;
  }
}

export function useResponseWidth(): [
  number | null,
  (width: number | null) => void,
] {
  const [width, setWidth] = useState<number | null>(readStored);
  const update = useCallback((next: number | null) => {
    const value = next === null ? null : clampResponseWidth(next);
    setWidth(value);
    try {
      if (value === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // 저장소를 못 쓰면 이번 화면에서만 유지해요.
    }
  }, []);
  return [width, update];
}
