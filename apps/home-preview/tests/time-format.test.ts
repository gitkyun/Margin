import { describe, expect, it } from "vitest";
import {
  detectHourStyle,
  formatClock,
  timeFieldFormat,
  timeParts,
} from "../src/lib/time-format";

describe("기기의 시각 표기 방식 읽기", () => {
  it("12시간제 기기는 12h, 24시간제 기기는 24h", () => {
    expect(detectHourStyle(() => ({ hourCycle: "h12" }))).toBe("12h");
    expect(detectHourStyle(() => ({ hourCycle: "h11" }))).toBe("12h");
    expect(detectHourStyle(() => ({ hourCycle: "h23" }))).toBe("24h");
    expect(detectHourStyle(() => ({ hourCycle: "h24" }))).toBe("24h");
  });

  it("hourCycle이 없으면 hour12 값을 본다", () => {
    expect(detectHourStyle(() => ({ hour12: true }))).toBe("12h");
    expect(detectHourStyle(() => ({ hour12: false }))).toBe("24h");
  });

  it("읽지 못하면 24시간제로 쓴다", () => {
    expect(detectHourStyle(() => ({}))).toBe("24h");
    expect(
      detectHourStyle(() => {
        throw new Error("Intl 없음");
      }),
    ).toBe("24h");
  });
});

describe("저장된 시각(HH:mm) 표기", () => {
  it("24시간제는 두 자리 시로 쓴다", () => {
    expect(formatClock("14:00", "24h")).toBe("14:00");
    expect(formatClock("9:05", "24h")).toBe("09:05");
    expect(formatClock("00:00", "24h")).toBe("00:00");
  });

  it("12시간제는 오전·오후를 앞에 쓴다", () => {
    expect(formatClock("14:00", "12h")).toBe("오후 2:00");
    expect(formatClock("09:05", "12h")).toBe("오전 9:05");
    expect(formatClock("00:30", "12h")).toBe("오전 12:30");
    expect(formatClock("12:00", "12h")).toBe("오후 12:00");
  });

  it("비었거나 형식이 아니면 지어내지 않는다", () => {
    expect(formatClock("", "12h")).toBe("");
    expect(formatClock(null, "24h")).toBe("");
    expect(formatClock("미정", "12h")).toBe("미정");
    expect(formatClock("25:00", "12h")).toBe("25:00");
  });
});

describe("날짜와 함께 쓰는 시각, 입력 칸", () => {
  const at = new Date(2026, 10, 13, 14, 5);
  const text = (style: "12h" | "24h") =>
    new Intl.DateTimeFormat("ko-KR", timeParts(style)).format(at);

  it("표기와 입력 칸이 같은 방식을 쓴다", () => {
    expect(text("12h")).toBe("오후 2:05");
    expect(text("24h")).toBe("14:05");
    expect(timeFieldFormat("12h")).toEqual({
      format: "a hh:mm",
      placeholder: "오전 00:00",
    });
    expect(timeFieldFormat("24h")).toEqual({
      format: "HH:mm",
      placeholder: "00:00",
    });
  });
});
