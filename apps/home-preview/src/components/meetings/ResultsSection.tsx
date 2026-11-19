import { t } from "@/lib/i18n";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { Segments } from "@/components/experience";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import { koreanScore } from "@/lib/hangul-search";
import { useOpenDetail } from "@/lib/item-detail";
import type { RevisionResult } from "@/lib/domain";
import {
  parseResultView,
  resultCounts,
  resultRows,
  type ResultView,
} from "@/lib/results-section";

/**
 * 미팅 목록 `type=review` 맨 위의 수정 결과 구획(IA v2 04 §2.4). 예전 수정 결과 목록 화면을 대신합니다.
 * `요청 전 | 요청에 포함 | 보관함`(주소 `results=`)과 목록의 찾기(`q`)로 고르고, 줄을 누르면 항목 상세가 열립니다.
 */
export function ResultsSection({ researchId }: { researchId: string }) {
  const { data, save } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const openDetail = useOpenDetail();
  const [open, setOpen] = useState(true);
  const view = parseResultView(params.get("results"));
  const query = params.get("q") ?? "";
  const base = `/r/${researchId}`;
  const counts = resultCounts(data.results, data.reviewItems, researchId);
  const rows = resultRows(
    data.results,
    data.reviewItems,
    researchId,
    view,
    query,
    (text, q) => koreanScore(text, q) > 0,
  );
  const total = counts.pending + counts.requested;

  function setView(next: ResultView) {
    const rest = new URLSearchParams(params);
    if (next === "pending") rest.delete("results");
    else rest.set("results", next);
    setParams(rest, { replace: true });
  }

  async function restore(result: RevisionResult) {
    try {
      const current =
        data.results.find((item) => item.id === result.id) ?? result;
      await save("results", { ...current, archivedAt: undefined });
      toast.success(t("복원했어요."));
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  return (
    <section className="record-results" aria-labelledby="record-results-head">
      <button
        type="button"
        id="record-results-head"
        className="record-results-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} size={14} />
        {t("수정 결과 {count}개", { count: total })}
      </button>
      {open && (
        <>
          <Segments
            value={view}
            onChange={(value) => setView(value as ResultView)}
            label={t("수정 결과 보기")}
            size="small"
            fill
            // 칸 폭이 같아(220px 열에서 약 70px) 수를 붙이면 '요청에 포함'이 잘립니다. 합계는 구획 머리에 둡니다.
            options={[
              { value: "pending", label: t("요청 전") },
              { value: "requested", label: t("요청에 포함") },
              { value: "archived", label: t("보관함") },
            ]}
          />
          <ul>
            {rows.map((result) => (
              <li key={result.id} className="record-line-row">
                {view === "archived" ? (
                  <span className="record-line">
                    <Icon name="result" size={16} />
                    <span className="record-line-copy">
                      <strong>{result.title}</strong>
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="record-line"
                    onClick={() =>
                      openDetail({ kind: "result", id: result.id })
                    }
                  >
                    <Icon name="result" size={16} />
                    <span className="record-line-copy">
                      <strong>{result.title}</strong>
                      <small>
                        {result.feedbackIds.length
                          ? t("피드백 {count}개", {
                              count: result.feedbackIds.length,
                            })
                          : t("연결한 피드백 없음")}
                      </small>
                    </span>
                  </button>
                )}
                {view === "archived" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void restore(result)}
                  >
                    {t("복원")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!rows.length && (
            <p className="record-list-empty">
              {query
                ? t("조건에 맞는 수정 결과가 없어요.")
                : view === "archived"
                  ? t("보관한 수정 결과가 없어요.")
                  : view === "requested"
                    ? t("검토 요청에 담은 수정 결과가 없어요.")
                    : t("아직 검토 요청 전인 수정 결과가 없어요.")}
            </p>
          )}
          <div className="record-results-actions">
            <Button variant="outline" size="sm" asChild>
              <Link to="?type=review&new=result">
                <Icon name="plus" size={15} />
                {t("수정 결과 작성")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`${base}/reviews?new=1`}>
                <Icon name="send" size={15} />
                {t("검토 요청 만들기")}
              </Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
