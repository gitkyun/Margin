/** 줄바꿈을 막는 보이지 않는 문자(WORD JOINER). 글자 수·검색에는 영향이 없습니다. */
const WORD_JOINER = "⁠";

/** 닫는 따옴표 바로 뒤에 붙는 한국어 조사 */
const QUOTE_THEN_PARTICLE = /([’”'"」』])(?=[을를이가은는의에와과도로])/gu;

/**
 * "‘추가 수정 필요’를"처럼 따옴표 뒤에 붙은 조사가 줄 첫머리로 혼자 떨어지지 않게 합니다.
 * `word-break: keep-all`은 닫는 따옴표 뒤를 줄바꿈 자리로 보기 때문에 문구에서 직접 막습니다.
 * 번역 열쇠는 바꾸지 않도록 t()를 거친 뒤의 문자열에 씁니다.
 */
export function keepParticle(text: string): string {
  return text.replace(QUOTE_THEN_PARTICLE, `$1${WORD_JOINER}`);
}
