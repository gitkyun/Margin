import { describe, expect, it } from "vitest";
import { navigationGuardSummary } from "./navigation-guard";

describe("여러 편집 영역의 이동 보호", () => {
  it("다른 폼이 저장되어도 남은 미저장 입력은 보호한다", () => {
    expect(
      navigationGuardSummary([
        { dirty: false, label: "준비 작업" },
        { dirty: true, label: "미팅 메모" },
      ]),
    ).toEqual({ active: true, busy: false, labels: ["미팅 메모"] });
  });

  it("입력 변경이 없어도 저장 요청이 끝나기 전에는 이동을 막는다", () => {
    expect(
      navigationGuardSummary([
        { dirty: false, busy: true, label: "자료 연결" },
      ]),
    ).toEqual({ active: true, busy: true, labels: ["자료 연결"] });
  });

  it("저장 성공 또는 명시적 취소 후 모든 등록이 비면 이동을 허용한다", () => {
    expect(
      navigationGuardSummary([
        { dirty: false, busy: false, label: "수정 결과" },
      ]).active,
    ).toBe(false);
    expect(navigationGuardSummary([]).active).toBe(false);
  });
});
