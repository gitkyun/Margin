import { canBeChoseong, disassemble, getChoseong } from "es-hangul";

/**
 * 한글 검색 점수(0이면 안 맞음, 클수록 위). ⌘K 명령 팔레트가 씁니다.
 * - 그대로 포함: 앞에서 맞으면 1, 가운데면 0.8
 * - 초성만 입력(ㅁㅌ → 미팅): 0.6
 * - 아직 조합 중인 글자(밑 → 미팅): 자모로 풀어 비교, 0.4
 */
const SCORE = { prefix: 1, contains: 0.8, choseong: 0.6, jamo: 0.4 } as const;
/** 이름 말고 덧붙인 말(기록 종류, 비슷한 말)로 맞으면 조금 아래로 */
const SECONDARY_WEIGHT = 0.75;

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function isChoseongOnly(query: string): boolean {
  const letters = query.replace(/\s/g, "");
  return letters.length > 0 && [...letters].every((c) => canBeChoseong(c));
}

export function koreanScore(text: string, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const t = normalize(text);
  if (t.startsWith(q)) return SCORE.prefix;
  if (t.includes(q)) return SCORE.contains;
  const compactQuery = q.replace(/\s/g, "");
  // 초성만 쳤으면 초성끼리만 비교합니다(자모로 풀면 '검토'의 ㅁ·ㅌ처럼 엉뚱하게 맞음).
  if (isChoseongOnly(q))
    return getChoseong(t.replace(/\s/g, "")).includes(compactQuery)
      ? SCORE.choseong
      : 0;
  if (disassemble(t).replace(/\s/g, "").includes(disassemble(compactQuery)))
    return SCORE.jamo;
  return 0;
}

/**
 * cmdk `filter` 모양. 팔레트 항목은 value에 겹치지 않는 id를 두고 보이는 이름은
 * keywords에 넣으므로, keywords가 있으면 그것만 비교합니다(id 글자로 잘못 맞지 않게).
 * keywords[0]은 보이는 이름이고, 나머지로 맞으면 점수를 조금 낮춥니다.
 */
export function commandFilter(
  value: string,
  search: string,
  keywords: string[] = [],
): number {
  if (!keywords.length) return koreanScore(value, search);
  const [name, ...rest] = keywords;
  return Math.max(
    koreanScore(name, search),
    ...rest.map((k) => koreanScore(k, search) * SECONDARY_WEIGHT),
  );
}
