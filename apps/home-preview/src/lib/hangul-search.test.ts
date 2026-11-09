import { describe, expect, it } from "vitest";
import { koreanScore, commandFilter } from "./hangul-search";

describe("koreanScore", () => {
  it("returns 0 when nothing matches", () => {
    expect(koreanScore("미팅 만들기", "자료")).toBe(0);
  });

  it("ranks a prefix above a match in the middle", () => {
    const prefix = koreanScore("미팅 만들기", "미팅");
    const middle = koreanScore("새 미팅", "미팅");
    expect(prefix).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(0);
  });

  it("matches initial consonants (초성)", () => {
    expect(koreanScore("미팅 만들기", "ㅁㅌ")).toBeGreaterThan(0);
    expect(koreanScore("미팅 만들기", "ㅁㅌ ㅁㄷ")).toBeGreaterThan(0);
    expect(koreanScore("할 일 추가", "ㅁㅌ")).toBe(0);
    // 자모로 풀면 '검(ㅁ)토(ㅌ)'가 이어지지만 초성 검색은 초성끼리만 봅니다.
    expect(koreanScore("검토 요청", "ㅁㅌ")).toBe(0);
  });

  it("matches a syllable still being typed (밑 → 미팅)", () => {
    expect(koreanScore("미팅 만들기", "밑")).toBeGreaterThan(0);
  });

  it("ignores case and surrounding spaces", () => {
    expect(koreanScore("AI 사용량", "  ai ")).toBeGreaterThan(0);
  });

  it("returns 1 for an empty query so every item stays visible", () => {
    expect(koreanScore("아무거나", "   ")).toBe(1);
  });
});

describe("commandFilter", () => {
  it("compares keywords instead of the id-like value when given", () => {
    expect(commandFilter("record:abc", "abc", ["미팅 기록"])).toBe(0);
    expect(commandFilter("이동 홈", "홈")).toBeGreaterThan(0);
    expect(
      commandFilter("다크 화면", "테마", ["테마", "어둡게"]),
    ).toBeGreaterThan(0);
    expect(commandFilter("다크 화면", "글쓰기", ["테마"])).toBe(0);
  });

  it("ranks a match on the name above a match on a secondary keyword", () => {
    const byName = commandFilter("create:meeting", "미팅", ["미팅 만들기"]);
    const byType = commandFilter("record:1", "미팅", [
      "제6차 논문 지도",
      "미팅",
    ]);
    expect(byName).toBeGreaterThan(byType);
    expect(byType).toBeGreaterThan(0);
  });
});
