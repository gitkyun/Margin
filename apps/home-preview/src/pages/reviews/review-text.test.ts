import { describe, expect, it } from "vitest";
import { firstLine, splitPageReferences } from "./review-text";
import {
  clampResponseWidth,
  keyResponseWidth,
  RESPONSE_MAX_WIDTH,
  RESPONSE_MIN_WIDTH,
} from "./column-width";

const pages = (body: string) =>
  splitPageReferences(body)
    .filter((segment) => segment.kind === "page")
    .map((segment) => (segment.kind === "page" ? segment.page : 0));

describe("댓글 속 페이지 표기", () => {
  it("p.4 · p. 4 · 4쪽 · 4페이지를 모두 찾는다", () => {
    expect(pages("p.4 표와 p. 12 그림, 3쪽 문단, 7 페이지 각주")).toEqual([
      4, 12, 3, 7,
    ]);
  });

  it("조각을 이어 붙이면 원문 그대로다", () => {
    const body = "표 2(p.4)는 5쪽과 비교해 주세요.";
    expect(
      splitPageReferences(body)
        .map((segment) => segment.text)
        .join(""),
    ).toBe(body);
  });

  it("단어 속 점·숫자에 붙은 표기와 0·너무 큰 수는 고르지 않는다", () => {
    expect(pages("step.4와 app.12 버전")).toEqual([]);
    expect(pages("0쪽, p.0, 2026페이지 아님 99999쪽")).toEqual([2026]);
  });

  it("페이지 표기가 없으면 글 조각 하나", () => {
    expect(splitPageReferences("좋아요")).toEqual([
      { kind: "text", text: "좋아요" },
    ]);
  });
});

describe("접힌 해결 댓글의 첫 줄", () => {
  it("빈 줄을 건너뛰고 길면 줄인다", () => {
    expect(firstLine("\n  \n표 제목을 고쳤어요\n둘째 줄")).toBe(
      "표 제목을 고쳤어요",
    );
    expect(firstLine("가".repeat(50), 10)).toBe(`${"가".repeat(9)}…`);
    expect(firstLine("   ")).toBe("");
  });
});

describe("응답 열 너비", () => {
  it("범위 안으로 자르고 정수로 맞춘다", () => {
    expect(clampResponseWidth(10)).toBe(RESPONSE_MIN_WIDTH);
    expect(clampResponseWidth(9999)).toBe(RESPONSE_MAX_WIDTH);
    expect(clampResponseWidth(333.6)).toBe(334);
  });

  it("←는 응답 열을 넓히고 →는 PDF 열을 넓히며 Home은 기본값", () => {
    expect(keyResponseWidth(340, "ArrowLeft")).toBe(364);
    expect(keyResponseWidth(340, "ArrowRight")).toBe(316);
    expect(keyResponseWidth(340, "Home")).toBeNull();
    expect(keyResponseWidth(340, "Enter")).toBeUndefined();
  });
});
