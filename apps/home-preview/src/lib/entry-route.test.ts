import { describe, expect, it } from "vitest";
import { isHomeEntry } from "./entry-route";

describe("isHomeEntry", () => {
  it("시작 경로와 연구 홈은 홈 진입으로 본다", () => {
    expect(isHomeEntry("/", "")).toBe(true);
    expect(isHomeEntry("/r/research-1", "")).toBe(true);
    expect(isHomeEntry("/r/research-1/", "")).toBe(true);
  });

  it("다른 학생 화면과 연구 선택은 홈 진입이 아니다", () => {
    expect(isHomeEntry("/r", "")).toBe(false);
    expect(isHomeEntry("/r/research-1/meetings", "")).toBe(false);
    expect(isHomeEntry("/reviews/request-1", "")).toBe(false);
  });

  it("로그인 직후에는 돌아갈 경로를 기준으로 판단한다", () => {
    expect(isHomeEntry("/login", "")).toBe(true);
    expect(isHomeEntry("/login", "?next=%2Fr%2Fresearch-1")).toBe(true);
    expect(isHomeEntry("/login", "?next=%2Fr%2Fresearch-1%2Ftasks")).toBe(
      false,
    );
  });
});
