// index.ts의 import.meta.glob으로 자동 연결됩니다. 근거가 바뀌었을 때의 [다시 보내기](IA v2 06 §2.2, 09 A7) 전용입니다.
const dictionary: Record<string, string> = {
  "보고 있던 기록이 바뀌었어요. 최신 내용으로 다시 보낼까요?":
    "見ていた記録が変更されました。最新の内容で送り直しますか？",
  "‘{title}’에서 보낸 부분을 찾지 못했어요. 칩을 빼거나 다시 놓은 뒤 보내 주세요.":
    "「{title}」で送った部分が見つかりませんでした。チップを外すか置き直してから送ってください。",
};

export default dictionary;
