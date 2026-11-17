import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeOrganize } from "./validation";

const researchId = "11111111-1111-4111-8111-111111111111",
  runId = "22222222-2222-4222-8222-222222222222",
  meetingId = "44444444-4444-4444-8444-444444444444",
  recordingId = "55555555-5555-4555-8555-555555555555",
  userId = "33333333-3333-4333-8333-333333333333";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("organize_meeting 결과(IA v2 08 §5.2)", () => {
  const sources = [
    {
      kind: "memo" as const,
      id: meetingId,
      text: "비교 기준을 보완해 주세요.",
    },
    {
      kind: "transcript" as const,
      id: recordingId,
      text: "다음 주까지 표를 다시 그려 오세요.",
    },
  ];
  it("요약 하나, 발췌를 찾은 제안만 남기고 뺀 수를 센다", () => {
    const { candidates, droppedQuotes } = normalizeOrganize(
      {
        candidates: [
          { title: "요약", category: "summary", body: "기준과 표를 다뤘어요." },
          { title: "두 번째 요약", category: "summary", body: "버림" },
          {
            title: "기준 보완",
            category: "feedback",
            body: "",
            sourceQuote: "비교 기준",
          },
          {
            title: "표 다시 그리기",
            category: "task",
            body: "표를 다시",
            sourceQuote: "표를 다시 그려 오세요",
          },
          {
            title: "지어낸 지시",
            category: "decision",
            body: "x",
            sourceQuote: "교수가 승인함",
          },
        ],
      },
      sources,
    );
    expect(droppedQuotes).toBe(1);
    expect(candidates.map((c) => c.category)).toEqual([
      "summary",
      "feedback",
      "task",
    ]);
    const task = candidates[2]!;
    expect(task.sourceKind).toBe("transcript");
    expect(task.recordingId).toBe(recordingId);
    expect(sources[1]!.text.slice(task.sourceStart, task.sourceEnd)).toBe(
      "표를 다시 그려 오세요",
    );
    expect(candidates[1]!.sourceKind).toBe("memo");
    expect(candidates[1]!.body).toBe("기준 보완");
  });
  it("아무것도 못 찾으면 알리고, 모두 확인 실패면 실패", () => {
    expect(() => normalizeOrganize({ candidates: [] }, sources)).toThrow(
      /찾지 못했어요/,
    );
    expect(() =>
      normalizeOrganize(
        {
          candidates: [
            { title: "x", category: "feedback", sourceQuote: "없는 말" },
          ],
        },
        sources,
      ),
    ).toThrow(/근거/);
    expect(() =>
      normalizeOrganize(
        { candidates: [{ title: "x", category: "plan", sourceQuote: "표" }] },
        sources,
      ),
    ).toThrow();
  });
});

