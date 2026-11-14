import { t } from "@/lib/i18n";

/** 답을 기다리는 동안 보여 줄 단계 하나. `doing`은 진행 중, `done`은 답 아래 '거친 단계'에 씁니다. */
export interface AssistantStep {
  doing: string;
  done: string;
}

export interface AssistantStepInput {
  /** 이 대화의 첫 질문인지. 첫 질문에서는 연구를 읽는 단계를 하나씩 보여 줍니다. */
  first: boolean;
  researchName: string;
  /** 연구 목적이나 연구 질문을 적어 두었는지. 적지 않았으면 그 단계를 넣지 않습니다. */
  hasDirection: boolean;
  /** 이번 요청에 붙인 기록 */
  contexts: { title: string }[];
}

/** 첫 대화에서 이름을 하나씩 보여 줄 기록 수. 넘는 것은 한 줄로 묶습니다. */
export const NAMED_SOURCE_LIMIT = 3;

/**
 * 이번 요청에 실제로 함께 보내는 것만 단계로 만듭니다.
 * AI가 속으로 생각한 과정이 아니라, 무엇을 읽고 답했는지 알려 주는 목록입니다.
 */
export function assistantSteps({
  first,
  researchName,
  hasDirection,
  contexts,
}: AssistantStepInput): AssistantStep[] {
  const answer: AssistantStep = {
    doing: t("답변 정리하는 중"),
    done: t("답변 정리"),
  };
  if (!first) {
    return [
      { doing: t("질문 읽는 중"), done: t("질문 읽기") },
      ...(contexts.length
        ? [
            {
              doing: t("고른 기록 {count}건 확인하는 중", {
                count: contexts.length,
              }),
              done: t("기록 {count}건 확인", { count: contexts.length }),
            },
          ]
        : []),
      answer,
    ];
  }
  const named = contexts.slice(0, NAMED_SOURCE_LIMIT);
  const rest = contexts.length - named.length;
  return [
    {
      doing: t("‘{name}’ 연구 개요 읽는 중", { name: researchName }),
      done: t("연구 개요 확인"),
    },
    ...(hasDirection
      ? [
          {
            doing: t("연구 주제와 목적 읽는 중"),
            done: t("연구 주제·목적 확인"),
          },
        ]
      : []),
    ...named.map((context) => ({
      doing: t("‘{title}’ 읽는 중", { title: context.title }),
      done: t("‘{title}’ 확인", { title: context.title }),
    })),
    ...(rest > 0
      ? [
          {
            doing: t("그 밖의 기록 {count}건 읽는 중", { count: rest }),
            done: t("그 밖의 기록 {count}건 확인", { count: rest }),
          },
        ]
      : []),
    answer,
  ];
}
