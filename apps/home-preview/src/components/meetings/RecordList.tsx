import { t } from "@/lib/i18n";
import { useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/lib/workspace";
import { toast } from "sonner";
import { friendlyError } from "@/lib/supabase";
import { useOptionalRecorder } from "@/components/recording/RecordingProvider";
import { seoulToday, selectNextMeeting } from "@/lib/home-meeting";
import { koreanScore } from "@/lib/hangul-search";
import { formatClock } from "@/lib/time-format";
import { formatDate, type Meeting } from "@/lib/domain";
import { unreadReviewNotifications } from "@/lib/notifications";
import {
  recordGroups,
  type RecordFilter,
  type RecordGroup,
  type RecordRow,
} from "@/lib/record-view";
import { useNavigate } from "react-router-dom";
import { Segments } from "@/components/experience";
import { parseReviewShare, reviewMatchesShare } from "@/lib/results-section";
import { ResultsSection } from "./ResultsSection";
import "./record-list.css";

const FILTERS: RecordFilter[] = ["all", "open", "written", "review", "poll"];

const SOURCE_LABELS: Record<string, string> = {
  kakao: t("카톡"),
  email: t("메일"),
  doc_comment: t("문서 댓글"),
  note: t("메모"),
  file: t("파일"),
  other: t("기타"),
};

function filterLabel(filter: RecordFilter): string {
  return {
    all: t("전체"),
    open: t("남은 할 일 있는 기록"),
    written: t("서면 피드백"),
    review: t("검토 요청"),
    poll: t("시간 조율"),
  }[filter];
}

function groupLabel(group: RecordGroup, today: string): string {
  switch (group.label.kind) {
    case "now":
      return t("지금");
    case "upcoming":
      return t("예정");
    case "polls-past":
      return t("지난 조율");
    case "month": {
      const [year, month] = (group.label.month ?? "").split("-").map(Number);
      return year && year !== Number(today.slice(0, 4))
        ? t("{year}년 {month}월", { year, month })
        : t("{month}월", { month });
    }
  }
}

/**
 * 미팅 화면의 기록 목록(IA v2 04 §2). 미팅·서면 피드백·검토 요청·시간 조율이 한 목록에 모입니다.
 * 묶음과 순서는 `lib/record-view.ts`(08 §4.2).
 */
export function RecordList({
  onImport,
}: {
  /** 파일에서 가져오기(04 §7.3). 고른 파일을 미팅 화면에 넘깁니다. */
  onImport?(file: File): void;
} = {}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { researchId = "", meetingId } = useParams();
  const { data, user, save, remove } = useWorkspace();
  const recorder = useOptionalRecorder();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const today = seoulToday();
  const raw = params.get("type") as RecordFilter | null;
  const filter: RecordFilter = raw && FILTERS.includes(raw) ? raw : "all";
  const query = params.get("q") ?? "";
  const showCancelled = params.get("cancelled") === "1";
  const showArchived = params.get("archived") === "1";
  const archived = data.meetings
    .filter((item) => item.researchId === researchId && item.archivedAt)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const base = `/r/${researchId}`;
  const research = data.researches.find((item) => item.id === researchId);
  const next = selectNextMeeting(
    data.meetings.filter((item) => item.researchId === researchId),
    research?.nextMeetingId,
  );
  const unread = new Set(
    unreadReviewNotifications(data, user, researchId).map(
      (event) => event.requestId,
    ),
  );
  const recordingId =
    recorder?.session?.researchId === researchId &&
    (recorder.state === "recording" || recorder.state === "paused")
      ? recorder.session.meetingId
      : null;
  // 검토 보기의 검토 요청 줄 보조 필터(04 §2.4): 전체 | 공유 중 | 공유 중지
  const share = parseReviewShare(params.get("share"));
  const allGroups = recordGroups({
    researchId,
    today,
    meetings: data.meetings,
    reviews: data.reviews,
    polls: data.polls,
    feedback: data.feedback,
    decisions: data.decisions,
    questions: data.questions,
    tasks: data.tasks,
    recordingId,
    filter,
    query,
    showCancelled,
    matches: (text, q) => koreanScore(text, q) > 0,
  });
  const groups =
    filter === "review" && share !== "all"
      ? allGroups
          .map((group) => ({
            ...group,
            rows: group.rows.filter(
              (row) =>
                row.kind !== "review" || reviewMatchesShare(row.review, share),
            ),
          }))
          .filter((group) => group.rows.length > 0)
      : allGroups;

  async function archive(meeting: Meeting) {
    try {
      await remove("meetings", meeting.id);
      if (meeting.id === meetingId) navigate(`${base}/meetings`);
      toast.success(t("보관했어요."), {
        duration: 6000,
        action: {
          label: t("되돌리기"),
          onClick: () => void restore(meeting),
        },
      });
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }
  async function restore(meeting: Meeting) {
    try {
      const current =
        data.meetings.find((item) => item.id === meeting.id) ?? meeting;
      await save("meetings", { ...current, archivedAt: undefined });
      toast.success(t("복원했어요."));
    } catch (error) {
      toast.error(friendlyError(error));
    }
  }

  function set(key: string, value: string | null) {
    const rest = new URLSearchParams(params);
    if (value) rest.set(key, value);
    else rest.delete(key);
    setParams(rest, { replace: true });
  }

  return (
    <nav className="record-list" aria-label={t("기록 목록")}>
      <div className="record-list-top">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="outline" size="sm" className="record-list-add">
              <Icon name="plus" size={16} />
              {t("기록 추가")}
              <Icon name="chevron-down" size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => navigate(`${base}/meetings?new=1&intent=record`)}
            >
              <Icon name="mic" size={16} />
              {t("녹음 시작")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate(`${base}/meetings?new=written`)}
            >
              <Icon name="file" size={16} />
              {t("서면 피드백 붙여넣기")}
            </DropdownMenuItem>
            {onImport && (
              <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
                <Icon name="upload" size={16} />
                {t("파일에서 가져오기")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => navigate(`${base}/meetings?new=1`)}
            >
              <Icon name="calendar" size={16} />
              {t("다음 미팅 잡기")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate("?type=review&new=review")}
            >
              <Icon name="send" size={16} />
              {t("교수님께 검토 요청")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate(`${base}/flow?tab=schedule`)}
            >
              <Icon name="clock" size={16} />
              {t("시간 조율")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.md,text/plain,text/markdown"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onImport?.(file);
          }}
        />
        <input
          className="record-list-search"
          type="search"
          value={query}
          aria-label={t("기록에서 찾기")}
          placeholder={t("기록에서 찾기")}
          onChange={(event) => set("q", event.target.value || null)}
        />
        <div className="record-list-filter">
          <select
            value={filter}
            aria-label={t("기록 보기")}
            onChange={(event) =>
              set(
                "type",
                event.target.value === "all" ? null : event.target.value,
              )
            }
          >
            {FILTERS.map((value) => (
              <option key={value} value={value}>
                {filterLabel(value)}
                {value === "review" && unread.size > 0 ? " •" : ""}
              </option>
            ))}
          </select>
          {filter !== "all" && (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("보기 끄기")}
              onClick={() => set("type", null)}
            >
              <Icon name="close" size={14} />
            </Button>
          )}
        </div>
      </div>
      {showArchived ? (
        <div className="record-list-groups">
          <section aria-label={t("보관한 기록")}>
            <div className="record-list-archived-head">
              <h3>{t("보관한 기록")}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => set("archived", null)}
              >
                {t("목록으로")}
              </Button>
            </div>
            <ul>
              {archived.map((meeting) => (
                <li key={meeting.id} className="record-line-row">
                  <span className="record-line">
                    <Icon
                      name={
                        meeting.recordType === "written" ? "file" : "calendar"
                      }
                      size={16}
                    />
                    <span className="record-line-copy">
                      <strong>{meeting.title}</strong>
                      <small>{formatDate(meeting.date)}</small>
                    </span>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void restore(meeting)}
                  >
                    {t("복원")}
                  </Button>
                </li>
              ))}
            </ul>
            {!archived.length && (
              <p className="record-list-empty">{t("보관한 기록이 없어요.")}</p>
            )}
          </section>
        </div>
      ) : (
        <div className="record-list-groups">
          {filter === "review" && (
            <>
              <ResultsSection researchId={researchId} />
              <Segments
                value={share}
                onChange={(value) =>
                  set("share", value === "all" ? null : value)
                }
                label={t("검토 요청 보기")}
                size="small"
                fill
                options={[
                  { value: "all", label: t("전체") },
                  { value: "shared", label: t("공유 중") },
                  { value: "stopped", label: t("공유 중지") },
                ]}
              />
            </>
          )}
          {groups.map((group) => (
            <section key={group.key} aria-label={groupLabel(group, today)}>
              <h3>{groupLabel(group, today)}</h3>
              <ul>
                {group.rows.map((row) => (
                  <li key={`${row.kind}:${row.id}`} className="record-line-row">
                    <RecordLine
                      row={row}
                      base={base}
                      selected={row.kind === "meeting" && row.id === meetingId}
                      isNext={row.kind === "meeting" && row.id === next?.id}
                      unread={row.kind === "review" && unread.has(row.id)}
                      data={data}
                    />
                    {row.kind === "meeting" && (
                      <RowMenu
                        meeting={row.meeting}
                        href={`${base}/meetings/${row.meeting.id}`}
                        onOpen={() =>
                          navigate(`${base}/meetings/${row.meeting.id}`)
                        }
                        onEdit={() =>
                          navigate(
                            `${base}/meetings/${row.meeting.id}?edit=info`,
                          )
                        }
                        onArchive={() => void archive(row.meeting)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!groups.length && (
            <p className="record-list-empty">
              {query || filter !== "all"
                ? t("조건에 맞는 기록이 없어요.")
                : t("아직 기록이 없어요.")}
            </p>
          )}
        </div>
      )}
      {!showArchived && archived.length > 0 && (
        <button
          type="button"
          className="record-list-archived"
          onClick={() => set("archived", "1")}
        >
          {t("보관한 기록 {count}개", { count: archived.length })}
        </button>
      )}
      <label className="record-list-cancelled">
        <input
          type="checkbox"
          checked={showCancelled}
          onChange={(event) =>
            set("cancelled", event.target.checked ? "1" : null)
          }
        />
        {t("취소한 미팅 보기")}
      </label>
    </nav>
  );
}

function RecordLine({
  row,
  base,
  selected,
  isNext,
  unread,
  data,
}: {
  row: RecordRow;
  base: string;
  selected: boolean;
  isNext: boolean;
  unread: boolean;
  data: ReturnType<typeof useWorkspace>["data"];
}) {
  if (row.kind === "review") {
    const items = data.reviewItems.filter(
      (item) => item.requestId === row.review.id,
    );
    const rounds = data.rounds.filter((round) =>
      items.some((item) => item.id === round.itemId),
    );
    const answered = items.filter((item) =>
      rounds.some(
        (round) =>
          round.itemId === item.id &&
          data.responses.some((response) => response.roundId === round.id),
      ),
    ).length;
    const state =
      row.review.status === "stopped"
        ? t("공유 중지")
        : row.review.status === "draft"
          ? t("초안")
          : t("공유 중 · 응답 {answered}/{total}", {
              answered,
              total: items.length,
            });
    return (
      <Link className="record-line" to={`/reviews/${row.review.id}`}>
        <Icon name="check-circle" size={16} />
        <span className="record-line-copy">
          <strong>{row.review.title}</strong>
          <small>
            {formatDate(row.review.createdAt.slice(0, 10))} · {state}
          </small>
        </span>
        {unread && (
          <span
            className="record-line-dot"
            role="img"
            aria-label={t("안 읽은 응답")}
          />
        )}
      </Link>
    );
  }
  if (row.kind === "poll") {
    const answered = row.poll.participants.filter(
      (person) => person.available.length > 0,
    ).length;
    return (
      <Link className="record-line" to={`/schedule/${row.poll.id}`}>
        <Icon name="clock" size={16} />
        <span className="record-line-copy">
          <strong>{row.poll.title}</strong>
          <small>
            {row.poll.status === "open"
              ? t("조율 중 · {total}명 중 {answered}명 응답", {
                  total: row.poll.participants.length,
                  answered,
                })
              : row.poll.status === "confirmed"
                ? t("확정")
                : t("취소")}
          </small>
        </span>
      </Link>
    );
  }
  const { meeting, state, remaining } = row;
  const written = meeting.recordType === "written";
  const hasRecording = data.recordings.some(
    (recording) => recording.meetingId === meeting.id,
  );
  const date = formatDate(meeting.date);
  const sub =
    state === "recording"
      ? t("지금 녹음 중")
      : state === "cancelled"
        ? t("{date} · 취소", { date })
        : state === "unrecorded"
          ? t("{date} · 기록 없음", { date })
          : state === "preparing"
            ? meeting.date
              ? t("{date} · 준비 중", {
                  date: `${date}${meeting.time ? ` ${formatClock(meeting.time)}` : ""}`,
                })
              : t("날짜 미정 · 준비 중")
            : written
              ? `${date} · ${SOURCE_LABELS[meeting.sourceLabel ?? "other"] ?? t("서면 피드백")}`
              : `${date} · ${hasRecording ? t("녹음") : t("메모")}`;
  const icon =
    state === "recording"
      ? null
      : written
        ? "file"
        : state === "recorded"
          ? hasRecording
            ? "mic"
            : "edit"
          : "calendar";
  return (
    <Link
      className={`record-line ${state === "cancelled" ? "is-cancelled" : ""}`}
      to={`${base}/meetings/${meeting.id}`}
      aria-current={selected ? "page" : undefined}
    >
      {icon ? (
        <Icon name={icon} size={16} />
      ) : (
        <span className="record-line-live" aria-hidden="true" />
      )}
      <span className="record-line-copy">
        <strong>{meeting.title}</strong>
        <small>{sub}</small>
      </span>
      {isNext && <span className="record-line-tag">{t("다음")}</span>}
      {remaining > 0 && state === "recorded" && (
        <span
          className="record-line-count"
          aria-label={t("남은 할 일 {count}개", { count: remaining })}
        >
          {remaining}
        </span>
      )}
    </Link>
  );
}

/** 줄 메뉴(04 §2.2): 열기 / 새 탭에서 열기 / 기록 정보 편집 / 보관 */
function RowMenu({
  meeting,
  href,
  onOpen,
  onEdit,
  onArchive,
}: {
  meeting: Meeting;
  href: string;
  onOpen(): void;
  onEdit(): void;
  onArchive(): void;
}) {
  return (
    <span className="record-line-menu">
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("{title} 메뉴", { title: meeting.title })}
          >
            <Icon name="more" size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onOpen}>{t("열기")}</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => window.open(href, "_blank", "noopener")}
          >
            {t("새 탭에서 열기")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEdit}>
            {t("기록 정보 편집")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onArchive}>{t("보관")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
