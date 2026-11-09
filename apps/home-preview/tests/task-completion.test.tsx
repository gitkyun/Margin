// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../src/lib/domain";

const toastCalls = vi.hoisted(() => ({
  show: vi.fn(),
  dismiss: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(toastCalls.show, {
    dismiss: toastCalls.dismiss,
    error: toastCalls.error,
  }),
}));

import {
  COMPLETE_HOLD_MS,
  UNDO_MS,
  useTaskCompletion,
} from "../src/lib/use-task-completion";

const task = (status: Task["status"]): Task =>
  ({
    id: "t1",
    researchId: "r1",
    title: "참고문헌 정리",
    status,
    createdAt: "2026-11-01",
    updatedAt: "2026-11-01",
  }) as Task;

type Save = (kind: "tasks", value: Task) => Promise<Task>;

function setup() {
  const save = vi.fn<Save>(async (_kind, value) => ({
    ...value,
    updatedAt: "2026-11-09",
  }));
  const hook = renderHook(() => useTaskCompletion(save));
  return { save, hook };
}

function lastUndoAction() {
  const options = toastCalls.show.mock.calls.at(-1)?.[1];
  return options?.action?.onClick as () => void;
}

beforeEach(() => {
  vi.useFakeTimers();
  toastCalls.show.mockReset().mockReturnValue("toast-1");
  toastCalls.dismiss.mockReset();
  toastCalls.error.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("useTaskCompletion", () => {
  it("completes a task, holds it in place briefly and offers undo for 6s", async () => {
    const { save, hook } = setup();
    await act(() => hook.result.current.toggle(task("doing")));

    expect(save).toHaveBeenCalledWith(
      "tasks",
      expect.objectContaining({ status: "done" }),
    );
    expect(hook.result.current.held.has("t1")).toBe(true);
    expect(toastCalls.show).toHaveBeenCalledWith(
      "할 일을 완료했어요",
      expect.objectContaining({
        duration: UNDO_MS,
        description: "참고문헌 정리",
      }),
    );

    act(() => vi.advanceTimersByTime(COMPLETE_HOLD_MS));
    expect(hook.result.current.held.has("t1")).toBe(false);
  });

  it("undo restores the previous status on the record save returned", async () => {
    const { save, hook } = setup();
    await act(() => hook.result.current.toggle(task("todo")));
    await act(async () => lastUndoAction()());

    expect(save).toHaveBeenLastCalledWith(
      "tasks",
      expect.objectContaining({ status: "todo", updatedAt: "2026-11-09" }),
    );
    expect(toastCalls.dismiss).toHaveBeenCalledWith("toast-1");
  });

  it("⌘Z undoes the last completion, but not while typing in a field", async () => {
    const { save, hook } = setup();
    await act(() => hook.result.current.toggle(task("doing")));

    const input = document.createElement("input");
    document.body.append(input);
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }),
    );
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "z", metaKey: true }),
      );
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(
      "tasks",
      expect.objectContaining({ status: "doing" }),
    );
    input.remove();
  });

  it("reopening a done task saves 'doing' without an undo toast", async () => {
    const { save, hook } = setup();
    await act(() => hook.result.current.toggle(task("done")));
    expect(save).toHaveBeenCalledWith(
      "tasks",
      expect.objectContaining({ status: "doing" }),
    );
    expect(toastCalls.show).not.toHaveBeenCalled();
    expect(hook.result.current.held.size).toBe(0);
  });

  it("shows an error toast and releases the busy flag when saving fails", async () => {
    const save = vi.fn<Save>(async () => {
      throw new Error("저장하지 못했어요");
    });
    const hook = renderHook(() => useTaskCompletion(save));
    await act(() => hook.result.current.toggle(task("doing")));
    expect(toastCalls.error).toHaveBeenCalledWith("저장하지 못했어요");
    expect(hook.result.current.busy.size).toBe(0);
  });
});
