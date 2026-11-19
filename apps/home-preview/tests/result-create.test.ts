import { describe, expect, it } from "vitest";
import {
  newResultRequest,
  withoutNewResult,
} from "../src/components/item-detail/ResultCreateHost";

describe("그 자리에서 여는 수정 결과 작성 창(01 §3.3 `new=result`)", () => {
  it("미리 채울 피드백·할 일·파일 판을 읽는다", () => {
    expect(newResultRequest("?new=result&version=v1")).toEqual({
      feedback: undefined,
      task: undefined,
      version: "v1",
    });
    expect(newResultRequest("?new=result&feedback=f1&task=t1")).toEqual({
      feedback: "f1",
      task: "t1",
      version: undefined,
    });
  });

  it("다른 new 값(미팅의 new=1·new=written, 글의 new=1)은 건드리지 않는다", () => {
    expect(newResultRequest("?new=1")).toBeNull();
    expect(newResultRequest("?new=written")).toBeNull();
    expect(newResultRequest("")).toBeNull();
  });

  it("연 뒤에는 그 값들만 지운다", () => {
    expect(withoutNewResult("?type=review&new=result&version=v1")).toBe(
      "?type=review",
    );
    expect(withoutNewResult("?new=result")).toBe("");
  });
});
