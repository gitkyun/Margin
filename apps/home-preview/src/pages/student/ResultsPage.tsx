import { WorkTabs } from "./shared";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import type { RevisionResult } from "@/lib/domain";
import { BackLink, SearchInput } from "./shared";
import { ResultEditorDialog } from "./ResultEditorDialog";
import { newResultDraft } from "./result-draft";

export function ResultsPage() {
  const { researchId = "", resultId } = useParams();
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<RevisionResult | null>(null);
  const current = data.results.find(
    (result) => result.id === resultId && result.researchId === researchId,
  );
  const version = data.versions.find((item) => item.id === current?.versionId);
  const linkedItems = data.reviewItems.filter(
    (item) => item.resultId === resultId,
  );
  const linkedRequests = data.reviews.filter((request) =>
    linkedItems.some((item) => item.requestId === request.id),
  );
  const ready =
    current &&
    (current.kind === "other" ||
      (!!current.versionId && !!current.location.trim()));
  function startCreate() {
    setDraft(
      newResultDraft(researchId, {
        feedback: data.feedback.find(
          (item) =>
            item.id === params.get("feedback") &&
            item.researchId === researchId,
        ),
        task: data.tasks.find(
          (item) =>
            item.id === params.get("task") && item.researchId === researchId,
        ),
        versionId: data.versions.find(
          (v) => v.id === params.get("version") && v.researchId === researchId,
        )?.id,
      }),
    );
  }
  useEffect(() => {
    if (params.get("new") === "1" && !resultId) {
      startCreate();
      setParams({}, { replace: true });
    }
  }, [params.get("new"), resultId]);
  const items = data.results
    .filter(
      (result) =>
        result.researchId === researchId &&
        (!search ||
          `${result.title} ${result.description}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    )
    .filter(
      (result) =>
        filter === "all" ||
        (filter === "private"
          ? !data.reviewItems.some((item) => item.resultId === result.id)
          : data.reviewItems.some((item) => item.resultId === result.id)),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (resultId && !current)
    return (
      <>
        <BackLink to={`/r/${researchId}/results`}>수정 결과 목록</BackLink>
        <EmptyState
          title="수정 결과를 열 수 없어요"
          description="수정 결과 목록에서 다시 선택해 주세요."
        />
      </>
    );
  return (
    <div className="student-page">
      <WorkTabs researchId={researchId} selected="results" />
      {current ? (
        <>
          <BackLink to={`/r/${researchId}/results`}>수정 결과 목록</BackLink>
          <PageHeader
            title={current.title}
            description="실제로 고친 내용과 근거를 기록해요."
            actions={
              <div className="button-row">
                <Button
                  variant="outline"
                  onClick={() => setDraft({ ...current })}
                >
                  <Icon name="edit" size={16} />
                  수정 결과 편집
                </Button>
                {ready ? (
                  <Button asChild>
                    <Link to={`/r/${researchId}/reviews?result=${current.id}`}>
                      검토 요청 만들기
                      <Icon name="arrow-right" size={16} />
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>검토 요청 만들기</Button>
                )}
              </div>
            }
          />
          <div className="result-detail-grid">
            <div className="stack">
              <section className="surface result-body">
                <div className="section-heading">
                  <h2>실제로 수정한 내용</h2>
                  <StatusBadge tone="neutral">
                    검토 요청에 넣으면 공개
                  </StatusBadge>
                </div>
                <p className="student-body-text">{current.description}</p>
                <div className="result-evidence">
                  <h3>확인할 근거</h3>
                  {version ? (
                    <Link
                      className="student-simple-row"
                      to={`/r/${researchId}/materials/${version.materialId}?version=${version.id}`}
                    >
                      <span className="student-file-symbol">
                        <Icon name="file" size={20} />
                      </span>
                      <span className="grow">
                        <strong>{version.fileName}</strong>
                        <small>
                          파일 버전 v{version.number} ·{" "}
                          {current.location || "볼 위치 없음"}
                        </small>
                      </span>
                      <Icon name="arrow-up-right" size={16} />
                    </Link>
                  ) : (
                    <p className="student-empty-inline">
                      {current.kind === "document"
                        ? "아직 파일을 연결하지 않았어요."
                        : "문서 외 수정이라 위에 적은 내용을 근거로 사용해요."}
                    </p>
                  )}
                  {current.kind === "document" && !ready && (
                    <p className="student-inline-note">
                      수정 결과는 저장되어 있어요. 검토 요청을 만들려면 파일과
                      볼 위치를 추가해 주세요.
                    </p>
                  )}
                </div>
              </section>
              {current.feedbackIds.length > 0 && (
                <section className="surface">
                  <h2>연결한 피드백</h2>
                  {data.feedback
                    .filter((feedback) =>
                      current.feedbackIds.includes(feedback.id),
                    )
                    .map((feedback) => (
                      <Link
                        className="student-simple-row"
                        key={feedback.id}
                        to={`/r/${researchId}/feedback/${feedback.id}`}
                      >
                        <span className="grow">
                          <strong>{feedback.title}</strong>
                          <small>{feedback.body}</small>
                        </span>
                        <Icon name="chevron-right" size={16} />
                      </Link>
                    ))}
                </section>
              )}
            </div>
            <aside className="stack">
              <section className="surface">
                <div className="section-heading">
                  <h2>검토 요청</h2>
                </div>
                {linkedRequests.length ? (
                  linkedRequests.map((request) => (
                    <Link
                      className="student-simple-row"
                      key={request.id}
                      to={`/reviews/${request.id}`}
                    >
                      <span className="grow">
                        <strong>{request.title}</strong>
                        <small>{request.professorEmail}</small>
                      </span>
                      <Icon name="chevron-right" size={16} />
                    </Link>
                  ))
                ) : (
                  <p className="student-empty-inline">
                    아직 검토 요청에 넣지 않았어요.
                  </p>
                )}
                <p className="student-footnote">
                  여기서 고쳐도 이미 검토 요청에 넣은 설명과 파일은 바뀌지
                  않아요.
                </p>
              </section>
              <section className="surface">
                <h2>연결한 할 일</h2>
                {current.taskIds.length ? (
                  data.tasks
                    .filter((task) => current.taskIds.includes(task.id))
                    .map((task) => (
                      <Link
                        className="student-simple-row"
                        key={task.id}
                        to={`/r/${researchId}/tasks/${task.id}`}
                      >
                        <span className="grow">
                          <strong>{task.title}</strong>
                        </span>
                        <Icon name="chevron-right" size={15} />
                      </Link>
                    ))
                ) : (
                  <p className="student-empty-inline">연결한 할 일이 없어요.</p>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title="수정 결과"
            description="실제로 고친 내용과 근거를 기록하고, 필요한 것만 검토 요청에 넣을 수 있어요."
            actions={
              <Button onClick={startCreate}>
                <Icon name="plus" size={17} />
                수정 결과 작성
              </Button>
            }
          />

          <div className="page-toolbar">
            <div className="segmented">
              {[
                ["all", "전체"],
                ["private", "검토 요청 전"],
                ["shared", "검토 요청에 포함"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="수정 결과에서 찾기"
            />
          </div>
          <section className="surface results-list">
            {items.length ? (
              items.map((result) => {
                const file = data.versions.find(
                  (version) => version.id === result.versionId,
                );
                const count = data.reviewItems.filter(
                  (item) => item.resultId === result.id,
                ).length;
                return (
                  <Link
                    className="result-list-row"
                    key={result.id}
                    to={`/r/${researchId}/results/${result.id}`}
                  >
                    <span className="student-result-symbol">
                      <Icon name="check" size={20} />
                    </span>
                    <span className="grow">
                      <strong>{result.title}</strong>
                      <p>{result.description}</p>
                      <small>
                        {file
                          ? `${file.fileName} · v${file.number}`
                          : result.kind === "document"
                            ? "파일 없음"
                            : "문서 외 수정"}
                        {result.location ? ` · ${result.location}` : ""}
                      </small>
                    </span>
                    <StatusBadge tone={count ? "blue" : "neutral"}>
                      {count ? `검토 요청 ${count}건` : "요청 전"}
                    </StatusBadge>
                    <Icon name="chevron-right" size={17} />
                  </Link>
                );
              })
            ) : (
              <EmptyState
                title={
                  search || filter !== "all"
                    ? "조건에 맞는 수정 결과가 없어요"
                    : "아직 수정 결과가 없어요"
                }
                description="고친 내용을 먼저 기록하고, 파일과 검토 요청은 나중에 준비할 수 있어요."
                action={
                  <Button variant="outline" onClick={startCreate}>
                    수정 결과 작성
                  </Button>
                }
              />
            )}
          </section>
        </>
      )}
      <ResultEditorDialog
        researchId={researchId}
        draft={draft}
        setDraft={setDraft}
        onSaved={(result) => navigate(`/r/${researchId}/results/${result.id}`)}
      />
    </div>
  );
}
