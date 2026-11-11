import { BrandMark, BrandWordmark } from "@/components/brand/Brand";
import { SelectField } from "@/components/experience";
import { useNavigationGuard } from "@/lib/navigation-guard";
import {
  useEffect,
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
import { useBackState } from "@/pages/student/shared";
import { useBusyKey } from "@/lib/use-busy-key";
import { Checkbox } from "@montage-ui/core";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EmptyState,
  Field,
  LoadingState,
  StatusBadge,
} from "@/components/common";
import { Icon } from "@/components/icons";
import { PdfViewer } from "@/components/PdfViewer";
import { useWorkspace } from "@/lib/workspace";
import { useTheme } from "@/lib/theme";
import {
  uid,
  type ReviewComment,
  type ReviewItem,
  type ReviewResponse,
} from "@/lib/domain";
import {
  ResponseStatus,
  evidenceIssue,
  errorText,
  isLatestRound,
  latestResponse,
  latestRound,
  sharingLabels,
  sharingTone,
  timeText,
  versionForRound,
} from "./helpers";
import { Tabs } from "@/components/ui/tabs";
import { RequestDirection } from "./RequestDirection";

function CommentThread({
  comment,
  replies,
  canWrite,
  busy,
  onReply,
  onResolve,
  userId,
}: {
  comment: ReviewComment;
  replies: ReviewComment[];
  canWrite: boolean;
  busy: boolean;
  onReply: (comment: ReviewComment) => void;
  onResolve: (id: string, value: boolean) => void;
  userId: string;
}) {
  return (
    <article
      className={`review-comment-thread ${comment.resolved ? "is-resolved" : ""}`}
    >
      <div className="review-comment-author">
        <span className="review-comment-avatar">
          {comment.authorName?.slice(0, 1) || t("검")}
        </span>
        <strong>
          {comment.authorName ||
            (comment.userId === userId ? t("나") : t("검토 참여자"))}
        </strong>
        <time>{timeText(comment.createdAt)}</time>
      </div>
      <p className="review-comment-body">{comment.body}</p>
      <div className="review-comment-actions">
        {comment.resolved && (
          <StatusBadge tone="neutral">{t("해결됨")}</StatusBadge>
        )}
        {canWrite && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReply(comment)}
            >
              {t("답글")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onResolve(comment.id, !comment.resolved)}
            >
              {comment.resolved ? t("다시 열기") : t("해결로 표시")}
            </button>
          </>
        )}
      </div>
      {replies.map((reply) => (
        <div className="review-comment-reply" key={reply.id}>
          <div className="review-comment-author">
            <strong>
              {reply.authorName ||
                (reply.userId === userId ? t("나") : t("검토 참여자"))}
            </strong>
            <time>{timeText(reply.createdAt)}</time>
          </div>
          <p className="review-comment-body">{reply.body}</p>
        </div>
      ))}
    </article>
  );
}

/**
 * 교수가 이 항목에 결과를 남긴 뒤 다음에 할 일을 알려 줍니다(검수 H-3).
 * 이 검토 요청 안의 항목만 셉니다. 여러 학생을 모아 보는 화면이 아닙니다.
 * ‘승인’·‘완료’라는 말은 쓰지 않습니다(docs/design/ux-writing.md).
 */
function ProfessorProgress({
  pending,
  onNext,
}: {
  pending: ReviewItem[];
  onNext: (item: ReviewItem) => void;
}) {
  if (!pending.length)
    return (
      <div className="review-progress is-done" role="status">
        <Icon name="check-circle" size={16} />
        <p>
          {t(
            "이 요청의 모든 항목에 결과를 남겼어요. 학생에게 알림으로 보여요.",
          )}
        </p>
      </div>
    );
  return (
    <div className="review-progress" role="status">
      <p>{t("결과를 남기지 않은 항목 {count}개", { count: pending.length })}</p>
      <Button size="sm" onClick={() => onNext(pending[0])}>
        {t("다음 항목")}
        <Icon name="arrow-right" size={14} />
      </Button>
    </div>
  );
}
/**
 * `embedded`: 학생이 앱 셸 안에서 열 때. 셸이 로고·계정 메뉴·<main>을 이미 그리므로
 * 이 화면은 그것들을 다시 그리지 않습니다(2026-11-09 검수 E-7).
 */
