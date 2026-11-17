import { WorkTabs, useBackState } from "./shared";
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Segments } from "@/components/experience";
import {
  PageHeader,
  EmptyState,
  StatusBadge,
  TextLink,
  InlineEmpty,
} from "@/components/common";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import type { RevisionResult } from "@/lib/domain";
import { BackLink, SearchInput } from "./shared";
import { ResultEditorDialog } from "./ResultEditorDialog";
import { newResultDraft } from "./result-draft";
import { MarginPanel, PanelFrame } from "@/components/margin-panel/MarginPanel";
import {
  ResponseStatus,
  latestResponse,
  latestRound,
  timeText,
} from "@/pages/reviews/helpers";

export function ResultsPage() {
  const { researchId = "", resultId } = useParams();
  const back = useBackState();
  const { data, save } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<RevisionResult | null>(null);
  // 여백 패널: 응답(교수 결과와 댓글)과 연결(이 결과와 이어진 기록)
  const [panelTab, setPanelTab] = useState<"responses" | "links">("responses");
  const [panelOpen, setPanelOpen] = useState(false);
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
  const hasResults = data.results.some(
    (result) => result.researchId === researchId,
  );
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
        <BackLink to={`/r/${researchId}/results`}>
          {t("수정 결과 목록")}
        </BackLink>
        <EmptyState
          title={t("수정 결과를 열 수 없어요")}
          description={t("수정 결과 목록에서 다시 선택해 주세요.")}
        />
      </>
    );
  return (
    <div className="student-page">
      {current ? (
        <>
          <PageHeader
            back={
              <BackLink to={`/r/${researchId}/results`}>
                {t("수정 결과 목록")}
              </BackLink>
            }
            title={current.title}
            description={t("실제로 고친 내용과 교수님이 볼 파일을 남겨요.")}
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={() => setDraft({ ...current })}
                >
                  <Icon name="edit" size={16} />
                  {t("수정 결과 편집")}
                </Button>
                {ready ? (
                  <Button asChild>
                    <Link to={`/r/${researchId}/reviews?result=${current.id}`}>
                      {t("검토 요청 만들기")}
                      <Icon name="arrow-right" size={16} />
                    </Link>
                  </Button>
                ) : (
                  <Button disabled>{t("검토 요청 만들기")}</Button>
                )}
              </>
            }
          />
          <div className="stack result-detail">
            <section className="surface result-response-summary">
              <div>
                <h2>{t("교수 응답")}</h2>
                <p className="meta">
                  {linkedItems.length
                    ? t(
                        "검토 요청 {count}건에 넣었어요. 응답과 댓글은 패널에서 볼 수 있어요.",
                        { count: linkedRequests.length },
                      )
                    : t("아직 검토 요청에 넣지 않았어요.")}
                </p>
              </div>
              <div className="button-row">
                {linkedItems.map((item) => (
                  <ResponseStatus
                    key={item.id}
                    response={latestResponse(
                      data,
                      latestRound(data, item.id)?.id,
                    )}
                  />
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPanelTab(linkedItems.length ? "responses" : "links");
                    setPanelOpen(true);
                  }}
                >
                  {linkedItems.length ? t("응답 보기") : t("연결된 기록 보기")}
                </Button>
              </div>
            </section>
            <section className="surface result-body">
              <div className="section-heading">
                <h2>{t("실제로 수정한 내용")}</h2>
                <StatusBadge tone="neutral">
                  {t("검토 요청에 넣으면 공개")}
                </StatusBadge>
              </div>
              <p className="student-body-text">{current.description}</p>
              <div className="result-evidence">
                <h3>{t("교수님이 볼 파일")}</h3>
                {version ? (
                  <Link
                    className="student-simple-row"
                    to={`/r/${researchId}/materials/${version.materialId}?version=${version.id}`}
                    state={back(current.title)}
                  >
                    <span className="student-file-symbol">
                      <Icon name="file" size={20} />
                    </span>
                    <span className="grow">
                      <strong>{version.fileName}</strong>
                      <small>
                        {t("파일 버전 v{number}", { number: version.number })} ·{" "}
                        {current.location || t("볼 위치 없음")}
                      </small>
                    </span>
                    <Icon name="arrow-up-right" size={16} />
                  </Link>
                ) : (
                  <InlineEmpty>
                    {current.kind === "document"
                      ? t("아직 파일을 연결하지 않았어요.")
                      : t(
                          "문서 외 수정이라 파일 없이 위에 적은 설명만 보여요.",
                        )}
                  </InlineEmpty>
                )}
                {current.kind === "document" && !ready && (
                  <p className="student-inline-note">
                    {t(
                      "수정 결과는 저장되어 있어요. 검토 요청을 만들려면 파일과 볼 위치를 추가해 주세요.",
                    )}
                  </p>
                )}
              </div>
            </section>
            {current.feedbackIds.length > 0 && (
              <section className="surface">
                <h2>{t("연결한 피드백")}</h2>
                {data.feedback
                  .filter((feedback) =>
                    current.feedbackIds.includes(feedback.id),
                  )
                  .map((feedback) => (
                    <Link
                      className="student-simple-row"
                      key={feedback.id}
                      to={`/r/${researchId}/feedback/${feedback.id}`}
                      state={back(current.title)}
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
            <ResultPanel
              researchId={researchId}
              result={current}
              open={panelOpen}
              tab={panelTab}
              onTab={setPanelTab}
              onOpen={() => setPanelOpen(true)}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        </>
      ) : (
        <>
          <PageHeader
            title={t("수정 결과")}
            tabs={<WorkTabs researchId={researchId} selected="results" />}
            actions={
              // 수정 결과가 없을 때는 빈 상태의 버튼이 주 행동이라 여기는 보조로 낮춥니다.
              <Button
                variant={hasResults ? undefined : "outline"}
                onClick={startCreate}
              >
                <Icon name="plus" size={17} />
                {t("수정 결과 작성")}
              </Button>
            }
          />

          <div className="page-toolbar">
            <Segments
              label={t("검토 요청 포함 여부")}
              value={filter}
              onChange={(value) => setFilter(value as typeof filter)}
              options={[
                { value: "all", label: t("전체") },
                { value: "private", label: t("검토 요청 전") },
                { value: "shared", label: t("검토 요청에 포함") },
              ]}
            />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("수정 결과에서 찾기")}
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
                    className="result-list-row list-row"
                    key={result.id}
                    to={`/r/${researchId}/results/${result.id}`}
                  >
                    <span className="student-result-symbol list-row-lead">
                      <Icon name="check" size={20} />
                    </span>
                    <span className="list-row-body">
                      <strong className="list-row-title" title={result.title}>
                        {result.title}
                      </strong>
                      {result.description && (
                        <span
                          className="list-row-desc"
                          title={result.description}
                        >
                          {result.description}
                        </span>
                      )}
                      <small className="list-row-meta">
                        {file
                          ? `${file.fileName} · v${file.number}`
                          : result.kind === "document"
                            ? t("파일 없음")
                            : t("문서 외 수정")}
                        {result.location ? ` · ${result.location}` : ""}
                      </small>
                    </span>
                    <StatusBadge tone={count ? "blue" : "neutral"}>
                      {count
                        ? t("검토 요청 {count}건", { count })
                        : t("요청 전")}
                    </StatusBadge>
                    <Icon name="chevron-right" size={17} />
                  </Link>
                );
              })
            ) : (
              <EmptyState
                title={
                  search || filter !== "all"
                    ? t("조건에 맞는 수정 결과가 없어요")
                    : t("아직 수정 결과가 없어요")
                }
                description={t(
                  "고친 내용을 먼저 기록하고, 파일과 검토 요청은 나중에 준비할 수 있어요.",
                )}
                action={
                  <Button variant="outline" onClick={startCreate}>
                    {t("수정 결과 작성")}
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

interface ResultPanelProps {
  researchId: string;
  result: RevisionResult;
  open: boolean;
  tab: "responses" | "links";
  onTab(tab: "responses" | "links"): void;
  onOpen(): void;
  onClose(): void;
}

/**
 * 수정 결과의 여백 패널. 응답 탭은 검토 요청마다 최신 차수의 교수 결과와 댓글을 보여 줍니다.
 * 교수 결과는 학생의 작업 완료·반영 기록과 따로 표시합니다.
 */
function ResultPanel({
  researchId,
  result,
  open,
  tab,
  onTab,
  onOpen,
  onClose,
}: ResultPanelProps) {
  const { data } = useWorkspace();
  const back = useBackState();
  const items = data.reviewItems.filter((item) => item.resultId === result.id);
  const tasks = data.tasks.filter((task) => result.taskIds.includes(task.id));
  const feedback = data.feedback.filter((item) =>
    result.feedbackIds.includes(item.id),
  );
  return (
    <MarginPanel
      label={t("교수 응답과 연결된 기록")}
      open={open}
      onOpen={onOpen}
      onClose={onClose}
    >
      <PanelFrame
        title={t("이 수정 결과")}
        onClose={onClose}
        tab={tab}
        onTab={(value) => onTab(value as "responses" | "links")}
        tabs={[
          { value: "responses", label: t("응답"), count: items.length },
          {
            value: "links",
            label: t("연결"),
            count: tasks.length + feedback.length,
          },
        ]}
      >
        {tab === "responses" && (
          <div className="panel-frame-body">
            {items.map((item) => {
              const request = data.reviews.find(
                (review) => review.id === item.requestId,
              );
              const round = latestRound(data, item.id);
              const response = latestResponse(data, round?.id);
              const comments = data.comments.filter(
                (comment) => comment.roundId === round?.id,
              );
              return (
                <article className="result-response" key={item.id}>
                  <div className="result-response-head">
                    <strong>{request?.title ?? item.title}</strong>
                    <ResponseStatus response={response} />
                  </div>
                  <small>
                    {round
                      ? t("{number}차", { number: round.number })
                      : t("차수 없음")}
                    {response ? ` · ${timeText(response.createdAt)}` : ""}
                  </small>
                  {response?.comment && (
                    <blockquote className="source-excerpt">
                      <small>{t("교수 응답")}</small>
                      {response.comment}
                    </blockquote>
                  )}
                  {comments.length > 0 && (
                    <ul className="result-response-comments">
                      {comments.map((comment) => (
                        <li key={comment.id}>
                          <small>
                            {comment.authorName}
                            {comment.resolved ? ` · ${t("해결됨")}` : ""}
                          </small>
                          {comment.body}
                        </li>
                      ))}
                    </ul>
                  )}
                  {request && (
                    <TextLink to={`/reviews/${request.id}`}>
                      {t("검토 요청 열기")}
                      <Icon name="arrow-right" size={14} />
                    </TextLink>
                  )}
                </article>
              );
            })}
            {!items.length && (
              <InlineEmpty>
                {t(
                  "아직 검토 요청에 넣지 않았어요. 넣으면 교수 응답이 여기에 보여요.",
                )}
              </InlineEmpty>
            )}
          </div>
        )}
        {tab === "links" && (
          <div className="panel-frame-body">
            <h3>
              {t("피드백")}
              <span className="count-chip">{feedback.length}</span>
            </h3>
            {feedback.map((item) => (
              <Link
                className="student-simple-row"
                key={item.id}
                to={`/r/${researchId}/feedback/${item.id}`}
                state={back(result.title)}
              >
                <span className="grow">
                  <strong>{item.title}</strong>
                </span>
                <Icon name="chevron-right" size={15} />
              </Link>
            ))}
            {!feedback.length && (
              <InlineEmpty>{t("연결한 피드백이 없어요.")}</InlineEmpty>
            )}
            <h3>
              {t("할 일")}
              <span className="count-chip">{tasks.length}</span>
            </h3>
            {tasks.map((task) => (
              <Link
                className="student-simple-row"
                key={task.id}
                to={`/r/${researchId}/tasks/${task.id}`}
                state={back(result.title)}
              >
                <span className="grow">
                  <strong>{task.title}</strong>
                </span>
                <Icon name="chevron-right" size={15} />
              </Link>
            ))}
            {!tasks.length && (
              <InlineEmpty>{t("연결한 할 일이 없어요.")}</InlineEmpty>
            )}
          </div>
        )}
      </PanelFrame>
    </MarginPanel>
  );
}
