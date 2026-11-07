export type Mode = "organize_meeting" | "suggest_revisions" | "ask_research" | "review_writing" | "plan_research" | "read_material";
export interface AIInput {
  mode: Mode;
  model?:string;thinking?:string;clientRunId?:string;contexts?:{kind:string;id:string;title:string;text?:string;revision?:number;page?:number}[];
  researchId: string;
  meetingId?: string;
  feedbackId?: string;
  sourceText: string;
  sourceRevision?: number;
  question?: string;
  history?: { role: "user" | "assistant"; text: string }[];
}
export interface Candidate {
  title: string;
  body?: string;
  category?: "feedback" | "decision" | "question";
  sourceQuote?: string;
  sourceStart?: number;
  sourceEnd?: number;
  method?: string;
  expectedResult?: string;
  assumptions?: string;
  requiredMaterials?: string;
  suggestedTasks?: string[];
}
export class AIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "AIError";
  }
}
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AIError("INVALID_INPUT", "AI 입력 형식을 확인해 주세요.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new AIError(
      "INVALID_OUTPUT",
      "AI 응답 형식을 확인할 수 없습니다. 다시 시도하거나 직접 작성해 주세요.",
      502,
    );
  return value;
}
export function validateInput(value: unknown): AIInput {
  const input = object(value);
  const contexts = Array.isArray(input.contexts)?input.contexts:[];
  if(contexts.length){
   if(contexts.length>8||!uuid.test(String(input.researchId))||!["organize_meeting","suggest_revisions","ask_research","review_writing","plan_research","read_material"].includes(String(input.mode)))throw new AIError("INVALID_INPUT","실행 범위를 확인해 주세요.");
   const selected=contexts.map(v=>{const c=object(v);if(!uuid.test(String(c.id))||!["meetings","feedback","documents","versions","attachments","tasks","phases","milestones"].includes(String(c.kind))||typeof c.title!=="string"||(c.text!==undefined&&(typeof c.text!=="string"||c.text.length>50000))||(c.page!==undefined&&(!Number.isInteger(c.page)||Number(c.page)<1||Number(c.page)>1000)))throw new AIError("INVALID_INPUT","선택한 자료를 확인해 주세요.");return c as unknown as NonNullable<AIInput['contexts']>[number]});
   if(typeof input.question!=='string'||input.question.length>2000||typeof input.sourceText!=='string'||input.sourceText.length>50000||!uuid.test(String(input.clientRunId)))throw new AIError("INVALID_INPUT","질문과 실행 정보를 확인해 주세요.");
   if(input.history!==undefined&&(!Array.isArray(input.history)||input.history.length>10||input.history.some(v=>{const m=object(v);return !['user','assistant'].includes(String(m.role))||typeof m.text!=='string'||m.text.length>10000})))throw new AIError("INVALID_INPUT","대화 범위를 줄여 주세요.");
   if(Array.isArray(input.history)&&input.history.reduce((n,m)=>n+String(object(m).text).length,0)>30000)throw new AIError("INVALID_INPUT","대화 범위를 줄여 주세요.");
   return {...input,contexts:selected} as unknown as AIInput;
  }

  if (
    !["organize_meeting", "suggest_revisions", "ask_research"].includes(
      String(input.mode),
    ) ||
    !uuid.test(String(input.researchId)) ||
    typeof input.sourceText !== "string" ||
    !input.sourceText.trim() ||
    input.sourceText.length > 50000
  )
    throw new AIError(
      "INVALID_INPUT",
      "선택한 원문과 실행 종류를 확인해 주세요.",
    );
  const mode = input.mode as Mode;
  const isMeeting =
    mode === "organize_meeting" ||
    (mode === "ask_research" && !!input.meetingId);
  if (
    isMeeting &&
    (!uuid.test(String(input.meetingId)) ||
      !Number.isInteger(input.sourceRevision) ||
      Number(input.sourceRevision) < 1)
  )
    throw new AIError(
      "INVALID_INPUT",
      "저장한 미팅 메모와 버전을 확인해 주세요.",
    );
  if (!isMeeting && !uuid.test(String(input.feedbackId)))
    throw new AIError("INVALID_INPUT", "사용할 피드백을 선택해 주세요.");
  if (
    mode === "ask_research" &&
    (Boolean(input.meetingId) === Boolean(input.feedbackId) ||
      typeof input.question !== "string" ||
      !input.question.trim() ||
      input.question.length > 2000)
  )
    throw new AIError(
      "INVALID_INPUT",
      "기록 하나와 2000자 이내의 질문을 선택해 주세요.",
    );
  let history: { role: "user" | "assistant"; text: string }[] = [];
  if (mode === "ask_research") {
    if (
      input.history !== undefined &&
      (!Array.isArray(input.history) || input.history.length > 10)
    )
      throw new AIError(
        "INVALID_INPUT",
        "이전 대화가 너무 깁니다. 새 대화를 시작해 주세요.",
      );
    history = ((input.history ?? []) as unknown[]).map((value) => {
      const m = object(value);
      if (
        !["user", "assistant"].includes(String(m.role)) ||
        typeof m.text !== "string" ||
        m.text.length > 10000
      )
        throw new AIError("INVALID_INPUT", "이전 대화 형식을 확인해 주세요.");
      return { role: m.role as "user" | "assistant", text: m.text };
    });
    if (history.reduce((n, m) => n + m.text.length, 0) > 30000)
      throw new AIError(
        "INVALID_INPUT",
        "이전 대화가 너무 깁니다. 새 대화를 시작해 주세요.",
      );
  }
  return {
    mode,
    researchId: String(input.researchId),
    sourceText: input.sourceText,
    ...(isMeeting
      ? {
          meetingId: String(input.meetingId),
          sourceRevision: Number(input.sourceRevision),
        }
      : { feedbackId: String(input.feedbackId) }),
    ...(mode === "ask_research"
      ? { question: String(input.question), history }
      : {}),
  };
}
export function normalizeCandidates(
  value: unknown,
  mode: Mode,
  source: string,
  originalQuote = "",
): Candidate[] {
  const output = object(value);
  if (
    !Array.isArray(output.candidates) ||
    output.candidates.length < 1 ||
    output.candidates.length > 8
  )
    throw new AIError(
      "INVALID_OUTPUT",
      "AI가 사용할 수 있는 후보를 반환하지 않았습니다. 직접 작성하거나 다시 시도해 주세요.",
      502,
    );
  return output.candidates.map((item) => {
    const c = object(item),
      title = text(c.title, 200, true).trim(),
      quote = c.sourceQuote === undefined ? "" : text(c.sourceQuote, 20000),
      position = quote ? source.indexOf(quote) : -1;
    if (
      quote &&
      position < 0 &&
      !(mode === "suggest_revisions" && originalQuote.includes(quote))
    )
      throw new AIError(
        "UNVERIFIED_QUOTE",
        "AI 발췌를 원문에서 찾을 수 없어 후보를 적용하지 않았습니다. 다시 시도하거나 직접 작성해 주세요.",
        502,
      );
    const citation = quote
      ? {
          sourceQuote: quote,
          ...(position >= 0
            ? { sourceStart: position, sourceEnd: position + quote.length }
            : {}),
        }
      : {};
    if (mode === "organize_meeting") {
      if (
        !["feedback", "decision", "question"].includes(String(c.category)) ||
        !quote ||
        position < 0
      )
        throw new AIError(
          "UNVERIFIED_QUOTE",
          "정리 후보의 원문 근거를 확인할 수 없습니다. 직접 작성하거나 다시 시도해 주세요.",
          502,
        );
      return {
        title,
        category: c.category as Candidate["category"],
        body: text(c.body, 10000, true).trim(),
        ...citation,
      };
    }
    if (!Array.isArray(c.suggestedTasks) || c.suggestedTasks.length > 8)
      throw new AIError(
        "INVALID_OUTPUT",
        "AI 수정 방안의 작업 목록을 확인할 수 없습니다.",
        502,
      );
    return {
      title,
      method: text(c.method, 10000, true).trim(),
      expectedResult: text(c.expectedResult, 10000, true).trim(),
      assumptions: text(c.assumptions, 10000),
      requiredMaterials: text(c.requiredMaterials, 10000),
      suggestedTasks: c.suggestedTasks.map((v) => text(v, 500, true).trim()),
      ...citation,
    };
  });
}
export function verifySource(
  input: AIInput,
  stored: Record<string, unknown>,
): void {
  const isMeeting =
    input.mode === "organize_meeting" ||
    (input.mode === "ask_research" && !!input.meetingId);
  const original = isMeeting ? stored.memo : stored.body;
  if (
    typeof original !== "string" ||
    original !== input.sourceText ||
    (isMeeting && stored.memoRevision !== input.sourceRevision)
  )
    throw new AIError(
      "SOURCE_CHANGED",
      "원문이 변경되었습니다. 저장한 내용을 다시 불러온 뒤 AI를 실행해 주세요.",
      409,
    );
}

export function normalizeAnswer(value: unknown): string {
  const output = object(value);
  return text(output.answer, 12000, true).trim();
}
