import type { KeyboardEvent } from "react";

/**
 * 목록 줄 키보드 조작(IA v2 03 §5, 04 §11): 목록에 초점이 있을 때 J/K로 줄 이동, Enter로 열기(링크·버튼 기본 동작),
 * X로 그 줄의 할 일 체크. 물리 키(`event.code`)로 보아 한글 자판에서도 같은 자리를 누르면 됩니다.
 * 입력 칸·편집기 안이나 조합 키와 함께일 때는 건드리지 않습니다.
 */
export const LIST_ITEM_SELECTOR = [
  "a.task-line-text",
  "a.task-line",
  "a.record-line",
  "button.record-line",
  "a.hm-row",
  "a.hm-row-main",
].join(", ");

/** 지금 줄에서 dir만큼 옮긴 줄. 아직 고른 줄이 없으면 J는 첫 줄, K는 마지막 줄 */
export function stepIndex(current: number, length: number, dir: 1 | -1) {
  if (!length) return -1;
  if (current < 0) return dir === 1 ? 0 : length - 1;
  return Math.min(length - 1, Math.max(0, current + dir));
}

function typing(target: HTMLElement): boolean {
  return (
    target.isContentEditable ||
    !!target.closest("input:not([type='checkbox']), textarea, select")
  );
}

export function handleListKeys(event: KeyboardEvent<HTMLElement>) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey)
    return;
  const target = event.target as HTMLElement;
  if (typing(target) || event.nativeEvent.isComposing) return;
  const { code } = event;
  if (code !== "KeyJ" && code !== "KeyK" && code !== "KeyX") return;
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(LIST_ITEM_SELECTOR),
  ].filter((item) => !item.closest("[hidden], [inert], [aria-hidden='true']"));
  const row = (element: Element) =>
    element.closest(".task-line, .record-line-row, .hm-row") ?? element;
  const current = items.findIndex(
    (item) => item === target || row(item).contains(target),
  );
  if (code === "KeyX") {
    const box = row(target).querySelector<HTMLElement>(
      "[role='checkbox'], input[type='checkbox']",
    );
    if (!box || box.hasAttribute("disabled")) return;
    event.preventDefault();
    box.click();
    return;
  }
  const next = stepIndex(current, items.length, code === "KeyJ" ? 1 : -1);
  if (next < 0) return;
  event.preventDefault();
  items[next].focus();
  items[next].scrollIntoView?.({ block: "nearest" });
}
