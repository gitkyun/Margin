// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import AIPrompt from "../src/components/kokonut/ai-prompt";
import AIInputSearch from "../src/components/kokonut/ai-input-search";

afterEach(cleanup);

it("일반 입력의 첨부를 제품 상태에 맡기면 독립적인 삭제 칩을 만들지 않는다", () => {
  const onAttach = vi.fn();
  const { container, queryByText } = render(
    <AIPrompt
      models={[]}
      selectedModel=""
      commands={[]}
      headerText=""
      onAttach={onAttach}
      onSubmit={vi.fn()}
    />,
  );
  const file = new File(["연구 메모"], "연구메모.txt", { type: "text/plain" });
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
  expect(onAttach).toHaveBeenCalledTimes(1);
  expect(Array.from(onAttach.mock.calls[0][0])).toEqual([file]);
  // 실제 첨부/해제는 제품의 context 카드 하나가 담당해야 한다.
  expect(queryByText(file.name)).toBeNull();
  expect(container.querySelectorAll('[aria-label="첨부 자료"]')).toHaveLength(
    0,
  );
});

it("검색 입력의 첨부를 제품 상태에 맡기면 실자료와 분리된 삭제 칩을 만들지 않는다", () => {
  const onAttach = vi.fn();
  const { container, queryByText } = render(
    <AIInputSearch
      models={[]}
      selectedModel=""
      tools={[]}
      defaultTool={null}
      onAttach={onAttach}
      onSearch={vi.fn()}
    />,
  );
  const file = new File(["참고 문서"], "참고문서.md", {
    type: "text/markdown",
  });
  fireEvent.change(container.querySelector('input[type="file"]')!, {
    target: { files: [file] },
  });
  expect(onAttach).toHaveBeenCalledTimes(1);
  expect(onAttach).toHaveBeenCalledWith([file]);
  expect(queryByText(file.name)).toBeNull();
  expect(container.querySelectorAll('[aria-label="첨부한 파일"]')).toHaveLength(
    0,
  );
});
