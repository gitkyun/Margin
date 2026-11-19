import { BrandMark, BrandWordmark } from "@/components/brand/Brand";
import { useConfirm } from "@/components/ConfirmDialog";
import { Choice } from "@/components/experience";
import { useNavigationGuard } from "@/lib/navigation-guard";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { BackLink, useBackState } from "@/pages/student/shared";
import { useBusyKey } from "@/lib/use-busy-key";
import { numberPins, parsePin } from "./pdf-pin";
import { Checkbox } from "@montage-ui/core";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
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
  PageHeader,
  StatusBadge,
  TextLink,
  useDisabledReason,
} from "@/components/common";
import { SectionBoundary } from "@/components/SectionBoundary";
import { Icon } from "@/components/icons";
import { OverflowActions } from "@/components/OverflowActions";
import {
  PdfViewer,
  type PdfPin,
  type PdfViewerHandle,
} from "@/components/PdfViewer";
import { SlideToConfirm } from "@/components/SlideToConfirm";
import { useMediaQuery } from "@/lib/use-media-query";
import { playCue } from "@/lib/ui-sound";
import { useWorkspace } from "@/lib/workspace";
import {
  uid,
  type ReviewComment,
  type ReviewItem,
  type ReviewResponse,
} from "@/lib/domain";
import {
  ResponseStatus,
  commentAnchor,
  commentLink,
  splitResolvedThreads,
  evidenceIssue,
  errorText,
  latestResponse,
  latestRound,
  sharingLabels,
  sharingTone,
  timeText,
  versionForRound,
} from "./helpers";
import { reviewPermissions } from "@/lib/review-permissions";
import { Tabs } from "@/components/ui/tabs";
import { RequestDirection } from "./RequestDirection";
import { ReviewNotifyBar } from "./ReviewNotifyBar";
import { ColumnResizer } from "./ColumnResizer";
import { useResponseWidth } from "./column-width";
import { firstLine, splitPageReferences } from "./review-text";

/** 맥에서는 ⌘, 그 밖에서는 Ctrl을 안내해요. */
/** 댓글 id → PDF 핀 번호. 댓글 속 위치 표시를 PDF의 같은 번호 배지로 보여 줘요. */
const PinNumberContext = createContext<Map<string, number>>(new Map());

const pinBadgeStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  minWidth: 20,
  height: 20,
  marginRight: 6,
  padding: "0 6px",
  borderRadius: 10,
  background: "var(--brand)",
  color: "var(--semantic-static-white)",
  fontSize: "var(--typography-caption2-fontSize, 11px)",
  fontWeight: 700,
  verticalAlign: "1px",
};

const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * 글 속 페이지 표기(p.4, 4쪽, 4페이지)를 누르면 가운데 PDF가 그 페이지로 가요.
 * 첨부 파일이 없으면 onPage가 없어 그냥 글자로 둡니다.
 */
function WithPageLinks({
  text,
  onPage,
}: {
  text: string;
  onPage?: (page: number) => void;
}): ReactNode {
  if (!onPage) return text;
  return splitPageReferences(text).map((segment, index) =>
    segment.kind === "page" ? (
      <button
        key={index}
        type="button"
        className="review-page-link"
        aria-label={t("{text}, PDF {page}페이지로 이동", {
          text: segment.text,
          page: segment.page,
        })}
        onClick={() => onPage(segment.page)}
      >
        {segment.text}
      </button>
    ) : (
      <Fragment key={index}>{segment.text}</Fragment>
    ),
  );
}

/** 편집 칸·댓글 칸: ⌘Enter(Ctrl+Enter)로 보내기. 한글 조합 중 Enter는 무시해요. */
function submitOnModEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (
    event.key !== "Enter" ||
    !(event.metaKey || event.ctrlKey) ||
    event.nativeEvent.isComposing
  )
    return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

/**
 * 댓글 하나의 ⋯ 메뉴(감사 F6). 링크 복사는 누구나, 편집·삭제는 쓴 사람만 할 수 있어요.
 * 삭제한 댓글에는 링크 복사만 남깁니다.
 */
