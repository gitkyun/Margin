// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IntroStage } from "../src/components/onboarding/IntroStage";
import { ServiceIntro } from "../src/components/onboarding/ServiceIntro";
import {
  INTRO_FLOW,
  INTRO_SLIDE_COUNT,
  isIntroSeen,
  markIntroSeen,
  shouldShowIntro,
} from "../src/lib/intro";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("서비스 소개를 보여 줄지", () => {
  it("연구가 없고 아직 보지 않았을 때만 자동으로 보여 준다", () => {
    const base = { hasResearches: false, seen: false, forced: false };
    expect(shouldShowIntro(base)).toBe(true);
    expect(shouldShowIntro({ ...base, seen: true })).toBe(false);
    expect(shouldShowIntro({ ...base, hasResearches: true })).toBe(false);
  });

  it("?intro=1로 들어오면 이미 봤어도 다시 보여 준다", () => {
    expect(
      shouldShowIntro({ hasResearches: true, seen: true, forced: true }),
    ).toBe(true);
  });

  it("봤다는 기록을 이 브라우저에 남긴다", () => {
    expect(isIntroSeen()).toBe(false);
    markIntroSeen();
    expect(isIntroSeen()).toBe(true);
  });
});

describe("서비스 소개 화면", () => {
  it("세 장을 차례로 넘기고 마지막에서 연구 만들기로 넘어간다", () => {
    const done = vi.fn();
    render(<ServiceIntro onDone={done} />);
    expect(screen.getByText(`소개 1 / ${INTRO_SLIDE_COUNT}`)).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "마진에 오신 걸 환영해요" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    const second = screen.getByRole("heading", {
      name: "미팅에서 검토 요청까지 이어져요",
    });
    // 장을 넘기면 새 제목으로 초점이 옮겨 가요.
    expect(document.activeElement).toBe(second);
    for (const step of INTRO_FLOW)
      expect(screen.getByText(step.label)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.queryByRole("button", { name: "소개 건너뛰기" })).toBeNull();
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "연구 만들기" }));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("이전으로 돌아가면 들어오는 방향이 반대로 바뀐다", () => {
    const { container } = render(<ServiceIntro onDone={() => {}} />);
    const direction = () =>
      container.querySelector(".ob-step")?.getAttribute("data-dir");
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(direction()).toBe("forward");
    fireEvent.click(screen.getByRole("button", { name: "이전" }));
    expect(direction()).toBe("back");
    expect(screen.getByText(`소개 1 / ${INTRO_SLIDE_COUNT}`)).toBeTruthy();
  });

  it("흐름 단계를 누르면 그 단계가 골라지고 오른쪽 장면에 알린다", () => {
    const scene = vi.fn();
    render(<ServiceIntro onDone={() => {}} onScene={scene} />);
    expect(scene).toHaveBeenLastCalledWith({ slide: 0, flowIndex: 0 });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    const step = screen.getByRole("button", { name: /수정 결과/ });
    expect(step.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(step);
    expect(step.getAttribute("aria-pressed")).toBe("true");
    expect(scene).toHaveBeenLastCalledWith({ slide: 1, flowIndex: 3 });
    // 키보드로 옮겨 가도 같은 단계가 골라져요.
    fireEvent.focus(screen.getByRole("button", { name: /검토 요청/ }));
    expect(scene).toHaveBeenLastCalledWith({ slide: 1, flowIndex: 4 });
  });

  it("장면은 고른 단계까지 선을 잇고 그 단계의 예시를 보여 준다", () => {
    const { container } = render(<IntroStage slide={1} flowIndex={2} />);
    const states = [...container.querySelectorAll(".ob-node")].map((node) =>
      node.getAttribute("data-state"),
    );
    expect(states).toEqual(["done", "done", "active", null, null]);
    expect(container.querySelector(".ob-flowcard")?.textContent).toContain(
      INTRO_FLOW[2].example,
    );
    expect(
      container.querySelector(".ob-stage")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("어느 장에서든 건너뛸 수 있다", () => {
    const done = vi.fn();
    render(<ServiceIntro onDone={done} />);
    fireEvent.click(screen.getByRole("button", { name: "소개 건너뛰기" }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
