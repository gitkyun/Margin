import { allowedOrigins } from "./origins.ts";
import { availableModels } from "./models.ts";
import {
  generate,
  reserveCredits,
  usageCredits,
  type TokenUsage,
} from "./providers.ts";
import {
  buildSystemPrompt,
  buildUserPayload,
  readDepth,
  readLocale,
  readPersonalGuide,
  researchBackground,
} from "./prompts.ts";
import {
  normalizeRoadmap,
  RoadmapError,
  ROADMAP_MODE,
  roadmapSchema,
  validateRoadmapPlan,
  type RoadmapPlan,
} from "./roadmap.ts";
import {
  AIError,
  type AIInput,
  normalizeCandidates,
  normalizeAnswer,
  validateInput,
  verifySource,
} from "./validation.ts";

const url = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
const defaultModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
const models = availableModels(defaultModel);
// 연결 경로를 명시한 설정을 우선합니다. 접두사 판별은 기존 설정과의 호환용입니다.
const provider =
  Deno.env.get("GEMINI_PROVIDER") ??
  (apiKey.startsWith("AIza") ? "studio" : "vertex");
const projectId = Deno.env.get("GEMINI_PROJECT_ID") ?? "";

const origins = allowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));
const chatSchema = {
  type: "OBJECT",
  properties: { answer: { type: "STRING" } },
  required: ["answer"],
};
const organizeSchema = {
  type: "OBJECT",
  properties: {
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          body: { type: "STRING" },
          category: {
            type: "STRING",
            enum: ["feedback", "decision", "question"],
          },
          sourceQuote: { type: "STRING" },
        },
        required: ["title", "body", "category", "sourceQuote"],
      },
    },
  },
  required: ["candidates"],
};
const revisionSchema = {
  type: "OBJECT",
  properties: {
    candidates: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          method: { type: "STRING" },
          expectedResult: { type: "STRING" },
          assumptions: { type: "STRING" },
          requiredMaterials: { type: "STRING" },
          suggestedTasks: { type: "ARRAY", items: { type: "STRING" } },
          sourceQuote: { type: "STRING" },
        },
        required: [
          "title",
          "method",
          "expectedResult",
          "assumptions",
          "requiredMaterials",
          "suggestedTasks",
          "sourceQuote",
        ],
      },
    },
  },
  required: ["candidates"],
};

