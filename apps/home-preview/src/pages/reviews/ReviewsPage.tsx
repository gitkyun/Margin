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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  latestResponse,
  latestRound,
  sharingLabels,
  sharingTone,
  sourceExcerpt,
  timeText,
} from "./helpers";

export function ReviewsPage() {
  const { researchId = "" } = useParams();
  const { data, loading, createReview, user } = useWorkspace();
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
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState<MaterialVersion | null>(null);
  const prompted = useRef("");
  const requestKey = useRef(uid());
  const requestGuard = useNavigationGuard({
    dirty: open && (!!title.trim() || !!email.trim() || selected.length > 0),
    busy,
    label: "교수 검토 요청",
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
        `${results.find((r) => r.id === id)?.title ?? "수정 결과"} 검토`,
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
    setError("");
    setPreviewFile(null);
    if (params.has("result")) {
      const p = new URLSearchParams(params);
      p.delete("result");
      setParams(p, { replace: true });
    }
  };
  const begin = () => {
    requestKey.current = uid();
    setTitle("");
    setEmail("");
    setSelected([]);
    setError("");
    setStep("compose");
    setPreviewFile(null);
    setOpen(true);
  };
  const validate = () => {
    if (!title.trim()) return "검토 요청 제목을 적어 주세요.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "검토할 교수 계정의 이메일을 확인해 주세요.";
    if (email.trim().toLowerCase() === user.email.toLowerCase())
      return "자신의 계정은 교수 검토자로 지정할 수 없습니다.";
    if (!picks.length) return "보낼 수정 결과를 하나 이상 선택해 주세요.";
    for (const result of picks) {
      const issue = evidenceIssue(result, data);
      if (issue) return `${result.title}: ${issue}`;
    }
    return "";
  };
  const showPreview = (event: FormEvent) => {
    event.preventDefault();
    const issue = validate();
    setError(issue);
    if (!issue) setStep("preview");
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
      toast.success(
        "검토 링크를 만들었습니다. 링크를 복사해 직접 전달해 주세요.",
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
        title="검토 요청"
        description="보낸 수정 결과와 항목별 응답을 확인합니다."
        actions={
          <Button onClick={begin}>
            <Icon name="plus" size={17} />
            검토 요청 만들기
          </Button>
        }
      />
      <div className="page-toolbar review-list-toolbar">
        <div className="segmented" aria-label="공유 상태">
          {[
            ["all", "전체"],
            ["shared", "공유 중"],
            ["stopped", "공유 중지"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <Input
          className="review-search"
          aria-label="검토 요청 찾기"
          placeholder="제목 또는 교수 이메일 찾기"
          value={search}
          onChange={(
            e: ChangeEvent<
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >,
          ) => setSearch(e.target.value)}
        />
      </div>
      {!requests.length ? (
        <EmptyState
          title={
            search || filter !== "all"
              ? "조건에 맞는 검토 요청이 없습니다."
              : "아직 보낸 검토 요청이 없습니다."
          }
          description={
            search || filter !== "all"
              ? "찾기 조건을 바꿔 보세요."
              : "수정한 내용과 근거를 모아 교수에게 확인을 요청하세요."
          }
          action={
            !results.length ? (
              <Button asChild variant="outline">
                <Link to={`/r/${researchId}/results`}>수정 결과 작성</Link>
              </Button>
            ) : (
              <Button variant="outline" onClick={begin}>
                검토 요청 만들기
              </Button>
            )
          }
        />
      ) : (
        <section className="surface review-list" aria-label="검토 요청 목록">
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
                        aria-label="새 댓글·응답"
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
                    <span>항목 {responses.length}개</span>
                    {confirmed > 0 && (
                      <span className="review-count-confirmed">
                        확인 {confirmed}개
                      </span>
                    )}
                    {changes > 0 && (
                      <span className="review-count-changes">
                        추가 수정 필요 {changes}개
                      </span>
                    )}
                    {pending > 0 && <span>응답 전 {pending}개</span>}
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
          if (!value) close();
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          className="review-compose-dialog"
          onEscapeKeyDown={(event: { preventDefault(): void }) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event: { preventDefault(): void }) =>
            event.preventDefault()
          }
        >
          <DialogHeader>
            <DialogTitle>
              {step === "compose" ? "교수 검토 준비" : "공유할 내용 확인"}
            </DialogTitle>
            <DialogDescription>
              {step === "compose"
                ? "수정한 결과를 선택하고 검토할 교수 계정을 지정하세요."
                : "아래 내용과 첨부 파일 전체가 지정한 교수 계정에 공개됩니다."}
            </DialogDescription>
          </DialogHeader>
          {step === "compose" ? (
            <form onSubmit={showPreview} className="review-compose-form">
              <Field label="검토 요청 제목" required>
                <Input
                  aria-label="검토 요청 제목"
                  value={title}
                  maxLength={180}
                  onChange={(
                    e: ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                    >,
                  ) => setTitle(e.target.value)}
                  placeholder="예: 선행연구 표와 연구 질문 수정 결과"
                />
              </Field>
              <Field
                label="교수 계정 이메일"
                required
                hint="서비스에 등록된 교수 계정으로만 열 수 있습니다."
              >
                <Input
                  aria-label="교수 계정 이메일"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(
                    e: ChangeEvent<
                      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                    >,
                  ) => setEmail(e.target.value)}
                  placeholder="professor@example.com"
                />
              </Field>
              <fieldset className="review-result-selection">
                <legend>
                  보낼 수정 결과 <span className="review-required">필수</span>
                </legend>
                {!results.length ? (
                  <p className="muted">먼저 수정 결과를 작성해 주세요.</p>
                ) : (
                  results.map((result) => {
                    const issue = evidenceIssue(result, data);
                    return (
                      <label className="review-pick-row" key={result.id}>
                        <Checkbox
                          checked={selected.includes(result.id)}
                          onCheckedChange={(
                            checked: boolean | "indeterminate",
                          ) =>
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
                              근거 보완 필요
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
                  개인 메모·전체 할 일·선택하지 않은 AI 후보는 포함되지
                  않습니다.
                </p>
              </div>
              {error && (
                <p className="review-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button type="button" variant="outline" onClick={close}>
                  취소
                </Button>
                <Button type="submit" disabled={!results.length}>
                  공유할 내용 확인
                  <Icon name="arrow-right" size={16} />
                </Button>
              </div>
            </form>
          ) : (
            <div className="review-public-preview">
              <div className="review-preview-heading">
                <StatusBadge tone="blue">교수에게 공개될 내용</StatusBadge>
                <h3>{title}</h3>
                <p className="muted">허용 계정 · {email}</p>
              </div>
              {picks.map((result, index) => {
                const version = data.versions.find(
                    (r) => r.id === result.versionId,
                  ),
                  excerpt = sourceExcerpt(result, data);
                return (
                  <article className="review-preview-item" key={result.id}>
                    <span className="meta">
                      검토 항목 {index + 1} · 1차 검토
                    </span>
                    <h4>{result.title}</h4>
                    {excerpt && (
                      <div className="review-source-block">
                        <span>연결된 피드백</span>
                        <p>{excerpt}</p>
                      </div>
                    )}
                    <div className="review-preserved-copy">
                      <span className="meta">수정한 내용</span>
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
                      <p className="meta">문서 외 작업 · 보존한 처리 설명</p>
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
                확인 위치는 읽기 안내입니다. 첨부한 PDF 전체를 열람할 수
                있습니다.
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
                  돌아가서 수정
                </Button>
                <Button disabled={busy} onClick={submit}>
                  {busy ? "링크 만드는 중" : "검토 링크 만들기"}
                  <Icon name="link" size={16} />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
