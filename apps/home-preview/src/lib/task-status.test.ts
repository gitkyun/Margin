import { describe, expect, it } from "vitest";
import { toggleDone } from "./task-status";

describe("작업 완료 체크 전환", () => {
  it("진행 전·진행 중 작업을 체크하면 완료가 된다", () => {
    expect(toggleDone("todo")).toBe("done");
    expect(toggleDone("doing")).toBe("done");
  });

  it("완료한 작업의 체크를 풀면 진행 전이 아니라 다시 진행 중이 된다", () => {
    expect(toggleDone("done")).toBe("doing");
  });
});