async function rest(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (body?.code === "P0001" && String(body.message).includes("크레딧"))
      throw new AIError(
        "CREDITS_EXHAUSTED",
        "남은 AI 크레딧이 부족합니다. 입력을 줄이거나 다음 지급일을 확인해 주세요.",
        402,
      );
    if (body?.code === "P0001")
      throw new AIError(
        "RATE_LIMITED",
        "AI 사용 한도에 도달했습니다. 잠시 뒤 다시 시도해 주세요.",
        429,
      );
    if (body?.code === "55000")
      throw new AIError(
        "ALREADY_RUNNING",
        "같은 원문의 AI 처리가 진행 중입니다.",
        409,
      );
    if (body?.code === "57014")
      throw new AIError("CANCELLED", "중단한 요청입니다.", 499);
    if (body?.code === "42501")
      throw new AIError("FORBIDDEN", "이 기록의 AI를 실행할 수 없습니다.", 403);
    throw new AIError(
      "SERVER_ERROR",
      "AI 실행을 준비하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
      500,
    );
  }
  return body;
}
async function rpc(name: string, input: Record<string, unknown>) {
  return await rest(`rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
  if (origin && origins.includes(origin))
    headers["Access-Control-Allow-Origin"] = origin;
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.includes(origin))
    return reply(
      {
        error: {
          code: "ORIGIN_NOT_ALLOWED",
          message: "허용되지 않은 접속 주소입니다.",
        },
      },
      403,
    );
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (!["POST", "GET"].includes(request.method))
    return reply(
      {
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "지원하지 않는 요청입니다.",
        },
      },
      405,
    );
  let runId: string | undefined;
  let reserved = false,
    settled = false,
    providerRejected = false;
  let measuredUsage: TokenUsage | undefined;
  let chargedCredits = 0;
  try {
    if (
      !url ||
      !publishableKey ||
      !serviceKey ||
      !/^gemini-[a-z0-9.-]+$/.test(defaultModel)
    )
      throw new AIError(
        "NOT_CONFIGURED",
        "연구 도우미에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요. 직접 작성한 내용은 유지됩니다.",
        503,
      );
    const token = request.headers.get("authorization");
    if (!token?.startsWith("Bearer "))
      throw new AIError(
        "UNAUTHENTICATED",
        "로그인한 뒤 AI를 실행해 주세요.",
        401,
      );
    const auth = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: token },
    });
    if (!auth.ok)
      throw new AIError(
        "UNAUTHENTICATED",
        "로그인 시간이 만료되었습니다. 다시 로그인해 주세요.",
        401,
      );
    const user = await auth.json();
    if (!user.id || !user.email_confirmed_at)
      throw new AIError(
        "UNAUTHENTICATED",
        "확인된 계정으로 로그인해 주세요.",
        401,
      );
    // 답변 깊이는 세 단계이고, 맨 앞(high)이 기본값입니다.
    if (request.method === "GET")
      return reply({ models: apiKey ? models : [] });
    if (Number(request.headers.get("content-length") ?? 0) > 262144)
      throw new AIError(
        "INPUT_TOO_LARGE",
        "원문이 너무 깁니다. 범위를 줄여 주세요.",
        413,
      );
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 262144)
      throw new AIError(
        "INPUT_TOO_LARGE",
        "원문이 너무 깁니다. 범위를 줄여 주세요.",
        413,
      );
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AIError("INVALID_INPUT", "AI 입력 형식을 확인해 주세요.");
    }
    // 투고일 기준 로드맵 제안은 기록을 고르지 않고 연구 배경과 단계 목록만 씁니다.
    const body0 =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    const isRoadmap = body0.mode === ROADMAP_MODE;
    let plan: RoadmapPlan | undefined;
    if (isRoadmap) {
      const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (
        !uuid.test(String(body0.researchId)) ||
        !uuid.test(String(body0.clientRunId)) ||
        (body0.model !== undefined && typeof body0.model !== "string") ||
        (body0.thinking !== undefined && typeof body0.thinking !== "string")
      )
        throw new AIError("INVALID_INPUT", "실행 범위를 확인해 주세요.");
      plan = validateRoadmapPlan(
        body0.plan,
        new Date().toISOString().slice(0, 10),
      );
    }
    const input: AIInput = isRoadmap
      ? {
          mode: ROADMAP_MODE,
          researchId: String(body0.researchId),
          clientRunId: String(body0.clientRunId),
          model: body0.model as string | undefined,
          thinking: body0.thinking as string | undefined,
          sourceText: "",
        }
      : validateInput(parsed);
    const locale = readLocale(body0.locale);
    const model = input.model ?? "gemini-3.8-flash";
    const selectedModel = models.find((item) => item.id === model);
    if (!selectedModel)
      throw new AIError("MODEL_UNAVAILABLE", "허용된 모델을 선택해 주세요.");
    if (selectedModel.disabled)
      throw new AIError(
        "MODEL_UNAVAILABLE",
        selectedModel.availability ?? "이 모델은 아직 연결되지 않았습니다.",
        503,
      );
    if (input.thinking && !selectedModel.thinking.includes(input.thinking))
      throw new AIError(
        "INVALID_INPUT",
        "이 모델에서 지원하는 생각 수준을 선택해 주세요.",
      );
    if (
      !(await rpc("rms_member_access", {
        p_id: input.researchId,
        p_user: user.id,
      }))
    )
      throw new AIError("FORBIDDEN", "이 연구에 접근할 수 없습니다.", 403);
    let source: Record<string, unknown> = {};
    const isMeeting =
      input.mode === "organize_meeting" ||
      (input.mode === "ask_research" && !!input.meetingId);
    const kind = isMeeting ? "meetings" : "feedback",
      id = isMeeting ? input.meetingId : input.feedbackId;
    let contexts = input.contexts ?? [];
    const freeChat =
      !contexts.length &&
      input.mode === "ask_research" &&
      !input.meetingId &&
      !input.feedbackId;
    if (isRoadmap) {
      contexts = [];
    } else if (contexts.length) {
      const verified = [];
      for (const c of contexts) {
        if (!(await rpc("rms_record_access", { p_id: c.id, p_user: user.id })))
          throw new AIError(
            "FORBIDDEN",
            "선택한 자료를 읽을 수 없습니다.",
            403,
          );
        const rows = (await rest(
          `rms_records?${new URLSearchParams({ id: `eq.${c.id}`, research_id: `eq.${input.researchId}`, kind: `eq.${c.kind}`, select: "data" })}`,
        )) as { data: Record<string, unknown> }[];
        if (rows.length !== 1)
          throw new AIError("FORBIDDEN", "선택 자료를 확인해 주세요.", 403);
        const stored = rows[0].data;
        const original = String(
          c.kind === "meetings"
            ? stored.memo
            : c.kind === "feedback"
              ? stored.body
              : c.kind === "documents" || c.kind === "attachments"
                ? stored.text
                : c.kind === "tasks"
                  ? stored.title + "\n" + (stored.description ?? "")
                  : c.kind === "versions"
                    ? (c.text ?? "")
                    : JSON.stringify(stored),
        );
        if (
          (c.kind === "meetings" && c.revision !== stored.memoRevision) ||
          (c.kind === "documents" && c.revision !== stored.revision)
        )
          throw new AIError(
            "SOURCE_CHANGED",
            "자료가 변경되었습니다. 최신 내용을 다시 선택해 주세요.",
            409,
          );
        if (c.text && !original.includes(c.text))
          throw new AIError(
            "SOURCE_CHANGED",
            "선택한 문단이 바뀌었습니다. 다시 선택해 주세요.",
            409,
          );
        if (c.kind === "versions" && (!c.page || !c.text?.trim()))
          throw new AIError(
            "INVALID_INPUT",
            "PDF 페이지와 읽을 텍스트를 선택해 주세요.",
          );
        verified.push({ ...c, text: c.text ?? original });
      }
      contexts = verified;
      input.sourceText = verified
        .map(
          (c) =>
            `[근거 ${verified.indexOf(c) + 1}] ${c.title}${c.page ? " · " + c.page + "쪽" : ""}\n${c.text}`,
        )
        .join("\n\n");
      if (input.sourceText.length > 50000)
        throw new AIError("INPUT_TOO_LARGE", "선택한 범위를 줄여 주세요.", 413);
      if (
        input.mode === "organize_meeting" &&
        (contexts.length !== 1 || contexts[0].kind !== "meetings")
      )
        throw new AIError("INVALID_INPUT", "미팅 메모 하나를 선택해 주세요.");
      if (
        input.mode === "suggest_revisions" &&
        !contexts.some((c) => c.kind === "feedback")
      )
        throw new AIError("INVALID_INPUT", "수정할 피드백을 선택해 주세요.");
    } else if (freeChat) {
      // 첨부한 기록이 없는 연구 대화. 읽을 원문이 없으므로 질문과 대화 내용만 보냅니다.
      contexts = [];
      input.sourceText = "";
    } else {
      const rows = (await rest(
        `rms_records?${new URLSearchParams({ id: `eq.${id}`, research_id: `eq.${input.researchId}`, kind: `eq.${kind}`, select: "data" })}`,
      )) as { data: Record<string, unknown> }[];
      if (
        rows.length !== 1 ||
        !(await rpc("rms_record_access", { p_id: id, p_user: user.id }))
      )
        throw new AIError("FORBIDDEN", "원문을 읽을 수 없습니다.", 403);
      source = rows[0].data;
      verifySource(input, source);
      contexts = [
        {
          id: id!,
          kind,
          title: String(source.title),
          revision: input.sourceRevision,
          text: input.sourceText,
        },
      ];
    }
    if (!apiKey)
      throw new AIError(
        "NOT_CONFIGURED",
        "연구 도우미에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요. 직접 작성한 내용은 유지됩니다.",
        503,
      );
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        JSON.stringify([
          input.mode,
          model,
          input.thinking,
          id,
          input.sourceRevision,
          input.sourceText,
          input.question,
          input.history,
          plan,
        ]),
      ),
    );
    const hash = [...new Uint8Array(digest)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    runId = (await rpc("rms_ai_begin_v2", {
      p_user_id: user.id,
      p_research_id: input.researchId,
      p_input_hash: hash,
      p_id: input.clientRunId ?? crypto.randomUUID(),
      p_mode: input.mode,
      p_model: model,
      p_thinking: input.thinking ?? null,
    })) as string;
    const originalQuote =
      typeof source.sourceQuote === "string" ? source.sourceQuote : "";
    // 연구 설정의 이름·목적·연구 질문을 배경으로 보냅니다(선택한 원문과 구분). 접근 권한은 위에서 확인했습니다.
    const researchRows = (await rest(
      `rms_researches?${new URLSearchParams({ id: `eq.${input.researchId}`, select: "data" })}`,
    )) as { data: Record<string, unknown> }[];
    const background = researchBackground(researchRows[0]?.data);
    const systemPrompt = buildSystemPrompt({
      mode: input.mode,
      locale,
      depth: readDepth(input.thinking),
      freeChat,
      background,
      // 개인 지침은 화면이 보낸 값이 아니라 요청한 사람의 계정 메타데이터에서 읽어요.
      personal: readPersonalGuide(user.user_metadata?.preferences),
    });
    const schema = plan
      ? roadmapSchema
      : ["ask_research", "continue_writing", "inline_edit"].includes(input.mode)
        ? chatSchema
        : input.mode === "organize_meeting"
          ? organizeSchema
          : revisionSchema;
    const maxOutput =
      input.mode === "continue_writing" || input.mode === "inline_edit"
        ? 2048
        : 8192;
    const prompt = buildUserPayload({
      mode: input.mode,
      sourceText: input.sourceText,
      question: input.question,
      history: input.history,
      originalQuote,
      background,
      plan,
    });
    const held = await rpc("rms_ai_reserve_credits", {
      p_run_id: runId,
      p_user_id: user.id,
      p_amount: reserveCredits(
        selectedModel,
        systemPrompt,
        prompt,
        schema,
        maxOutput,
      ),
    });
    if (held !== true)
      throw new AIError("CANCELLED", "중단한 요청입니다.", 499);
    reserved = true;
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 90000),
      abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    let upstream: Response;
    let candidateText = "";
    try {
      const result = await generate({
        model: selectedModel,
        system: systemPrompt,
        prompt,
        schema,
        thinking: input.thinking,
        maxOutput,
        signal: controller.signal,
        apiKey,
        projectId,
        provider,
      });
      upstream = result.response;
      candidateText = result.text;
      measuredUsage = result.usage;
      providerRejected = !upstream.ok;
    } catch (error) {
      if (controller.signal.aborted)
        throw new AIError(
          request.signal.aborted ? "CANCELLED" : "TIMEOUT",
          request.signal.aborted
            ? "AI 실행을 중단했습니다."
            : "AI 응답이 늦어 중단했습니다. 입력을 유지한 채 다시 시도하거나 직접 작성해 주세요.",
          request.signal.aborted ? 499 : 504,
        );
      throw error;
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener("abort", abort);
    }
    if (!upstream.ok)
      console.error("rms_ai_provider_error", upstream.status, model);
    if (upstream.status === 429)
      throw new AIError(
        "RATE_LIMITED",
        "AI 사용 한도에 도달했습니다. 잠시 뒤 다시 시도하거나 직접 작성해 주세요.",
        429,
      );
    if (upstream.status === 404)
      throw new AIError(
        "MODEL_UNAVAILABLE",
        "현재 설정한 AI 모델을 사용할 수 없습니다. 연결 설정을 확인해 주세요.",
        503,
      );
    if (!upstream.ok)
      throw new AIError(
        "PROVIDER_ERROR",
        "AI 응답을 받지 못했습니다. 입력은 유지됩니다. 다시 시도하거나 직접 작성해 주세요.",
        502,
      );
    // 제공사가 실제로 처리한 요청은 출력이 비어 있거나 형식이 틀려도 비용이 생깁니다.
    // 그래서 출력을 읽기 전에 확인된 사용량으로 먼저 정산합니다.
    // 정산 호출이 실패하면 예약을 그대로 두고(공짜 처리하지 않음) 응답은 계속 돌려줍니다.
    if (measuredUsage?.known) {
      try {
        const amount = usageCredits(selectedModel, measuredUsage);
        const closed = await rpc("rms_ai_settle_credits", {
          p_run_id: runId,
          p_amount: amount,
          p_usage: measuredUsage,
          p_refund: false,
        });
        settled = true;
        if (closed === true) chargedCredits = amount;
      } catch {
        // 운영자가 청구 내역과 대조해 확정할 수 있게 실행 번호와 확인된 사용량만 남깁니다(입력 내용은 남기지 않음).
        console.error(
          "rms_ai_settle_failed",
          JSON.stringify({ runId, usage: measuredUsage }),
        );
      }
    }
    if (!candidateText)
      throw new AIError(
        "NO_CANDIDATES",
        "AI가 후보를 반환하지 않았습니다. 직접 작성하거나 입력을 확인해 다시 시도해 주세요.",
        502,
      );
    let candidateData: unknown;
    try {
      candidateData = JSON.parse(candidateText);
    } catch {
      throw new AIError(
        "INVALID_OUTPUT",
        "AI 응답 형식을 확인할 수 없습니다. 입력은 유지됩니다.",
        502,
      );
    }
    const roadmap = plan ? normalizeRoadmap(candidateData, plan) : undefined;
    const candidates =
      ["ask_research", "continue_writing", "inline_edit"].includes(
        input.mode,
      ) || plan
        ? []
        : normalizeCandidates(
            candidateData,
            input.mode,
            input.sourceText,
            originalQuote,
          );
    const output = {
      candidates,
      ...(["ask_research", "continue_writing", "inline_edit"].includes(
        input.mode,
      )
        ? { answer: normalizeAnswer(candidateData) }
        : {}),
      ...(roadmap ? { roadmap } : {}),
    };
    const accepted = await rpc("rms_ai_finish_v2", {
      p_run_id: runId,
      p_status: "complete",
      p_output: output,
      p_contexts: contexts,
    });
    if (!accepted)
      throw new AIError("CANCELLED", "중단한 결과는 적용하지 않았습니다.", 499);
    return reply({
      runId,
      candidates,
      creditsUsed: chargedCredits > 0 ? chargedCredits : undefined,
      creditStatus: settled ? "settled" : "pending",
      ...(["ask_research", "continue_writing", "inline_edit"].includes(
        input.mode,
      )
        ? { answer: normalizeAnswer(candidateData) }
        : {}),
      ...(roadmap ? { roadmap } : {}),
      model,
      sourceRevision: input.sourceRevision,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // 제공사가 요청을 거절한 것이 확실할 때만 환불합니다. 사용량을 받았다면 위에서 이미 정산했고,
    // 사용량을 모르는 경우(시간 초과·연결 끊김·사용량 누락)는 0으로 지어내지 않고 예약을 남겨 운영이 확인합니다.
    if (runId && reserved && !settled && providerRejected)
      await rpc("rms_ai_settle_credits", {
        p_run_id: runId,
        p_amount: 0,
        p_usage: {},
        p_refund: true,
      }).catch(() => undefined);
    if (runId)
      await rpc("rms_ai_finish_v2", {
        p_run_id: runId,
        p_status:
          error instanceof AIError && error.code === "CANCELLED"
            ? "cancelled"
            : "failed",
        p_error:
          error instanceof AIError
            ? error.message
            : "AI 응답을 받지 못했습니다.",
      }).catch(() => undefined);
    if (error instanceof RoadmapError)
      return reply(
        { error: { code: error.code, message: error.message } },
        error.code === "INVALID_INPUT" ? 400 : 502,
      );
    if (error instanceof AIError)
      return reply(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    // Never log prompts, bearer tokens, API keys, or raw provider error bodies.
    console.error("rms_ai_unexpected_error");
    return reply(
      {
        error: {
          code: "SERVER_ERROR",
          message: "AI 실행 중 문제가 발생했습니다. 작성한 내용은 유지됩니다.",
        },
      },
      500,
    );
  }
});
