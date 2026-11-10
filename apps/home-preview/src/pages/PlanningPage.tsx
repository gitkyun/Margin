import { dateLocale } from "@/lib/i18n";
import { timeParts } from "@/lib/time-format";
import themePlugin from "@fullcalendar/react/themes/forma";
import { Input } from "@/components/ui/input";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/forma/theme.css";
import { lazy, Suspense, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import listPlugin from "@fullcalendar/react/list";
import interactionPlugin from "@fullcalendar/react/interaction";
import koLocale from "@fullcalendar/react/locales/ko";
import { toast } from "sonner";
import { useExperience } from "@/lib/experience";
import {
  formatDate,
  recordBase,
  phaseTitles,
  uid,
  type ResearchPhase,
  type Milestone,
  type MeetingPoll,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
} from "@/components/common";
import { Choice, Segments } from "@/components/experience";
import { Tabs } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@montage-ui/core";
import { DateField, DateTimeField } from "@/components/ui/date-field";

/**
 * 캘린더 일정 색. FullCalendar v7은 color 하나로 막대·옅은 바탕을 만들고,
 * contrastColor를 채운 막대 위 글자색으로 씁니다.
 * 미팅=브랜드, 할 일 마감=주의(주황), 단계 목표=보라, 주요 목표=완료(초록).
 */
type EventTone = "brand" | "cautionary" | "violet" | "positive";
const EVENT_TONE: Record<EventTone, string> = {
  brand: "--semantic-foreground-brand-primary",
  cautionary: "--semantic-foreground-cautionary-primary",
  violet: "--semantic-foreground-accent-violet",
  positive: "--semantic-foreground-positive-primary",
};
function eventTone(tone: EventTone) {
  const token = EVENT_TONE[tone];
  return {
    color: `var(${token})`,
    contrastColor: "var(--semantic-static-white)",
  };
}

const Diagram = lazy(() => import("./RoadmapDiagram"));
export function PlanningPage() {
  const { researchId = "" } = useParams(),
    w = useExperience(),
    { data, save, saveResearch } = w,
    navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "roadmap";
  const [view, setView] = useState("timeline"),
    [phase, setPhase] = useState<ResearchPhase | null>(null),
    [milestone, setMilestone] = useState<Milestone | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pollOpen, setPollOpen] = useState(false);
  const research = data.researches.find((r) => r.id === researchId)!,
    phases = data.phases
      .filter((p) => p.researchId === researchId && !p.archivedAt)
      .sort((a, b) => a.order - b.order),
    milestones = data.milestones
      .filter((m) => m.researchId === researchId && !m.archivedAt)
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    meetings = data.meetings.filter(
      (m) =>
        m.researchId === researchId &&
        !m.archivedAt &&
        m.status !== "cancelled",
    ),
    polls = data.polls.filter((p) => p.researchId === researchId);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function newPhase() {
    setPhase({
      ...recordBase(researchId),
      title: "",
      order: phases.length,
      status: "planned",
      dependsOn: [],
      dueDate: null,
      visibility: "shared",
    });
  }
  return (
    <div className="experience-page">
      <PageHeader
        title="계획·일정"
        description="연구 단계와 중요한 일정을 확인하세요."
        actions={
          // 탭마다 그 탭에서 만드는 것 하나만 주 행동으로 둡니다.
          tab === "calendar" ? (
            <Button asChild>
              <Link to={`/r/${researchId}/meetings?new=1`}>
                <Icon name="plus" size={17} />
                미팅 만들기
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() =>
                tab === "schedule" ? setPollOpen(true) : newPhase()
              }
            >
              <Icon name="plus" size={17} />
              {tab === "schedule" ? "시간 조율 시작" : "단계 추가"}
            </Button>
          )
        }
        tabs={
          <Tabs
            className="tabs-line"
            label="계획 화면"
            value={tab}
            onChange={(v) => setParams({ tab: v })}
            options={[
              { value: "roadmap", label: "연구 로드맵" },
              { value: "calendar", label: "캘린더" },
              {
                value: "schedule",
                label: "시간 조율",
                count: polls.filter((p) => p.status === "open").length,
              },
            ]}
          />
        }
        toolbar={
          tab === "roadmap" ? (
            <Segments
              label="로드맵 보기"
              value={view}
              onChange={setView}
              options={[
                { value: "timeline", label: "시간순" },
                { value: "diagram", label: "관계도" },
              ]}
            />
          ) : undefined
        }
      />
      {error && <p className="rms-error">{error}</p>}
      {tab === "roadmap" ? (
        <>
          <div className="roadmap-summary">
            <span className="rms-pill">
              <Icon name="flag" size={14} />
              {phases.find((p) => p.id === research.currentPhaseId)?.title ??
                phases.find((p) => p.status === "active")?.title ??
                "현재 단계 미정"}
            </span>
            <p>단계와 목표의 날짜를 바꿔도 할 일 기한은 바뀌지 않아요.</p>
          </div>
          {!phases.length ? (
            <EmptyState
              icon="flag"
              title="아직 연구 단계가 없어요"
              points={[
                "기본 단계 여섯 개로 시작해요",
                "이름과 순서, 기간을 내 연구에 맞게 바꿔요",
                "지금 단계가 연구 홈에 보여요",
              ]}
              action={
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      for (const [i, title] of phaseTitles.entries())
                        await save("phases", {
                          ...recordBase(researchId),
                          title,
                          order: i,
                          status: "planned",
                          dependsOn: [],
                          dueDate: null,
                          visibility: "shared",
                        });
                    })
                  }
                >
                  기본 단계로 시작
                </Button>
              }
            />
          ) : view === "diagram" ? (
            <Suspense fallback={<LoadingState />}>
              <Diagram phases={phases} onEdit={setPhase} />
            </Suspense>
          ) : (
            <div className="roadmap-timeline">
              {phases.map((p, i) => (
                <article
                  key={p.id}
                  className={`phase-card ${research.currentPhaseId === p.id ? "is-current" : ""}`}
                >
                  <span className="phase-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="phase-card-body">
                    <div className="section-heading">
                      <h2>{p.title}</h2>
                      <StatusBadge
                        tone={
                          research.currentPhaseId === p.id
                            ? "blue"
                            : p.status === "done"
                              ? "green"
                              : "neutral"
                        }
                      >
                        {research.currentPhaseId === p.id
                          ? "현재 단계"
                          : p.status === "done"
                            ? "완료"
                            : p.status === "active"
                              ? "진행 중"
                              : "예정"}
                      </StatusBadge>
                    </div>
                    <p>
                      {formatDate(p.dueDate)} · 할 일{" "}
                      {
                        data.tasks.filter(
                          (t) => t.phaseId === p.id && !t.archivedAt,
                        ).length
                      }
                      개
                    </p>
                    <div className="phase-milestones">
                      {milestones
                        .filter((m) => m.phaseId === p.id)
                        .map((m) => (
                          <button key={m.id} onClick={() => setMilestone(m)}>
                            <Icon
                              name={m.status === "done" ? "check" : "flag"}
                              size={15}
                            />
                            {m.title}
                            <small>{formatDate(m.dueDate)}</small>
                          </button>
                        ))}
                    </div>
                    <div className="button-row">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPhase(p)}
                      >
                        단계 편집
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || p.id === research.currentPhaseId}
                        onClick={() =>
                          void run(async () => {
                            await saveResearch({
                              ...research,
                              currentPhaseId: p.id,
                            });
                            toast.success("현재 단계를 바꿨어요");
                          })
                        }
                      >
                        현재 단계로 설정
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`${p.title} 위로 이동`}
                        disabled={i === 0 || busy}
                        onClick={() =>
                          void run(async () => {
                            await save("phases", {
                              ...p,
                              order: phases[i - 1].order,
                            });
                            await save("phases", {
                              ...phases[i - 1],
                              order: p.order,
                            });
                          })
                        }
                      >
                        <Icon name="arrow-up" size={15} />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <section className="experience-panel roadmap-goals">
            <div className="section-heading">
              <h2>주요 목표</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setMilestone({
                    ...recordBase(researchId),
                    title: "",
                    dueDate: null,
                    status: "planned",
                    taskIds: [],
                    documentIds: [],
                    visibility: "shared",
                  })
                }
              >
                <Icon name="plus" size={15} />
                목표 추가
              </Button>
            </div>
            {milestones.map((m) => (
              <button
                className="goal-row"
                key={m.id}
                onClick={() => setMilestone(m)}
              >
                <Icon name={m.status === "done" ? "check" : "flag"} size={17} />
                <strong>{m.title}</strong>
                <span>{formatDate(m.dueDate)}</span>
                <StatusBadge tone={m.status === "done" ? "green" : "neutral"}>
                  {m.status === "done" ? "완료" : "예정"}
                </StatusBadge>
              </button>
            ))}
            {!milestones.length && (
              <p>아직 주요 목표가 없어요. 예: 계획서 제출, 학회 발표</p>
            )}
          </section>
        </>
      ) : tab === "calendar" ? (
        <>
          <div className="rms-calendar">
            <FullCalendar
              plugins={[
                themePlugin,
                dayGridPlugin,
                timeGridPlugin,
                listPlugin,
                interactionPlugin,
              ]}
              locale={koLocale}
              initialView="dayGridMonth"
              // 달 이름 양옆에 이전·다음 버튼을 두어 한 곳에서 달을 넘깁니다.
              headerToolbar={{
                left: "prev title next",
                center: "",
                right: "today dayGridMonth,timeGridWeek,listMonth",
              }}
              // 날짜 칸은 숫자만 보여 줍니다("10일" → "10").
              dayCellFormat={{ day: "numeric" }}
              dayCellTopContent={(info) => info.dayNumberText.replace("일", "")}
              height="auto"
              events={[
                ...meetings
                  .filter((m) => m.date)
                  .map((m) => ({
                    id: m.id,
                    title: m.title,
                    start: m.date! + (m.time ? "T" + m.time : ""),
                    url: `/r/${researchId}/meetings/${m.id}`,
                    allDay: !m.time,
                    ...eventTone("brand"),
                  })),
                ...data.tasks
                  .filter(
                    (t) =>
                      t.researchId === researchId && !t.archivedAt && t.dueDate,
                  )
                  .map((t) => ({
                    id: `task-${t.id}`,
                    title: `할 일 · ${t.title}`,
                    start: t.dueDate!,
                    allDay: true,
                    ...eventTone("cautionary"),
                    url: `/r/${researchId}/tasks/${t.id}`,
                  })),
                ...phases
                  .filter((p) => !p.archivedAt && p.dueDate)
                  .map((p) => ({
                    id: `phase-${p.id}`,
                    title: `단계 목표 · ${p.title}`,
                    start: p.dueDate!,
                    allDay: true,
                    ...eventTone("violet"),
                    extendedProps: { phaseId: p.id },
                  })),
                ...milestones
                  .filter((m) => m.dueDate)
                  .map((m) => ({
                    id: m.id,
                    title: m.title,
                    start: m.dueDate!,
                    allDay: true,
                    ...eventTone("positive"),
                    extendedProps: { milestone: true },
                  })),
              ]}
              eventClick={(e) => {
                e.jsEvent.preventDefault();
                if (e.event.extendedProps.phaseId)
                  setPhase(
                    phases.find((p) => p.id === e.event.extendedProps.phaseId)!,
                  );
                else if (e.event.extendedProps.milestone)
                  setMilestone(milestones.find((m) => m.id === e.event.id)!);
                else navigate(e.event.url);
              }}
              dateClick={(e) =>
                navigate(`/r/${researchId}/meetings?new=1&date=${e.dateStr}`)
              }
            />
          </div>
          <section className="experience-panel">
            <h2>날짜 미정 미팅</h2>
            {meetings
              .filter((m) => !m.date)
              .map((m) => (
                <Link
                  className="student-simple-row"
                  key={m.id}
                  to={`/r/${researchId}/meetings/${m.id}`}
                >
                  {m.title}
                  <Icon name="arrow-right" size={16} />
                </Link>
              ))}
            {!meetings.some((m) => !m.date) && (
              <p>날짜 미정인 미팅이 없어요.</p>
            )}
          </section>
        </>
      ) : (
        <section className="experience-panel">
          <div className="section-heading">
            <h2>미팅 시간 조율</h2>
            <Button variant="outline" onClick={() => setPollOpen(true)}>
              시간 조율 시작
            </Button>
          </div>
          <div className="experience-list">
            {polls.map((p) => (
              <Link
                className="experience-list-row"
                key={p.id}
                to={`/schedule/${p.id}`}
              >
                <Icon name="calendar" size={20} />
                <div>
                  <strong>{p.title}</strong>
                  <small>
                    후보 시간 {p.options.length}개 · 참여자{" "}
                    {p.participants.length}명
                  </small>
                </div>
                <StatusBadge
                  tone={
                    p.status === "confirmed"
                      ? "green"
                      : p.status === "open"
                        ? "blue"
                        : "neutral"
                  }
                >
                  {p.status === "confirmed"
                    ? "확정"
                    : p.status === "open"
                      ? "조율 중"
                      : "취소"}
                </StatusBadge>
              </Link>
            ))}
          </div>
          {!polls.length && (
            <p className="quiet-placeholder">아직 시간 조율이 없어요.</p>
          )}
        </section>
      )}
      <Dialog
        open={!!phase}
        onOpenChange={(v) => {
          if (!busy && !v) setPhase(null);
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>연구 단계</DialogTitle>
            <DialogDescription>
              순서는 ‘시간순’ 보기에서 바꿀 수 있어요. 현재 단계를 바꿔도 다른
              단계의 상태는 바뀌지 않아요.
            </DialogDescription>
          </DialogHeader>
          {phase && (
            <form
              className="rms-modal-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await save("phases", phase);
                  setPhase(null);
                });
              }}
            >
              <label className="field">
                단계 이름
                <Input
                  required

                  maxLength={200}
                  value={phase.title}
                  onChange={(e) =>
                    setPhase({ ...phase, title: e.target.value })
                  }
                />
              </label>
              <label className="field">
                목표일
                <DateField
                  value={phase.dueDate ?? ""}
                  onChange={(dueDate) =>
                    setPhase({ ...phase, dueDate: dueDate || null })
                  }
                />
              </label>
              <label className="field">
                <span>진행 상태</span>
                <Choice
                  label="진행 상태"
                  value={phase.status}
                  onChange={(v) =>
                    setPhase({ ...phase, status: v as ResearchPhase["status"] })
                  }
                  options={[
                    { value: "planned", label: "예정" },
                    { value: "active", label: "진행 중" },
                    { value: "done", label: "완료" },
                  ]}
                />
              </label>
              <div className="bottom-actions">
                {data.phases.some((p) => p.id === phase.id) && (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await save("phases", {
                          ...phase,
                          archivedAt: new Date().toISOString(),
                        });
                        setPhase(null);
                      })
                    }
                  >
                    단계 보관
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPhase(null)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={busy}>
                  단계 저장
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!milestone}
        onOpenChange={(v) => {
          if (!busy && !v) setMilestone(null);
        }}
      >
        <DialogContent className="rms-dialog">
          <DialogHeader>
            <DialogTitle>주요 목표</DialogTitle>
            <DialogDescription>
              관련 할 일과 문서를 이 목표에 연결할 수 있어요.
            </DialogDescription>
          </DialogHeader>
          {milestone && (
            <form
              className="rms-modal-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await save("milestones", milestone);
                  setMilestone(null);
                });
              }}
            >
              <label className="field">
                목표 이름
                <Input
                  required
                  maxLength={200}
                  value={milestone.title}
                  onChange={(e) =>
                    setMilestone({ ...milestone, title: e.target.value })
                  }
                />
              </label>
              <label className="field">
                기한
                <DateField
                  value={milestone.dueDate ?? ""}
                  onChange={(dueDate) =>
                    setMilestone({ ...milestone, dueDate: dueDate || null })
                  }
                />
              </label>
              <label className="field">
                <span>단계</span>
                <Choice
                  label="단계"
                  value={milestone.phaseId ?? ""}
                  onChange={(v) =>
                    setMilestone({ ...milestone, phaseId: v || undefined })
                  }
                  options={[
                    { value: "", label: "단계 미지정" },
                    ...phases.map((p) => ({ value: p.id, label: p.title })),
                  ]}
                />
              </label>
              <label className="field">
                <span>목표 상태</span>
                <Choice
                  label="목표 상태"
                  value={milestone.status}
                  onChange={(v) =>
                    setMilestone({
                      ...milestone,
                      status: v as Milestone["status"],
                    })
                  }
                  options={[
                    { value: "planned", label: "예정" },
                    { value: "done", label: "완료" },
                  ]}
                />
              </label>
              {(["tasks", "documents"] as const).map((kind) => (
                <fieldset className="connection-picker" key={kind}>
                  <legend>
                    {kind === "tasks" ? "관련 할 일" : "관련 문서"}
                  </legend>
                  {data[kind]
                    .filter((t) => t.researchId === researchId && !t.archivedAt)
                    .map((t) => {
                      const field =
                        kind === "tasks" ? "taskIds" : "documentIds";
                      return (
                        <label key={t.id}>
                          <Checkbox
                            checked={milestone[field].includes(t.id)}
                            onCheckedChange={(next) =>
                              setMilestone({
                                ...milestone,
                                [field]: next
                                  ? [...milestone[field], t.id]
                                  : milestone[field].filter(
                                      (id) => id !== t.id,
                                    ),
                              })
                            }
                          />
                          {t.title}
                        </label>
                      );
                    })}
                </fieldset>
              ))}
              <div className="bottom-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMilestone(null)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={busy}>
                  목표 저장
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <PollCreate
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        researchId={researchId}
      />
    </div>
  );
}
function PollCreate({
  open,
  onClose,
  researchId,
}: {
  open: boolean;
  onClose: () => void;
  researchId: string;
}) {
  const { action } = useExperience(),
    navigate = useNavigate(),
    [title, setTitle] = useState(""),
    [emails, setEmails] = useState(""),
    [options, setOptions] = useState([{ id: uid(), start: "", end: "" }]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="rms-dialog">
        <DialogHeader>
          <DialogTitle>미팅 시간 조율</DialogTitle>
          <DialogDescription>
            입력한 계정에 마진 알림을 보내요. 이메일은 보내지 않아요.
            공동연구자가 아닌 사람에게는 연구 이름, 미팅 제목, 후보 시간,
            참여자별 응답만 보여요.
          </DialogDescription>
        </DialogHeader>
        <form
          className="rms-modal-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const p = await action<MeetingPoll>("rms_poll_action", {
                action: "create",
                researchId,
                title,
                emails: emails.split(/[,;\s]+/).filter(Boolean),
                options: options.map((o) => ({
                  ...o,
                  start: new Date(o.start).toISOString(),
                  end: new Date(o.end).toISOString(),
                })),
              });
              onClose();
              navigate(`/schedule/${p.id}`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field">
            미팅 제목
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="field">
            참여자 이메일
            <Input
              required
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="쉼표로 구분해 입력"
            />
            <small>
              마진 계정이 있는 사람만 초대할 수 있어요. 이메일은 최대 20개예요.
            </small>
          </label>
          {options.map((o, i) => (
            <div className="schedule-option-input" key={o.id}>
              <strong>후보 {i + 1}</strong>
              <div className="schedule-option-field">
                <span>시작</span>
                <DateTimeField
                  label={`후보 ${i + 1} 시작`}
                  required
                  value={o.start}
                  onChange={(startValue) =>
                    setOptions(
                      options.map((v) =>
                        v.id === o.id ? { ...v, start: startValue } : v,
                      ),
                    )
                  }
                />
              </div>
              <div className="schedule-option-field">
                <span>종료</span>
                <DateTimeField
                  label={`후보 ${i + 1} 종료`}
                  required
                  value={o.end}
                  onChange={(endValue) =>
                    setOptions(
                      options.map((v) =>
                        v.id === o.id ? { ...v, end: endValue } : v,
                      ),
                    )
                  }
                />
              </div>
              {options.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setOptions(options.filter((v) => v.id !== o.id))
                  }
                >
                  후보 제거
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={options.length >= 12}
            onClick={() =>
              setOptions([...options, { id: uid(), start: "", end: "" }])
            }
          >
            <Icon name="plus" size={16} />
            후보 추가
          </Button>
          {error && <p className="rms-error">{error}</p>}
          <div className="bottom-actions">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
            >
              취소
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "보내는 중" : "응답 요청 보내기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function PollPage() {
  const { pollId } = useParams(),
    w = useExperience(),
    { data, user, action } = w,
    p = data.polls.find((p) => p.id === pollId);
  const [selected, setSelected] = useState<string[] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!p)
    return (
      <EmptyState
        title="시간 조율을 열 수 없어요"
        description="초대받은 계정으로 로그인했는지 확인해 주세요."
        action={
          <Button asChild>
            <Link to="/r">내 연구로 이동</Link>
          </Button>
        }
      />
    );
  const mine = p.participants.find((m) => m.userId === user.id),
    available = selected ?? mine?.available ?? [],
    owner =
      data.researches.find((r) => r.id === p.researchId)?.ownerId === user.id,
    canConfirm = owner || p.organizerId === user.id;
  async function run(input: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await action("rms_poll_action", { id: p!.id, ...input });
      setSelected(null);
      toast.success(
        input.action === "confirm"
          ? "미팅 시간을 확정했어요"
          : input.action === "cancel"
            ? "시간 조율을 취소했어요"
            : "가능한 시간을 저장했어요",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="experience-page poll-page">
      <Link
        className="text-link"
        to={
          data.researches.some((r) => r.id === p.researchId)
            ? `/r/${p.researchId}/planning?tab=schedule`
            : "/r"
        }
      >
        <Icon name="arrow-left" size={16} />
        돌아가기
      </Link>
      <PageHeader
        title={p.title}
        description={`${p.researchName} · ${
          p.status === "confirmed"
            ? "미팅 시간이 확정됐어요."
            : p.status === "cancelled"
              ? "시간 조율이 취소됐어요."
              : "가능한 시간을 모두 선택해 주세요."
        }`}
        actions={
          <StatusBadge tone={p.status === "confirmed" ? "green" : "blue"}>
            {p.status === "confirmed"
              ? "확정"
              : p.status === "cancelled"
                ? "취소"
                : "조율 중"}
          </StatusBadge>
        }
      />
      {error && <p className="rms-error">{error}</p>}
      <section className="experience-panel">
        <div className="poll-options">
          {p.options.map((o) => (
            <div
              className={`poll-option ${p.selectedOptionId === o.id ? "selected" : ""}`}
              key={o.id}
            >
              <label>
                <Checkbox
                  disabled={!mine || p.status !== "open" || busy}
                  checked={available.includes(o.id)}
                  onCheckedChange={(next) =>
                    setSelected(
                      next
                        ? [...available, o.id]
                        : available.filter((id) => id !== o.id),
                    )
                  }
                />
                <div>
                  <strong>
                    {new Date(o.start).toLocaleDateString(dateLocale(), {
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </strong>
                  <span>
                    {new Date(o.start).toLocaleTimeString(
                      dateLocale(),
                      timeParts(),
                    )}{" "}
                    –{" "}
                    {new Date(o.end).toLocaleTimeString(
                      dateLocale(),
                      timeParts(),
                    )}
                  </span>
                </div>
              </label>
              {p.status === "confirmed" && p.selectedOptionId === o.id && (
                <StatusBadge tone="green">확정된 시간</StatusBadge>
              )}
              <div className="poll-responses">
                {p.participants.map((m) => (
                  <span key={m.userId} className="rms-pill">
                    <Icon
                      name={m.available.includes(o.id) ? "check" : "user"}
                      size={13}
                    />
                    {m.name}
                    {m.available.includes(o.id) ? " · 가능" : ""}
                  </span>
                ))}
              </div>
              {canConfirm && p.status === "open" && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run({ action: "confirm", optionId: o.id })
                  }
                >
                  이 시간으로 확정
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="bottom-actions">
          {canConfirm && p.status === "open" && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void run({ action: "cancel" })}
            >
              시간 조율 취소
            </Button>
          )}
          {mine && p.status === "open" && (
            <Button
              disabled={busy}
              onClick={() => void run({ action: "respond", available })}
            >
              가능한 시간 저장
            </Button>
          )}
          {p.meetingId &&
            data.researches.some((r) => r.id === p.researchId) && (
              <Button asChild>
                <Link to={`/r/${p.researchId}/meetings/${p.meetingId}`}>
                  확정한 미팅 열기
                </Link>
              </Button>
            )}
        </div>
      </section>
    </div>
  );
}
