// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AIWaitStatus } from "@/components/assistant-wait/AIWaitStatus";
import { aiWaitKindForMode, aiWaitLevel } from "@/lib/ai-wait";

afterEach(cleanup);

it("follows the 1s / 10s wait thresholds", () => {
  expect(aiWaitLevel(500)).toBe("none");
  expect(aiWaitLevel(5_000)).toBe("spinner");
  expect(aiWaitLevel(15_000)).toBe("detailed");
  expect(aiWaitKindForMode("suggest_revisions")).toBe("revision");
  expect(aiWaitKindForMode("organize_meeting")).toBe("organize");
});

it("renders nothing under 1s", () => {
  const { container } = render(
    <AIWaitStatus startedAt={0} now={500} kind="answer" label="기다리는 중" />,
  );
  expect(container.textContent).toBe("");
});

it("shows steps, elapsed and typical time after 10s without a progress bar", () => {
  const { container } = render(
    <AIWaitStatus
      startedAt={0}
      now={15_400}
      kind="revision"
      label="수정 방법을 살펴보고 있어요"
    />,
  );
  expect(screen.getByText("요청을 보냈어요")).toBeTruthy();
  expect(
    container.querySelector('[aria-current="step"]')?.textContent,
  ).toContain("수정 방법을 살펴보고 있어요");
  expect(screen.getByText("지난 시간 15초 · 보통 10~40초")).toBeTruthy();
  expect(screen.getByText(/이 화면을 떠나면 멈춰요/)).toBeTruthy();
  expect(container.querySelector('[role="progressbar"], progress')).toBeNull();
});
