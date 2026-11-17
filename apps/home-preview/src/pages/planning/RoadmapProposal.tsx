import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@montage-ui/core";
import { useExperience } from "@/lib/experience";
import { useAIRequestOptions } from "@/lib/ai-request-options";
import { AINotConfiguredError } from "@/lib/ai-availability";
import {
  formatDate,
  recordBase,
  uid,
  type Research,
  type ResearchPhase,
} from "@/lib/domain";
import {
  requestRoadmapProposal,
  type RoadmapProposalResult,
} from "@/lib/repository";
import {
  buildRoadmapPlan,
  evenRoadmapDraft,
  planPhaseChanges,
  stageDateProblem,
  submissionDateProblem,
  todayKey,
  type ProposedStage,
  type StageDateProblem,
} from "@/lib/roadmap-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/ui/date-field";
import { StatusBadge, useDisabledReason } from "@/components/common";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { RoadmapTimeline } from "./RoadmapTimeline";

interface DraftStage extends ProposedStage {
  key: string;
}
interface Proposal {
  /** ai: 연구 도우미 제안, even: 화면에서 계산한 균등 배분 초안(AI 결과 아님) */
  kind: "ai" | "even";
  stages: DraftStage[];
  assumptions: string;
  model: string;
  submissionDate: string;
  today: string;
  /** 요청할 때 보낸 단계. 제안의 sourceIndex가 이 순서를 가리킵니다. */
  sent: ResearchPhase[];
}
interface RoadmapProposalDialogProps {
  open: boolean;
  onClose: () => void;
  research: Research;
  /** 보관하지 않은 이 연구의 단계(순서대로) */
  phases: ResearchPhase[];
  /**
   * ai(기본): 연구 도우미에 제안을 요청해요.
   * even: AI를 쓸 수 없을 때 오늘~투고일을 단계 수로 똑같이 나눈 초안을 이 화면에서 계산해요.
   */
  kind?: "ai" | "even";
}

function dateProblemText(problem: StageDateProblem): string {
  switch (problem) {
    case "missing":
    case "invalid":
      return t("시작일과 끝나는 날을 넣어 주세요.");
    case "reversed":
      return t("끝나는 날이 시작일보다 빨라요.");
    case "before_today":
      return t("시작일이 오늘보다 빨라요.");
    case "after_submission":
      return t("끝나는 날이 투고일보다 늦어요.");
  }
}

/**
 * 투고일을 넣으면 연구 도우미가 단계별 기간을 제안하고, 월별 막대로 미리 보여 줍니다.
 * '이 계획 적용'을 누르기 전에는 아무것도 저장하지 않아요.
 */
