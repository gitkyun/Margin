import { describe, it, expect } from "vitest";
import {
  restoreMemoDraft,
  hasMemoConflict,
} from "../src/pages/student/memo-draft";
import { safeUrl } from "../src/lib/domain";
describe("미저장 원문 복구", () => {
  it("초안과 편집 기준 원문을 함께 복구한다", () => {
    const draft = restoreMemoDraft(
      JSON.stringify({
        text: "내 수정",
        baseMemo: "당시 원문",
        baseRevision: 2,
      }),
    );
    expect(draft).toEqual({
      text: "내 수정",
      baseMemo: "당시 원문",
      baseRevision: 2,
    });
    expect(hasMemoConflict(draft!.baseMemo, "다른 창 수정")).toBe(true);
  });
  it("같은 저장 원문이면 재시도하고 달라지면 자동 덮어쓰기를 막는다", () => {
    expect(hasMemoConflict("원문", "원문")).toBe(false);
    expect(hasMemoConflict("원문", "변경 원문")).toBe(true);
  });
  it("이전 형식의 초안은 입력을 보존하고 저장 기준을 모른다고 표시한다", () => {
    const draft = restoreMemoDraft("이전 입력");
    expect(draft?.text).toBe("이전 입력");
    expect(hasMemoConflict(draft!.baseMemo, "서버 원문")).toBe(true);
  });
  it("초안이 없으면 복원 기록을 만들지 않는다", () =>
    expect(restoreMemoDraft(null)).toBe(null));
});
describe("외부 자료 링크", () => {
  it("실행·파일 주소와 상대 경로를 외부 자료로 열지 않는다", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "file:///private/file",
      "//example.org",
      "/r/other",
    ])
      expect(safeUrl(url)).toBe(null);
  });
  it("명시한 웹 주소만 정규화한다", () =>
    expect(safeUrl("https://example.org/paper?q=1")).toBe(
      "https://example.org/paper?q=1",
    ));
});
