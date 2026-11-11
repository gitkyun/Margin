import { afterEach, describe, expect, it } from "vitest";
import { setLangForTest } from "../src/lib/i18n";
import {
  EXACT,
  FIELD_LABELS,
  REQUEST_FAILURES,
  localizeServerMessage,
} from "../src/lib/server-messages";
import ja from "../src/i18n/ja/server";

const HANGUL = /[가-힣]/u;

describe("서버 메시지의 일본어 문구", () => {
  afterEach(() => setLangForTest("ko"));

  it("표에 있는 모든 화면 문구가 일본어 사전에 있다", () => {
    const values = [
      ...Object.values(EXACT),
      ...Object.values(FIELD_LABELS),
      ...REQUEST_FAILURES.map(([, wording]) => wording),
    ];
    const missing = [...new Set(values)].filter(
      (value) => !ja[value] || HANGUL.test(ja[value]),
    );
    expect(missing).toEqual([]);
  });

  it("일본어에서는 서버 문구를 일본어로 바꿔 보여 준다", () => {
    setLangForTest("ja");
    for (const message of [
      ...Object.keys(EXACT),
      "title 입력을 확인해 주세요.",
      "unknownField 입력을 확인해 주세요.",
      "comment 입력 길이를 확인해 주세요.",
      "unknownField 입력 길이를 확인해 주세요.",
      "TimeoutError: signal timed out",
      "TypeError: Failed to fetch",
    ])
      expect(localizeServerMessage(message)).not.toMatch(HANGUL);
    expect(localizeServerMessage("title 입력을 확인해 주세요.")).toBe(
      "タイトルの入力内容を確認してください。",
    );
  });

  it("한국어에서는 기존 문구 그대로다", () => {
    expect(localizeServerMessage("title 입력을 확인해 주세요.")).toBe(
      "제목 입력을 확인해 주세요.",
    );
    expect(
      localizeServerMessage("unknownField 입력 길이를 확인해 주세요."),
    ).toBe("입력한 내용의 길이를 확인해 주세요.");
    expect(localizeServerMessage("접근할 수 없습니다.")).toBe(
      "접근할 수 없어요.",
    );
  });
});
