import { describe, expect, it } from "vitest";
import {
  newPollRequest,
  withoutNewPoll,
} from "@/components/meetings/PollCreate";

describe("그 자리에서 여는 미팅 시간 조율 창(01 §3.3 `new=poll`)", () => {
  it("new=poll일 때만 연다", () => {
    expect(newPollRequest("?type=poll&new=poll")).toBe(true);
    expect(newPollRequest("?new=1")).toBe(false);
    expect(newPollRequest("")).toBe(false);
  });

  it("창을 연 뒤 new만 지우고 보기는 남긴다", () => {
    expect(withoutNewPoll("?type=poll&new=poll")).toBe("?type=poll");
    expect(withoutNewPoll("?new=poll")).toBe("");
  });
});
