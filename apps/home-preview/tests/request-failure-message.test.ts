import { describe, expect, it } from "vitest";
import { localizeServerMessage } from "../src/lib/server-messages";

describe("요청 자체가 실패했을 때 문구(F-003)", () => {
  it("시간 초과·중단을 영어 원문 대신 한국어로 알린다", () => {
    const wording =
      "서버 응답이 늦어 요청을 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.";
    expect(localizeServerMessage("TimeoutError: signal timed out")).toBe(
      wording,
    );
    expect(
      localizeServerMessage("AbortError: The operation was aborted."),
    ).toBe(wording);
  });

  it("네트워크 실패도 한국어로 알린다", () => {
    expect(localizeServerMessage("TypeError: Failed to fetch")).toBe(
      "서버에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
    );
    expect(localizeServerMessage("TypeError: Load failed")).toMatch(
      /^서버에 연결하지 못했어요/u,
    );
  });

  it("앱이 직접 만든 취소 문구와 다른 메시지는 그대로 둔다", () => {
    expect(localizeServerMessage("업로드를 취소했어요.")).toBe(
      "업로드를 취소했어요.",
    );
    expect(localizeServerMessage("TypeError: x is undefined")).toBe(
      "TypeError: x is undefined",
    );
  });
});
