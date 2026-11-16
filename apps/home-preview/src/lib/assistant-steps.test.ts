import { describe, expect, it } from "vitest";
import { assistantSteps, NAMED_SOURCE_LIMIT } from "./assistant-steps";

const base = {
  first: true,
  researchName: "대학원생 협업 연구",
  hasDirection: true,
  contexts: [] as { title: string }[],
};

describe("연구 도우미가 답하기 전에 보여 주는 단계", () => {
  it("첫 질문에서는 연구, 주제·목적, 연구 기록, 답변 정리 순서로 보여 준다", () => {
    expect(assistantSteps(base).map((step) => step.doing)).toEqual([
      "‘대학원생 협업 연구’ 연구 개요 읽는 중",
      "연구 주제와 목적 읽는 중",
      "이 연구의 기록 읽는 중",
      "답변 정리하는 중",
    ]);
  });

  it("연구 목적과 질문을 적지 않았으면 그 단계를 넣지 않는다", () => {
    const steps = assistantSteps({ ...base, hasDirection: false });
    expect(steps.map((step) => step.doing)).not.toContain(
      "연구 주제와 목적 읽는 중",
    );
  });

  it("첫 질문에 붙인 기록은 이름을 보여 주고, 많으면 나머지를 묶는다", () => {
    const contexts = ["가", "나", "다", "라", "마"].map((title) => ({ title }));
    const doing = assistantSteps({ ...base, contexts }).map((s) => s.doing);
    expect(doing).toContain("‘가’ 읽는 중");
    expect(doing).not.toContain("‘라’ 읽는 중");
    expect(doing).toContain(
      `그 밖에 붙인 기록 ${contexts.length - NAMED_SOURCE_LIMIT}건 읽는 중`,
    );
  });

  it("그다음 질문부터는 질문, 붙인 기록, 연구 기록, 답변 정리만 보여 준다", () => {
    const steps = assistantSteps({
      ...base,
      first: false,
      contexts: [{ title: "가" }, { title: "나" }],
    });
    expect(steps.map((step) => step.done)).toEqual([
      "질문 읽기",
      "붙인 기록 2건 확인",
      "연구 기록 확인",
      "답변 정리",
    ]);
  });

  it("기록을 붙이지 않은 질문에도 연구 기록을 읽는 단계가 있다", () => {
    const steps = assistantSteps({ ...base, first: false });
    expect(steps.map((step) => step.done)).toEqual([
      "질문 읽기",
      "연구 기록 확인",
      "답변 정리",
    ]);
  });
});
