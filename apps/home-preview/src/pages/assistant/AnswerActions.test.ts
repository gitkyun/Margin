import { describe, expect, it } from "vitest";
import { questionBefore } from "./AnswerActions";

describe("다시 답하기에 쓸 질문", () => {
  const messages = [
    { role: "user", text: "첫 질문" },
    { role: "assistant", text: "첫 답" },
    { role: "user", text: "둘째 질문" },
    { role: "assistant", text: "둘째 답" },
  ];

  it("그 답변 바로 앞의 사용자 질문을 고른다", () => {
    expect(questionBefore(messages, 1)).toBe("첫 질문");
    expect(questionBefore(messages, 3)).toBe("둘째 질문");
  });

  it("앞에 질문이 없으면 다시 답하기를 만들지 않는다", () => {
    expect(questionBefore([{ role: "assistant", text: "답" }], 0)).toBe(
      undefined,
    );
  });
});
