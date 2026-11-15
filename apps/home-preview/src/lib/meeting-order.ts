/** 미팅 준비 목록(질문·할 일)의 순서를 다루는 순수 함수 */

/** from 자리의 항목을 to 자리로 옮긴 새 배열. 범위를 벗어나면 그대로 복사해요. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const copy = [...items];
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** ids 순서대로 항목을 늘어놓아요. ids에 없는 항목은 원래 순서로 뒤에 둬요. */
export function orderedBy<T extends { id: string }>(
  items: readonly T[],
  ids: readonly string[],
): T[] {
  const rank = new Map(ids.map((id, i) => [id, i] as const));
  return items
    .map((item, i) => ({ item, i }))
    .sort(
      (a, b) =>
        (rank.get(a.item.id) ?? ids.length + a.i) -
        (rank.get(b.item.id) ?? ids.length + b.i),
    )
    .map(({ item }) => item);
}

/**
 * 화면에 보인 일부(예: 열린 질문)만 순서를 바꿨을 때 전체 id 목록에 반영해요.
 * 보이지 않은 id(해결한 질문 등)는 제자리를 지켜요.
 */
export function reorderIds(
  allIds: readonly string[],
  visibleInNewOrder: readonly string[],
): string[] {
  const visible = new Set(visibleInNewOrder);
  const queue = visibleInNewOrder.filter((id) => allIds.includes(id));
  let next = 0;
  return allIds.map((id) => (visible.has(id) ? queue[next++] : id));
}
