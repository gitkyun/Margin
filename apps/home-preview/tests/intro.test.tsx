// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { IntroStage } from "../src/components/onboarding/IntroStage";
import { ServiceIntro } from "../src/components/onboarding/ServiceIntro";
import {
  INTRO_FLOW,
  INTRO_FLOW_MS,
  INTRO_SLIDE_COUNT,
  INTRO_SLIDE_MS,
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
    expect(scene).toHaveBeenLastCalledWith(
      expect.objectContaining({ slide: 0, flowIndex: 0 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    const step = screen.getByRole("button", { name: /수정 결과/ });
    expect(step.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(step);
    expect(step.getAttribute("aria-pressed")).toBe("true");
    expect(scene).toHaveBeenLastCalledWith(
      expect.objectContaining({ slide: 1, flowIndex: 3 }),
    );
    // 키보드로 옮겨 가도 같은 단계가 골라져요.
    fireEvent.focus(screen.getByRole("button", { name: /검토 요청/ }));
    expect(scene).toHaveBeenLastCalledWith(
      expect.objectContaining({ slide: 1, flowIndex: 4 }),
    );
  });

  it("장면은 고른 단계의 화면 그림과 예시를 보여 준다", () => {
    const { container } = render(<IntroStage slide={1} flowIndex={2} />);
    const states = [...container.querySelectorAll(".ob-stage-nav span")].map(
      (node) => node.getAttribute("data-state"),
    );
    expect(states).toEqual(["done", "done", "active", null, null]);
    expect(container.querySelector(".ob-shot")?.textContent).toContain(
      INTRO_FLOW[2].example,
    );
    expect(
      container.querySelector(".ob-stage")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("검토 요청 장면은 교수 결과 이름을 제품 용어 그대로 쓴다", () => {
    const { container } = render(<IntroStage slide={1} flowIndex={4} />);
    expect(container.textContent).toContain("수정 내용 확인");
  });

  it("자동으로 넘어가다가 마지막 장에서 멈춘다", () => {
    vi.useFakeTimers();
    try {
      const scene = vi.fn();
      render(<ServiceIntro onDone={() => {}} onScene={scene} />);
      act(() => vi.advanceTimersByTime(INTRO_SLIDE_MS));
      expect(scene).toHaveBeenLastCalledWith(
        expect.objectContaining({ slide: 1, flowIndex: 0 }),
      );
      // 흐름 장에서는 다섯 단계를 차례로 돈 뒤 다음 장으로 가요.
      for (let index = 1; index < INTRO_FLOW.length; index += 1) {
        act(() => vi.advanceTimersByTime(INTRO_FLOW_MS));
        expect(scene).toHaveBeenLastCalledWith(
          expect.objectContaining({ slide: 1, flowIndex: index }),
        );
      }
      act(() => vi.advanceTimersByTime(INTRO_FLOW_MS));
      expect(screen.getByText(`소개 3 / ${INTRO_SLIDE_COUNT}`)).toBeTruthy();
      // 마지막 장은 사람이 직접 눌러야 넘어가요.
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByRole("button", { name: "연구 만들기" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /자동 넘김/ })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("자동 넘김을 멈추거나 단계를 직접 고르면 더 넘어가지 않는다", () => {
    vi.useFakeTimers();
    try {
      render(<ServiceIntro onDone={() => {}} />);
      fireEvent.click(screen.getByRole("button", { name: "자동 넘김 멈추기" }));
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByText(`소개 1 / ${INTRO_SLIDE_COUNT}`)).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "자동 넘김 켜기" }));
      act(() => vi.advanceTimersByTime(INTRO_SLIDE_MS));
      expect(screen.getByText(`소개 2 / ${INTRO_SLIDE_COUNT}`)).toBeTruthy();
      const step = screen.getByRole("button", { name: /할 일/ });
      fireEvent.click(step);
      act(() => vi.advanceTimersByTime(60_000));
      expect(step.getAttribute("aria-pressed")).toBe("true");
      expect(
        screen.getByRole("button", { name: "자동 넘김 켜기" }),
      ).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("동작 줄이기 설정이면 자동으로 넘기지 않는다", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"),
      addEventListener() {},
      removeEventListener() {},
    }));
    try {
      render(<ServiceIntro onDone={() => {}} />);
      act(() => vi.advanceTimersByTime(60_000));
      expect(screen.getByText(`소개 1 / ${INTRO_SLIDE_COUNT}`)).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("이전으로 돌아가면 그 장이 처음부터 다시 시작한다", () => {
    vi.useFakeTimers();
    try {
      const scene = vi.fn();
      render(<ServiceIntro onDone={() => {}} onScene={scene} />);
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
      // 단계를 직접 골라 자동 넘김이 멈춘 상태에서 돌아가요.
      fireEvent.click(screen.getByRole("button", { name: /수정 결과/ }));
      const before = scene.mock.lastCall?.[0].run;
      fireEvent.click(screen.getByRole("button", { name: "이전" }));
      expect(screen.getByText(`소개 1 / ${INTRO_SLIDE_COUNT}`)).toBeTruthy();
      // 장면을 처음부터 다시 돌리라는 값이 바뀌고, 자동 넘김도 다시 켜져 있어요.
      expect(scene.mock.lastCall?.[0].run).not.toBe(before);
      expect(
        screen.getByRole("button", { name: "자동 넘김 멈추기" }),
      ).toBeTruthy();
      act(() => vi.advanceTimersByTime(INTRO_SLIDE_MS));
      // 다시 넘어간 흐름 장은 고르던 단계가 아니라 첫 단계부터 시작해요.
      expect(scene).toHaveBeenLastCalledWith(
        expect.objectContaining({ slide: 1, flowIndex: 0 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("단계를 가리키는 동안만 멈추고, 벗어나면 다시 넘어간다", () => {
    vi.useFakeTimers();
    try {
      const scene = vi.fn();
      render(<ServiceIntro onDone={() => {}} onScene={scene} />);
      fireEvent.click(screen.getByRole("button", { name: "다음" }));
      const step = screen.getByRole("button", { name: /할 일/ });
      fireEvent.pointerEnter(step);
      act(() => vi.advanceTimersByTime(60_000));
      expect(scene).toHaveBeenLastCalledWith(
        expect.objectContaining({ slide: 1, flowIndex: 2 }),
      );
      fireEvent.pointerLeave(step);
      act(() => vi.advanceTimersByTime(INTRO_FLOW_MS));
      expect(scene).toHaveBeenLastCalledWith(
        expect.objectContaining({ slide: 1, flowIndex: 3 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("어느 장에서든 건너뛸 수 있다", () => {
    const done = vi.fn();
    render(<ServiceIntro onDone={done} />);
    fireEvent.click(screen.getByRole("button", { name: "소개 건너뛰기" }));
    expect(done).toHaveBeenCalledTimes(1);
  });
});