export function ReviewDetailPage({ embedded = false }: { embedded?: boolean }) {
  const { requestId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const context = useWorkspace();
  const {
    data,
    user,
    mode,
    loading,
    error: workspaceError,
    refresh,
    respond,
    comment: sendComment,
    resolveComment,
    recheck,
    setSharing,
    markRead,
  } = context;
  const { theme, setTheme, resolvedTheme } = useTheme();
  const request = data.reviews.find((r) => r.id === requestId);
  const back = useBackState();
  const items = data.reviewItems.filter((r) => r.requestId === requestId);
  const queryRound = data.rounds.find(
    (r) => r.id === params.get("round") && r.requestId === requestId,
  );
  const item =
    items.find((r) => r.id === params.get("item")) ??
    items.find((r) => r.id === queryRound?.itemId) ??
    items[0];
  const rounds = data.rounds
    .filter((r) => r.itemId === item?.id && r.requestId === requestId)
    .sort((a, b) => b.number - a.number);
  const nextRoundNumber = (rounds[0]?.number ?? 0) + 1;
  const round = rounds.find((r) => r.id === params.get("round")) ?? rounds[0];
  // Pin the opened round so background refresh never replaces an in-progress response.
  useEffect(() => {
    if (round && !params.get("round")) {
      const next = new URLSearchParams(params);
      next.set("item", round.itemId);
      next.set("round", round.id);
      setParams(next, { replace: true });
    }
  }, [round?.id, params, setParams]);
  const response = latestResponse(data, round?.id);
  const isOwner =
    !!request && data.researches.some((r) => r.id === request.researchId);
  const isProfessor = !!request && request.professorId === user.id && !isOwner;
  const canRead =
    !!request && (isOwner || (isProfessor && request.status === "shared"));
  const canWrite = canRead && request?.status === "shared";
  const canRespond =
    isProfessor && canWrite && !!round && isLatestRound(data, round);
  const version =
    request && round ? versionForRound(round, request, data) : undefined;
  const [mobilePanel, setMobilePanel] = useState<"document" | "response">(
    "document",
  );
  const [responseDrafts, setResponseDrafts] = useState<
    Record<
      string,
      { result: "" | "confirmed" | "changes_requested"; comment: string }
    >
  >({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
    {},
  );
  const [replyTo, setReplyTo] = useState<
    Record<string, ReviewComment | undefined>
  >({});
  const { busy, run: runBusy } = useBusyKey();
  const [error, setError] = useState("");
  // 칸 하나에 대한 오류는 그 칸 바로 아래에 보여 줍니다(QA D-016).
  const [reasonError, setReasonError] = useState("");
  const [emailError, setEmailError] = useState("");
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [sharingEmail, setSharingEmail] = useState("");
  const [recheckOpen, setRecheckOpen] = useState(false);
  const [recheckConfirmed, setRecheckConfirmed] = useState(false);
  const [history, setHistory] = useState<Record<string, ReviewResponse[]>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const seen = useRef(new Set<string>());
  const recheckKey = useRef(uid());
  const comments = data.comments
    .filter((r) => r.roundId === round?.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ownResponse = response?.userId === user.id ? response : undefined;
  const draft = round
    ? (responseDrafts[round.id] ?? {
        result: ownResponse?.result ?? "",
        comment: ownResponse?.comment ?? "",
      })
    : { result: "" as const, comment: "" };
  const responseIsDirty = Object.entries(responseDrafts).some(([id, value]) => {
    const saved = data.responses.find(
      (r) => r.roundId === id && r.userId === user.id,
    );
    return (
      value.result !== (saved?.result ?? "") ||
      value.comment.trim() !== (saved?.comment ?? "").trim()
    );
  });
  useNavigationGuard({
    dirty:
      responseIsDirty ||
      Object.values(commentDrafts).some((text) => !!text.trim()) ||
      (sharingOpen &&
        sharingEmail.trim().toLowerCase() !== request?.professorEmail),
    busy: !!busy && busy !== "history",
    label: t("검토 응답·댓글"),
    onDiscard: () => {
      setResponseDrafts({});
      setCommentDrafts({});
      setSharingOpen(false);
    },
  });
  const privateResult = data.results.find(
    (r) => r.id === item?.resultId && r.researchId === request?.researchId,
  );
  const privateVersion = data.versions.find(
    (r) => r.id === privateResult?.versionId,
  );
  const doAction = async (
    key: string,
    operation: () => Promise<unknown>,
    success?: string,
  ) =>
    (await runBusy(key, async () => {
      setError("");
      try {
        await operation();
        if (success) toast.success(success);
        return true;
      } catch (failure) {
        setError(errorText(failure));
        return false;
      }
    })) ?? false;
  useEffect(() => {
    if (!round || !canRead) return;
    const key = `${round.id}:${response?.updatedAt ?? ""}:${comments.at(-1)?.createdAt ?? ""}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    void markRead(round.id).catch(() => {
      seen.current.delete(key);
    });
  }, [
    round?.id,
    response?.updatedAt,
    comments.at(-1)?.createdAt,
    canRead,
    markRead,
  ]);
  useEffect(() => {
    setError("");
    setReasonError("");
    setHistoryOpen(false);
  }, [round?.id]);
  const selectItem = (value: ReviewItem) => {
    const next = new URLSearchParams(params);
    next.set("item", value.id);
    next.delete("round");
    next.delete("comment");
    setParams(next);
    setMobilePanel("document");
  };
  const selectRound = (id: string) => {
    const next = new URLSearchParams(params);
    if (item) next.set("item", item.id);
    next.set("round", id);
    next.delete("comment");
    setParams(next);
  };
  const submitResponse = async (event: FormEvent) => {
    event.preventDefault();
    if (!round || !canRespond) return;
    if (!draft.result) {
      setError(t("이 항목의 검토 결과를 선택해 주세요."));
      return;
    }
    const chosenResult = draft.result;
    if (draft.result === "changes_requested" && !draft.comment.trim()) {
      setReasonError(t("추가로 수정할 내용을 적어 주세요."));
      reasonInput.current?.focus();
      return;
    }
    setReasonError("");
    const saved = await doAction(
      "response",
      () =>
        respond({
          roundId: round.id,
          result: chosenResult,
          comment: draft.comment.trim(),
        }),
      t("이 항목의 검토 결과를 저장했어요."),
    );
    if (saved)
      setResponseDrafts((current) => {
        const next = { ...current };
        delete next[round.id];
        return next;
      });
  };
  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!round || !canWrite || !commentDrafts[round.id]?.trim()) return;
    const saved = await doAction(
      "comment",
      () =>
        sendComment({
          roundId: round.id,
          body: commentDrafts[round.id].trim(),
          parentId: replyTo[round.id]?.id,
        }),
      t("댓글을 남겼어요."),
    );
    if (saved) {
      setCommentDrafts((current) => ({ ...current, [round.id]: "" }));
      setReplyTo((current) => ({ ...current, [round.id]: undefined }));
    }
  };
  const copyLink = async () => {
    try {
      const url = new URL(`/reviews/${requestId}`, window.location.origin);
      if (item) url.searchParams.set("item", item.id);
      if (round) url.searchParams.set("round", round.id);
      await navigator.clipboard.writeText(url.href);
      toast.success(
        request?.status === "stopped"
          ? t(
              "링크를 복사했어요. 공유를 중지한 상태라 다시 공유해야 교수님이 열 수 있어요.",
            )
          : t("링크를 복사했어요. 교수님께 직접 전달해 주세요."),
      );
    } catch {
      toast.error(
        t("링크를 복사하지 못했어요. 브라우저 주소창의 링크를 복사해 주세요."),
      );
    }
  };
  const saveSharing = async (
    status: "shared" | "stopped",
    changeEmail: boolean,
  ) => {
    if (!request || !isOwner) return;
    if (
      changeEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sharingEmail.trim())
    ) {
      setEmailError(
        t("이메일 형식이 맞지 않아요. 교수님 계정 이메일을 확인해 주세요."),
      );
      emailInput.current?.focus();
      return;
    }
    setEmailError("");
    const saved = await doAction(
      "sharing",
      () =>
        setSharing(
          request.id,
          status,
          changeEmail ? sharingEmail.trim().toLowerCase() : undefined,
        ),
      request.status === status
        ? t("공유 설정을 저장했어요.")
        : status === "stopped"
          ? t("공유를 중지했어요. 지금까지의 검토 기록은 그대로 남아요.")
          : t("다시 공유했어요. 교수님이 같은 링크로 열 수 있어요."),
    );
    if (saved) setSharingOpen(false);
  };
  const submitRecheck = async () => {
    if (!request || !item || !privateResult || !recheckConfirmed) return;
    const issue = evidenceIssue(privateResult, data);
    if (issue) {
      setError(issue);
      return;
    }
    const saved = await doAction(
      "recheck",
      () =>
        recheck({
          requestId: request.id,
          itemId: item.id,
          resultId: privateResult.id,
          requestKey: recheckKey.current,
        }),
      t(
        "{number}차 검토를 만들었어요. 교수님은 같은 검토 링크에서 볼 수 있어요.",
        { number: nextRoundNumber },
      ),
    );
    if (saved) {
      recheckKey.current = uid();
      setRecheckOpen(false);
      const next = new URLSearchParams(params);
      next.set("item", item.id);
      next.delete("round");
      setParams(next);
    }
  };
  const loadHistory = async () => {
    if (!round) return;
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    const historyContext = context as typeof context & {
      responseHistory?: (roundId: string) => Promise<ReviewResponse[]>;
    };
    if (!historyContext.responseHistory) return;
    const saved = await doAction("history", async () => {
      const values = await historyContext.responseHistory!(round.id);
      setHistory((current) => ({ ...current, [round.id]: values }));
    });
    if (saved) setHistoryOpen(true);
  };
  if (loading)
    return (
      <div className="review-loading">
        <LoadingState />
      </div>
    );
  if (!request || !canRead)
    return (
      <main className="review-access-page">
        <span className="review-brand">
          <BrandMark />
          <BrandWordmark />
        </span>
        <EmptyState
          title={t("이 검토를 열 수 없어요")}
          description={t(
            "공유가 중지되었거나 지금 로그인한 계정에 열람 권한이 없어요. 학생이 지정한 교수 계정으로 로그인했는지 확인해 주세요.",
          )}
          action={
            <div className="button-row">
              <Button variant="outline" onClick={() => void refresh()}>
                {t("다시 불러오기")}
              </Button>
              <Button onClick={() => void context.signOut()}>
                {t("다른 계정으로 로그인")}
              </Button>
            </div>
          }
        />
        {workspaceError && (
          <p className="review-form-error" role="alert">
            {workspaceError}
          </p>
        )}
        <p className="meta">
          {t("로그인한 계정 · {email}", { email: user.email })}
        </p>
        <Link className="review-return" to="/r">
          {t("내 연구로 이동")}
        </Link>
      </main>
    );
  const Root = embedded ? "div" : "main";
  return (
    <Root className="review-workspace">
      <header className="review-workspace-header">
        <div className="review-header-left">
          <Link
            className="review-brand"
            to={isOwner || embedded ? `/r/${request.researchId}/reviews` : "/r"}
            aria-label={
              embedded
                ? t("검토 요청 목록으로 돌아가기")
                : isOwner
                  ? t("마진(Margin) 검토 요청 목록으로 돌아가기")
                  : t("마진(Margin) 홈")
            }
          >
            {(isOwner || embedded) && <Icon name="arrow-left" size={21} />}
            {!embedded && (
              <>
                <BrandMark />
                <BrandWordmark />
              </>
            )}
          </Link>
          {!embedded && <span className="review-header-divider" />}
          <div>
            <h1>{request.title}</h1>
            <p>
              {isOwner
                ? t("{email}에게 공유", { email: request.professorEmail })
                : t("학생이 보낸 수정 결과")}{" "}
              · {timeText(request.createdAt)}
            </p>
          </div>
          <StatusBadge tone={sharingTone[request.status]}>
            {sharingLabels[request.status]}
          </StatusBadge>
        </div>
        <div className="review-header-actions">
          <Button
            size="sm"
            variant="outline"
            aria-label={t("새로고침")}
            onClick={() => void refresh()}
            disabled={!!busy}
          >
            <Icon name="refresh" size={16} />
            <span className="review-refresh-label">{t("새로고침")}</span>
          </Button>
          {isOwner ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSharingEmail(request.professorEmail);
                  setError("");
                  setEmailError("");
                  setSharingOpen(true);
                }}
              >
                <Icon name="settings" size={16} />
                {t("공유 설정")}
              </Button>
              <Button size="sm" onClick={copyLink}>
                <Icon name="link" size={16} />
                {t("링크 복사")}
              </Button>
            </>
          ) : null}
          {!embedded && (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button
                  className="review-account-button"
                  aria-label={t("{name} 계정 메뉴", { name: user.name })}
                >
                  {user.name.slice(0, 1) || t("나")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="review-account-menu">
                <DropdownMenuLabel>
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => navigate("/account?tab=appearance")}
                >
                  <Icon name="monitor" size={16} />
                  {t("화면 설정")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void context.signOut()}>
                  <Icon name="logout" size={16} />
                  {t("로그아웃")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      {mode === "preview" && (
        <div className="review-preview-banner">
          <Icon name="info" size={15} />
          {t(
            "로컬 미리보기예요. 서버 연결 전이라 교수 계정으로 열거나 응답할 수 없어요.",
          )}
        </div>
      )}
      {request.status === "stopped" && (
        <div className="review-stopped-banner">
          <Icon name="lock" size={16} />
          {t(
            "공유를 중지한 검토예요. 교수님은 열 수 없고, 지금까지의 검토 기록은 그대로 남아요.",
          )}
        </div>
      )}
      {!isOwner && (
        <div className="review-direction-bar">
          <RequestDirection
            name={request.researchName}
            purpose={request.researchPurpose}
            questions={request.researchQuestions}
          />
        </div>
      )}
      <div className="review-workspace-body">
        <aside className="review-item-sidebar" aria-label={t("검토 항목")}>
          <div className="review-sidebar-title">
            <h2>{t("검토 항목")}</h2>
            <span>{items.length}</span>
          </div>
          {items.map((record, index) => {
            const latest = latestRound(data, record.id),
              result = latestResponse(data, latest?.id);
            return (
              <button
                type="button"
                className={`review-item-nav ${record.id === item?.id ? "selected" : ""}`}
                key={record.id}
                aria-current={record.id === item?.id ? "true" : undefined}
                onClick={() => selectItem(record)}
              >
                <span className="review-item-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{latest?.title ?? record.title}</strong>
                <ResponseStatus response={result} />
                <span className="review-item-version">
                  {t("{number}차 검토", { number: latest?.number ?? 1 })}
                  {latest?.fileName ? ` · ${latest.fileName}` : ""}
                </span>
              </button>
            );
          })}
          <div className="review-sidebar-note">
            <Icon name="lock" size={15} />
            <p>
              {t(
                "이 요청에 담긴 내용만 공개돼요. 학생의 개인 기록은 공유되지 않아요.",
              )}
            </p>
          </div>
        </aside>
        {!item || !round ? (
          <div className="review-no-item">
            <EmptyState
              title={t("표시할 검토 항목이 없어요")}
              description={t("새로고침한 뒤 다시 확인해 주세요.")}
            />
          </div>
        ) : (
          <div className="review-selected-workspace">
            <div className="review-item-heading">
              <div>
                <span className="meta">
                  {t("항목 {index} / {total}", {
                    index: items.indexOf(item) + 1,
                    total: items.length,
                  })}
                </span>
                <h2>{round.title}</h2>
              </div>
              <div className="review-round-actions">
                <label className="review-round-picker">
                  <span>{t("검토")}</span>
                  <SelectField
                    value={round.id}
                    onChange={(
                      e: ChangeEvent<
                        | HTMLInputElement
                        | HTMLTextAreaElement
                        | HTMLSelectElement
                      >,
                    ) => selectRound(e.target.value)}
                  >
                    {rounds.map((r, index) => (
                      <option key={r.id} value={r.id}>
                        {index === 0
                          ? t("{number}차 검토 · 최신", { number: r.number })
                          : t("{number}차 검토 · 이전", { number: r.number })}
                      </option>
                    ))}
                  </SelectField>
                </label>
                {isOwner && request.status === "shared" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!!busy || !privateResult}
                    onClick={() => {
                      recheckKey.current = uid();
                      setRecheckConfirmed(false);
                      setError("");
                      setRecheckOpen(true);
                    }}
                  >
                    <Icon name="refresh" size={15} />
                    {t("다시 확인 요청")}
                  </Button>
                )}
              </div>
            </div>
            {round.id !== rounds[0]?.id && (
              <div className="review-earlier-note">
                <Icon name="clock" size={16} />
                {t(
                  "{number}차 검토예요. 당시의 설명, 파일, 응답을 그대로 보여 줘요.",
                  { number: round.number },
                )}
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => selectRound(rounds[0].id)}
                >
                  {t("최신 {number}차 검토 열기", { number: rounds[0].number })}
                </Button>
              </div>
            )}
            <Tabs
              className="review-mobile-tabs"
              label={t("검토 영역")}
              value={mobilePanel}
              onChange={(value) => setMobilePanel(value as typeof mobilePanel)}
              options={[
                { value: "document", label: t("수정 내용·파일") },
                { value: "response", label: t("교수 응답·댓글") },
              ]}
            />
            <div className={`review-reading-grid show-${mobilePanel}`}>
              <section
                className="review-document-column"
                aria-label={t("수정 내용과 파일")}
              >
                <article className="review-description-card">
                  <div className="review-description-meta">
                    <StatusBadge tone="neutral">
                      {t("{number}차 검토 · 보낸 당시 내용", {
                        number: round.number,
                      })}
                    </StatusBadge>
                    <time>{timeText(round.createdAt)}</time>
                    {round.createdByName && (
                      <span>
                        {t("{name} · 보냄", { name: round.createdByName })}
                      </span>
                    )}
                  </div>
                  {round.feedbackExcerpt && (
                    <div className="review-source-block">
                      <span>{t("연결된 피드백")}</span>
                      <p>{round.feedbackExcerpt}</p>
                    </div>
                  )}
                  <h3>{t("수정한 내용")}</h3>
                  <p className="review-preserved-description">
                    {round.description}
                  </p>
                  {round.location && (
                    <div className="review-location">
                      <Icon name="eye" size={16} />
                      <span>
                        {t("먼저 볼 위치")}
                        <strong>{round.location}</strong>
                      </span>
                    </div>
                  )}
                </article>
                {version ? (
                  <section
                    className="review-pdf-section"
                    aria-label={t("보낸 당시 파일")}
                  >
                    <div className="review-file-heading">
                      <Icon name="file" size={17} />
                      <strong>{version.fileName}</strong>
                      <span>{t("보낸 당시 파일")}</span>
                    </div>
                    <PdfViewer key={round.id} version={version} />
                    <p className="review-file-note">
                      {t("먼저 볼 위치뿐 아니라 PDF 전체를 볼 수 있어요.")}
                    </p>
                  </section>
                ) : round.versionId ? (
                  <div className="review-missing-file" role="status">
                    <Icon name="file" size={23} />
                    <p>{t("파일 정보를 불러오지 못했어요.")}</p>
                    <Button variant="outline" onClick={() => void refresh()}>
                      {t("다시 불러오기")}
                    </Button>
                  </div>
                ) : (
                  <div className="review-nondocument">
                    <Icon name="file" size={19} />
                    <p>
                      {t("첨부 파일 없이 위의 설명으로 검토하는 항목이에요.")}
                    </p>
                  </div>
                )}
              </section>
              <aside
                className="review-response-column"
                aria-label={t("교수 응답과 댓글")}
              >
                <section className="review-response-card">
                  <div className="section-heading">
                    <h3>{t("교수 응답")}</h3>
                    <ResponseStatus response={response} />
                  </div>
                  {response && (
                    <div className="review-saved-response">
                      <span className="meta">
                        {response.userId === user.id
                          ? t("내가 남긴 응답")
                          : t("교수가 남긴 응답")}{" "}
                        · {timeText(response.updatedAt)}
                      </span>
                      {response.comment && <p>{response.comment}</p>}
                      {response.createdAt !== response.updatedAt && (
                        <span className="review-edited-label">
                          {t("응답 변경됨")}
                        </span>
                      )}
                    </div>
                  )}
                  {/* ‘추가 수정 필요’를 받은 학생이 고칠 곳으로 바로 갑니다(검수 H-1).
                      교수 결과와 학생의 수정 결과 상태는 합치지 않고 길만 이어 줍니다. */}
                  {isOwner &&
                    response?.result === "changes_requested" &&
                    privateResult && (
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to={`/r/${request.researchId}/results/${privateResult.id}`}
                          state={back(request.title)}
                        >
                          {t("수정 결과에서 고치기")}
                          <Icon name="arrow-right" size={14} />
                        </Link>
                      </Button>
                    )}
                  {canRespond ? (
                    <form
                      className="review-response-form"
                      onSubmit={submitResponse}
                    >
                      <fieldset>
                        <legend>
                          {ownResponse
                            ? t("내 응답 변경")
                            : t("이 항목의 검토 결과")}
                        </legend>
                        <label
                          className={`review-response-option ${draft.result === "confirmed" ? "selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`response-${round.id}`}
                            checked={draft.result === "confirmed"}
                            onChange={() =>
                              setResponseDrafts((current) => ({
                                ...current,
                                [round.id]: { ...draft, result: "confirmed" },
                              }))
                            }
                          />
                          <Icon name="check" size={17} />
                          {t("수정 내용 확인")}
                        </label>
                        <label
                          className={`review-response-option ${draft.result === "changes_requested" ? "selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`response-${round.id}`}
                            checked={draft.result === "changes_requested"}
                            onChange={() =>
                              setResponseDrafts((current) => ({
                                ...current,
                                [round.id]: {
                                  ...draft,
                                  result: "changes_requested",
                                },
                              }))
                            }
                          />
                          <Icon name="edit" size={17} />
                          {t("추가 수정 필요")}
                        </label>
                      </fieldset>
                      <Field
                        label={
                          draft.result === "changes_requested"
                            ? t("추가로 수정할 내용")
                            : t("응답 댓글")
                        }
                        required={draft.result === "changes_requested"}
                        error={
                          draft.result === "changes_requested"
                            ? reasonError || undefined
                            : undefined
                        }
                        hint={
                          draft.result === "changes_requested"
                            ? t("무엇을 더 고쳐야 하는지 알려 주세요.")
                            : t("필요할 때만 남겨 주세요.")
                        }
                      >
                        <Textarea
                          ref={reasonInput}
                          aria-label={
                            draft.result === "changes_requested"
                              ? t("추가로 수정할 내용")
                              : t("응답 댓글")
                          }
                          value={draft.comment}
                          maxLength={10000}
                          onChange={(
                            e: ChangeEvent<
                              | HTMLInputElement
                              | HTMLTextAreaElement
                              | HTMLSelectElement
                            >,
                          ) => {
                            setReasonError("");
                            setResponseDrafts((current) => ({
                              ...current,
                              [round.id]: { ...draft, comment: e.target.value },
                            }));
                          }}
                          placeholder={
                            draft.result === "changes_requested"
                              ? t(
                                  "예: 연구 목적에 맞는 비교 기준을 하나 더 보완해 주세요.",
                                )
                              : t("예: 표 2의 출처 표기를 확인했어요.")
                          }
                        />
                      </Field>
                      <Button type="submit" disabled={!!busy || !draft.result}>
                        {busy === "response"
                          ? t("저장 중")
                          : ownResponse
                            ? t("변경 내용 저장")
                            : t("검토 결과 저장")}
                      </Button>
                    </form>
                  ) : (
                    <p className="review-response-help">
                      {isOwner
                        ? t(
                            "교수님 응답은 여기에 보여요. 응답, 댓글, 읽음 표시는 할 일과 피드백 상태를 바꾸지 않아요.",
                          )
                        : isProfessor && canWrite
                          ? t(
                              "이 항목은 {latest}차 검토가 있어 {current}차에는 응답할 수 없어요. 최신 검토에서 결과를 남겨 주세요.",
                              {
                                latest: rounds[0]?.number ?? round.number,
                                current: round.number,
                              },
                            )
                          : t("공유 중일 때 응답할 수 있어요.")}
                    </p>
                  )}
                  {isProfessor && canWrite && response && (
                    <ProfessorProgress
                      pending={items.filter(
                        (record) =>
                          !latestResponse(
                            data,
                            latestRound(data, record.id)?.id,
                          ),
                      )}
                      onNext={selectItem}
                    />
                  )}
                  {response && (
                    <button
                      type="button"
                      className="review-history-button"
                      disabled={!!busy}
                      onClick={loadHistory}
                    >
                      <Icon name="clock" size={14} />
                      {busy === "history"
                        ? t("이력 불러오는 중")
                        : historyOpen
                          ? t("응답 변경 이력 닫기")
                          : t("응답 변경 이력 보기")}
                    </button>
                  )}
                  {historyOpen && (
                    <div className="review-response-history">
                      {!history[round.id]?.length ? (
                        <p className="meta">
                          {t("이 검토에서 응답을 바꾼 기록이 없어요.")}
                        </p>
                      ) : (
                        history[round.id].map((r, index) => (
                          <div key={`${r.id}-${r.updatedAt}-${index}`}>
                            <ResponseStatus response={r} />
                            <time>{timeText(r.updatedAt)}</time>
                            {r.comment && <p>{r.comment}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </section>
                <section className="review-comments-card">
                  <div className="section-heading">
                    <h3>{t("댓글")}</h3>
                    <span className="meta">{comments.length}</span>
                  </div>
                  {!comments.length && (
                    <p className="review-no-comments">
                      {t("아직 댓글이 없어요.")}
                    </p>
                  )}
                  {comments
                    .filter(
                      (r) =>
                        !r.parentId ||
                        !comments.some((parent) => parent.id === r.parentId),
                    )
                    .map((record) => (
                      <CommentThread
                        key={record.id}
                        comment={record}
                        replies={comments.filter(
                          (reply) => reply.parentId === record.id,
                        )}
                        canWrite={canWrite}
                        busy={!!busy}
                        userId={user.id}
                        onReply={(parent) => {
                          setReplyTo((current) => ({
                            ...current,
                            [round.id]: parent,
                          }));
                          setMobilePanel("response");
                        }}
                        onResolve={(id, value) =>
                          void doAction(
                            `resolve-${id}`,
                            () => resolveComment(id, value),
                            value
                              ? t("대화를 해결로 표시했어요.")
                              : t("대화를 다시 열었어요."),
                          )
                        }
                      />
                    ))}
                  {canWrite && (
                    <form
                      className="review-comment-form"
                      onSubmit={submitComment}
                    >
                      {replyTo[round.id] && (
                        <div className="review-reply-target">
                          <span>
                            {t("{name}에게 답글", {
                              name:
                                replyTo[round.id]?.authorName ||
                                t("검토 참여자"),
                            })}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label={t("답글 대상 취소")}
                            onClick={() =>
                              setReplyTo((current) => ({
                                ...current,
                                [round.id]: undefined,
                              }))
                            }
                          >
                            <Icon name="close" size={14} />
                          </Button>
                        </div>
                      )}
                      <label
                        className="sr-only"
                        htmlFor={`comment-${round.id}`}
                      >
                        {t("검토 댓글")}
                      </label>
                      <Textarea
                        id={`comment-${round.id}`}
                        value={commentDrafts[round.id] ?? ""}
                        maxLength={10000}
                        onChange={(
                          e: ChangeEvent<
                            | HTMLInputElement
                            | HTMLTextAreaElement
                            | HTMLSelectElement
                          >,
                        ) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [round.id]: e.target.value,
                          }))
                        }
                        placeholder={
                          isProfessor
                            ? t("예: 그림 2의 범례도 함께 확인해 주세요.")
                            : t("예: 표 제목은 다음 검토 때 함께 고칠게요.")
                        }
                      />
                      <Button
                        type="submit"
                        disabled={!!busy || !commentDrafts[round.id]?.trim()}
                      >
                        {busy === "comment"
                          ? t("저장 중")
                          : replyTo[round.id]
                            ? t("답글 남기기")
                            : t("댓글 남기기")}
                        <Icon name="send" size={15} />
                      </Button>
                    </form>
                  )}
                  <p className="review-comments-help">
                    {t("해결로 표시해도 교수 응답은 바뀌지 않아요.")}
                  </p>
                </section>
                {error && !sharingOpen && !recheckOpen && (
                  <p className="review-form-error" role="alert">
                    {error}
                  </p>
                )}
              </aside>
            </div>
          </div>
        )}
      </div>
      <Dialog
        open={sharingOpen}
        onOpenChange={(value: boolean) => {
          if (!busy) {
            setSharingOpen(value);
            setError("");
          }
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          className="review-settings-dialog"
          disableOutsideClickClose
        >
          <DialogHeader>
            <DialogTitle>{t("공유 설정")}</DialogTitle>
            <DialogDescription>
              {t("지정한 교수 계정만 이 검토를 열 수 있어요.")}
            </DialogDescription>
          </DialogHeader>
          <div className="review-sharing-current">
            <span>{t("현재 공유 상태")}</span>
            <StatusBadge tone={sharingTone[request.status]}>
              {sharingLabels[request.status]}
            </StatusBadge>
          </div>
          <Field
            label={t("교수 계정 이메일")}
            required
            error={emailError || undefined}
          >
            <Input
              ref={emailInput}
              aria-label={t("교수 계정 이메일")}
              type="email"
              value={sharingEmail}
              onChange={(
                e: ChangeEvent<
                  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
                >,
              ) => {
                setEmailError("");
                setSharingEmail(e.target.value);
              }}
            />
          </Field>
          <p className="review-settings-note">
            {t(
              "이메일을 바꾸면 이전 교수님 계정으로는 더 이상 열 수 없어요. 이미 남긴 응답과 댓글은 그대로 남고, 새로 지정한 교수님도 볼 수 있어요.",
            )}
          </p>
          {error && (
            <p className="review-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => setSharingOpen(false)}
            >
              {t("취소")}
            </Button>
            <Button
              disabled={!!busy}
              onClick={() =>
                void saveSharing(
                  request.status === "stopped" ? "stopped" : "shared",
                  true,
                )
              }
            >
              {busy === "sharing" ? t("저장 중") : t("설정 저장")}
            </Button>
          </div>
          <div className="review-sharing-stop">
            <p>
              {request.status === "stopped"
                ? t(
                    "다시 공유하면 위 이메일의 교수 계정이 이 검토를 열 수 있어요.",
                  )
                : t(
                    "공유를 중지하면 교수님은 이 검토를 열 수 없어요. 지금까지의 검토 기록은 그대로 남지만, 이미 내려받은 파일은 회수할 수 없어요.",
                  )}
            </p>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                void saveSharing(
                  request.status === "stopped" ? "shared" : "stopped",
                  request.status === "stopped",
                )
              }
            >
              {request.status === "stopped" ? t("다시 공유") : t("공유 중지")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={recheckOpen}
        onOpenChange={(value: boolean) => {
          if (!busy) {
            setRecheckOpen(value);
            if (!value) recheckKey.current = uid();
            setError("");
          }
        }}
      >
        <DialogContent
          showCloseButton={!busy}
          className="review-recheck-dialog"
          disableOutsideClickClose
        >
          <DialogHeader>
            <DialogTitle>{t("이 항목만 다시 확인을 요청할까요?")}</DialogTitle>
            <DialogDescription>
              {t(
                "{number}차 검토로 새로 요청해요. 이전 검토의 설명, 파일, 응답은 그대로 남고, 다른 항목은 바뀌지 않아요.",
                { number: nextRoundNumber },
              )}
            </DialogDescription>
          </DialogHeader>
          {privateResult ? (
            <>
              <div className="review-preview-item">
                <span className="meta">
                  {t("{number}차 검토에 담길 수정 결과", {
                    number: nextRoundNumber,
                  })}
                </span>
                <h3>{privateResult.title}</h3>
                <p className="review-preserved-description">
                  {privateResult.description || t("수정한 내용이 비어 있어요.")}
                </p>
                {privateVersion && (
                  <div className="review-file-chip">
                    <Icon name="file" size={18} />
                    <span>
                      <strong>{privateVersion.fileName}</strong>
                      <small>
                        v{privateVersion.number} ·{" "}
                        {privateResult.location || t("볼 위치 없음")}
                      </small>
                    </span>
                  </div>
                )}
                {evidenceIssue(privateResult, data) && (
                  <p className="review-evidence-warning">
                    {evidenceIssue(privateResult, data)}
                  </p>
                )}
                <Link
                  className="review-text-link"
                  to={`/r/${request.researchId}/results/${privateResult.id}`}
                  state={back(request.title)}
                >
                  {t("수정 결과에서 고치기")}
                  <Icon name="arrow-right" size={14} />
                </Link>
              </div>
              <label className="review-recheck-confirmation">
                <Checkbox
                  checked={recheckConfirmed}
                  onCheckedChange={(value: boolean) =>
                    setRecheckConfirmed(!!value)
                  }
                />
                <span>
                  {t("설명과 파일 전체가 교수님께 공개되는 것을 확인했어요.")}
                </span>
              </label>
              {error && (
                <p className="review-form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="form-actions">
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => setRecheckOpen(false)}
                >
                  {t("취소")}
                </Button>
                <Button
                  disabled={
                    !!busy ||
                    !recheckConfirmed ||
                    !!evidenceIssue(privateResult, data)
                  }
                  onClick={submitRecheck}
                >
                  {busy === "recheck"
                    ? t("요청하는 중")
                    : t("{number}차 검토 요청", { number: nextRoundNumber })}
                </Button>
              </div>
            </>
          ) : (
            <p className="muted">
              {t("이 항목과 연결된 수정 결과를 찾을 수 없어요.")}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </Root>
  );
}
