import { assertConnected } from "@/lib/supabase";
import { useNavigationGuard } from "@/lib/navigation-guard";
import { unreadReviewNotifications } from "@/lib/notifications";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Choice, Segments } from "@/components/experience";
import { Checkbox } from "@montage-ui/core";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  StatusBadge,
} from "@/components/common";
import { Icon } from "@/components/icons";
import { PdfViewer } from "@/components/PdfViewer";
import { useWorkspace } from "@/lib/workspace";
import { uid, type MaterialVersion } from "@/lib/domain";
import {
  evidenceIssue,
  errorText,
  knownProfessorEmails,
  latestResponse,
  latestRound,
  sharingLabels,
  sharingTone,
  sourceExcerpt,
  timeText,
} from "./helpers";
import { addAdvisor, advisorChoices } from "@/lib/advisors";
import { localizeServerMessage } from "@/lib/server-messages";

export function ReviewsPage() {
  const { researchId = "" } = useParams();
  const { data, loading, createReview, saveResearch, user, mode } =
    useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"compose" | "preview">("compose");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState<MaterialVersion | null>(null);
  const prompted = useRef("");
  const requestKey = useRef(uid());
  const research = data.researches.find((r) => r.id === researchId);
  // 연구에 등록한 지도교수가 먼저, 그다음 전에 검토를 요청한 이메일.
  const professors = useMemo(
    () =>
      advisorChoices(
        research?.advisorEmails,
        knownProfessorEmails(data.reviews, researchId),
      ),
    [research?.advisorEmails, data.reviews, researchId],
  );
  // 미리 채운 이메일은 사용자가 쓴 내용이 아니므로 "버릴 내용"으로 세지 않습니다.
  const emailEdited = email.trim() !== (professors[0] ?? "");
  const requestGuard = useNavigationGuard({
    dirty: open && (!!title.trim() || emailEdited || selected.length > 0),
    busy,
    label: t("검토 요청"),
    onDiscard: () => setOpen(false),
  });
  const results = useMemo(
    () =>
      data.results
        .filter((r) => r.researchId === researchId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data.results, researchId],
  );
  const picks = results.filter((r) => selected.includes(r.id));
  const requests = data.reviews
    .filter(
      (r) =>
        r.researchId === researchId &&
        (filter === "all" || r.status === filter) &&
        `${r.title} ${r.professorEmail}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  useEffect(() => {
    const id = params.get("result");
    if (
      !loading &&
      id &&
      prompted.current !== id &&
      results.some((r) => r.id === id)
    ) {
      prompted.current = id;
      requestKey.current = uid();
      setSelected([id]);
      setTitle(
        t("{title} 검토", {
          title: results.find((r) => r.id === id)?.title ?? t("수정 결과"),
        }),
      );
      setOpen(true);
      setStep("compose");
    }
  }, [params, results, loading]);
  useEffect(() => {
    requestKey.current = uid();
  }, [title, email, selected]);
  const close = () => {
    if (busy) return;
    requestKey.current = uid();
    requestGuard.clear();
    setOpen(false);
    setDiscardOpen(false);
    setError("");
    setPreviewFile(null);
    if (params.has("result")) {
      const p = new URLSearchParams(params);
      p.delete("result");
      setParams(p, { replace: true });
    }
  };
  const requestClose = () => {
    if (busy) return;
    if (title.trim() || emailEdited || selected.length) setDiscardOpen(true);
    else close();
  };
  const begin = () => {
    requestKey.current = uid();
    setTitle("");
    setEmail(professors[0] ?? "");
    setSelected([]);
    setError("");
    setStep("compose");
    setPreviewFile(null);
    setOpen(true);
  };
  // ⌘K ‘검토 요청 만들기’(?new=1)로 들어오면 만들기 대화상자를 바로 엽니다.
  useEffect(() => {
    if (loading || params.get("new") !== "1") return;
    const p = new URLSearchParams(params);
    p.delete("new");
    setParams(p, { replace: true });
    begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, loading]);
  const validate = () => {
    if (!title.trim()) return t("검토 요청 제목을 적어 주세요.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return t(
        "이메일 형식이 맞지 않아요. 교수님 계정 이메일을 확인해 주세요.",
      );
    if (email.trim().toLowerCase() === user.email.toLowerCase())
      return t(
        "내 계정 이메일은 지정할 수 없어요. 교수님 계정 이메일을 적어 주세요.",
      );
    if (!picks.length)
      return t("검토받을 수정 결과를 하나 이상 선택해 주세요.");
    for (const result of picks) {
      const issue = evidenceIssue(result, data);
      if (issue) return `${result.title}: ${issue}`;
    }
    return "";
  };
  const showPreview = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const issue = validate();
    setError(issue);
    if (issue) return;
    setBusy(true);
    try {
      if (mode === "connected") {
        const response = await assertConnected().rpc("rms_validate_reviewer", {
          p_research_id: researchId,
          p_email: email.trim().toLowerCase(),
        });
        if (response.error)
          throw new Error(localizeServerMessage(response.error.message));
      }
      setStep("preview");
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };
  // 직접 입력해 보낸 교수는 이 연구의 지도교수로 등록해 다음부터 고르기만 하게 합니다.
  // 등록에 실패해도 검토 요청은 이미 만들어졌으므로 알리기만 합니다.
  const registerAdvisor = async (professorEmail: string) => {
    if (!research) return;
    const current = research.advisorEmails ?? [];
    const next = addAdvisor(current, professorEmail);
    if (next === current) return;
    try {
      await saveResearch({ ...research, advisorEmails: next });
    } catch {
      toast.error(
        t("지도교수 목록에 추가하지 못했어요. 연구 설정에서 등록할 수 있어요."),
      );
    }
  };
  const submit = async () => {
    const issue = validate();
    setError(issue);
    if (issue || busy) return;
    setBusy(true);
    try {
      const request = await createReview({
        researchId,
        title: title.trim(),
        professorEmail: email.trim().toLowerCase(),
        resultIds: picks.map((r) => r.id),
        requestKey: requestKey.current,
      });
      requestKey.current = uid();
      requestGuard.clear();
      setOpen(false);
      void registerAdvisor(request.professorEmail);
      toast.success(
        t(
          "검토 링크를 만들었어요. 링크를 복사해서 교수님께 직접 전달해 주세요.",
        ),
      );
      navigate(`/reviews/${request.id}`);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <LoadingState />;
  return (
    <div className="reviews-page">
      <PageHeader
        title={t("검토 요청")}
        description={t("교수님의 항목별 응답과 공유 상태를 확인하세요.")}
        actions={
          <Button onClick={begin}>
            <Icon name="plus" size={17} />
            {t("검토 요청 만들기")}
          </Button>
        }
      />
      <div className="page-toolbar review-list-toolbar">
        <Segments
          label={t("공유 상태")}
          value={filter}
          onChange={(value) => setFilter(value as typeof filter)}
          options={[
            { value: "all", label: t("전체") },
            { value: "shared", label: t("공유 중") },
            { value: "stopped", label: t("공유 중지") },
          ]}
        />
        <div className="review-search">
          <Input
            fieldSize="medium"
            width="100%"
            aria-label={t("검토 요청 찾기")}
            placeholder={t("제목이나 교수 이메일로 찾기")}
            value={search}
            onChange={(
              e: ChangeEvent<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
              >,
            ) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {!requests.length ? (
        <EmptyState
          title={
            search || filter !== "all"
              ? t("조건에 맞는 검토 요청이 없어요")
              : t("아직 검토 요청이 없어요")
          }
          description={
            search || filter !== "all"
              ? t("검색어나 공유 상태를 바꿔 보세요.")
              : t(
                  "수정 결과를 선택해 검토 링크를 만들고, 교수님께 직접 전달할 수 있어요.",
                )
          }
          action={
            !results.length ? (
              <Button asChild variant="outline">
                <Link to={`/r/${researchId}/results?new=1`}>
                  {t("수정 결과 작성")}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={begin}>
                {t("검토 요청 만들기")}
              </Button>
            )
          }
        />
      ) : (
        <section
          className="surface review-list"
          aria-label={t("검토 요청 목록")}
        >
          {requests.map((request) => {
            const responses = data.reviewItems
              .filter((i) => i.requestId === request.id)
              .map((i) => latestResponse(data, latestRound(data, i.id)?.id));
            const confirmed = responses.filter(
                (r) => r?.result === "confirmed",
              ).length,
              changes = responses.filter(
                (r) => r?.result === "changes_requested",
              ).length,
              pending = responses.filter((r) => !r).length;
            const hasUnread = unreadReviewNotifications(
              data,
              user,
              researchId,
            ).some((event) => event.requestId === request.id);
            return (
              <Link
                className="review-list-row"
                to={`/reviews/${request.id}`}
                key={request.id}
              >
                <span className="review-list-icon">
                  <Icon name="send" size={20} />
                </span>
                <div className="review-list-main">
                  <div className="review-list-title">
                    <strong>{request.title}</strong>
                    {hasUnread && (
                      <span
                        className="review-new-dot"
                        aria-label={t("새 응답·댓글 있음")}
                      />
                    )}
                    <StatusBadge tone={sharingTone[request.status]}>
                      {sharingLabels[request.status]}
                    </StatusBadge>
                  </div>
                  <span className="muted">
                    {request.professorEmail} · {timeText(request.createdAt)}
                  </span>
                  <div className="review-counts">
                    <span>
                      {t("항목 {count}개", { count: responses.length })}
                    </span>
                    {confirmed > 0 && (
                      <span className="review-count-confirmed">
                        {t("수정 내용 확인 {count}개", { count: confirmed })}
                      </span>
                    )}
                    {changes > 0 && (
                      <span className="review-count-changes">
                        {t("추가 수정 필요 {count}개", { count: changes })}
                      </span>
                    )}
                    {pending > 0 && (
                      <span>{t("응답 전 {count}개", { count: pending })}</span>
                    )}
                  </div>
                </div>
                <Icon name="chevron-right" size={18} />
              </Link>
            );
          })}
        </section>
      )}
      <Dialog
        open={open}
        onOpenChange={(value: boolean) => {
          if (!value) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          className="review-compose-dialog"
          disableEscapeKeyDownClose={busy}
          disableOutsideClickClose
        >
          <DialogHeader>
            <DialogTitle>
              {step === "compose"
                ? t("검토 요청 만들기")
                : t("공유할 내용 확인")}
            </DialogTitle>
            <DialogDescription>
              {step === "compose"
                ? t(
                    "링크를 만들기 전에 교수님께 공개될 내용을 확인할 수 있어요.",
                  )
                : t(
                    "링크를 만들면 아래 내용과 첨부 파일 전체가 지정한 교수 계정에 공개돼요.",
                  )}
            </DialogDescription>
          </DialogHeader>
          {step === "compose" ? (
            <form onSubmit={showPreview} className="review-compose-form">
              <Field label={t("검토 요청 제목")} required>
                <Input
                  aria-label={t("검토 요청 제목")}
                  value={title}
                  maxLength={180}
                  onChange={(
                    e: ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                    >,
                  ) => setTitle(e.target.value)}
                  placeholder={t("예: 선행연구 표와 연구 질문 수정 결과")}
                />
              </Field>
              <Field
                label={t("검토할 교수")}
                required
                hint={
                  professors.length > 0
                    ? t("지도교수는 연구 설정에서 추가하거나 뺄 수 있어요.")
                    : t(
                        "이 이메일로 등록된 마진 계정만 검토를 열 수 있어요. 보내면 이 연구의 지도교수로 등록돼요.",
                      )
                }
              >
                {professors.length > 0 && (
                  <Choice
                    label={t("검토할 교수")}
                    value={email}
                    onChange={setEmail}
                    options={professors.map((p) => ({ value: p, label: p }))}
                  />
                )}
                {professors.length === 0 && (
                  <Input
                    aria-label={t("교수 계정 이메일")}
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(
                      e: ChangeEvent<
                        | HTMLInputElement
                        | HTMLTextAreaElement
                        | HTMLSelectElement
                      >,
                    ) => setEmail(e.target.value)}
                    placeholder="professor@example.com"
                  />
                )}
              </Field>
              <fieldset className="review-result-selection">
                <legend>
                  {t("검토받을 수정 결과")}{" "}
                  <span className="review-required">{t("필수")}</span>
                </legend>
                {!results.length ? (
                  <p className="muted">
                    {t("아직 수정 결과가 없어요.")}{" "}
                    <Link to={`/r/${researchId}/results?new=1`}>
                      {t("수정 결과 작성")}
                    </Link>
                  </p>
                ) : (
                  results.map((result) => {
                    const issue = evidenceIssue(result, data);
                    return (
                      <label className="review-pick-row" key={result.id}>
                        <Checkbox
                          checked={selected.includes(result.id)}
                          onCheckedChange={(checked: boolean) =>
                            setSelected((current) =>
                              checked
                                ? [...current, result.id]
                                : current.filter((id) => id !== result.id),
                            )
                          }
                        />
                        <span>
                          <strong>{result.title}</strong>
                          <small>{issue || result.description}</small>
                          {issue && (
                            <span className="review-evidence-warning">
                              {t("보완 필요")}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })
                )}
              </fieldset>
              <div className="review-inline-note">
                <Icon name="lock" size={17} />
                <p>
                  {t(
                    "개인 메모, 할 일 목록, AI 대화, 선택하지 않은 AI 제안은 포함되지 않아요.",
                  )}
                </p>
              </div>
              {error && (
                <p className="review-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={requestClose}
                >
                  {t("취소")}
                </Button>
                <Button type="submit" disabled={busy || !results.length}>
                  {busy ? t("교수 계정 확인 중") : t("공유할 내용 확인")}
                  <Icon name="arrow-right" size={16} />
                </Button>
              </div>
            </form>
          ) : (
            <div className="review-public-preview">
              <div className="review-preview-heading">
                <StatusBadge tone="blue">
                  {t("교수에게 공개될 내용")}
                </StatusBadge>
                <h3>{title}</h3>
                <p className="muted">
                  {t("열 수 있는 계정 · {email}", { email })}
                </p>
              </div>
              {picks.map((result, index) => {
                const version = data.versions.find(
                    (r) => r.id === result.versionId,
                  ),
                  excerpt = sourceExcerpt(result, data);
                return (
                  <article className="review-preview-item" key={result.id}>
                    <span className="meta">
                      {t("검토 항목 {index} · 1차 검토", { index: index + 1 })}
                    </span>
                    <h4>{result.title}</h4>
                    {excerpt && (
                      <div className="review-source-block">
                        <span>{t("연결된 피드백")}</span>
                        <p>{excerpt}</p>
                      </div>
                    )}
                    <div className="review-preserved-copy">
                      <span className="meta">{t("수정한 내용")}</span>
                      <p>{result.description}</p>
                    </div>
                    {version ? (
                      <button
                        className="review-file-chip"
                        type="button"
                        onClick={() =>
                          setPreviewFile(
                            previewFile?.id === version.id ? null : version,
                          )
                        }
                      >
                        <Icon name="file" size={19} />
                        <span>
                          <strong>{version.fileName}</strong>
                          <small>
                            v{version.number} · {result.location}
                          </small>
                        </span>
                        <Icon name="chevron-down" size={16} />
                      </button>
                    ) : (
                      <p className="meta">{t("파일 없음 · 설명으로 검토")}</p>
                    )}
                  </article>
                );
              })}
              {previewFile && (
                <div className="review-compose-pdf">
                  <PdfViewer version={previewFile} />
                </div>
              )}
              <p className="review-inline-note">
                <Icon name="info" size={17} />
                {picks.some((result) => !!result.versionId)
                  ? t(
                      "볼 위치는 먼저 볼 곳을 알려 줄 뿐이에요. 교수님은 첨부한 PDF 전체를 보고 내려받을 수 있어요.",
                    )
                  : t("첨부 파일 없이 위의 설명이 공개돼요.")}
              </p>
              {error && (
                <p className="review-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setStep("compose");
                    setPreviewFile(null);
                    setError("");
                  }}
                >
                  {t("돌아가서 수정")}
                </Button>
                <Button disabled={busy} onClick={submit}>
                  {busy ? t("링크 만드는 중") : t("검토 링크 만들기")}
                  <Icon name="link" size={16} />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="student-dialog">
          <DialogHeader>
            <DialogTitle>{t("검토 요청 작성을 닫을까요?")}</DialogTitle>
            <DialogDescription>
              {t(
                "입력한 제목과 교수 계정 이메일, 수정 결과 선택이 사라져요. 수정 결과는 그대로 남아요.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              {t("계속 작성")}
            </Button>
            <Button variant="destructive" onClick={close}>
              {t("버리고 닫기")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
