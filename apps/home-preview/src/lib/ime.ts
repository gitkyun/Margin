/**
 * 한글 조합 중 키 입력인지 판단합니다.
 * 조합을 끝내는 Enter로 덜 쓴 질문이 추가되거나 전송되지 않게 할 때 씁니다.
 * Safari는 조합 종료 Enter에서 isComposing이 false인 경우가 있어 keyCode 229도 봅니다.
 */
export function isImeComposing(event: {
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean; keyCode?: number };
  isComposing?: boolean;
}): boolean {
  const native = event.nativeEvent ?? event;
  return (
    Boolean(native.isComposing) ||
    native.keyCode === 229 ||
    event.keyCode === 229
  );
}
