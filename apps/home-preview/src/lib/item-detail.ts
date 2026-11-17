import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/** 항목 상세(P5)의 다섯 종류(IA v2 01 §2, 06 §6). */
export const DETAIL_KINDS = [
  "task",
  "feedback",
  "decision",
  "question",
  "result",
] as const;
export type DetailKind = (typeof DETAIL_KINDS)[number];

export interface DetailRef {
  kind: DetailKind;
  id: string;
}

/** 앱 안에서 상세를 열 때 history.state에 남기는 값(02 §4.3 '깊이'). */
export interface DetailHistoryState {
  layer: "detail";
  depth: number;
  /**
   * 이어 열기를 시작한 상세가 주소로 들어온 것(앱 안에서 연 것이 아님)이면 true.
   * 그때는 뒤로 가도 상세가 남으므로, 닫을 때 주소에서 detail을 지웁니다.
   */
  fromAddress?: boolean;
}

/** `?detail=<종류>:<id>` 값을 읽습니다. 틀린 값이면 null(조용히 무시, 01 §2). */
export function parseDetail(
  value: string | null | undefined,
): DetailRef | null {
  if (!value) return null;
  const at = value.indexOf(":");
  if (at < 1) return null;
  const kind = value.slice(0, at);
  const id = value.slice(at + 1);
  if (!(DETAIL_KINDS as readonly string[]).includes(kind) || !id) return null;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  return { kind: kind as DetailKind, id };
}

export function detailValue(ref: DetailRef): string {
  return `${ref.kind}:${ref.id}`;
}

/** 지금 주소의 검색어에 상세를 넣거나(ref) 뺀(null) 검색어. 다른 값은 그대로 둡니다. */
export function withDetail(search: string, ref: DetailRef | null): string {
  const params = new URLSearchParams(search);
  if (ref) params.set("detail", detailValue(ref));
  else params.delete("detail");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** 앱 안에서 연 상세의 깊이. 주소로 바로 들어왔으면 0. */
export function detailDepth(state: unknown): number {
  if (
    state &&
    typeof state === "object" &&
    (state as Partial<DetailHistoryState>).layer === "detail"
  ) {
    const depth = (state as DetailHistoryState).depth;
    return Number.isInteger(depth) && depth > 0 ? depth : 0;
  }
  return 0;
}

/** 지금 주소의 상세. */
export function useDetailRef(): DetailRef | null {
  const location = useLocation();
  return parseDetail(new URLSearchParams(location.search).get("detail"));
}

/**
 * 항목 상세를 엽니다. 앱 안에서 누른 것이므로 주소를 쌓고(push) 깊이를 하나 올립니다.
 * 찾기 창·단축키처럼 바꿔 끼울 때는 `{ replace: true }`.
 */
export function useOpenDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  return useCallback(
    (ref: DetailRef, options: { replace?: boolean } = {}) => {
      if (options.replace) {
        navigate(
          {
            pathname: location.pathname,
            search: withDetail(location.search, ref),
          },
          { replace: true },
        );
        return;
      }
      const depth = detailDepth(location.state);
      const state: DetailHistoryState = {
        layer: "detail",
        depth: depth + 1,
        fromAddress:
          depth === 0
            ? new URLSearchParams(location.search).has("detail")
            : !!(location.state as DetailHistoryState).fromAddress,
      };
      navigate(
        {
          pathname: location.pathname,
          search: withDetail(location.search, ref),
        },
        { state },
      );
    },
    [location.pathname, location.search, location.state, navigate],
  );
}

/**
 * 상세를 한 번에 닫습니다(02 §4.3). 앱 안에서 n번 이어 열었으면 n단계 뒤로,
 * 주소로 들어왔으면 주소에서 `detail`만 지웁니다.
 */
export function useCloseDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  return useCallback(() => {
    const depth = detailDepth(location.state);
    const fromAddress = !!(location.state as DetailHistoryState | null)
      ?.fromAddress;
    if (depth > 0 && !fromAddress) navigate(-depth);
    else
      navigate(
        {
          pathname: location.pathname,
          search: withDetail(location.search, null),
        },
        { replace: true },
      );
  }, [location.pathname, location.search, location.state, navigate]);
}
