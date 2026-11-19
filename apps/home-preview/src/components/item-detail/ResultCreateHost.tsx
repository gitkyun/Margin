import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/lib/workspace";
import { useOpenDetail } from "@/lib/item-detail";
import type { RevisionResult } from "@/lib/domain";
import { ResultEditorDialog } from "@/pages/student/ResultEditorDialog";
import { newResultDraft } from "@/pages/student/result-draft";

/** 수정 결과 작성 창을 여는 주소 값(01 §3.3의 `new=result`)과 함께 지울 값 */
const NEW_RESULT_KEYS = ["new", "feedback", "task", "version"] as const;

/** `?new=result&feedback=&task=&version=` → 미리 채울 것. 아니면 null */
export function newResultRequest(
  search: string,
): { feedback?: string; task?: string; version?: string } | null {
  const params = new URLSearchParams(search);
  if (params.get("new") !== "result") return null;
  const pick = (key: string) => params.get(key) || undefined;
  return {
    feedback: pick("feedback"),
    task: pick("task"),
    version: pick("version"),
  };
}

/** 창을 연 뒤 주소에서 `new=result`와 미리 채운 값을 지운 검색어 */
export function withoutNewResult(search: string): string {
  const params = new URLSearchParams(search);
  for (const key of NEW_RESULT_KEYS) params.delete(key);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * 어느 화면에서든 수정 결과 작성 창을 그 자리에서 엽니다(⌘K '수정 결과 작성', 글 화면의 PDF 등록 뒤 등).
 * 예전 수정 결과 화면으로 가지 않고, 저장하면 지금 화면 위에 그 수정 결과의 항목 상세를 엽니다(06 §6.6).
 */
export function ResultCreateHost({ researchId }: { researchId: string }) {
  const { data } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const openDetail = useOpenDetail();
  const [draft, setDraft] = useState<RevisionResult | null>(null);
  useEffect(() => {
    const request = newResultRequest(location.search);
    if (!request) return;
    const mine = <T extends { id: string; researchId: string }>(
      items: T[],
      id?: string,
    ) => items.find((item) => item.id === id && item.researchId === researchId);
    setDraft(
      newResultDraft(researchId, {
        feedback: mine(data.feedback, request.feedback),
        task: mine(data.tasks, request.task),
        versionId: mine(data.versions, request.version)?.id,
      }),
    );
    navigate(
      {
        pathname: location.pathname,
        search: withoutNewResult(location.search),
        hash: location.hash,
      },
      { replace: true, state: location.state },
    );
  }, [location.search, researchId]);
  return (
    <ResultEditorDialog
      researchId={researchId}
      draft={draft}
      setDraft={setDraft}
      onSaved={(result) => openDetail({ kind: "result", id: result.id })}
    />
  );
}
