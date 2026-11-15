/**
 * 여러 개를 고르는 목록 필터를 주소(?status=a,b)에 담고 읽어요.
 * 아무것도 고르지 않으면 ‘전체’이고 주소에서 키를 지워요.
 */

/** 주소의 값 중 허용 목록에 있는 것만, 중복 없이 순서대로 돌려줘요. */
export function readMultiParam(
  params: URLSearchParams,
  key: string,
  allowed?: ReadonlySet<string>,
): string[] {
  const raw = params.get(key);
  if (!raw) return [];
  const values = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value && (!allowed || allowed.has(value)));
  return [...new Set(values)];
}

/** 원래 주소를 바꾸지 않고, 그 키만 바꾼 새 주소 값을 돌려줘요. */
export function writeMultiParam(
  params: URLSearchParams,
  key: string,
  values: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (values.length) next.set(key, [...new Set(values)].join(","));
  else next.delete(key);
  return next;
}

/** 고른 값이 없으면 모두 통과, 있으면 그중 하나와 같아야 통과 */
export function matchesAny(
  selected: readonly string[],
  value: string,
): boolean {
  return !selected.length || selected.includes(value);
}

/** 선택 하나를 켜거나 끈 새 배열 */
export function toggleValue(
  selected: readonly string[],
  value: string,
): string[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}
