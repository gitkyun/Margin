// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { useWritingReview } from "../src/pages/writing/WritingReview";

vi.mock("@/lib/workspace", () => ({
  useWorkspace: () => ({ runAI: vi.fn(), mode: "connected" }),
}));
vi.mock("@/lib/ai-request-options", () => ({
  useAIRequestOptions: () => () => ({}),
}));
vi.mock("@/lib/ai-availability", () => ({
  useAINotConfigured: () => false,
}));

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  MockResizeObserver as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function createMockEditor(getPoint: () => { left: number; bottom: number }, empty = false) {
  const coordsAtPos = vi.fn(() => getPoint());
  const editor = {
    isDestroyed: false,
    getText: () => "선택된 문장입니다.",
    state: {
      selection: empty ? { empty: true, from: 1, to: 1 } : { empty: false, from: 1, to: 6 },
      doc: {
        content: { size: 20 },
        textBetween: () => (empty ? "" : "선택된 문장"),
      },
    },
    view: { coordsAtPos },
    commands: { focus: vi.fn() },
  } as unknown as Editor;
  return { editor, coordsAtPos };
}

function Harness({ editor }: { editor: Editor | null }) {
  const review = useWritingReview({
    editor,
    researchId: "r-1",
    documentId: "d-1",
    savedTitle: "초안",
    savedRevision: 1,
    dirty: false,
    busy: false,
    saveFirst: async () => {},
  });
  return <>{review.selectionBar}</>;
}

describe("WritingReview 선택 바 스크롤·리사이즈 추적 (U8-03)", () => {
  it("스크롤 시 선택 바의 y 좌표가 선택 영역을 따라 움직이고, 화면 밖에서는 clamp된다", () => {
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

    let point = { left: 120, bottom: 300 };
    const { editor } = createMockEditor(() => point);
    render(<Harness editor={editor} />);

    const bar = screen.getByRole("group", { name: "AI로 고쳐 쓰기" });
    expect(bar.style.top).toBe("308px");

    // 70px 아래로 스크롤 → 선택 영역 bottom이 230으로 이동
    point = { left: 120, bottom: 230 };
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      while (rafQueue.length) rafQueue.shift()!(0);
    });
    expect(bar.style.top).toBe("238px");

    // 스크롤 가능한 조상 요소에서 발생한 스크롤(버블링 안 됨, capture로 감지)
    const scroller = document.createElement("div");
    document.body.appendChild(scroller);
    try {
      point = { left: 120, bottom: -50 };
      act(() => {
        scroller.dispatchEvent(new Event("scroll", { bubbles: false }));
        while (rafQueue.length) rafQueue.shift()!(0);
      });
      // 화면 위로 나가면 상단 16px에 clamp
      expect(bar.style.top).toBe("16px");
    } finally {
      scroller.remove();
    }
  });

  it("바가 사라지면 scroll·resize 리스너를 정리한다", () => {
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        cb(0);
        return 1;
      });

    const { editor: activeEditor } = createMockEditor(
      () => ({ left: 100, bottom: 250 }),
      false,
    );
    const { rerender } = render(<Harness editor={activeEditor} />);

    const { editor: emptyEditor, coordsAtPos } = createMockEditor(
      () => ({ left: 100, bottom: 250 }),
      true,
    );
    rerender(<Harness editor={emptyEditor} />);

    const callsBefore = coordsAtPos.mock.calls.length;
    rafSpy.mockClear();
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
    });
    expect(rafSpy).not.toHaveBeenCalled();
    expect(coordsAtPos.mock.calls.length).toBe(callsBefore);
  });
});
