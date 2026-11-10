// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBusyKey } from "../src/lib/use-busy-key";

describe("한 번에 하나의 저장(useBusyKey)", () => {
  it("같은 순간 두 번 눌러도 요청은 한 번만 보낸다(F-010)", async () => {
    const { result } = renderHook(() => useBusyKey());
    let finish = () => {};
    const operation = vi.fn(
      () => new Promise<string>((resolve) => (finish = () => resolve("saved"))),
    );
    let first: Promise<string | undefined> = Promise.resolve(undefined);
    let second: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      // 렌더가 끼어들지 않는 같은 틱의 두 클릭
      first = result.current.run("response", operation);
      second = result.current.run("response", operation);
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe("response");
    await expect(second).resolves.toBeUndefined();
    await act(async () => {
      finish();
      await first;
    });
    await expect(first).resolves.toBe("saved");
    expect(result.current.busy).toBe("");
  });

  it("앞의 저장이 실패해도 다음 저장은 다시 보낼 수 있다", async () => {
    const { result } = renderHook(() => useBusyKey());
    await act(async () => {
      await expect(
        result.current.run("comment", () => Promise.reject(new Error("x"))),
      ).rejects.toThrow("x");
    });
    const next = vi.fn(() => Promise.resolve(1));
    await act(async () => {
      await result.current.run("comment", next);
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe("");
  });
});