async function endpoint(options: {
  memo: string;
  transcripts: { recording_id: string; edited_text: string }[];
  output?: unknown;
}) {
  let handler: (request: Request) => Promise<Response>;
  const calls: { url: string; body: any; headers: Headers }[] = [];
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) =>
        (
          ({
            SUPABASE_URL: "https://test.supabase.co",
            SUPABASE_ANON_KEY: "public-key",
            SUPABASE_SERVICE_ROLE_KEY: "server-key",
            GEMINI_API_KEY: "test-google-key",
            GEMINI_PROVIDER: "vertex",
            GEMINI_PROJECT_ID: "project",
          }) as Record<string, string>
        )[key],
    },
    serve: (fn: any) => {
      handler = fn;
    },
  });
  vi.stubGlobal("fetch", async (input: any, init: any = {}) => {
    const url = decodeURIComponent(String(input)),
      body = init.body ? JSON.parse(init.body) : undefined,
      headers = new Headers(init.headers);
    calls.push({ url, body, headers });
    if (url.endsWith("/auth/v1/user"))
      return Response.json({ id: userId, email_confirmed_at: "2026-01-01" });
    if (url.includes("/rpc/"))
      return Response.json(url.endsWith("rms_ai_begin_v2") ? runId : true);
    if (url.includes("/rms_ai_credit_ledger"))
      return Response.json([{ amount: -3 }]);
    if (url.includes("/rms_researches")) return Response.json([{ data: {} }]);
    if (url.includes("/rms_live_transcripts"))
      return Response.json(options.transcripts);
    if (url.includes("kind=eq.recordings"))
      return Response.json([
        { id: recordingId, data: { title: "11월 녹음", meetingId } },
        {
          id: "66666666-6666-4666-8666-666666666666",
          data: { title: "보관한 녹음", meetingId, archivedAt: "x" },
        },
      ]);
    if (url.includes("/rms_records"))
      return Response.json([
        { data: { title: "6차", memo: options.memo, memoRevision: 2 } },
      ]);
    if (url.includes("aiplatform.googleapis.com"))
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify(
                    options.output ?? {
                      candidates: [
                        { title: "요약", category: "summary", body: "요약 글" },
                        {
                          title: "표 다시",
                          category: "task",
                          body: "표",
                          sourceQuote: "표를 다시 그려",
                        },
                        {
                          title: "지어냄",
                          category: "feedback",
                          body: "x",
                          sourceQuote: "없는 말",
                        },
                      ],
                    },
                  ),
                },
              ],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 10,
          totalTokenCount: 20,
        },
      });
    throw new Error("Unexpected route: " + url);
  });
  await import("./index.ts");
  const send = (memo: string) =>
    handler!(
      new Request("https://test.supabase.co/functions/v1/ai-assist", {
        method: "POST",
        headers: {
          Authorization: "Bearer user-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "organize_meeting",
          researchId,
          meetingId,
          sourceText: memo,
          sourceRevision: 2,
          clientRunId: runId,
        }),
      }),
    );
  return { send, calls };
}

describe("[정리하기]에 내 전사문 붙이기(IA v2 08 §5.1)", () => {
  it("요청한 사람 토큰과 user_id로 이 미팅의 보관하지 않은 녹음 전사만 읽는다", async () => {
    const { send, calls } = await endpoint({
      memo: "비교 기준을 보완해 주세요.",
      transcripts: [
        { recording_id: recordingId, edited_text: "표를 다시 그려 오세요." },
      ],
    });
    const response = await send("비교 기준을 보완해 주세요.");
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.droppedQuotes).toBe(1);
    expect(result.candidates.map((c: any) => c.category)).toEqual([
      "summary",
      "task",
    ]);
    expect(result.candidates[1].sourceKind).toBe("transcript");
    const read = calls.find((c) => c.url.includes("/rms_live_transcripts"))!;
    expect(read.headers.get("authorization")).toBe("Bearer user-token");
    expect(read.url).toContain(`user_id=eq.${userId}`);
    expect(read.url).toContain(`recording_id=in.(${recordingId})`);
    expect(read.url).not.toContain("66666666");
    const provider = calls.find((c) =>
      c.url.includes("aiplatform.googleapis.com"),
    )!;
    const sent = JSON.stringify(provider.body);
    expect(sent).toContain("미팅 메모");
    expect(sent).toContain("내 전사문 · 11월 녹음");
    const finish = calls.find((c) => c.url.endsWith("rms_ai_finish_v2"))!;
    // 전사 글자는 실행 기록에 저장하지 않습니다.
    expect(JSON.stringify(finish.body.p_contexts)).not.toContain(
      "표를 다시 그려 오세요",
    );
    expect(finish.body.p_output.droppedQuotes).toBe(1);
  });

  it("메모가 비어도 내 전사문이 있으면 정리하고, 둘 다 없으면 AI를 부르지 않는다", async () => {
    const withTranscript = await endpoint({
      memo: "",
      transcripts: [
        { recording_id: recordingId, edited_text: "표를 다시 그려 오세요." },
      ],
    });
    expect((await withTranscript.send("")).status).toBe(200);
    vi.resetModules();
    const nothing = await endpoint({ memo: "", transcripts: [] });
    const response = await nothing.send("");
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toContain("전사문");
    expect(
      nothing.calls.some((c) => c.url.includes("aiplatform.googleapis.com")),
    ).toBe(false);
  });
});
