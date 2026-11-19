import { describe, expect, it } from "vitest";
import { runCreditsLabel, runTarget } from "@/lib/assistant-runs";
import type { AICredits } from "@/lib/ai-usage";
import type { AIConversationMessage } from "@/lib/domain";

const message = (
  role: "user" | "assistant",
  runId?: string,
): AIConversationMessage => ({
  role,
  text: role,
  createdAt: "2026-11-18T00:00:00.000Z",
  ...(runId ? { runId } : {}),
});

const conversations = [
  { id: "c1", messages: [message("user"), message("assistant", "run-a")] },
  { id: "c2", messages: [message("user"), message("assistant", "run-b")] },
];

describe("runTarget (06 §2.8)", () => {
  it("그 실행의 답이 남은 대화로 갑니다", () => {
    expect(runTarget("run-b", conversations, [])).toEqual({
      kind: "message",
      conversationId: "c2",
    });
  });

  it("답이 대화에 없고 고르지 않은 제안이 있으면 제안 보기로 갑니다", () => {
    expect(runTarget("run-c", conversations, [{ runId: "run-c" }])).toEqual({
      kind: "suggestions",
    });
  });

  it("대화와 제안이 함께 있으면 대화가 먼저입니다", () => {
    expect(runTarget("run-a", conversations, [{ runId: "run-a" }])).toEqual({
      kind: "message",
      conversationId: "c1",
    });
  });

  it("갈 곳이 없으면 null(누를 수 없음)", () => {
    expect(runTarget("run-z", conversations, [{ runId: "run-c" }])).toBeNull();
    expect(runTarget("", conversations, [])).toBeNull();
  });

  it("사용자 메시지의 runId는 답으로 치지 않습니다", () => {
    expect(
      runTarget(
        "run-u",
        [{ id: "c3", messages: [message("user", "run-u")] }],
        [],
      ),
    ).toBeNull();
  });
});

describe("runCreditsLabel (06 §2.8)", () => {
  const credits = (ledger: AICredits["ledger"]): AICredits => ({
    balance: 0,
    allowance: 20000,
    reserved: 0,
    used: 0,
    resetsAt: "2026-12-01T00:00:00.000Z",
    ledger,
  });
  const entry = (
    runId: string,
    kind: string,
    amount: number,
  ): AICredits["ledger"][number] => ({
    id: `${runId}-${kind}`,
    createdAt: "2026-11-19T00:00:00.000Z",
    amount,
    kind,
    runId,
  });

  it("정산된 사용량(청구에서 환불을 뺀 값)을 보입니다", () => {
    expect(
      runCreditsLabel(
        credits([
          entry("run-a", "charge", -1200),
          entry("run-b", "charge", -5),
        ]),
        "run-a",
      ),
    ).toBe("1,200크레딧");
    expect(
      runCreditsLabel(
        credits([
          entry("run-a", "charge", -300),
          entry("run-a", "refund", 100),
        ]),
        "run-a",
      ),
    ).toBe("200크레딧");
  });

  it("이력에 없거나 크레딧 정보가 없으면 비웁니다(예약은 세지 않음)", () => {
    expect(runCreditsLabel(undefined, "run-a")).toBeUndefined();
    expect(runCreditsLabel(credits([]), "run-a")).toBeUndefined();
    expect(
      runCreditsLabel(credits([entry("run-a", "reserve", -800)]), "run-a"),
    ).toBeUndefined();
  });
});
