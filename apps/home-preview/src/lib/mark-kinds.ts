import { t } from "./i18n";

/**
 * 형광펜 종류(IA v2 6단계, 2026-11-20 사용자 결정 '뜻 있는 3종').
 * 저장은 표시 한 칸의 `kind`이고, 기본 '중요'는 저장하지 않아 예전 표시와 모양이 같습니다.
 * 색은 tokens.css의 `--mark-fill`(연두)·`--mark-fill-check`(하늘)·`--mark-fill-cite`(보라)이며,
 * 색만으로 구분하지 않도록 이름을 화면 낭독·도움말·오른쪽 열에 함께 둡니다.
 */
export type MarkKind = "key" | "check" | "cite";

export const DEFAULT_MARK_KIND: MarkKind = "key";
export const MARK_KINDS: readonly MarkKind[] = ["key", "check", "cite"];

export function markKindLabel(kind: MarkKind): string {
  return {
    key: t("중요"),
    check: t("다시 확인"),
    cite: t("인용할 곳"),
  }[kind];
}

/** 저장된 값을 종류로. 없거나 모르는 값이면 기본 '중요' */
export function readMarkKind(value: unknown): MarkKind {
  return value === "check" || value === "cite" ? value : DEFAULT_MARK_KIND;
}

/** 저장할 때 붙일 값. 기본 종류는 붙이지 않습니다. */
export function storedKind(kind: MarkKind): { kind?: MarkKind } {
  return kind === DEFAULT_MARK_KIND ? {} : { kind };
}
