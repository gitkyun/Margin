import { describe, expect, it } from "vitest";
import {
  WRITTEN_MAX,
  writtenTitle,
} from "../src/components/meetings/WrittenFeedbackDialog";

describe("서면 피드백(IA v2 04 §7.2)", () => {
  it("받은 날로 기본 제목을 만든다", () => {
    expect(writtenTitle("2026-11-12")).toBe("11월 12일 서면 피드백");
    expect(writtenTitle("")).toBe("서면 피드백");
  });
  it("내용 한도는 서버 메모 한도와 같은 50,000자", () => {
    expect(WRITTEN_MAX).toBe(50_000);
  });
});
