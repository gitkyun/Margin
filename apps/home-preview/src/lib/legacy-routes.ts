import { legacySettingsTarget } from "@/components/settings/settings-sections";

// IA v2 예전 주소 이동(01 §3.3) 가운데 0단계에 옮길 수 있는 것만 둡니다.
// 새 화면이 아직 없는 것(results·reviews, `new=` 값 바꾸기,
// planning?tab=schedule → meetings?type=poll, plans·recordings 찾아가기)은 그 단계에서 더합니다.

type Rule = (
  base: string,
  rest: string[],
  params: URLSearchParams,
) => string | null;

function build(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

const RULES: Record<string, Rule> = {
  writing: (base, [id], params) => {
    if (id) return build(`${base}/docs/w/${id}`, params);
    params.set("kind", "writing");
    return build(`${base}/docs`, params);
  },
  materials: (base, [id], params) => {
    if (id) return build(`${base}/docs/m/${id}`, params);
    params.set("kind", "material");
    return build(`${base}/docs`, params);
  },
  // 시간 조율 탭(`tab=schedule`)은 미팅 화면 단계 전까지 연구 흐름에 그대로 둡니다.
  planning: (base, _rest, params) => build(`${base}/flow`, params),
  folders: (base, [id], params) => {
    if (!id) return null;
    params.set("folder", id);
    return build(`${base}/docs`, params);
  },
  questions: (base, [id], params) => {
    if (!id) return null;
    params.set("detail", `question:${id}`);
    return build(base, params);
  },
  // 1단계: 할 일·피드백 한 건은 항목 상세(?detail=)로 엽니다(01 §3.3, 06 §6).
  // `full=1`은 상세에서 아직 못 하는 일(수정 방법 쓰기·AI 제안)을 하러 예전 화면을 여는 통로입니다.
  tasks: (base, [id], params) => {
    if (!id || params.get("full") === "1") return null;
    params.set("detail", `task:${id}`);
    return build(`${base}/tasks`, params);
  },
  // 피드백 목록은 할 일 화면의 피드백 탭(T1)으로, 한 건은 그 위의 항목 상세로 엽니다.
  // 미팅 화면(2단계) 전까지는 기록을 찾아가지 않습니다. `new=1`(피드백 입력 창)은 지금 화면에 둡니다.
  feedback: (base, [id], params) => {
    if (params.get("full") === "1" || params.get("new") === "1") return null;
    params.set("view", "feedback");
    if (id) params.set("detail", `feedback:${id}`);
    return build(`${base}/tasks`, params);
  },
  // 4단계: 연구 도우미 화면은 사이드 창으로 엽니다(01 §3.3). 요청 종류(`mode`)는 넘기지 않고,
  // 예전 제안 탭(`tab=overview`)은 창의 제안 보기로, 글에서 넘어온 것(`document=`)은 그 글 위의 창으로 엽니다.
  assistant: (base, _rest, params) => {
    const document = params.get("document");
    const suggestions = params.get("tab") === "overview";
    for (const key of ["document", "selection", "tab", "mode"])
      params.delete(key);
    params.set("panel", "assistant");
    if (suggestions) params.set("panelView", "suggestions");
    return build(document ? `${base}/docs/w/${document}` : base, params);
  },
  decisions: (base, [id], params) => {
    if (!id) return null;
    params.set("detail", `decision:${id}`);
    return build(base, params);
  },
};

/** 예전 주소면 새 주소(replace로 이동할 곳), 아니면 null */
export function legacyRedirect(
  pathname: string,
  search: string,
): string | null {
  const settings = legacySettingsTarget(pathname, search);
  if (settings) return settings;
  const match = /^\/r\/([^/]+)\/([^/]+)((?:\/[^/]+)*)\/?$/.exec(pathname);
  if (!match) return null;
  const [, researchId, segment, tail] = match;
  const rule = RULES[segment];
  if (!rule) return null;
  const rest = tail.split("/").filter(Boolean);
  return rule(`/r/${researchId}`, rest, new URLSearchParams(search));
}

/** 테스트용: 표의 예전 주소 견본(이동한 곳이 다시 표에 걸리지 않는지 확인) */
export const LEGACY_SAMPLES: readonly [string, string][] = [
  ["/r/a/writing", "?new=1"],
  ["/r/a/writing/d1", ""],
  ["/r/a/materials", "?folder=f"],
  ["/r/a/materials/m1", ""],
  ["/r/a/planning", "?tab=schedule"],
  ["/r/a/folders/f", ""],
  ["/r/a/questions/q", ""],
  ["/r/a/decisions/d", ""],
  ["/r/a/tasks/t", ""],
  ["/r/a/feedback/f", ""],
  ["/r/a/feedback", ""],
  ["/r/a/settings", "?tab=lifecycle"],
  ["/r/a/settings", "?tab=phases"],
  ["/account", ""],
  ["/r/a/assistant", "?tab=overview"],
  ["/r/a/assistant", "?document=d1&selection=1"],
];
