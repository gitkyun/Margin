// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AIContext } from "@/lib/domain";
import {
  AssistantMessageText,
  citationsToLinks,
} from "@/pages/assistant/AssistantMessageText";

afterEach(cleanup);

const contexts = [
  { id: "m1", kind: "meetings", title: "미팅 메모", revision: 1, text: "x" },
] as unknown as AIContext[];

it("turns [근거 N] into a clickable badge and keeps unknown numbers as written", () => {
  const open = vi.fn();
  const { container } = render(
    <AssistantMessageText
      text="결과는 이렇습니다 [근거 1]. 다른 근거는 [근거 3]예요."
      contexts={contexts}
      onOpenSources={open}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "근거: 미팅 메모" }));
  fireEvent.click(screen.getByRole("button", { name: "근거 1개" }));
  fireEvent.click(screen.getByRole("link", { name: /미팅 메모/ }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("[근거 3]");
  expect(container.querySelectorAll("[data-citation-chip]")).toHaveLength(1);
});

it("shows simple formatting but never renders raw HTML, images or headings", () => {
  const { container } = render(
    <AssistantMessageText
      text={
        "**굵게** 그리고\n\n- 하나\n- 둘\n\n# 제목\n\n<script>alert(1)</script><img src=x onerror=alert(1)>"
      }
      contexts={[]}
    />,
  );
  expect(container.querySelector("strong")?.textContent).toBe("굵게");
  expect(container.querySelectorAll("li")).toHaveLength(2);
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("h1")).toBeNull();
  expect(container.textContent).toContain("제목");
});

it("opens real links safely and drops unsafe protocols", () => {
  const { container } = render(
    <AssistantMessageText
      text="[논문](https://example.com/a) [나쁨](javascript:alert(1))"
      contexts={[]}
    />,
  );
  const links = [...container.querySelectorAll("a")];
  const good = links.find((a) => a.textContent === "논문");
  expect(good?.getAttribute("href")).toBe("https://example.com/a");
  expect(good?.getAttribute("rel")).toBe("noopener noreferrer");
  expect(good?.getAttribute("target")).toBe("_blank");
  const bad = links.find((a) => a.textContent === "나쁨");
  expect(bad?.getAttribute("href") ?? "").not.toContain("javascript");
});

it("rewrites only explicit citation markers", () => {
  expect(citationsToLinks("논문 [1]과 [근거 2]")).toBe(
    "논문 [1]과 [근거 2](#cite-2)",
  );
});