function CommentMenu({
  comment,
  authorLabel,
  canManage,
  onCopyLink,
  onEdit,
  onDelete,
}: {
  comment: ReviewComment;
  authorLabel: string;
  canManage: boolean;
  onCopyLink: (id: string) => void;
  onEdit: (comment: ReviewComment) => void;
  onDelete: (comment: ReviewComment) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="review-comment-menu"
          aria-label={t("{name}님 댓글 메뉴", { name: authorLabel })}
        >
          <Icon name="more" size={15} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onCopyLink(comment.id)}>
          <Icon name="link" size={16} />
          {t("링크 복사")}
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onSelect={() => onEdit(comment)}>
            <Icon name="edit" size={16} />
            {t("편집")}
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem onSelect={() => onDelete(comment)}>
            <Icon name="trash" size={16} />
            {t("삭제")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 댓글 본문. 삭제한 댓글은 자리만 남기고, 편집 중에는 그 자리에서 고칩니다. */
function CommentBody({
  comment,
  editing,
  busy,
  onSave,
  onCancel,
  onPage,
}: {
  comment: ReviewComment;
  editing: boolean;
  busy: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
  onPage?: (page: number) => void;
}) {
  const hintId = useId();
  const pinNumber = useContext(PinNumberContext).get(comment.id);
  const pin = pinNumber ? parsePin(comment.body) : null;
  const [draft, setDraft] = useState(comment.body);
  useEffect(() => {
    if (editing) setDraft(comment.body);
  }, [editing, comment.body]);
  if (comment.deletedAt)
    return (
      <p className="review-comment-body is-deleted">
        {t("삭제한 댓글이에요.")}
      </p>
    );
  // ‘(수정됨)’은 작성자 줄의 시간 옆에 둬요(CommentThread).
  if (!editing)
    return (
      <p className="review-comment-body">
        {pinNumber && pin ? (
          <>
            <span
              style={pinBadgeStyle}
              aria-label={t("PDF 위치 핀 {number}", { number: pinNumber })}
            >
              {pinNumber}
            </span>
            <WithPageLinks text={`p.${pin.page} ${pin.text}`} onPage={onPage} />
          </>
        ) : (
          <WithPageLinks text={comment.body} onPage={onPage} />
        )}
      </p>
    );
  const body = draft.trim();
  return (
    <form
      className="review-comment-edit"
      onSubmit={(event) => {
        event.preventDefault();
        if (body && body !== comment.body) onSave(body);
        else onCancel();
      }}
    >
      <textarea
        aria-label={t("댓글 편집")}
        value={draft}
        maxLength={10000}
        rows={3}
        autoFocus
        aria-describedby={hintId}
        aria-keyshortcuts={
          IS_MAC ? "Meta+Enter Escape" : "Control+Enter Escape"
        }
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onCancel();
            return;
          }
          submitOnModEnter(event);
        }}
      />
      <div className="review-comment-edit-actions">
        <small id={hintId} className="review-comment-edit-hint">
          {IS_MAC
            ? t("⌘Enter로 저장 · Esc로 취소")
            : t("Ctrl+Enter로 저장 · Esc로 취소")}
        </small>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("취소")}
        </Button>
        <Button type="submit" size="sm" disabled={busy || !body}>
          {t("저장")}
        </Button>
      </div>
    </form>
  );
}

