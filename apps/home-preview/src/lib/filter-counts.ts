/** 목록 필터의 각 선택지가 보여 줄 항목 수. 화면의 실제 필터 조건을 그대로 받는다. */
export function filterCounts<T>(
  values: readonly string[],
  items: readonly T[],
  matches: (item: T, value: string) => boolean,
): Record<string, number> {
  return Object.fromEntries(
    values.map((value) => [
      value,
      items.filter((item) => matches(item, value)).length,
    ]),
  );
}