export function RoadmapProposalDialog({
  open,
  onClose,
  research,
  phases,
  kind = "ai",
}: RoadmapProposalDialogProps) {
  const even = kind === "even";
  const { save, refresh, cancelRun, saveResearch, data } = useExperience();
  const aiOptions = useAIRequestOptions();
  const [submissionDate, setSubmissionDate] = useState(""),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [addGoal, setAddGoal] = useState(true),
    [running, setRunning] = useState(false),
    [applying, setApplying] = useState(false),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null),
    runId = useRef("");

  // 창을 닫으면 제안과 입력을 버립니다(저장한 것이 없으므로 남길 것이 없어요).
  useEffect(() => {
    // 열 때 연구에 적어 둔 투고 목표일을 미리 채워요.
    if (open) {
      setSubmissionDate(research.submissionDate ?? "");
      return;
    }
    abort.current?.abort();
    // 답을 기다리다 닫았으면 서버 실행도 중단을 요청합니다(늦게 온 결과는 쓰지 않아요).
    if (runId.current) void cancelRun(runId.current).catch(() => undefined);
    runId.current = "";
    setProposal(null);
    setSubmissionDate("");
    setAddGoal(true);
    setRunning(false);
    setError("");
    // cancelRun은 렌더마다 새로 만들어지므로 open이 바뀔 때만 실행합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = todayKey();
  const unfinished = phases.filter((p) => p.status !== "done");
  const dateProblem = submissionDate
    ? submissionDateProblem(today, submissionDate)
    : null;
  const requestReason = running
    ? ""
    : !submissionDate
      ? t("투고일을 넣어 주세요.")
      : dateProblem === "not_future"
        ? t("투고일은 내일 이후로 넣어 주세요.")
        : dateProblem === "too_far"
          ? t("투고일은 5년 안으로 넣어 주세요.")
          : dateProblem
            ? t("투고일을 다시 확인해 주세요.")
            : even && !unfinished.length
              ? t("끝나지 않은 단계가 없어 나눌 단계가 없어요.")
              : "";
  const requestHint = useDisabledReason(requestReason);

  const stageProblems = proposal
    ? proposal.stages.map((stage) =>
        !stage.title.trim()
          ? t("단계 이름을 넣어 주세요.")
          : ((problem) => (problem ? dateProblemText(problem) : ""))(
              stageDateProblem(stage, proposal.today, proposal.submissionDate),
            ),
      )
    : [];
  const applyReason = !proposal
    ? ""
    : !proposal.stages.length
      ? t("적용할 단계가 없어요.")
      : stageProblems.some(Boolean)
        ? t("날짜나 이름에 고칠 곳이 있어요.")
        : "";
  const applyHint = useDisabledReason(applyReason);

  /** 균등 배분 초안: 서버에 아무것도 보내지 않고 이 화면에서 계산해요. */
  function draftEvenly() {
    if (requestReason) return;
    const { sent } = buildRoadmapPlan(phases, submissionDate, today);
    const stages = evenRoadmapDraft(sent, today, submissionDate);
    if (!stages) {
      setError(
        t("남은 날이 단계 수보다 적어 나눌 수 없어요. 투고일을 늦춰 주세요."),
      );
      return;
    }
    setError("");
    setProposal({
      kind: "even",
      stages: stages.map((stage) => ({ ...stage, key: uid() })),
      assumptions: "",
      model: "",
      submissionDate,
      today,
      sent,
    });
  }

  async function request() {
    if (even) return draftEvenly();
    if (requestReason || running) return;
    const controller = new AbortController(),
      id = uid();
    abort.current = controller;
    runId.current = id;
    setRunning(true);
    setError("");
    const { plan, sent } = buildRoadmapPlan(phases, submissionDate, today);
    try {
      const result: RoadmapProposalResult = await requestRoadmapProposal(
        // 사용자가 정한 모델·생각 깊이를 함께 보내요(서버가 허용하지 않으면 거절해요).
        { researchId: research.id, clientRunId: id, plan, ...aiOptions() },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setProposal({
        kind: "ai",
        stages: result.roadmap.stages.map((stage) => ({
          ...stage,
          key: uid(),
        })),
        assumptions: result.roadmap.assumptions,
        model: result.model,
        submissionDate,
        today,
        sent,
      });
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(
        e instanceof AINotConfiguredError
          ? t("연구 도우미가 아직 연결되지 않아 계획을 제안받을 수 없어요.")
          : (e as Error).message,
      );
    } finally {
      if (runId.current === id) {
        runId.current = "";
        setRunning(false);
      }
      // AI 사용량과 실행 내역을 새로 읽습니다. 실패해도 제안 화면은 그대로 둡니다.
      await refresh().catch(() => undefined);
    }
  }

  async function stop() {
    const id = runId.current;
    abort.current?.abort();
    runId.current = "";
    setRunning(false);
    if (!id) return;
    try {
      await cancelRun(id);
    } catch {
      setError(t("AI 실행을 멈추지 못했어요. 잠시 뒤 다시 확인해 주세요."));
    }
  }

  function updateStage(key: string, value: Partial<ProposedStage>) {
    setProposal((current) =>
      current
        ? {
            ...current,
            stages: current.stages.map((stage) =>
              stage.key === key ? { ...stage, ...value } : stage,
            ),
          }
        : current,
    );
  }

  async function apply() {
    if (!proposal || applyReason || applying) return;
    setApplying(true);
    setError("");
    try {
      const ordered = [...proposal.stages].sort((a, b) =>
        a.startDate.localeCompare(b.startDate),
      );
      for (const phase of planPhaseChanges(
        phases,
        proposal.sent,
        ordered,
        research.id,
      ))
        await save("phases", phase);
      // 적용한 투고일을 연구의 목표일로도 남겨 홈 D-Day와 맞춰요.
      const latest = data.researches.find((item) => item.id === research.id);
      if (latest && latest.submissionDate !== proposal.submissionDate)
        await saveResearch({
          ...latest,
          submissionDate: proposal.submissionDate,
        });
      if (addGoal)
        await save("milestones", {
          ...recordBase(research.id),
          title: t("논문 투고"),
          dueDate: proposal.submissionDate,
          status: "planned",
          taskIds: [],
          documentIds: [],
          visibility: "shared",
        });
      toast.success(t("계획을 적용했어요"));
      onClose();
    } catch (e) {
      setError(
        t(
          "계획을 모두 적용하지 못했어요. 일부 단계만 바뀌었을 수 있으니 로드맵을 확인해 주세요. ({message})",
          { message: (e as Error).message },
        ),
      );
    } finally {
      setApplying(false);
    }
  }

  const busy = running || applying;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !applying) onClose();
      }}
    >
      <DialogContent className="rms-dialog wide-dialog roadmap-proposal">
        <DialogHeader>
          <DialogTitle>
            {even ? t("균등 배분 초안 만들기") : t("투고일로 계획 제안받기")}
          </DialogTitle>
          <DialogDescription>
            {even
              ? proposal
                ? t(
                    "AI 결과가 아니에요. 오늘부터 투고일까지를 단계 수만큼 똑같이 나눈 자동 계산 초안이에요. 아직 저장하지 않았어요.",
                  )
                : t(
                    "연구 도우미가 연결되지 않아 AI 제안 대신 오늘부터 투고일까지를 끝나지 않은 단계 수만큼 똑같이 나눠 드려요. 적용하기 전에는 저장하지 않아요.",
                  )
              : proposal
                ? t(
                    "연구 도우미가 제안한 계획이에요. 아직 저장하지 않았어요. 이름과 날짜를 고친 뒤 적용할 수 있어요.",
                  )
                : t(
                    "투고일을 넣으면 연구 도우미가 오늘부터 투고일까지 단계별 기간을 제안해요. 적용하기 전에는 저장하지 않아요.",
                  )}
          </DialogDescription>
        </DialogHeader>
        {!proposal ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request();
            }}
          >
            <DialogBody>
              <label className="field">
                {t("투고일")}
                <DateField
                  value={submissionDate}
                  disabled={running}
                  onChange={setSubmissionDate}
                />
              </label>
              {even ? (
                <div className="roadmap-proposal-scope">
                  <strong>{t("이렇게 나눠요")}</strong>
                  <ul>
                    <li>
                      {unfinished.length
                        ? t("끝나지 않은 단계 {count}개를 지금 순서대로", {
                            count: unfinished.length,
                          })
                        : t("끝나지 않은 단계가 없어요")}
                    </li>
                    <li>{t("오늘부터 투고일까지 같은 길이로, 겹치지 않게")}</li>
                  </ul>
                  <p>{t("서버나 AI에 아무것도 보내지 않아요.")}</p>
                </div>
              ) : (
                <div className="roadmap-proposal-scope">
                  <strong>{t("연구 도우미에 보내는 내용")}</strong>
                  <ul>
                    <li>
                      {research.purpose?.trim() || research.questions?.length
                        ? t("연구 이름과 연구 설정에 적은 목적·연구 질문")
                        : t(
                            "연구 이름(목적과 연구 질문이 비어 있어 일반적인 논문 순서로 제안해요)",
                          )}
                    </li>
                    <li>
                      {unfinished.length
                        ? t("끝나지 않은 단계 {count}개의 이름·상태·목표일", {
                            count: unfinished.length,
                          })
                        : t("단계가 없어 새 단계를 제안받아요")}
                    </li>
                    <li>{t("오늘 날짜와 투고일")}</li>
                  </ul>
                  <p>{t("미팅, 피드백, 원고 내용은 보내지 않아요.")}</p>
                </div>
              )}
              {error && (
                <p className="rms-error" role="alert">
                  {error}
                </p>
              )}
              {requestHint.node}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => (running ? void stop() : onClose())}
              >
                {running ? t("중단") : t("취소")}
              </Button>
              <Button
                type="submit"
                disabled={!!requestReason || running}
                loading={running}
                aria-describedby={requestHint.describedBy}
              >
                {even
                  ? t("초안 만들기")
                  : running
                    ? t("계획을 만드는 중")
                    : t("계획 제안받기")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <DialogBody>
              <div className="roadmap-proposal-heading">
                {proposal.kind === "even" ? (
                  <StatusBadge tone="neutral">
                    {t("자동 계산 초안")}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="blue">{t("AI 제안")}</StatusBadge>
                )}
                <span>
                  {t("투고일 {date} 기준", {
                    date: formatDate(proposal.submissionDate),
                  })}
                </span>
              </div>
              <RoadmapTimeline
                label={
                  proposal.kind === "even"
                    ? t("자동 계산 초안 미리보기")
                    : t("AI가 제안한 로드맵 미리보기")
                }
                bars={proposal.stages.map((stage) => ({
                  id: stage.key,
                  title: stage.title.trim() || t("이름 없는 단계"),
                  startDate: stage.startDate,
                  endDate: stage.endDate,
                  tone: "proposal" as const,
                }))}
                markers={[
                  {
                    id: "submission",
                    label: t("투고일"),
                    date: proposal.submissionDate,
                  },
                ]}
              />
              <ol className="roadmap-proposal-stages">
                {proposal.stages.map((stage, i) => (
                  <li key={stage.key}>
                    <div className="roadmap-proposal-stage-title">
                      <label className="field">
                        {t("단계 이름")}
                        <Input
                          maxLength={200}
                          value={stage.title}
                          disabled={applying}
                          onChange={(e) =>
                            updateStage(stage.key, { title: e.target.value })
                          }
                        />
                      </label>
                      <StatusBadge tone="neutral">
                        {stage.sourceIndex > 0 ? t("기존 단계") : t("새 단계")}
                      </StatusBadge>
                    </div>
                    <div className="roadmap-proposal-dates">
                      <label className="field">
                        {t("시작일")}
                        <DateField
                          value={stage.startDate}
                          disabled={applying}
                          onChange={(startDate) =>
                            updateStage(stage.key, { startDate })
                          }
                        />
                      </label>
                      <label className="field">
                        {t("끝나는 날")}
                        <DateField
                          value={stage.endDate}
                          disabled={applying}
                          onChange={(endDate) =>
                            updateStage(stage.key, { endDate })
                          }
                        />
                      </label>
                    </div>
                    {stageProblems[i] && (
                      <p className="rms-error" role="alert">
                        {stageProblems[i]}
                      </p>
                    )}
                    {stage.reason && (
                      <p className="roadmap-proposal-reason">
                        {t("AI가 적은 이유: {reason}", {
                          reason: stage.reason,
                        })}
                      </p>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={applying}
                      aria-label={t("{title} 제안에서 빼기", {
                        title: stage.title.trim() || t("이름 없는 단계"),
                      })}
                      onClick={() =>
                        setProposal({
                          ...proposal,
                          stages: proposal.stages.filter(
                            (item) => item.key !== stage.key,
                          ),
                        })
                      }
                    >
                      {t("제안에서 빼기")}
                    </Button>
                  </li>
                ))}
              </ol>
              {proposal.assumptions && (
                <div className="roadmap-proposal-scope">
                  <strong>{t("확인할 가정")}</strong>
                  <p>{proposal.assumptions}</p>
                </div>
              )}
              <label className="roadmap-proposal-goal">
                <Checkbox
                  checked={addGoal}
                  disabled={applying}
                  onCheckedChange={(next) => setAddGoal(!!next)}
                />
                {t("투고일을 주요 목표 ‘논문 투고’로 추가")}
              </label>
              <p className="roadmap-proposal-note">
                {t(
                  "적용하면 기존 단계의 시작일·목표일이 바뀌고 새 단계가 ‘예정’으로 추가돼요. 끝난 단계와 할 일 기한은 바뀌지 않아요.",
                )}
                {proposal.model
                  ? ` ${t("응답한 AI 모델 · {model}", { model: proposal.model })}`
                  : ""}
              </p>
              {error && (
                <p className="rms-error" role="alert">
                  {error}
                </p>
              )}
              {applyHint.node}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setProposal(null);
                  setError("");
                }}
              >
                {proposal.kind === "even"
                  ? t("투고일 다시 정하기")
                  : t("다시 제안받기")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={applying}
                onClick={onClose}
              >
                {t("취소")}
              </Button>
              <Button
                type="button"
                disabled={!!applyReason || applying}
                loading={applying}
                aria-describedby={applyHint.describedBy}
                onClick={() => void apply()}
              >
                {t("이 계획 적용")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