function CommentThread({
  comment,
  replies,
  canWrite,
  busy,
  onReply,
  onResolve,
  onCopyLink,
  onUpdate,
  onDelete,
  onPage,
  userId,
}: {
  comment: ReviewComment;
  replies: ReviewComment[];
  canWrite: boolean;
  busy: boolean;
  onReply: (comment: ReviewComment) => void;
  onResolve: (id: string, value: boolean) => void;
  onCopyLink: (id: string) => void;
  onUpdate: (id: string, body: string) => Promise<boolean>;
  onDelete: (comment: ReviewComment) => void;
  onPage?: (page: number) => void;
  userId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // 작성자 · 시간 · (수정됨)을 한 줄에 맞춰요. 답글도 같은 줄 구조를 써요.
  const authorLine = (value: ReviewComment, reply = false) => (
    <div className="review-comment-author">
      <span
        className={`review-comment-avatar${reply ? " is-reply" : ""}`}
        aria-hidden="true"
      >
        {value.authorName?.slice(0, 1) || t("검")}
      </span>
      <strong>{authorOf(value)}</strong>
      <span className="review-comment-meta">
        <time dateTime={value.createdAt} title={value.createdAt}>
          {timeText(value.createdAt)}
        </time>
        {value.editedAt && !value.deletedAt && (
          <small className="review-comment-edited">{t("(수정됨)")}</small>
        )}
      </span>
      {menuOf(value)}
    </div>
  );
  const authorOf = (value: ReviewComment) =>
    value.authorName || (value.userId === userId ? t("나") : t("검토 참여자"));
  const canManage = (value: ReviewComment) =>
    canWrite && value.userId === userId && !value.deletedAt;
  const menuOf = (value: ReviewComment) => (
    <CommentMenu
      comment={value}
      authorLabel={authorOf(value)}
      canManage={canManage(value)}
      onCopyLink={onCopyLink}
      onEdit={(target) => setEditingId(target.id)}
      onDelete={onDelete}
    />
  );
  const bodyOf = (value: ReviewComment) => (
    <CommentBody
      comment={value}
      editing={editingId === value.id}
      busy={busy}
      onPage={onPage}
      onCancel={() => setEditingId(null)}
      onSave={(body) =>
        void onUpdate(value.id, body).then((saved) => {
          if (saved) setEditingId(null);
        })
      }
    />
  );
  return (
    <article
      id={commentAnchor(comment.id)}
      className={`review-comment-thread ${comment.resolved ? "is-resolved" : ""}`}
    >
      {authorLine(comment)}
      {bodyOf(comment)}
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
        <div
          className="review-comment-reply"
          key={reply.id}
          id={commentAnchor(reply.id)}
        >
          {authorLine(reply, true)}
          {bodyOf(reply)}
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
  const [confirmDialog, askConfirm] = useConfirm();
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
    updateComment,
    deleteComment,
    recheck,
    setSharing,
    markRead,
  } = context;
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
  const permissions = reviewPermissions(data, request, user.id, round);
  const {
    canEditResearch,
    isDesignatedReviewer,
    isDualRole,
    canRead,
    canComment: canWrite,
    canRespondOnLatestRound,
    canRespond,
    canRequestRecheck,
    canManageSharing,
    canShareRequest,
    canEditSourceResult,
  } = permissions;
  const version =
    request && round ? versionForRound(round, request, data) : undefined;
  const [mobilePanel, setMobilePanel] = useState<"document" | "response">(
    "document",
  );
  const pdfViewer = useRef<PdfViewerHandle>(null);
  const responseColumn = useRef<HTMLElement>(null);
  const [pinMode, setPinMode] = useState(false);
  // 1200px 이상에서만 문서 열과 응답 열 사이 경계를 끌어 너비를 바꿔요.
  const resizable = useMediaQuery("(min-width: 1200px)");
  const [responseWidth, setResponseWidth] = useResponseWidth();
  const reduceMotion = useReducedMotion();
  // 댓글·볼 위치의 ‘p.4’를 누르면 가운데 PDF를 그 페이지로 옮겨요. 좁은 화면은 문서 칸으로 바꿔요.
  const jumpToPage = (page: number) => {
    setMobilePanel("document");
    pdfViewer.current?.goToPage(page);
  };
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
  // 해결한 댓글은 접어 두고, 펼친 상태는 차수를 바꾸면 처음으로 돌아가요(감사 F6).
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const scrolledAnchor = useRef("");
  const seen = useRef(new Set<string>());
  const recheckKey = useRef(uid());
  const comments = data.comments
    .filter((r) => r.roundId === round?.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pinNumbers = numberPins(comments);
  const ownResponse = response?.userId === user.id ? response : undefined;
  const draft = round
    ? (responseDrafts[round.id] ?? {
        result: ownResponse?.result ?? "",
        comment: ownResponse?.comment ?? "",
      })
    : { result: "" as const, comment: "" };
  // 이미 남긴 응답은 바꾼 것이 있을 때만 저장할 수 있어요(감사 B2·B4).
  const responseReason = useDisabledReason(
    !busy &&
      (!draft.result
        ? t("검토 결과를 고르면 저장할 수 있어요.")
        : !!ownResponse &&
          draft.result === ownResponse.result &&
          draft.comment.trim() === (ownResponse.comment ?? "").trim() &&
          t("바뀐 내용이 없어요.")),
  );
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
    label: t("교수 응답·댓글"),
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
  // 근거 문제는 창 안의 경고 문장이 알려 주므로 그 문장과 버튼을 잇습니다.
  const recheckIssue = privateResult ? evidenceIssue(privateResult, data) : "";
  const evidenceWarningId = useId();
  const recheckReason = useDisabledReason(
    !busy &&
      !recheckIssue &&
      !recheckConfirmed &&
      t("공개 확인에 체크하면 요청할 수 있어요."),
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
    setResolvedOpen(false);
  }, [round?.id]);
  const commentThreads = comments.filter(
    (r) => !r.parentId || !comments.some((parent) => parent.id === r.parentId),
  );
  const { open: openThreads, resolved: resolvedThreads } =
    splitResolvedThreads(commentThreads);
  const resolvedRegionId = useId();
  const firstResolved = resolvedThreads.find((thread) => !thread.deletedAt);
  const resolvedSummary = firstResolved ? firstLine(firstResolved.body) : "";
  // #comment-<id> 링크로 열면 그 댓글로 내려가요. 해결해서 접힌 댓글이면 먼저 펼쳐요.
  useEffect(() => {
    const anchor = window.location.hash.slice(1);
    if (!anchor || scrolledAnchor.current === anchor) return;
    const target = comments.find((c) => commentAnchor(c.id) === anchor);
    if (!target) return;
    const thread =
      commentThreads.find((c) => c.id === (target.parentId ?? target.id)) ??
      target;
    if (thread.resolved && !resolvedOpen) {
      setResolvedOpen(true);
      return;
    }
    const element = document.getElementById(anchor);
    if (!element) return;
    scrolledAnchor.current = anchor;
    element.scrollIntoView({ block: "center" });
  }, [round?.id, comments.length, resolvedOpen]);
  const copyCommentLink = async (id: string) => {
    try {
      await navigator.clipboard.writeText(
        commentLink(window.location.href, id),
      );
      playCue("copy");
      toast.success(t("댓글 링크를 복사했어요."));
    } catch {
      toast.error(
        t("링크를 복사하지 못했어요. 브라우저 주소창의 링크를 복사해 주세요."),
      );
    }
  };
  const renderThread = (record: ReviewComment) => (
    <CommentThread
      key={record.id}
      comment={record}
      replies={comments.filter((reply) => reply.parentId === record.id)}
      canWrite={canWrite}
      busy={!!busy}
      userId={user.id}
      onReply={(parent) => {
        if (!round) return;
        setReplyTo((current) => ({ ...current, [round.id]: parent }));
        setMobilePanel("response");
      }}
      onResolve={(id, value) =>
        void doAction(
          `resolve-${id}`,
          () => resolveComment(id, value),
          value ? t("대화를 해결로 표시했어요.") : t("대화를 다시 열었어요."),
        )
      }
      onCopyLink={(id) => void copyCommentLink(id)}
      onUpdate={(id, body) =>
        doAction(
          `edit-${id}`,
          () => updateComment(id, body),
          t("댓글을 고쳤어요."),
        )
      }
      onPage={version ? jumpToPage : undefined}
      onDelete={(target) =>
        void askConfirm({
          title: t("이 댓글을 삭제할까요?"),
          description: t(
            "삭제하면 되돌릴 수 없어요. 답글이 있으면 자리는 남고 내용만 가려져요.",
          ),
          confirmLabel: t("삭제"),
          destructive: true,
        }).then((ok) => {
          if (ok)
            void doAction(
              `delete-${target.id}`,
              () => deleteComment(target.id),
              t("댓글을 삭제했어요."),
            );
        })
      }
    />
  );
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
      playCue("copy");
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
    if (!request || !canManageSharing) return;
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
    if (
      !request ||
      !item ||
      !privateResult ||
      !recheckConfirmed ||
      !canRequestRecheck
    )
      return;
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
  const openSharing = () => {
    setSharingEmail(request.professorEmail);
    setError("");
    setEmailError("");
    setSharingOpen(true);
  };
  const openRecheck = () => {
    recheckKey.current = uid();
    setRecheckConfirmed(false);
    setError("");
    setRecheckOpen(true);
  };
  // 공동연구자이면서 지정 교수인 경우, 주 흐름은 검토 응답에 두고 기존 연구 관리 동작은 보조 메뉴에 모읍니다.
  const researchManageMenu = isDualRole ? (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          type="button"
          variant="outline"
          aria-label={t("연구 관리 메뉴")}
        >
          <Icon name="more" size={16} />
          {t("연구 관리")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canManageSharing && (
          <DropdownMenuItem onSelect={openSharing}>
            <Icon name="settings" size={16} />
            {t("공유 설정")}
          </DropdownMenuItem>
        )}
        {canShareRequest && (
          <DropdownMenuItem onSelect={() => void copyLink()}>
            <Icon name="link" size={16} />
            {t("링크 복사")}
          </DropdownMenuItem>
        )}
        {canRequestRecheck && privateResult && (
          <DropdownMenuItem
            onSelect={() => {
              if (!busy) openRecheck();
            }}
          >
            <Icon name="refresh" size={16} />
            {t("다시 확인 요청")}
          </DropdownMenuItem>
        )}
        {canEditSourceResult && privateResult && (
          <DropdownMenuItem
            onSelect={() =>
              navigate(`/r/${request.researchId}/results/${privateResult.id}`, {
                state: back(request.title),
              })
            }
          >
            <Icon name="edit" size={16} />
            {t("수정 결과에서 고치기")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  const sharedLine = (
    <>
      {canEditResearch && !isDesignatedReviewer
        ? t("{email}에게 공유", { email: request.professorEmail })
        : t("학생이 보낸 수정 내용")}{" "}
      · {timeText(request.createdAt)}
    </>
  );
  const sharingBadge = (
    <StatusBadge tone={sharingTone[request.status]}>
      {sharingLabels[request.status]}
    </StatusBadge>
  );
  const Root = embedded ? "div" : "main";
  const workspace = (
    <Root className={`review-workspace${embedded ? " is-embedded" : ""}`}>
      {!embedded && (
        <header className="review-workspace-header">
          <div className="review-header-left">
            <Link
              className="review-brand"
              to={canEditResearch ? `/r/${request.researchId}/reviews` : "/r"}
              aria-label={
                canEditResearch
                  ? t("마진(Margin) 검토 요청 목록으로 돌아가기")
                  : t("마진(Margin) 홈")
              }
            >
              {canEditResearch && <Icon name="arrow-left" size={21} />}
              <BrandMark />
              <BrandWordmark />
            </Link>
            <span className="review-header-divider" />
            <div>
              {/* 교수는 받은 검토 요청 목록(/r)으로 바로 돌아가요(감사 F5·F6). */}
              {isDesignatedReviewer && (
                <TextLink className="review-back-link" to="/r">
                  <Icon name="arrow-left" size={14} />
                  {t("받은 검토 요청")}
                </TextLink>
              )}
              <h1>{request.title}</h1>
              <p>{sharedLine}</p>
            </div>
            {sharingBadge}
          </div>
          <div className="review-header-actions">
            <OverflowActions
              moreLabel={t("더보기")}
              secondary={[
                {
                  id: "refresh",
                  label: t("새로고침"),
                  icon: "refresh",
                  disabled: !!busy,
                  onSelect: () => void refresh(),
                },
                ...(canManageSharing && !isDualRole
                  ? [
                      {
                        id: "sharing",
                        label: t("공유 설정"),
                        icon: "settings",
                        onSelect: openSharing,
                      },
                    ]
                  : []),
              ]}
              primary={
                canShareRequest && !isDualRole
                  ? [
                      {
                        id: "copy-link",
                        label: t("링크 복사"),
                        icon: "link",
                        onSelect: copyLink,
                      },
                    ]
                  : []
              }
            />
            {researchManageMenu}
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
          </div>
        </header>
      )}
      {/* 셸 안에서는 셸의 미리보기 띠가 이미 있어 두 겹이 되지 않게 합니다. */}
      {mode === "preview" && !embedded && (
        <div className="review-preview-banner">
          <Icon name="info" size={15} />
          {t(
            "로컬 미리보기예요. 서버 연결 전이라 교수 계정으로 열거나 응답할 수 없어요.",
          )}
        </div>
      )}
      {canShareRequest && !isDesignatedReviewer && request.status === "shared" && (
        <ReviewNotifyBar
          requestId={request.id}
          requestTitle={request.title}
          professorEmail={request.professorEmail}
          status={request.status}
          preview={mode === "preview"}
        />
      )}
      {request.status === "stopped" && (
        <div className="review-stopped-banner">
          <Icon name="lock" size={16} />
          {t(
            "공유를 중지한 검토예요. 교수님은 열 수 없고, 지금까지의 검토 기록은 그대로 남아요.",
          )}
        </div>
      )}
      {!canEditResearch && (
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
                <span className="review-badge-fit">
                  <ResponseStatus response={result} />
                </span>
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
                {/* 옆 버튼과 같은 높이(40)가 되도록 medium 선택 상자를 씁니다. */}
                <div className="review-round-picker">
                  <span aria-hidden="true">{t("검토")}</span>
                  <Choice
                    size="medium"
                    label={t("검토")}
                    value={round.id}
                    onChange={selectRound}
                    options={rounds.map((r, index) => ({
                      value: r.id,
                      label:
                        index === 0
                          ? t("{number}차 검토 · 최신", { number: r.number })
                          : t("{number}차 검토 · 이전", { number: r.number }),
                    }))}
                  />
                </div>
                {canRequestRecheck && !isDualRole && (
                  <Button
                    variant="outline"
                    disabled={!!busy || !privateResult}
                    onClick={openRecheck}
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
                  {t("최신 {number}차 검토 열기", {
                    number: rounds[0].number,
                  })}
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
            <div
              className={`review-reading-grid show-${mobilePanel}${resizable ? " is-resizable" : ""}`}
              style={
                resizable && responseWidth
                  ? ({
                      "--review-response-width": `${responseWidth}px`,
                    } as CSSProperties)
                  : undefined
              }
            >
              <section
                className="review-document-column"
                aria-label={t("수정 내용과 파일")}
              >
                <article className="review-description-card">
                  <div className="review-description-meta">
                    <span className="review-badge-fit">
                      <StatusBadge tone="neutral">
                        {t("{number}차 검토 · 보낸 당시 내용", {
                          number: round.number,
                        })}
                      </StatusBadge>
                    </span>
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
                        <strong>
                          <WithPageLinks
                            text={round.location}
                            onPage={version ? jumpToPage : undefined}
                          />
                        </strong>
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
                    <SectionBoundary resetKeys={[round.id]}>
                      <PdfViewer
                        key={round.id}
                        ref={pdfViewer}
                        version={version}
                        pins={comments.flatMap((c): PdfPin[] => {
                          const number = pinNumbers.get(c.id),
                            pin = parsePin(c.body);
                          if (!number || !pin) return [];
                          return [
                            {
                              id: c.id,
                              number,
                              page: pin.page,
                              x: pin.x,
                              y: pin.y,
                              label: pin.text || c.body,
                            },
                          ];
                        })}
                        pinMode={pinMode && canWrite}
                        onDropPin={(pin) => {
                          const marker = `[p.${pin.page} @ ${pin.x}%,${pin.y}%] `;
                          setCommentDrafts((current) => ({
                            ...current,
                            [round.id]: `${marker}${current[round.id] ?? ""}`,
                          }));
                          setPinMode(false);
                          setMobilePanel("response");
                        }}
                        onSelectPin={(id) => {
                          setMobilePanel("response");
                          document
                            .getElementById(commentAnchor(id))
                            ?.scrollIntoView({
                              block: "center",
                              behavior: "smooth",
                            });
                        }}
                      />
                    </SectionBoundary>
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
              {resizable && (
                <ColumnResizer
                  width={responseWidth}
                  onChange={setResponseWidth}
                  currentWidth={() =>
                    responseColumn.current?.getBoundingClientRect().width ?? 340
                  }
                />
              )}
              <aside
                ref={responseColumn}
                className="review-response-column"
                aria-label={t("교수 응답과 댓글")}
              >
                <section className="review-response-card">
                  <div className="section-heading">
                    <h3>{t("교수 응답")}</h3>
                    <span className="review-badge-fit">
                      <ResponseStatus response={response} />
                    </span>
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
                  {canEditSourceResult &&
                    !isDualRole &&
                    response?.result === "changes_requested" &&
                    privateResult && (
                      <span className="review-fit-button">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            to={`/r/${request.researchId}/results/${privateResult.id}`}
                            state={back(request.title)}
                          >
                            {t("수정 결과에서 고치기")}
                            <Icon name="arrow-right" size={14} />
                          </Link>
                        </Button>
                      </span>
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
                            : t("이 항목에 대한 응답")}
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
                              [round.id]: {
                                ...draft,
                                comment: e.target.value,
                              },
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
                      {/* 이미 남긴 응답은 바꾼 것이 있을 때만 저장할 수 있어요. */}
                      <Button
                        type="submit"
                        disabled={
                          !!busy ||
                          !draft.result ||
                          (!!ownResponse &&
                            draft.result === ownResponse.result &&
                            draft.comment.trim() ===
                              (ownResponse.comment ?? "").trim())
                        }
                        aria-describedby={responseReason.describedBy}
                      >
                        {busy === "response"
                          ? t("저장 중")
                          : ownResponse
                            ? t("변경 내용 저장")
                            : t("응답 저장")}
                      </Button>
                      {responseReason.node}
                    </form>
                  ) : (
                    <p className="review-response-help">
                      {isDesignatedReviewer
                        ? canRespondOnLatestRound
                          ? t(
                              "이 항목은 {latest}차 검토가 있어 {current}차에는 응답할 수 없어요. 최신 검토에서 결과를 남겨 주세요.",
                              {
                                latest: rounds[0]?.number ?? round.number,
                                current: round.number,
                              },
                            )
                          : t("공유 중일 때 응답할 수 있어요.")
                        : canEditResearch
                          ? t("교수님 응답은 여기에 보여요.")
                          : t("공유 중일 때 응답할 수 있어요.")}
                    </p>
                  )}
                  {canRespondOnLatestRound && response && (
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
                  {openThreads.map((record) => renderThread(record))}
                  {!!resolvedThreads.length && (
                    <button
                      type="button"
                      className="review-resolved-toggle"
                      aria-expanded={resolvedOpen}
                      aria-controls={resolvedRegionId}
                      onClick={() => setResolvedOpen((value) => !value)}
                    >
                      <Icon
                        name="chevron-right"
                        size={14}
                        className="review-resolved-chevron"
                      />
                      <span className="review-resolved-title">
                        {t("해결한 댓글 {count}개", {
                          count: resolvedThreads.length,
                        })}
                      </span>
                      {/* 접혀 있어도 몇 차 검토의 어떤 대화인지 알 수 있게 첫 줄을 남겨요. */}
                      <span className="review-resolved-summary">
                        {resolvedSummary
                          ? t("{number}차 검토 · {line}", {
                              number: round.number,
                              line: resolvedSummary,
                            })
                          : t("{number}차 검토", { number: round.number })}
                      </span>
                    </button>
                  )}
                  <AnimatePresence initial={false}>
                    {resolvedOpen && (
                      <motion.div
                        key="resolved"
                        id={resolvedRegionId}
                        className="review-resolved-region"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.2,
                          ease: [0.2, 0, 0, 1],
                        }}
                      >
                        {resolvedThreads.map((record) => renderThread(record))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {canWrite && (
                    <form
                      className="review-comment-form"
                      onSubmit={submitComment}
                    >
                      {version && (
                        <div className="review-pin-bar">
                          <Button
                            type="button"
                            size="sm"
                            variant={pinMode ? "default" : "outline"}
                            aria-pressed={pinMode}
                            onClick={() => {
                              setPinMode((v) => !v);
                              if (!pinMode) setMobilePanel("document");
                            }}
                          >
                            <Icon name="flag" size={14} />
                            {pinMode
                              ? t("PDF에서 위치를 누르세요")
                              : t("PDF 위치 핀 찍기")}
                          </Button>
                        </div>
                      )}
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
                        onKeyDown={submitOnModEnter}
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
                          isDesignatedReviewer
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
          <DialogBody>
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
              {request.status === "stopped" ? (
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => void saveSharing("shared", true)}
                >
                  {t("다시 공유")}
                </Button>
              ) : (
                // 실수로 누르지 않게 끝까지 밀어야 공유를 멈춰요.
                <SlideToConfirm
                  label={t("밀어서 공유 중지")}
                  confirmLabel={t("공유를 중지하는 중")}
                  tone="danger"
                  disabled={!!busy}
                  onConfirm={() => saveSharing("stopped", false)}
                />
              )}
            </div>
          </DialogBody>
          <DialogFooter>
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
          </DialogFooter>
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
              <DialogBody>
                <div className="review-preview-item">
                  <span className="meta">
                    {t("{number}차 검토에 담길 수정 결과", {
                      number: nextRoundNumber,
                    })}
                  </span>
                  <h3>{privateResult.title}</h3>
                  <p className="review-preserved-description">
                    {privateResult.description ||
                      t("수정한 내용이 비어 있어요.")}
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
                  {recheckIssue && (
                    <p
                      id={evidenceWarningId}
                      className="review-evidence-warning"
                    >
                      {recheckIssue}
                    </p>
                  )}
                  <TextLink
                    to={`/r/${request.researchId}/results/${privateResult.id}`}
                    state={back(request.title)}
                  >
                    {t("수정 결과에서 고치기")}
                    <Icon name="arrow-right" size={14} />
                  </TextLink>
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
                {recheckReason.node}
              </DialogBody>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => setRecheckOpen(false)}
                >
                  {t("취소")}
                </Button>
                <Button
                  disabled={!!busy || !recheckConfirmed || !!recheckIssue}
                  aria-describedby={
                    recheckIssue ? evidenceWarningId : recheckReason.describedBy
                  }
                  onClick={submitRecheck}
                >
                  {busy === "recheck"
                    ? t("요청하는 중")
                    : t("{number}차 검토 요청", { number: nextRoundNumber })}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <p className="muted">
              {t("이 항목과 연결된 수정 결과를 찾을 수 없어요.")}
            </p>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </Root>
  );
  return (
    <PinNumberContext value={pinNumbers}>
      {embedded ? (
        // 셸 안에서는 다른 상세 화면과 같은 머리(PageHeader)를 쓰고, 그 아래에 검토 작업 영역을 둡니다.
        <div className="review-embedded">
          <PageHeader
            back={
              <BackLink to={`/r/${request.researchId}/reviews`}>
                {t("검토 요청 목록")}
              </BackLink>
            }
            title={request.title}
            status={sharingBadge}
            description={sharedLine}
            actions={
              <>
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => void refresh()}
                >
                  <Icon name="refresh" size={16} />
                  {t("새로고침")}
                </Button>
                {isDualRole ? (
                  researchManageMenu
                ) : (
                  <>
                    {canManageSharing && (
                      <Button variant="outline" onClick={openSharing}>
                        <Icon name="settings" size={16} />
                        {t("공유 설정")}
                      </Button>
                    )}
                    {canShareRequest && (
                      <Button onClick={copyLink}>
                        <Icon name="link" size={16} />
                        {t("링크 복사")}
                      </Button>
                    )}
                  </>
                )}
              </>
            }
          />
          {workspace}
        </div>
      ) : (
        workspace
      )}
    </PinNumberContext>
  );
}
