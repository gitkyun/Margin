// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AIModelSelector } from "./AIModelSelector";
import type { AIModelCapability } from "@/lib/ai-capabilities";

afterEach(cleanup);
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const models: AIModelCapability[] = [
  {
    id: "flash",
    label: "Flash 3.8",
    description: "Quick everyday research",
    provider: "google",
    recommended: true,
    thinking: [],
  },
  {
    id: "review",
    label: "Review",
    description: "Long document review",
    provider: "example",
    thinking: [],
  },
  {
    id: "pending",
    label: "Pending",
    description: "Waiting for verification",
    thinking: [],
    disabled: true,
  },
];

function openByKeyboard(trigger: HTMLElement) {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
}

describe("model selector", () => {
  it("opens as a listbox, moves with the keyboard, and returns focus on Escape", async () => {
    render(
      <AIModelSelector models={models} model="flash" onChange={vi.fn()} />,
    );
    const trigger = screen.getByRole("combobox", {
      name: "AI 모델 · Flash 3.8",
    });
    openByKeyboard(trigger);
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringContaining("Flash 3.8"),
      expect.stringContaining("Review"),
      expect.stringContaining("Pending"),
    ]);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("selects a model with Enter without submitting a surrounding form", async () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <AIModelSelector models={models} model="flash" onChange={onChange} />
      </form>,
    );
    openByKeyboard(
      screen.getByRole("combobox", { name: "AI 모델 · Flash 3.8" }),
    );
    const review = await screen.findByRole("option", { name: /Review/ });
    fireEvent.mouseMove(review);
    fireEvent.keyDown(review, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ model: "review", thinking: "" });
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
  });

  it("shows unverified models as disabled and offers a direct recommended-model action", async () => {
    const onChange = vi.fn();
    render(
      <AIModelSelector models={models} model="review" onChange={onChange} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "추천 모델로 선택 · Flash 3.8" }),
    );
    expect(onChange).toHaveBeenCalledWith({ model: "flash", thinking: "" });
    openByKeyboard(screen.getByRole("combobox", { name: "AI 모델 · Review" }));
    const pending = await screen.findByRole("option", { name: /Pending/ });
    expect(pending.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(pending);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("hides the quick pick in compact mode", () => {
    render(
      <AIModelSelector
        models={models}
        model="review"
        onChange={vi.fn()}
        compact
      />,
    );
    expect(
      screen.queryByRole("button", { name: /추천 모델로 선택/ }),
    ).toBeNull();
  });
});
