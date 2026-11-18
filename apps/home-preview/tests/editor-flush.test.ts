import { describe, expect, it } from "vitest";
import { flushEditor, registerFlush } from "@/lib/editor-flush";

describe("editor flush", () => {
  it("등록한 편집기가 없으면 저장할 것이 없다고 본다", async () => {
    expect(await flushEditor("none")).toBe(true);
  });

  it("등록한 저장 함수의 결과를 돌려주고, 오류는 false로 바꾼다", async () => {
    const off = registerFlush("d1", async () => true);
    expect(await flushEditor("d1")).toBe(true);
    off();
    const off2 = registerFlush("d1", async () => {
      throw new Error("network");
    });
    expect(await flushEditor("d1")).toBe(false);
    off2();
    expect(await flushEditor("d1")).toBe(true);
  });

  it("먼저 등록한 쪽을 풀어도 나중에 등록한 함수는 남는다", async () => {
    const offOld = registerFlush("d2", async () => false);
    registerFlush("d2", async () => true);
    offOld();
    expect(await flushEditor("d2")).toBe(true);
  });
});
