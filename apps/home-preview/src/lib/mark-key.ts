/**
 * 읽기 상태의 원문(전사문)에서 고른 글에 형광펜을 칠하는 `H` 단축키(IA v2 04 §5.2·§11).
 * 물리 키(`event.code`)로 보아 한글 자판(ㅗ)에서도 같은 자리를 누르면 됩니다.
 * 조합 키와 함께이거나, 입력 칸·편집기 안이거나, 한글 조합 중이면 쓰지 않습니다.
 * 바로 앞 키가 G면 화면 이동(G H = 홈)이라 칠하지 않습니다.
 */
export function isMarkKey(
  event: Pick<
    KeyboardEvent,
    | "code"
    | "metaKey"
    | "ctrlKey"
    | "altKey"
    | "shiftKey"
    | "isComposing"
    | "defaultPrevented"
    | "target"
  >,
  previousCode?: string,
): boolean {
  if (event.code !== "KeyH") return false;
  if (
    event.metaKey ||
    event.ctrlKey ||
    event.altKey ||
    event.shiftKey ||
    event.isComposing ||
    event.defaultPrevented
  )
    return false;
  if (previousCode === "KeyG") return false;
  const target = event.target;
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      !!target.closest("input, textarea, select, [role='textbox']"))
  )
    return false;
  return true;
}
