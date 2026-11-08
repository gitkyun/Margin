import { WorkTabs } from "./shared";
import { SelectField } from "@/components/experience";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState, StatusBadge } from "@/components/common";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { recordBase, type RevisionResult } from "@/lib/domain";
import {
  BackLink,
  ErrorNotice,
  FormDialog,
  LabeledInput,
  LabeledText,
  SaveActions,
  SearchInput,
  useSaving,
} from "./shared";
import { QuickPdfUpload } from "./QuickPdfUpload";

export function ResultsPage() {
  const { researchId = "", resultId } = useParams();
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<RevisionResult | null>(null);
  const form = useSaving();
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
    const feedbackId = params.get("feedback");
    const taskId = params.get("task");
    const task = data.tasks.find(
      (item) => item.id === taskId && item.researchId === researchId,
    );
    const feedback = data.feedback.find(
      (item) => item.id === feedbackId && item.researchId === researchId,
    );
    setDraft({
      ...recordBase(researchId),
      title: task
        ? `${task.title} 수정 결과`
        : feedback
          ? `${feedback.title} 수정 결과`
          : "",
      description: "",
      feedbackIds: feedback ? [feedback.id] : (task?.feedbackIds ?? []),
      taskIds: task ? [task.id] : [],
      kind: "document",
      versionId: data.versions.find(
        (v) => v.id === params.get("version") && v.researchId === researchId,
      )?.id,
      location: "",
    });
    form.setError(null);
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
          title="수정 결과를 열 수 없습니다"
          description="현재 연구의 수정 결과 목록에서 다시 선택하세요."
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
            description="무엇을 바꿨는지와 확인할 자료를 함께 기록합니다."
            actions={
              <div className="button-row">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDraft({ ...current });
                    form.setError(null);
                  }}
                >
                  <Icon name="edit" size={16} />
                  수정 결과 편집
                </Button>
                {ready ? (
                  <Button asChild>
                    <Link to={`/r/${researchId}/reviews?result=${current.id}`}>
                      교수 검토 준비
                      <Icon name="arrow-right" size={16} />
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>교수 검토 준비</Button>
                )}
              </div>
            }
          />
          <div className="result-detail-grid">
            <div className="stack">
              <section className="surface result-body">
                <div className="section-heading">
                  <h2>실제로 수정한 내용</h2>
                  <StatusBadge tone="neutral">개인 저장본</StatusBadge>
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
                          보존 버전 v{version.number} ·{" "}
                          {current.location || "확인 위치 미정"}
                        </small>
                      </span>
                      <Icon name="arrow-up-right" size={16} />
                    </Link>
                  ) : (
                    <p className="student-empty-inline">
                      {current.kind === "document"
                        ? "아직 보존 파일을 연결하지 않았습니다."
                        : "비문서 작업의 처리 설명을 근거로 사용합니다."}
                    </p>
                  )}
                  {current.kind === "document" && !ready && (
                    <p className="student-inline-note">
                      개인 결과는 저장되었습니다. 교수 검토를 준비하려면 보존
                      파일과 확인 위치를 추가하세요.
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
                  <h2>교수에게 보낸 기록</h2>
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
                    아직 교수 검토에 사용하지 않은 결과입니다.
                  </p>
                )}
                <p className="student-footnote">
                  개인 저장본을 수정해도 이미 보낸 설명과 자료는 바뀌지
                  않습니다.
                </p>
              </section>
              <section className="surface">
                <h2>관련 작업</h2>
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
                  <p className="student-empty-inline">
                    연결한 작업이 없습니다.
                  </p>
                )}
              </section>
            </aside>
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title="피드백·수정"
            description="실제 수정한 내용과 근거를 기록하고, 필요한 결과만 교수 검토에 사용하세요."
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
                ["private", "아직 보내지 않은 결과"],
                ["shared", "검토에 사용한 결과"],
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
                            ? "보존 파일 미연결"
                            : "비문서 작업"}
                        {result.location ? ` · ${result.location}` : ""}
                      </small>
                    </span>
                    <StatusBadge tone={count ? "blue" : "neutral"}>
                      {count ? `검토 ${count}건에 사용` : "개인 저장본"}
                    </StatusBadge>
                    <Icon name="chevron-right" size={17} />
                  </Link>
                );
              })
            ) : (
              <EmptyState
                title={
                  search || filter !== "all"
                    ? "조건에 맞는 수정 결과가 없습니다"
                    : "아직 수정 결과가 없습니다"
                }
                description="무엇을 바꿨는지 먼저 기록하고, 근거 자료와 교수 검토는 이어서 준비할 수 있습니다."
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
      <FormDialog
        busy={form.saving}
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        title={
          draft && data.results.some((result) => result.id === draft.id)
            ? "수정 결과 편집"
            : "수정 결과 작성"
        }
        description="개인 저장본입니다. 저장만으로 교수에게 공개되지 않습니다."
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft || !draft.title.trim() || !draft.description.trim()) {
              form.setError("결과 제목과 실제 수정한 내용을 입력하세요.");
              return;
            }
            void form.perform(async () => {
              const result = await save("results", {
                ...draft,
                title: draft.title.trim(),
                description: draft.description.trim(),
                location: draft.location.trim(),
              });
              setDraft(null);
              navigate(`/r/${researchId}/results/${result.id}`);
              toast.success("수정 결과를 저장했습니다");
            });
          }}
        >
          {draft && (
            <>
              <LabeledInput
                label="결과 제목"
                required
                value={draft.title}
                onChange={(title) =>
                  setDraft((value) => (value ? { ...value, title } : value))
                }
              />
              <LabeledText
                label={
                  draft.kind === "other"
                    ? "실제로 수행한 내용"
                    : "실제로 수정한 내용"
                }
                required
                value={draft.description}
                onChange={(description) =>
                  setDraft((value) =>
                    value ? { ...value, description } : value,
                  )
                }
                placeholder="어떤 부분을 어떻게 바꿨는지 적어 주세요."
                rows={5}
              />
              <label className="field">
                <span className="field-name">작업 종류</span>
                <SelectField
                  className="native-select"
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft((value) =>
                      value
                        ? {
                            ...value,
                            kind: event.target.value as RevisionResult["kind"],
                          }
                        : value,
                    )
                  }
                >
                  <option value="document">문서 수정</option>
                  <option value="other">비문서 작업</option>
                </SelectField>
              </label>
              {draft.kind === "document" && (
                <>
                  <label className="field">
                    <span className="field-name">보존 파일</span>
                    <SelectField
                      className="native-select"
                      value={draft.versionId ?? ""}
                      onChange={(event) =>
                        setDraft((value) =>
                          value
                            ? {
                                ...value,
                                versionId: event.target.value || undefined,
                              }
                            : value,
                        )
                      }
                    >
                      <option value="">나중에 연결</option>
                      {data.versions
                        .filter((version) => version.researchId === researchId)
                        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                        .map((version) => (
                          <option key={version.id} value={version.id}>
                            {version.fileName} · v{version.number}
                          </option>
                        ))}
                    </SelectField>
                    <small className="field-hint">
                      문서 수정의 교수 검토에는 보존 파일과 확인 위치가
                      필요합니다.
                    </small>
                  </label>
                  <QuickPdfUpload
                    researchId={researchId}
                    onUploaded={(version) =>
                      setDraft((value) =>
                        value ? { ...value, versionId: version.id } : value,
                      )
                    }
                  />
                  <LabeledInput
                    label="확인 위치"
                    value={draft.location}
                    onChange={(location) =>
                      setDraft((value) =>
                        value ? { ...value, location } : value,
                      )
                    }
                    placeholder="예: 4페이지 표 2, 2장 마지막 문단"
                  />
                </>
              )}
              <div className="student-picker">
                <h3>연결할 피드백</h3>
                {data.feedback
                  .filter((feedback) => feedback.researchId === researchId)
                  .map((feedback) => (
                    <label className="student-choice-row" key={feedback.id}>
                      <input
                        type="checkbox"
                        checked={draft.feedbackIds.includes(feedback.id)}
                        onChange={(event) =>
                          setDraft((value) =>
                            value
                              ? {
                                  ...value,
                                  feedbackIds: event.target.checked
                                    ? [...value.feedbackIds, feedback.id]
                                    : value.feedbackIds.filter(
                                        (id) => id !== feedback.id,
                                      ),
                                }
                              : value,
                          )
                        }
                      />
                      <span>{feedback.title}</span>
                    </label>
                  ))}
              </div>
              <div className="student-picker">
                <h3>연결할 작업</h3>
                {data.tasks
                  .filter((task) => task.researchId === researchId)
                  .map((task) => (
                    <label className="student-choice-row" key={task.id}>
                      <input
                        type="checkbox"
                        checked={draft.taskIds.includes(task.id)}
                        onChange={(event) =>
                          setDraft((value) =>
                            value
                              ? {
                                  ...value,
                                  taskIds: event.target.checked
                                    ? [...value.taskIds, task.id]
                                    : value.taskIds.filter(
                                        (id) => id !== task.id,
                                      ),
                                }
                              : value,
                          )
                        }
                      />
                      <span>{task.title}</span>
                    </label>
                  ))}
              </div>
            </>
          )}
          <ErrorNotice error={form.error} />
          <SaveActions
            saving={form.saving}
            onCancel={() => setDraft(null)}
            label="수정 결과 저장"
          />
        </form>
      </FormDialog>
    </div>
  );
}
