// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickTaskInput } from "../src/components/tasks/TaskRow";

afterEach(cleanup);

function setup(onAdd: (title: string) => Promise<void>) {
  render(<QuickTaskInput onAdd={onAdd} onClose={() => {}} />);
  return screen.getByRole("textbox");
}

async function typeAndEnter(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
}

describe("QuickTaskInput", () => {
  it("keeps the text and does not leak a rejection when saving fails", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const input = setup(() => Promise.reject(new Error("offline")));
    await typeAndEnter(input, "표 2 출처 표기");
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe("표 2 출처 표기");
  });
});
