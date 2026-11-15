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
const models: AIModelCapability[] = [
  {
    id: "flash",
    label: "Flash 3.8",
    description: "Quick everyday research",
    provider: "Google",
    recommended: true,
    thinking: [],
  },
  {
    id: "review",
    label: "Review",
    description: "Long document review",
    provider: "Example",
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
describe("model selector", () => {
  it("focuses search, moves through available models with the keyboard, and closes with Escape", async () => {
    render(
      <AIModelSelector models={models} model="flash" onChange={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: "AI 모델 · Flash 3.8" });
    fireEvent.click(trigger);
    const search = await screen.findByRole("textbox", { name: "모델 검색" });
    await waitFor(() => expect(document.activeElement).toBe(search));
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Flash 3.8");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Review");
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Flash 3.8");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "모델 검색" })).toBeNull(),
    );
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it("searches descriptions and selects the result without submitting a surrounding form", async () => {
    const onChange = vi.fn(),
      onSubmit = vi.fn((event) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <AIModelSelector models={models} model="flash" onChange={onChange} />
      </form>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "AI 모델 · Flash 3.8" }),
    );
    const search = await screen.findByRole("textbox", { name: "모델 검색" });
    fireEvent.change(search, { target: { value: "long document" } });
    expect(screen.queryByRole("button", { name: /Flash 3.8 추천/ })).toBeNull();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ model: "review", thinking: "" });
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "모델 검색" })).toBeNull(),
    );
  });
  it("marks unverified models as disabled and offers a direct recommended-model action", async () => {
    const onChange = vi.fn();
    render(
      <AIModelSelector models={models} model="review" onChange={onChange} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "추천 모델로 선택 · Flash 3.8" }),
    );
    expect(onChange).toHaveBeenCalledWith({ model: "flash", thinking: "" });
    fireEvent.click(screen.getByRole("button", { name: "AI 모델 · Review" }));
    const pending = await screen.findByRole("button", {
      name: /^Pending/,
    });
    expect((pending as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(pending);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
