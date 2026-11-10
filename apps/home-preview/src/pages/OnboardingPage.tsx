import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { BrandMark, BrandWordmark } from "@/components/brand/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseAdvisorEmails } from "@/lib/advisors";
import { PURPOSE_MAX, parseQuestions } from "@/lib/research-direction";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common";
import { Icon } from "@/components/icons";
import { StartGlow } from "@/components/StartGlow";
import { HomePreview } from "@/components/onboarding/HomePreview";
import { IntroStage } from "@/components/onboarding/IntroStage";
import {
  ServiceIntro,
  type IntroScene,
} from "@/components/onboarding/ServiceIntro";
import { StepMeter } from "@/components/onboarding/StepMeter";
import { isIntroSeen, markIntroSeen, shouldShowIntro } from "@/lib/intro";
import { useWorkspace } from "@/lib/workspace";
import { friendlyError } from "@/lib/supabase";
import {
  formatDate,
  now,
  phaseTitles,
  recordBase,
  uid,
  type Research,
} from "@/lib/domain";
import { seoulToday } from "@/lib/home-meeting";
import {
  onboardingLeadLabel,
  onboardingMeeting,
  type MeetingAnswer,
} from "@/lib/onboarding";
import { LabeledInput } from "./student/shared";
import "./onboarding.css";

const STEP_COUNT = 4;
const QUESTIONS = [
  "어떤 연구를 하고 있나요?",
  "지금 어느 단계인가요?",
  "다음 지도 미팅은 언제인가요?",
  "이 연구로 무엇을 밝히려 하나요?",
];
const MEETING_CHOICES: { kind: MeetingAnswer["kind"]; label: string }[] = [
  { kind: "dated", label: "날짜를 정했어요" },
  { kind: "undated", label: "아직 안 잡혔어요" },
  { kind: "just_finished", label: "방금 미팅을 마쳤어요" },
];

/** 저장이 중간에 끊겼다가 다시 시도할 때 같은 기록을 두 번 만들지 않도록 기억합니다. */
interface SaveProgress {
  research?: Research;
  phases: number;
  meeting: boolean;
}

function meetingSummary(answer: MeetingAnswer | null, today: string): string {
  const meeting = onboardingMeeting(answer, today);
  if (!meeting) return "미팅은 나중에 만들게요";
  if (answer?.kind === "just_finished") return "방금 미팅을 마쳤어요";
  if (!meeting.date) return "아직 안 잡혔어요";
  return `${formatDate(meeting.date)}${meeting.time ? ` · ${meeting.time}` : ""}`;
}

/**
 * 연구를 처음 만들 때의 화면. 질문 네 개에 답하면 오른쪽 미리보기가 채워지고,
 * 마지막 버튼에서 한 번에 저장한 뒤 미리보기가 실제 연구 홈으로 커집니다.
 * (docs/design/product-design-plan.md 5절)
 */
