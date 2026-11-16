// 이 파일은 Vite 개발 서버에서만 여는 별도 시연 진입점입니다. 프로덕션 빌드의 진입점이 아닙니다.
import "../src/design/layers.css";
import React, { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import "@montage-ui/core/theme.css";
import "../src/styles.css";
import "../src/design/tokens.css";
import "../src/experience.css";
import "../src/components/brand/brand.css";
import "../src/pages/assistant.css";
import "../src/pages/writing/kokonut-writing.css";
import { ThemeProvider, useTheme } from "../src/lib/theme";
import AIPrompt, { PromoHeader } from "../src/components/kokonut/ai-prompt";
import AIInputSearch from "../src/components/kokonut/ai-input-search";
import AIVoice from "../src/components/kokonut/ai-voice";
import AIContextMeter from "../src/components/kokonut/ai-context-meter";
import AIAttachment from "../src/components/kokonut/ai-attachment";
import AIModelSelector from "../src/components/kokonut/ai-model-selector";
import { ComposerModelSettings } from "../src/components/ai/ComposerModelSettings";
import { QueueList } from "../src/components/kokonut/ai-message-queue";
import {
  AssistantThinking,
  AnswerSteps,
} from "../src/pages/assistant/AssistantThinking";
import { AssistantMessageText } from "../src/pages/assistant/AssistantMessageText";
import { AnswerActions } from "../src/pages/assistant/AnswerActions";
import { AIAutocomplete } from "../src/components/kokonut/ai-autocomplete";
import AIInlineEdit from "../src/components/kokonut/ai-inline-edit";
import AISend from "../src/components/kokonut/ai-send";
import AISchedule from "../src/components/kokonut/ai-schedule";
import AIHandoff from "../src/components/kokonut/ai-handoff";
import ClipTrimmer from "../src/components/kokonut/clip-trimmer";
import ProfileDropdown from "../src/components/kokonut/profile-dropdown";
import { ThemeSwitch } from "../src/components/ThemeSwitch";
import { AssistantMascot } from "../src/components/brand/Brand";
import { Mic, Pencil } from "lucide-react";
import { assistantSteps } from "../src/lib/assistant-steps";
const models = [
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "google",
    description: "일반 대화와 기록 정리에 추천해요.",
    recommended: true,
    thinking: ["low", "medium", "high"],
  },
  {
    id: "gemini-4-carbon",
    label: "Gemini 4 Carbon",
    provider: "google",
    description: "문서 분석과 원고 검토에 써 볼 수 있어요.",
    thinking: ["low", "medium", "high"],
  },
];
const contexts = [
  {
    kind: "meetings" as const,
    id: "demo-meeting",
    title: "시연용 미팅 메모",
    text: "다음 미팅까지 선행연구 비교 기준을 연구 목적·수집 방법·분석 관점으로 정리한다.",
  },
  {
    kind: "feedback" as const,
    id: "demo-feedback",
    title: "시연용 교수 피드백",
    text: "비교 기준을 선택한 이유와 반례를 함께 제시해 주세요.",
  },
];
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
function App() {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("입력과 응답"),
    [draft, setDraft] = useState(""),
    [selection, setSelection] = useState({
      model: models[0].id,
      thinking: "high",
    }),
    [busy, setBusy] = useState(false),
    [answer, setAnswer] = useState(""),
    [queue, setQueue] = useState<any[]>([]),
    [notice, setNotice] = useState(""),
    [voice, setVoice] = useState(false),
    [stage, setStage] = useState<"uploading" | "reading" | "done" | "error">(
      "done",
    );
  const runToken = useRef(0);
  const modelControls = (
    <ComposerModelSettings
      models={models}
      {...selection}
      onChange={setSelection}
    />
  );
  const send = async (text: string) => {
    const token = ++runToken.current;
    setBusy(true);
    setNotice("");
    await pause(1600);
    if (token !== runToken.current) return;
    setAnswer(
      `다음 미팅 전에는 **선행연구 비교표**부터 준비하세요 [근거 1].\n\n1. 연구 목적·자료 수집 방법·분석 관점으로 비교 기준을 나눠요.\n2. 기준을 고른 이유와 맞지 않는 사례도 적어 두세요 [근거 2].\n\n> 제안: 표 한 장과 확인할 질문 두 개를 가져가세요.\n\n질문: ${text}`,
    );
    setBusy(false);
  };
  return (
    <MemoryRouter initialEntries={["/r/demo/assistant"]}>
      <MotionConfig reducedMotion="user">
        <div className="demo-page">
          <header>
            <div>
              <b>마진 · 적용 부품 시연</b>
              <p>
                시연용 가상 내용입니다. 실제 AI·메일·마이크 호출이나 서버 저장은
                하지 않습니다.
              </p>
            </div>
            <ThemeSwitch />
          </header>
          <nav>
            {[
              "입력과 응답",
              "첨부·근거·대기",
              "글쓰기",
              "전송·일정·검토",
              "프로필·모델·음성",
            ].map((name) => (
              <button data-active={tab === name} onClick={() => setTab(name)}>
                {name}
              </button>
            ))}
          </nav>
          <main key={tab}>
            {tab === "입력과 응답" && (
              <div className="assistant-experience">
                <div className="demo-welcome">
                  <AssistantMascot state="ready" size={56} />
                  <h1>어떤 연구를 도와드릴까요?</h1>
                  <p>
                    원본 입력창의 추천 띠와 이전 모델·깊이 칩을 함께 사용해요.
                  </p>
                </div>
                <div className="assistant-prompts">
                  {[
                    "다음 미팅 전에 끝낼 일이 뭐가 있지?",
                    "이 피드백은 어떻게 고치면 좋을까?",
                    "이 문단에서 더 구체적으로 쓸 곳을 찾아 줘",
                  ].map((s) => (
                    <button onClick={() => setDraft(s)}>{s}</button>
                  ))}
                </div>
                <div className="demo-answer">
                  {busy ? (
                    <AssistantThinking
                      first={!answer}
                      steps={assistantSteps({
                        first: true,
                        researchName: "시연 연구",
                        hasDirection: true,
                        contexts,
                      })}
                      mascot="thinking"
                    />
                  ) : answer ? (
                    <>
                      <AssistantMessageText
                        text={answer}
                        contexts={contexts}
                        onOpenSources={(i) =>
                          setNotice(contexts[i ?? 0]?.text ?? "근거 목록")
                        }
                      />
                      <AnswerSteps steps={["시연용 답변 받음"]} />
                      <AnswerActions
                        text={answer}
                        question="다음 미팅 준비"
                        disabled={false}
                        onRetry={() => void send("다시 확인해 줘")}
                      />
                    </>
                  ) : null}
                </div>
                <div className="assistant-composer-wrap">
                  <PromoHeader
                    model="Gemini 3.8 Flash"
                    text="추천 · Gemini 3.8 Flash · 일반 대화와 기록 정리에 추천해요."
                    action="시도하기"
                    canSwitch
                    inUse={false}
                    onAction={() => {
                      setSelection({ model: models[0].id, thinking: "high" });
                      setNotice("시연: 추천 모델을 선택했어요.");
                    }}
                  />
                  <AIPrompt
                    className="max-w-none py-0"
                    header={<span />}
                    value={draft}
                    onValueChange={setDraft}
                    selectedModel={
                      models.find((m) => m.id === selection.model)!.label
                    }
                    selectedEffort={selection.thinking}
                    models={models.map((m) => ({
                      name: m.label,
                      efforts: m.thinking,
                    }))}
                    modelControls={modelControls}
                    leadingControl={
                      <button
                        className="flex size-8 items-center justify-center rounded-full"
                        aria-label="음성으로 질문 입력"
                        onClick={() => {
                          setVoice(!voice);
                          setNotice(
                            "마이크 권한을 요청하지 않는 음성 UI 시연이에요.",
                          );
                        }}
                      >
                        <Mic className="size-4" />
                      </button>
                    }
                    placeholder="질문을 적어 주세요 · / 를 치면 요청 종류를 고를 수 있어요"
                    busy={busy}
                    onStop={() => {
                      runToken.current += 1;
                  setBusy(false);
                      setNotice("시연: 중단 동작을 확인했어요.");
                    }}
                    onAttach={() =>
                      setNotice("첨부 상태는 ‘첨부·근거·대기’에서 확인해요.")
                    }
                    commands={[
                      { id: "review", label: "원고 검토", icon: <Pencil /> },
                    ]}
                    onQueue={(text) =>
                      setQueue((q) => [...q, { id: String(Date.now()), text }])
                    }
                    onSubmit={(text) => send(text)}
                  />
                  <div className="composer-usage-footer">
                    <span>
                      시연 잔액 · 19,993크레딧
                      {answer && <span>시연 이번 요청 · 1크레딧</span>}
                    </span>
                    <button
                      onClick={() =>
                        setNotice(
                          "실제 앱에서는 내 사용량과 플랜 화면으로 이동해요.",
                        )
                      }
                    >
                      사용 내역
                    </button>
                  </div>
                  {voice && (
                    <AIVoice
                      demo={false}
                      listening={false}
                      onListeningChange={() =>
                        setNotice("이 시연은 실제 마이크를 켜지 않아요.")
                      }
                    />
                  )}
                  {queue.length > 0 && (
                    <p>
                      시연 대기 질문 {queue.length}개 · 실제 대기 줄은 다음
                      탭에서 확인해요.
                    </p>
                  )}
                </div>
              </div>
            )}
            {tab === "첨부·근거·대기" && (
              <>
                <section>
                  <h2>첨부 처리 상태</h2>
                  <div className="demo-controls">
                    {["uploading", "reading", "done", "error"].map((s) => (
                      <button onClick={() => setStage(s as any)}>
                        {
                          (
                            {
                              uploading: "업로드 중",
                              reading: "읽는 중",
                              done: "준비됨",
                              error: "실패",
                            } as any
                          )[s]
                        }
                      </button>
                    ))}
                  </div>
                  <AIAttachment
                    file={{
                      name: "시연용_연구메모.pdf",
                      size: 120000,
                      pages: 2,
                    }}
                    status={stage}
                    uploaded={0.45}
                    pagesRead={stage === "done" ? 2 : 1}
                    error="시연: 파일을 읽지 못했어요."
                    answer={[]}
                    pageNumbers={[4, 5]}
                  />
                </section>
                <section>
                  <h2>근거가 있는 답변</h2>
                  <AssistantMessageText
                    text="비교표에 연구 목적과 분석 관점을 나눠 적어 보세요 [근거 1]. 반례도 함께 확인하세요 [근거 2]."
                    contexts={contexts}
                    onOpenSources={(i) =>
                      setNotice(contexts[i ?? 0]?.text ?? "근거 목록")
                    }
                  />
                </section>
                <section>
                  <h2>질문 대기 줄 · 끌기, 편집, 삭제, 바로 보내기</h2>
                  <button
                    onClick={() =>
                      setQueue([
                        { id: "a", text: "비교표에 빠진 관점을 찾아 줘" },
                        { id: "b", text: "다음 미팅 질문을 두 개 정리해 줘" },
                      ])
                    }
                  >
                    대기 질문 채우기
                  </button>
                  <QueueList
                    queue={queue}
                    paused={false}
                    progress={0}
                    onMoved={(text) => setNotice(text)}
                    onReorder={setQueue}
                    onEdit={(id, text) =>
                      setQueue((q) =>
                        q.map((item) =>
                          item.id === id ? { ...item, text } : item,
                        ),
                      )
                    }
                    onRemove={(id) =>
                      setQueue((q) => q.filter((item) => item.id !== id))
                    }
                    onSendNow={(m) => {
                      setNotice("시연: " + m.text);
                      setQueue((q) => q.filter((item) => item.id !== m.id));
                    }}
                    onClear={() => setQueue([])}
                    onResume={() => {}}
                  />
                </section>
                <section>
                  <h2>검색형 입력 · 요청 종류</h2>
                  <AIInputSearch
                    className="max-w-none"
                    models={models.map((m) => m.label)}
                    selectedModel={models[0].label}
                    modelControls={modelControls}
                    tools={[
                      {
                        id: "review",
                        label: "원고 검토",
                        activity: "선택한 원고를 점검해요",
                        placeholder: "고칠 부분을 적어 주세요",
                        icon: Pencil,
                        readsSources: true,
                        color: "var(--brand)",
                      },
                    ]}
                    placeholder="요청 종류를 골라 보세요"
                    onSearch={async () => {
                      setNotice("시연: 검색형 요청을 완료했어요.");
                    }}
                  />
                </section>
                <section>
                  <h2>컨텍스트 고리 · 참고용 원본 부품</h2>
                  <p>
                    실제 입력창 아래에서는 이 고리 대신 사용량을 표시합니다.
                  </p>
                  <AIContextMeter
                    model="시연 · 문자 기준"
                    limit={82000}
                    segments={[
                      { id: "sources", label: "선택한 기록", tokens: 12000 },
                      { id: "history", label: "대화", tokens: 3000 },
                    ]}
                  />
                </section>
              </>
            )}
            {tab === "글쓰기" && (
              <>
                <section>
                  <h2>이어쓰기 · 멈추면 제안, Tab 전체 수락</h2>
                  <AIAutocomplete
                    defaultValue="선행연구를 비교할 때 "
                    label="시연용 이어쓰기"
                    suggest={() =>
                      "연구 목적과 자료 수집 방법, 분석 관점을 나눠 살펴본다."
                    }
                  />
                </section>
                <section>
                  <h2>선택 문장 고쳐 쓰기 · 문장을 드래그해 선택하세요</h2>
                  <AIInlineEdit
                    title="시연용 연구 계획서"
                    paragraphs={[
                      "기존 연구를 비교해 보았다. 여러 차이가 있었다.",
                      "연구 목적과 자료 수집 방법을 기준으로 비교표를 작성하고, 각 기준을 고른 이유와 반례를 함께 기록한다.",
                    ]}
                    rewrite={async () => {
                      await pause(900);
                      return "선행연구를 연구 목적·자료 수집 방법·분석 관점에 따라 비교하였다.";
                    }}
                  />
                </section>
              </>
            )}
            {tab === "전송·일정·검토" && (
              <>
                <section>
                  <h2>메일 보내기 · 5초 동안 되돌리기</h2>
                  <AISend
                    draft={{
                      from: "시연용 마진",
                      toName: "시연용 교수",
                      toEmail: "demo@example.invalid",
                      subject: "연구 계획서 검토 요청",
                      body: "비교 기준과 수정한 문장을 확인해 주세요. (시연용 가상 내용)",
                    }}
                    message="수신자와 내용을 확인해 주세요."
                    readOnly
                    onSend={() =>
                      setNotice("시연 완료: 실제 메일은 전송하지 않았어요.")
                    }
                  />
                </section>
                <section>
                  <h2>시간 선택</h2>
                  <AISchedule
                    title="시연 미팅"
                    duration="30분"
                    timezone="한국시간"
                    me={{ name: "시연 학생", initials: "학" }}
                    with={{ name: "시연 교수", initials: "교" }}
                    message="가능한 시간을 선택해 보세요."
                    slots={[
                      {
                        id: "s1",
                        weekday: "목",
                        month: "11월",
                        day: 19,
                        time: "14:00 – 14:30",
                        at: [14, 14.5],
                        you: [],
                        them: [],
                      },
                      {
                        id: "s2",
                        weekday: "금",
                        month: "11월",
                        day: 20,
                        time: "10:00 – 10:30",
                        at: [10, 10.5],
                        you: [],
                        them: [],
                      },
                    ]}
                    onBook={async () => {
                      setNotice(
                        "시연: 일정만 선택했어요. 서버 저장이나 초대는 하지 않았어요.",
                      );
                    }}
                  />
                </section>
                <section>
                  <h2>교수님 검토로 넘기기</h2>
                  <AIHandoff
                    team="교수님 검토"
                    status="waiting"
                    position={0}
                    agents={[]}
                    waitingLabel="검토 요청 전"
                    waitHint="검토 요청에서 공유할 항목을 직접 골라요."
                    shared={[
                      "직접 선택한 수정 결과와 첨부 파일",
                      "개인 AI 대화는 공유하지 않아요.",
                    ]}
                    actionLabel="검토 요청 만들기"
                    onStay={() =>
                      setNotice(
                        "실제 앱에서는 검토 요청 작성 화면으로 이동해요.",
                      )
                    }
                  />
                </section>
                <section>
                  <h2>음성 구간 · 양 끝 손잡이 조절</h2>
                  <ClipTrimmer
                    duration={30}
                    media={{
                      time: 8,
                      playing: false,
                      onSeek: (t) =>
                        setNotice("시연 위치 " + t.toFixed(1) + "초"),
                      onToggle: () => setNotice("시연에는 음성 파일이 없어요."),
                    }}
                    alt="시연 녹음"
                    onRangeChange={(r) => setNotice(JSON.stringify(r))}
                  />
                </section>
              </>
            )}
            {tab === "프로필·모델·음성" && (
              <>
                <section>
                  <h2>프로필 메뉴 · 펼침/접힘</h2>
                  <div className="demo-profile-grid">
                    <div style={{ width: 230 }}>
                      <ProfileDropdown
                        accounts={[
                          {
                            id: "demo",
                            name: "시연 학생",
                            email: "demo@example.invalid",
                            initials: "시",
                            plan: "Free",
                          },
                        ]}
                        items={[
                          {
                            label: "프로필 설정",
                            onSelect: () => setNotice("시연: 프로필 설정"),
                          },
                        ]}
                        theme={theme}
                        onThemeChange={setTheme}
                        onSignOut={() =>
                          setNotice("시연: 로그아웃 동작, 실제 세션 변경 없음")
                        }
                      />
                    </div>
                    <div className="sidebar-collapsed" style={{ width: 60 }}>
                      <ProfileDropdown
                        accounts={[
                          {
                            id: "demo2",
                            name: "시연 학생",
                            email: "demo@example.invalid",
                            initials: "시",
                            plan: "Free",
                          },
                        ]}
                        items={[]}
                        theme={theme}
                        onThemeChange={setTheme}
                        onSignOut={() => setNotice("시연: 로그아웃")}
                      />
                    </div>
                  </div>
                </section>
                <section>
                  <h2>설정용 원본 모델·답변 깊이 트랙</h2>
                  <AIModelSelector
                    models={models.map((m) => ({
                      id: m.id,
                      name: m.label,
                      description: m.description,
                      efforts: m.thinking.map((id) => ({
                        id,
                        label: (
                          {
                            low: "간단히",
                            medium: "보통",
                            high: "자세히",
                          } as any
                        )[id],
                      })),
                    }))}
                    value={{
                      model: selection.model,
                      effort: selection.thinking,
                    }}
                    onChange={(s) =>
                      setSelection({ model: s.model, thinking: s.effort })
                    }
                  />
                </section>
                <section>
                  <h2>음성 상태 · 마이크 권한을 요청하지 않는 예시</h2>
                  <AIVoice
                    demo={false}
                    listening={false}
                    onListeningChange={() =>
                      setNotice(
                        "실제 마이크는 켜지지 않아요. 실제 앱에서 허용 후 사용할 수 있어요.",
                      )
                    }
                  />
                </section>
                <section>
                  <h2>테마 스위치</h2>
                  <ThemeSwitch />
                </section>
              </>
            )}
            {notice && (
              <aside role="status" className="demo-notice">
                {notice}
              </aside>
            )}
          </main>
          <footer>
            화면 색·글꼴·원본 상호작용을 확인하는 로컬 시연입니다. AI 답변의
            품질이나 실서비스 전송 성공을 검증하는 화면은 아닙니다.
          </footer>
        </div>
      </MotionConfig>
    </MemoryRouter>
  );
}
const style = document.createElement("style");
style.textContent = `
body{background:var(--surface);color:var(--text);margin:0}.demo-page{max-width:1000px;margin:auto;padding:28px 24px 64px;font-family:var(--font-sans)}.demo-page>header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:24px;border-bottom:1px solid var(--line)}header b{font-size:21px}header p,footer{font-size:12px;color:var(--text-secondary);margin-top:8px}.demo-page>nav{display:flex;gap:8px;flex-wrap:wrap;padding:20px 0 28px}.demo-page>nav button,.demo-controls button,section>button{font-size:13px;border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--surface);color:var(--text)}.demo-page>nav button[data-active=true]{color:var(--brand);border-color:var(--brand);background:var(--selected-fill)}.demo-page main{min-height:540px}.demo-page section{margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--line)}.demo-page section>h2{font-size:17px;font-weight:650;margin:0 0 20px}.demo-page section>p{font-size:13px;color:var(--text-secondary);margin-bottom:16px}.demo-welcome{text-align:center;display:flex;align-items:center;flex-direction:column;gap:12px;padding:16px 0 24px}.demo-welcome h1{font-size:26px;font-weight:700}.demo-welcome p{font-size:13px;color:var(--text-secondary)}.demo-answer{max-width:760px;margin:24px auto;min-height:52px}.demo-controls,.demo-profile-grid{display:flex;gap:16px;margin-bottom:20px}.demo-notice{position:sticky;bottom:16px;margin-top:20px;border:1px solid var(--line);border-radius:12px;background:var(--surface-raised);padding:12px;font-size:13px;box-shadow:0 4px 16px #0001}.demo-page footer{margin-top:40px} .demo-page .assistant-prompts{max-width:760px;margin:auto}.demo-page .assistant-composer-wrap{max-width:760px}
`;
document.head.append(style);
createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
