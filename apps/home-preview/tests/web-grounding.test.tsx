// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { AssistantMessageText } from "@/pages/assistant/AssistantMessageText";
import {
  safeWebUrl,
  webCitationMarkdown,
  type WebGroundingData,
} from "@/pages/assistant/WebGroundedText";
import {
  restorePendingContexts,
  messageFileContexts,
} from "@/pages/assistant/conversation-contexts";
import type { AIContext, AIConversationMessage } from "@/lib/domain";

afterEach(cleanup);
const grounding: WebGroundingData = {
  sources: [
    { url: "https://example.org/paper", title: "공개 논문" },
    { url: "javascript:alert(1)", title: "위험 링크" },
  ],
  citations: [{ startIndex: 0, endIndex: 4, sourceIndices: [0, 1, 999] }],
  queries: ["최신 연구 동향"],
};

it("uses only returned valid web support offsets and safe sources", () => {
  expect(webCitationMarkdown("😀한글 근거", grounding)).toBe(
    "😀한글 [웹 근거 1](#web-cite-0) 근거",
  );
  expect(webCitationMarkdown("짧음", grounding)).toBe("짧음");
  expect(safeWebUrl("file:///etc/passwd")).toBeNull();
  expect(safeWebUrl("https://user:password@example.com")).toBeNull();
});

it("renders web citations separately and isolates Google search suggestions", () => {
  const { container } = render(
    <AssistantMessageText
      text="웹 정보"
      contexts={[]}
      webGrounding={{
        ...grounding,
        searchEntryPointHtml:
          '<script>parent.evil()</script><a href="https://google.com/search?q=test">Google</a>',
      }}
    />,
  );
  expect(screen.getByText("웹 검색 근거")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "근거 1개" }));
  const source = screen.getByRole("link", { name: /공개 논문/ });
  expect(source.getAttribute("href")).toBe("https://example.org/paper");
  expect(source.getAttribute("target")).toBe("_blank");
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
  const frame = screen.getByTitle("Google 검색 추천");
  expect(frame.getAttribute("sandbox")).not.toMatch(
    /allow-scripts|allow-same-origin/,
  );
  expect(frame.getAttribute("srcdoc")).toContain("default-src 'none'");
  expect(container.querySelector("script")).toBeNull();
});

it("does not invent a web citation when Google returned no sources", () => {
  const { container } = render(
    <AssistantMessageText
      text="일반 답변"
      contexts={[]}
      webGrounding={{ sources: [], citations: [], queries: [] }}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain(
    "웹 출처가 반환되지 않았어요",
  );
  expect(container.querySelector("[data-citation-chip]")).toBeNull();
});

const file = {
  id: "file-a",
  kind: "attachments",
  title: "논문.pdf",
} as AIContext;
it("shows each question's attachment snapshot instead of repeating conversation files", () => {
  const messages = [
    { role: "user", text: "첫 질문", createdAt: "1", contexts: [file] },
    { role: "assistant", text: "답", createdAt: "2" },
    { role: "user", text: "두 번째 질문", createdAt: "3", contexts: [] },
  ] as AIConversationMessage[];
  expect(messageFileContexts(messages, 0, [file])).toEqual([file]);
  expect(messageFileContexts(messages, 2, [file])).toEqual([]);
  delete messages[0].contexts;
  delete messages[2].contexts;
  expect(messageFileContexts(messages, 0, [file])).toEqual([file]);
  expect(messageFileContexts(messages, 2, [file])).toEqual([]);
});

it("restores failed attachments without overwriting newer selections", () => {
  const updated = { ...file, title: "수정된 논문.pdf" };
  const other = { ...file, id: "file-b" };
  expect(restorePendingContexts([updated], [file, other])).toEqual([
    updated,
    other,
  ]);
});