export function OnboardingPage() {
  const { data, user, save, saveResearch } = useWorkspace();
  const navigate = useNavigate();
  const today = seoulToday();
  const researchId = useRef(uid());
  const progress = useRef<SaveProgress>({ phases: 0, meeting: false });
  const nameInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [advisors, setAdvisors] = useState("");
  const [purpose, setPurpose] = useState("");
  const [questions, setQuestions] = useState("");
  // undefined: 아직 답하지 않음, null: 나중에 정하기
  const [phaseIndex, setPhaseIndex] = useState<number | null | undefined>();
  const [meetingKind, setMeetingKind] = useState<
    MeetingAnswer["kind"] | undefined
  >();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [nameError, setNameError] = useState(false);
  const [pending, setPending] = useState(false);

  const hasResearches = data.researches.some((item) => !item.deletedAt);
  const [params, setParams] = useSearchParams();
  // 처음 한 번만 정합니다. 소개를 보는 동안 연구 목록이 바뀌어도 화면이 갑자기 바뀌지 않게 해요.
  const [intro, setIntro] = useState(() =>
    shouldShowIntro({
      hasResearches,
      seen: isIntroSeen(),
      forced: params.get("intro") === "1",
    }),
  );

  const [scene, setScene] = useState<IntroScene>({
    slide: 0,
    flowIndex: 0,
    run: 0,
  });
  // 마지막 장은 곧 채울 연구 홈 미리보기를 보여 줍니다.
  const staged = intro && scene.slide < 2;

  function endIntro() {
    markIntroSeen();
    setIntro(false);
    if (params.has("intro")) {
      const rest = new URLSearchParams(params);
      rest.delete("intro");
      setParams(rest, { replace: true });
    }
  }
  const meetingAnswer: MeetingAnswer | null =
    meetingKind === undefined
      ? null
      : meetingKind === "dated"
        ? { kind: "dated", date, time }
        : { kind: meetingKind };
  const answeredMeeting = step > 2;
  const reviewing = step === STEP_COUNT;
  const phaseTitle =
    step > 1 || phaseIndex !== undefined
      ? phaseIndex == null
        ? null
        : phaseTitles[phaseIndex]
      : undefined;
  // 세 번째 질문은 고르는 동안에도 미리보기에 바로 반영합니다.
  const previewMeeting =
    meetingAnswer || answeredMeeting
      ? onboardingMeeting(meetingAnswer, today)
      : undefined;

  function moveTo(target: number) {
    setDirection(target >= step ? "forward" : "back");
    setStep(target);
  }

  function requireName(): boolean {
    if (name.trim()) return true;
    setNameError(true);
    moveTo(0);
    nameInput.current?.focus();
    return false;
  }

  function next(event: FormEvent) {
    event.preventDefault();
    if (step === 0 && !requireName()) return;
    if (step === 1 && phaseIndex === undefined) setPhaseIndex(null);
    if (step === 2 && meetingKind === undefined) setMeetingKind("skip");
    moveTo(step + 1);
  }

  async function finish(answers: {
    phaseIndex: number | null;
    meeting: MeetingAnswer | null;
  }) {
    if (pending || !requireName()) return;
    setPending(true);
    try {
      const saved = progress.current;
      if (!saved.research) {
        const stamp = now();
        saved.research = await saveResearch({
          id: researchId.current,
          ownerId: user.id,
          name: name.trim(),
          description: description.trim(),
          advisorEmails: parseAdvisorEmails(advisors),
          purpose: purpose.trim() || undefined,
          questions: parseQuestions(questions),
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
      const id = saved.research.id;
      if (answers.phaseIndex !== null) {
        for (const [index, title] of phaseTitles.entries()) {
          if (index < saved.phases) continue;
          await save("phases", {
            ...recordBase(id),
            title,
            order: index,
            status: index === answers.phaseIndex ? "active" : "planned",
            dependsOn: [],
            dueDate: null,
            visibility: "shared",
          });
          saved.phases = index + 1;
        }
      }
      const meeting = onboardingMeeting(answers.meeting, today);
      if (meeting && !saved.meeting) {
        await save("meetings", {
          ...recordBase(id),
          ...meeting,
          status: "preparing",
          goal: "",
          memo: "",
          memoRevision: 1,
          visibility: "private",
          taskIds: [],
          versionIds: [],
          questionIds: [],
        });
        saved.meeting = true;
      }
      openHome(id);
    } catch (error) {
      // 입력은 그대로 두고 같은 자리에서 다시 시도할 수 있게 합니다.
      toast.error(friendlyError(error));
      setPending(false);
    }
  }

  /** 미리보기 창이 실제 홈으로 커지는 전환. 지원하지 않거나 동작 줄이기면 바로 이동합니다. */
  function openHome(id: string) {
    const go = () => navigate(`/r/${id}`, { replace: true });
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || typeof document.startViewTransition !== "function") {
      go();
      return;
    }
    const root = document.documentElement;
    root.classList.add("ob-expanding");
    const transition = document.startViewTransition(() => flushSync(go));
    void transition.finished.finally(() =>
      root.classList.remove("ob-expanding"),
    );
  }

  const summaries = [
    name.trim(),
    phaseIndex == null ? "나중에 정할게요" : phaseTitles[phaseIndex],
    meetingSummary(meetingAnswer, today),
    purpose.trim() || parseQuestions(questions)[0] || "방향은 나중에 적을게요",
  ];

  return (
    <div className="ob-page">
      <div className="ob-form-side">
        <header className="ob-top">
          <span className="ob-brand">
            <BrandMark />
            <BrandWordmark />
          </span>
          {hasResearches && (
            <Link className="ob-leave" to="/r">
              내 연구로 돌아가기
            </Link>
          )}
        </header>
        {intro ? (
          <ServiceIntro onDone={endIntro} onScene={setScene} />
        ) : (
          <form
            className="ob-form"
            onSubmit={
              reviewing
                ? (event) => {
                    event.preventDefault();
                    void finish({
                      phaseIndex: phaseIndex ?? null,
                      meeting: meetingAnswer,
                    });
                  }
                : next
            }
          >
            {step > 0 && (
              <ol className="ob-answers" aria-label="답한 내용">
                {summaries.slice(0, step).map((summary, index) => (
                  <li
                    key={QUESTIONS[index]}
                    className={
                      index === step - 1 && direction === "forward"
                        ? "ob-filled"
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      onClick={() => moveTo(index)}
                      disabled={pending}
                    >
                      <Icon name="check" size={14} />
                      <span>{summary}</span>
                      <small>고치기</small>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <StepMeter count={STEP_COUNT} current={step} />
            <div className="ob-step" data-dir={direction} key={step}>
              {reviewing ? (
                <>
                  <h1 tabIndex={-1}>이렇게 시작할게요</h1>
                  <p className="ob-help">
                    연구를 만든 뒤에도 이름, 단계, 미팅, 연구 방향은 모두 바꿀
                    수 있어요.
                  </p>
                </>
              ) : (
                <>
                  <p className="ob-progress">
                    {step + 1} / {STEP_COUNT}
                  </p>
                  <h1>{QUESTIONS[step]}</h1>
                </>
              )}
              {step === 0 && (
                <div className="ob-fields">
                  <p className="ob-help">
                    지도받는 연구마다 하나씩 만들어요. 이름은 나중에 바꿀 수
                    있어요.
                  </p>
                  <Field label="연구 이름" required>
                    <Input
                      ref={nameInput}
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setNameError(false);
                      }}
                      maxLength={120}
                      autoFocus
                      aria-invalid={nameError || undefined}
                      placeholder="예: 대학원생의 연구 도구 사용 경험"
                    />
                  </Field>
                  {nameError && (
                    <p className="ob-error" role="alert">
                      연구 이름을 입력해 주세요.
                    </p>
                  )}
                  <Field label="한 줄 설명" hint="나중에 적어도 돼요.">
                    <Textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="예: 대학원생 12명 심층 인터뷰를 바탕으로 한 질적 연구"
                    />
                  </Field>
                  <Field
                    label="지도교수 이메일"
                    hint="여러 명이면 쉼표로 나눠 주세요. 나중에 연구 설정에서 바꿀 수 있어요."
                  >
                    <Input
                      type="text"
                      inputMode="email"
                      autoComplete="off"
                      value={advisors}
                      onChange={(event) => setAdvisors(event.target.value)}
                      placeholder="professor@example.com"
                    />
                  </Field>
                </div>
              )}
              {step === 1 && (
                <fieldset className="ob-choices">
                  <legend className="ob-sr-only">{QUESTIONS[1]}</legend>
                  {phaseTitles.map((title, index) => (
                    <label key={title} className="ob-choice">
                      <input
                        type="radio"
                        name="ob-phase"
                        checked={phaseIndex === index}
                        onChange={() => setPhaseIndex(index)}
                      />
                      <span className="ob-choice-number">{index + 1}</span>
                      <span>{title}</span>
                      <Icon
                        name="check"
                        size={16}
                        className="ob-choice-check"
                      />
                    </label>
                  ))}
                  <label className="ob-choice ob-choice-later">
                    <input
                      type="radio"
                      name="ob-phase"
                      checked={phaseIndex === null}
                      onChange={() => setPhaseIndex(null)}
                    />
                    <span>나중에 정할게요</span>
                    <Icon name="check" size={16} className="ob-choice-check" />
                  </label>
                </fieldset>
              )}
              {step === 2 && (
                <>
                  <fieldset className="ob-choices">
                    <legend className="ob-sr-only">{QUESTIONS[2]}</legend>
                    {MEETING_CHOICES.map((choice) => (
                      <label key={choice.kind} className="ob-choice">
                        <input
                          type="radio"
                          name="ob-meeting"
                          checked={meetingKind === choice.kind}
                          onChange={() => setMeetingKind(choice.kind)}
                        />
                        <span>{choice.label}</span>
                        <Icon
                          name="check"
                          size={16}
                          className="ob-choice-check"
                        />
                      </label>
                    ))}
                  </fieldset>
                  {meetingKind === "dated" && (
                    <div className="ob-date-fields">
                      <LabeledInput
                        label="날짜"
                        type="date"
                        value={date}
                        onChange={setDate}
                      />
                      <LabeledInput
                        label="시각"
                        type="time"
                        value={time}
                        onChange={setTime}
                        disabled={!date}
                      />
                    </div>
                  )}
                </>
              )}
              {step === 3 && (
                <div className="ob-fields">
                  <p className="ob-help">
                    아직 정하지 못했으면 비워 둬도 돼요. 나중에 연구 홈에서
                    적거나 계획서에서 가져올 수 있어요.
                  </p>
                  <Field label="연구 목적">
                    <Textarea
                      value={purpose}
                      maxLength={PURPOSE_MAX}
                      onChange={(event) => setPurpose(event.target.value)}
                      placeholder="예: 대학원생이 지도 미팅 뒤 피드백을 어떻게 기록하고 다시 쓰는지 밝힌다"
                    />
                  </Field>
                  <Field
                    label="연구 질문"
                    hint="한 줄에 하나씩, 5개까지 적을 수 있어요."
                  >
                    <Textarea
                      value={questions}
                      onChange={(event) => setQuestions(event.target.value)}
                      placeholder="예: 미팅에서 받은 피드백은 어느 단계에서 사라지는가?"
                    />
                  </Field>
                </div>
              )}
            </div>
            <div className="ob-actions">
              {reviewing ? (
                <StartGlow>
                  <Button type="submit" size="lg" disabled={pending}>
                    {pending ? "만드는 중" : "내 연구 홈으로"}
                    <Icon name="arrow-right" size={18} />
                  </Button>
                </StartGlow>
              ) : (
                <Button type="submit" size="lg">
                  계속
                  <Icon name="arrow-right" size={18} />
                </Button>
              )}
              {!reviewing && (
                <button
                  type="button"
                  className="ob-skip"
                  disabled={pending}
                  onClick={() =>
                    void finish({ phaseIndex: null, meeting: null })
                  }
                >
                  건너뛰고 빈 연구로 시작
                </button>
              )}
            </div>
            <p className="ob-sr-only" aria-live="polite">
              {step > 0 &&
                `미리보기에 반영했어요. ${summaries.slice(0, step).join(", ")}`}
            </p>
          </form>
        )}
      </div>
      <div className={`ob-preview-side ${reviewing ? "ob-preview-full" : ""}`}>
        {staged ? (
          <IntroStage
            key={scene.run}
            slide={scene.slide}
            flowIndex={scene.flowIndex}
          />
        ) : (
          <HomePreview
            name={name}
            description={description}
            phaseTitle={phaseTitle}
            meeting={previewMeeting}
            leadLabel={
              previewMeeting !== undefined
                ? onboardingLeadLabel(meetingAnswer, today)
                : undefined
            }
            today={today}
            focus={(["name", "phase", "meeting"] as const)[step]}
          />
        )}
        <p className="ob-preview-note">
          {staged
            ? "예시 그림이에요. 실제 기록이 아니에요."
            : "미리보기예요. 답한 내용이 내 연구 홈에 이렇게 보여요."}
        </p>
      </div>
    </div>
  );
}
