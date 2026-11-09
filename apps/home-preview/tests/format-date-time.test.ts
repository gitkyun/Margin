import { describe, expect, it } from "vitest";
import { formatDateTime } from "../src/lib/domain";

describe("formatDateTime", () => {
  it("올해 기록은 연도 없이 ‘월 일 (요일) 오후 시:분’, 초는 쓰지 않는다", () => {
    const year = new Date().getFullYear();
    const text = formatDateTime(`${year}-03-04T05:06:07Z`);
    expect(text).toMatch(/^3월 4일 \(.\) (오전|오후) \d{1,2}:\d{2}$/);
  });
  it("다른 해 기록은 연도를 붙이고, time: false면 날짜만 쓴다", () => {
    expect(formatDateTime("2001-03-04T05:06:07Z", { time: false })).toMatch(
      /^2001년 3월 4일 \(?.\)?$/,
    );
  });
  it("값이 없거나 잘못되면 빈 글자", () => {
    expect(formatDateTime(undefined)).toBe("");
    expect(formatDateTime("not-a-date")).toBe("");
  });
});
