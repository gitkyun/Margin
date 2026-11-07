import {
  BrandMark,
  BrandWordmark,
  AssistantMascot,
} from "@/components/brand/Brand";
import { useState, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { Link, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/icons";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { CloudShader } from "@/components/marketing/CloudShader";
import { CoverText, RevealLine } from "@/components/marketing/TextEffects";
import { FooterControls } from "@/components/marketing/FooterControls";
import { FooterDotField } from "@/components/marketing/FooterDotField";
import { PublicNavigation } from "@/components/marketing/PublicNavigation";
import {
  MergeFlow,
  SpotlightCard,
  ComparePreview,
} from "@/components/marketing/MarketingEffects";

const journey = [
  {
    label: "미팅 기록",
    icon: "microphone",
    title: "메모 속 피드백을, 다음 행동으로.",
    body: "녹음과 한국어 전사를 남기고, 원문에서 피드백·결정·질문을 골라 정리하세요.",
    color: "blue",
  },
  {
    label: "수정 방안",
    icon: "sparkles",
    title: "정답 하나 대신, 선택할 수 있는 방법.",
    body: "AI가 제안한 수정 방안과 가정을 읽고, 내 연구에 맞는 방법을 선택하세요.",
    color: "sky",
  },
  {
    label: "원고 작성",
    icon: "edit",
    title: "고친 내용과 이유가 함께 남도록.",
    body: "원고를 작성하고 버전을 비교하세요. 검토할 때는 당시 파일을 그대로 보냅니다.",
    color: "azure",
  },
  {
    label: "교수 검토",
    icon: "check-circle",
    title: "무엇을 확인받았는지, 분명하게.",
    body: "수정 설명과 파일을 한 링크로 모으세요. 항목별 교수 의견은 보낸 버전에 남습니다.",
    color: "ice",
  },
];

function ResearchMark({ small = false }: { small?: boolean }) {
  return <BrandMark className={`lp-mark ${small ? "lp-mark-small" : ""}`} />;
}
function AssistantFace({
  active = false,
  size = 40,
}: {
  active?: boolean;
  size?: number;
}) {
  return (
    <AssistantMascot
      state={active ? "thinking" : "idea"}
      active={active}
      size={size}
    />
  );
}
export function PublicFrame({
  children,
  compact = false,
  signedIn = false,
}: {
  children: ReactNode;
  compact?: boolean;
  signedIn?: boolean;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div
      className={`public-site lp-site ${compact ? "public-compact lp-compact" : ""}`}
    >
      <a className="skip-link" href="#public-main">
        본문으로 이동
      </a>
      <header className="lp-header">
        <div className="lp-nav-shell">
          <Link to="/" className="lp-brand" aria-label="Margin 소개">
            <ResearchMark small />
            <BrandWordmark />
          </Link>
          <PublicNavigation
            open={menu}
            signedIn={signedIn}
            onNavigate={() => setMenu(false)}
          />
          <div className="lp-nav-actions">
            {!signedIn && (
              <Link className="lp-login" to="/login">
                로그인
              </Link>
            )}
            <Link
              className="lp-button lp-button-dark lp-button-small"
              to={signedIn ? "/r" : "/signup"}
            >
              {signedIn ? "연구 이어가기" : "시작하기"}
              <Icon name="arrow-up-right" size={16} />
            </Link>
            <button
              className="lp-menu-toggle"
              aria-label="소개 메뉴"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Icon name={menu ? "close" : "menu"} size={22} />
            </button>
          </div>
        </div>
      </header>
      <main id="public-main">{children}</main>
      <footer className="lp-footer" id="footer">
        <FooterDotField />
        <div className="lp-footer-inner">
          <div className="lp-footer-intro">
            <Link className="lp-brand" to="/">
              <ResearchMark />
              <BrandWordmark />
            </Link>
            <p>
              미팅에서 나온 한마디가
              <br />
              다음 연구로 이어지는 곳.
            </p>
            <Link className="lp-footer-start" to={signedIn ? "/r" : "/login"}>
              연구 이어가기
              <Icon name="arrow-up-right" size={18} />
            </Link>
          </div>
          <div className="lp-footer-columns">
            <div>
              <h3>서비스</h3>
              <Link to="/">서비스 소개</Link>
              <Link to="/features">주요 기능</Link>
              <Link to="/pricing">구독 플랜</Link>
              <Link to={signedIn ? "/r" : "/login"}>
                {signedIn ? "내 연구" : "로그인"}
              </Link>
            </div>
            <div>
              <h3>연구 흐름</h3>
              <Link to="/features?view=meeting">미팅과 기록</Link>
              <Link to="/features?view=ai">AI와 수정 방안</Link>
              <Link to="/features?view=writing">작성과 버전 비교</Link>
              <Link to="/features?view=review">교수 검토</Link>
            </div>
            <div>
              <h3>도움말</h3>
              <Link to="/guide">서비스 안내</Link>
              <Link to="/guide#questions">자주 묻는 질문</Link>
              <Link to="/privacy">자료와 개인정보</Link>
              <Link to="/signup">가입 과정 살펴보기</Link>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} Margin</span>
            <span>지난 지도를, 다음 연구로.</span>
            <FooterControls />
          </div>
        </div>
      </footer>
    </div>
  );
}
function ProductPreview({ index }: { index: number }) {
  const content = [
    <div className="lp-preview-note" key="note">
      <span className="lp-preview-tag">
        <Icon name="microphone" size={14} />
        미팅 원문
      </span>
      <h4>비교 기준을 더 분명히 해볼까요?</h4>
      <p>
        연구 목적, 자료 수집 방법, 분석 관점을 나누어 비교해 주세요. 다음
        미팅에는 기준을 고른 이유도 설명해 주세요.
      </p>
      <div className="lp-note-candidates">
        <span>
          <Icon name="feedback" size={16} />
          피드백 1개
        </span>
        <span>
          <Icon name="tasks" size={16} />
          준비할 작업
        </span>
        <span>
          <Icon name="help" size={16} />
          다음 질문
        </span>
      </div>
    </div>,
    <div className="lp-preview-ai" key="ai">
      <div className="lp-assistant-name">
        <AssistantFace />
        <span>
          연구 도우미<small>선택한 피드백으로 수정 방안 제안</small>
        </span>
      </div>
      <div className="lp-method">
        <span>방법 1</span>
        <h4>세 가지 기준으로 비교표 다시 만들기</h4>
        <p>연구 목적 · 자료 수집 방법 · 분석 관점</p>
        <span className="lp-example-selected">
          <Icon name="check" size={14} />이 방법으로 준비
        </span>
      </div>
      <div className="lp-method lp-method-alt">
        <span>방법 2</span>
        <h4>핵심 선행연구 두 편을 깊게 비교하기</h4>
      </div>
      <div className="lp-model-meta">
        <Icon name="sparkles" size={14} />
        차근차근<em>사용 예시 · 실제 실행 아님</em>
      </div>
    </div>,
    <div className="lp-preview-writing" key="writing">
      <div className="lp-version-top">
        <span>
          <Icon name="file" size={16} />
          연구 계획서
        </span>
        <span>보존 버전 v2</span>
      </div>
      <h4>2. 선행연구 비교</h4>
      <p>
        본 연구는 선행연구를 <mark>연구 목적, 자료 수집 방법, 분석 관점</mark>에
        따라 비교한다.
      </p>
      <div className="lp-writing-ghosts">
        <i />
        <i />
        <i />
      </div>
      <div className="lp-version-bottom">
        <span>
          <Icon name="check-circle" size={14} />
          수정 이유와 함께 저장
        </span>
        <Icon name="layers" size={18} />
      </div>
    </div>,
    <div className="lp-preview-review" key="review">
      <span className="lp-preview-tag">
        <Icon name="lock" size={14} />
        지정 교수에게 공유
      </span>
      <h4>선행연구 비교표 수정</h4>
      <p>비교 기준을 세 가지로 나누고, 각 기준을 선택한 이유를 덧붙였습니다.</p>
      <div className="lp-review-file">
        <Icon name="file" size={23} />
        <span>
          연구계획서_v2.pdf<small>4~5쪽 · 보낸 파일 보존</small>
        </span>
      </div>
      <div className="lp-reviewed">
        <Icon name="check-circle" size={17} />
        수정 내용 확인
      </div>
    </div>,
  ];
  return (
    <div className="lp-product-window">
      <div className="lp-window-top">
        <span className="lp-window-dots">
          <i />
          <i />
          <i />
        </span>
        <span>나의 연구</span>
        <span className="lp-window-example">사용 예시</span>
      </div>
      <div className="lp-window-body">
        <div className="lp-mini-sidebar" aria-hidden="true">
          <ResearchMark small />
          {["home", "calendar", "edit", "feedback", "folder"].map((icon) => (
            <span
              key={icon}
              className={icon === journey[index].icon ? "selected" : ""}
            >
              <Icon name={icon} size={18} />
            </span>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            className="lp-window-content"
            key={index}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
          >
            {content[index]}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
export function LandingPage({ signedIn = false }: { signedIn?: boolean }) {
  const { resolvedTheme } = useTheme();
  const [scene, setScene] = useState(0),
    [feature, setFeature] = useState(0);
  const reduced = useReducedMotion();
  return (
    <PublicFrame signedIn={signedIn}>
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-hero-intro">
            <ResearchMark small />
            논문을 쓰는 사람의 작업 공간
          </span>
          <h1>
            <RevealLine>지난 지도를,</RevealLine>
            <br />
            <RevealLine delay={0.12}>
              <CoverText>다음 연구로.</CoverText>
            </RevealLine>
          </h1>
          <p>
            기록하고, 고치고, 확인받는 일.
            <br />
            흩어져 있던 연구의 흐름을 한곳에서 이어가세요.
          </p>
          <div className="lp-hero-actions">
            <Link
              className="lp-button lp-button-dark"
              to={signedIn ? "/r" : "/signup"}
            >
              {signedIn ? "연구 공간 열기" : "연구 시작하기"}
              <Icon name="arrow-up-right" size={19} />
            </Link>
            <a className="lp-button lp-button-light" href="#workflow">
              어떻게 쓰나요?
              <Icon name="chevron-down" size={16} />
            </a>
          </div>
        </div>
        <div className="lp-hero-stage">
          <CloudShader
            className="lp-cloud"
            speed={0.35}
            count={3}
            cloudColor={resolvedTheme === "dark" ? "#24334a" : "#f8fbff"}
            skyTopColor={resolvedTheme === "dark" ? "#080d1a" : "#72afea"}
            skyBottomColor={resolvedTheme === "dark" ? "#121d30" : "#d6eafe"}
            sunIntensity={0}
          />
          <div className="lp-hero-demo">
            <div
              className="lp-demo-tabs"
              role="group"
              aria-label="연구 흐름 미리보기"
            >
              {journey.map((item, i) => (
                <button
                  key={item.label}
                  aria-pressed={scene === i}
                  onClick={() => setScene(i)}
                >
                  <Icon name={item.icon} size={16} />
                  {item.label}
                </button>
              ))}
            </div>
            <ProductPreview index={scene} />
          </div>
          <span className="lp-hero-caption">
            미팅 메모부터 교수 확인까지, 같은 기록으로.
          </span>
        </div>
      </section>
      <section className="lp-section lp-features" id="features">
        <div className="lp-section-heading">
          <h2>
            정리로 끝나지 않도록.
            <br />
            <RevealLine>다음 작업까지 연결하세요.</RevealLine>
          </h2>
          <p>
            미팅마다 다시 찾던 기록을 모으고,
            <br />
            지금 필요한 일에 집중할 수 있게.
          </p>
        </div>
        <div className="lp-bento">
          <SpotlightCard className="lp-feature-card lp-feature-wide">
            <div className="lp-feature-visual lp-merge-visual">
              <MergeFlow />
            </div>
            <div className="lp-feature-copy">
              <span className="lp-feature-icon">
                <Icon name="layers" size={22} />
              </span>
              <h3>여러 기록, 하나의 맥락.</h3>
              <p>
                미팅 메모와 피드백, 자료가 연결됩니다.
                <br />
                어떤 의견에서 시작한 작업인지 다시 찾을 수 있어요.
              </p>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-ai">
            <div className="lp-feature-visual">
              <div className="lp-cute-chat">
                <AssistantFace size={64} />
                <div className="lp-chat-bubble">
                  비교표를 어떻게 고칠까요?<span>선택한 피드백 · 1개</span>
                </div>
                <div className="lp-chat-response">
                  <Icon name="sparkles" size={17} />두 가지 방법을 비교해
                  볼게요.
                </div>
                <div className="lp-chat-composer">
                  <span>궁금한 내용을 적어보세요</span>
                  <Icon name="paperclip" size={16} />
                  <span className="lp-think-chip">
                    차근차근
                    <Icon name="chevron-down" size={11} />
                  </span>
                  <Icon name="arrow-up" size={17} />
                </div>
              </div>
            </div>
            <div className="lp-feature-copy">
              <span className="lp-feature-icon">
                <Icon name="sparkles" size={22} />
              </span>
              <h3>생각을 이어주는 연구 도우미.</h3>
              <p>
                원문에서 확인한 내용과 AI의 제안을 나눠 읽고,
                <br />내 연구에 맞는 방법을 고릅니다.
              </p>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-writing">
            <div className="lp-feature-visual" id="writing-preview">
              <ComparePreview
                before="선행연구를 비교해 보았다. 기존 연구와 차이가 있다."
                after="선행연구를 연구 목적·자료 수집 방법·분석 관점에 따라 비교하였다."
              />
            </div>
            <div className="lp-feature-copy">
              <span className="lp-feature-icon">
                <Icon name="edit" size={22} />
              </span>
              <h3>원고는 바뀌어도, 맥락은 그대로.</h3>
              <p>이전 버전과 바뀐 문장을 비교하고, 고친 이유를 남기세요.</p>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-review">
            <div className="lp-feature-visual" id="review-preview">
              <div className="lp-review-stack">
                <div>
                  <Icon name="file" size={22} />
                  <span>
                    연구계획서_v2.pdf<small>당시 설명과 파일을 함께 보존</small>
                  </span>
                  <span>v2</span>
                </div>
                <div>
                  <span className="lp-professor-avatar">교</span>
                  <span>
                    비교 기준이 더 명확해졌네요.<small>수정 내용 확인</small>
                  </span>
                  <Icon name="check-circle" size={22} />
                </div>
              </div>
            </div>
            <div className="lp-feature-copy">
              <span className="lp-feature-icon">
                <Icon name="check-circle" size={22} />
              </span>
              <h3>교수님에게는 고른 결과만.</h3>
              <p>수정한 항목을 한 링크로 보내고, 각 항목에 의견을 받습니다.</p>
            </div>
          </SpotlightCard>
        </div>
      </section>
      <section className="lp-workflow" id="workflow">
        <div className="lp-workflow-select">
          <h2>연구의 어느 순간에도.</h2>
          <div role="group" aria-label="기능별 사용 방법">
            {journey.map((j, i) => (
              <button
                key={j.label}
                onClick={() => setFeature(i)}
                aria-pressed={feature === i}
              >
                <Icon name={j.icon} size={23} />
                {j.label}
                <Icon name="arrow-up-right" size={19} />
              </button>
            ))}
          </div>
          <p>
            직접 작성해도, AI의 도움을 받아도.
            <br />
            기록은 같은 곳에 이어집니다.
          </p>
        </div>
        <div
          className={`lp-workflow-preview lp-tone-${journey[feature].color}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={feature}
              initial={{ opacity: 0, y: reduced ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h3>{journey[feature].title}</h3>
              <p>{journey[feature].body}</p>
              <ProductPreview index={feature} />
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
      <section className="lp-section lp-capabilities" id="ai-work">
        <div className="lp-section-heading">
          <h2>
            복잡한 연구에도,
            <br />
            단정한 작업 공간.
          </h2>
          <p>필요할 때 열고, 필요한 만큼 사용하세요.</p>
        </div>
        <div className="lp-capability-row">
          {[
            {
              icon: "microphone",
              title: "말한 내용은 기록으로",
              body: "녹음과 한국어 전사로 미팅을 남깁니다.",
            },
            {
              icon: "calendar",
              title: "다음 미팅은 분명하게",
              body: "보여줄 작업과 질문, 준비할 자료를 모읍니다.",
            },
            {
              icon: "folder",
              title: "자료는 찾기 쉽게",
              body: "자료와 버전을 나누고 관련 기록으로 이동합니다.",
            },
            {
              icon: "users",
              title: "함께할 때는 함께",
              body: "참여자를 추가해 공동 기록과 일정을 나눕니다.",
            },
          ].map((c) => (
            <SpotlightCard key={c.title} className="lp-capability">
              <Icon name={c.icon} size={27} />
              <div>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </div>
              <span className="lp-capability-arrow">
                <Icon name="arrow-up-right" size={20} />
              </span>
            </SpotlightCard>
          ))}
        </div>
      </section>
      <section className="lp-section lp-pricing" id="plans">
        <div className="lp-section-heading lp-heading-centered">
          <h2>연구의 크기에 맞는 플랜.</h2>
          <p>혼자 시작하는 논문부터, 함께하는 연구까지.</p>
        </div>
        <SubscriptionPlans publicView signedIn={signedIn} />
      </section>
      <section className="lp-section lp-faq" id="faq">
        <div>
          <h2>
            궁금한 점이
            <br />
            남아 있나요?
          </h2>
          <Link to="/guide">
            서비스 안내 보기
            <Icon name="arrow-up-right" size={17} />
          </Link>
        </div>
        <div className="lp-faq-list">
          {[
            [
              "AI 없이도 사용할 수 있나요?",
              "네. 메모 정리부터 수정 방안, 작업과 교수 검토까지 직접 작성할 수 있습니다. AI는 선택한 기록으로 실행하고, 채택한 내용만 저장합니다.",
            ],
            [
              "교수님에게는 어디까지 보이나요?",
              "지정한 교수 계정에 공유한 검토 항목과 첨부 파일만 공개됩니다. 개인 메모와 AI 대화, 미채택 제안은 자동 공유되지 않습니다.",
            ],
            [
              "동료와 함께 쓰려면 어떻게 하나요?",
              "연구 설정에서 참여자를 추가하세요. 참여한 계정이 생기면 공동 기록과 작업, 일정 조율을 사용할 수 있습니다. 교수의 검토 권한은 공동 편집 권한과 다릅니다.",
            ],
            [
              "다시 수정하면 이전 검토는 사라지나요?",
              "보낸 설명과 파일, 교수 응답은 당시 버전에 남습니다. 바뀐 항목에 재확인을 요청하면 새 검토 차수가 추가됩니다.",
            ],
            [
              "지금 가입하거나 결제할 수 있나요?",
              "현재 접속은 발급받은 계정으로 진행합니다. 가입 과정은 미리 살펴볼 수 있으며 실제 계정은 생성되지 않습니다. 유료 플랜의 결제는 아직 열리지 않았습니다.",
            ],
          ].map(([q, a]) => (
            <details key={q}>
              <summary>
                {q}
                <Icon name="plus" size={19} />
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="lp-close">
        <BrandMark inverse />
        <h2>
          다음 미팅을,
          <br />
          조금 더 분명하게.
        </h2>
        <p>지난 기록을 찾는 시간에서, 연구를 이어가는 시간으로.</p>
        <Link
          className="lp-button lp-button-dark"
          to={signedIn ? "/r" : "/login"}
        >
          {signedIn ? "연구 이어가기" : "Margin 시작하기"}
          <Icon name="arrow-up-right" size={20} />
        </Link>
      </section>
    </PublicFrame>
  );
}

const tourViews = ["meeting", "ai", "writing", "review"];
const tourDetails = [
  [
    [
      "남길 내용",
      "미팅 메모, 녹음과 한국어 전사, 다음에 확인할 질문을 모읍니다.",
    ],
    [
      "이어지는 작업",
      "원문을 보며 피드백·결정·질문을 직접 정리하거나 AI 정리 후보를 선택합니다.",
    ],
    [
      "다음 미팅",
      "할 일과 자료를 준비 목록에 넣고, 지난 기록으로 돌아갈 수 있습니다.",
    ],
  ],
  [
    ["사용할 근거", "도움을 받을 피드백과 원문·자료 범위를 먼저 선택합니다."],
    [
      "읽고 판단하기",
      "원문에서 확인한 내용, 제안하는 방법, 확인할 가정을 나누어 읽습니다.",
    ],
    [
      "실제 반영",
      "고른 방법을 편집해 저장하고 할 일로 연결합니다. 채택하지 않은 후보는 공유되지 않습니다.",
    ],
  ],
  [
    [
      "작성할 문서",
      "연구 계획서와 원고를 작성하고 명시적으로 보존 버전을 남깁니다.",
    ],
    [
      "변경 비교",
      "두 버전의 바뀐 문장을 비교합니다. 이전 내용을 복원해도 새로운 버전으로 남습니다.",
    ],
    [
      "검토 준비",
      "수정 설명과 당시 PDF를 묶어 교수에게 보낼 항목을 준비합니다.",
    ],
  ],
  [
    ["공유할 범위", "지정 교수 계정에 수정한 항목과 당시 파일만 공개합니다."],
    [
      "항목별 의견",
      "교수는 ‘수정 내용 확인’ 또는 이유 댓글을 포함한 ‘추가 수정 필요’를 남깁니다.",
    ],
    [
      "다시 고친 뒤",
      "바뀐 항목만 재확인을 요청합니다. 이전 파일과 응답은 당시 차수에 보존됩니다.",
    ],
  ],
];

export function FeatureTourPage({ signedIn = false }: { signedIn?: boolean }) {
  const [params, setParams] = useSearchParams();
  const selected = Math.max(
    0,
    tourViews.indexOf(params.get("view") ?? "meeting"),
  );
  return (
    <PublicFrame signedIn={signedIn}>
      <section className="lp-section lp-destination">
        <div className="lp-destination-heading">
          <h1>기록이 다음 연구로 이어지는 방법.</h1>
          <p>미팅을 남기고, 방법을 고르고, 바꾼 결과를 확인받기까지.</p>
        </div>
        <div className="lp-tour-layout">
          <div
            className="lp-tour-index"
            role="group"
            aria-label="둘러볼 기능 선택"
          >
            {journey.map((item, index) => (
              <button
                key={item.label}
                aria-pressed={selected === index}
                onClick={() =>
                  setParams(
                    { view: tourViews[index] },
                    { preventScrollReset: true },
                  )
                }
              >
                <Icon name={item.icon} size={21} />
                <span>{item.label}</span>
                <Icon name="arrow-right" size={17} />
              </button>
            ))}
            <Link className="lp-tour-guide" to="/guide">
              처음 사용한다면 <Icon name="arrow-up-right" size={16} />
            </Link>
          </div>
          <div
            className={`lp-workflow-preview lp-tour-preview lp-tone-${journey[selected].color}`}
          >
            <div>
              <h2>{journey[selected].title}</h2>
              <p>{journey[selected].body}</p>
              <ProductPreview index={selected} />
            </div>
          </div>
        </div>
        <dl className="lp-tour-details">
          {tourDetails[selected].map(([title, description]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
        <div className="lp-destination-next">
          <span>기록을 연구로 이어가 볼까요?</span>
          <Link
            className="lp-button lp-button-dark"
            to={signedIn ? "/r" : "/login"}
          >
            {signedIn ? "연구 공간 열기" : "시작하기"}
            <Icon name="arrow-right" size={18} />
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}

export function PricingPage({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <PublicFrame signedIn={signedIn}>
      <section className="lp-section lp-destination lp-pricing">
        <div className="lp-destination-heading lp-heading-centered">
          <h1>연구하는 방식에 맞는 플랜.</h1>
          <p>기본 연구 공간으로 시작하고, 필요한 만큼 넓혀가세요.</p>
        </div>
        <SubscriptionPlans publicView signedIn={signedIn} />
        <div className="lp-plan-help">
          <Icon name="users" size={24} />
          <div>
            <h2>함께 쓴다고 Team 결제가 필요한가요?</h2>
            <p>
              공동 기록은 연구에 참여자를 추가하면 사용할 수 있습니다. Team은
              연구실 운영을 위한 후속 플랜이며, 현재 결제는 열리지 않았습니다.
            </p>
            <Link to="/guide#questions">
              사용 안내에서 더 알아보기 <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}

export function SignupPage() {
  const [step, setStep] = useState(0),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState("student");
  return (
    <PublicFrame compact>
      <section className="signup-layout">
        <div className="auth-story">
          <h1>
            연구의 다음 장을
            <br />
            함께 열어보세요.
          </h1>
          <p>
            기록은 차곡차곡,
            <br />
            다음 할 일은 분명하게.
          </p>
          <div className="auth-proof">
            <Icon name="lock" size={19} />
            <span>
              개인 기록은 비공개로 시작합니다.
              <br />
              교수에게는 직접 고른 결과만 공유합니다.
            </span>
          </div>
        </div>
        <div className="auth-panel">
          <span className="demo-label">회원가입 흐름 미리보기</span>
          {step === 0 ? (
            <>
              <h2>Margin 시작하기</h2>
              <p>
                지금은 가입 과정을 살펴보는 시연 화면입니다.
                <br />
                입력한 정보는 서버로 전송하지 않습니다.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setPassword("");
                  setStep(1);
                }}
              >
                <label className="field">
                  이름
                  <input
                    className="rms-input"
                    required
                    maxLength={40}
                    autoComplete="off"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름을 입력하세요"
                  />
                </label>
                <label className="field">
                  이메일
                  <input
                    className="rms-input"
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.ac.kr"
                  />
                </label>
                <label className="field">
                  비밀번호
                  <input
                    className="rms-input"
                    type="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="시연용으로 12자 이상 입력하세요"
                  />
                  <small>실제로 사용하는 비밀번호를 입력하지 마세요.</small>
                </label>
                <fieldset className="role-choice">
                  <legend>어떤 목적으로 사용하나요?</legend>
                  {[
                    ["student", "학생", "내 연구 기록과 수정 관리"],
                    ["professor", "교수", "공유받은 결과 검토"],
                  ].map(([v, l, d]) => (
                    <label key={v} className={role === v ? "selected" : ""}>
                      <input
                        type="radio"
                        name="role"
                        value={v}
                        checked={role === v}
                        onChange={() => setRole(v)}
                      />
                      <strong>{l}</strong>
                      <small>{d}</small>
                    </label>
                  ))}
                </fieldset>
                <button className="rms-action primary full" type="submit">
                  가입 과정 미리보기
                  <Icon name="arrow-right" size={18} />
                </button>
              </form>
              <p className="auth-switch">
                발급받은 계정이 있나요? <Link to="/login">로그인</Link>
              </p>
            </>
          ) : (
            <div className="signup-finish" role="status">
              <Icon name="check-circle" size={38} />
              <h2>
                {name}님,
                <br />
                가입 과정을 확인했어요.
              </h2>
              <p>
                {email}
                <br />
                선택한 이용 목적: {role === "student" ? "학생" : "교수"}
              </p>
              <p>
                실제 계정은 생성되지 않았고,
                <br />
                인증 메일도 발송되지 않았습니다.
              </p>
              <Link className="rms-action primary full" to="/login">
                발급 계정으로 로그인
                <Icon name="arrow-right" size={18} />
              </Link>
              <button
                className="rms-action quiet full"
                onClick={() => setStep(0)}
              >
                입력 화면으로 돌아가기
              </button>
            </div>
          )}
        </div>
      </section>
    </PublicFrame>
  );
}
export function InfoPage({
  privacy = false,
  signedIn = false,
}: {
  privacy?: boolean;
  signedIn?: boolean;
}) {
  return (
    <PublicFrame compact signedIn={signedIn}>
      <article className="public-article">
        <Link to="/" className="text-link">
          <Icon name="arrow-left" size={16} />
          서비스 소개
        </Link>
        <h1>{privacy ? "자료와 개인정보" : "Margin 사용 안내"}</h1>
        <p>
          {privacy
            ? "현재 Margin는 수업 시연을 위한 제한 공개 서비스입니다. 아래 내용은 현재 구현 상태에 대한 안내이며 정식 서비스의 이용약관이나 개인정보 처리방침을 대신하지 않습니다."
            : "미팅 기록에서 시작해 수정 방법을 고르고, 결과를 확인받은 뒤 다음 미팅을 준비합니다."}
        </p>
        {(privacy
          ? [
              [
                "개인 기록과 공유",
                "로그인한 학생의 기록은 기본적으로 비공개입니다. 지정 교수에게 보낸 검토 항목과 당시 파일만 공유합니다.",
              ],
              [
                "AI 처리",
                "AI는 선택한 기록과 입력한 질문을 처리하도록 설계했습니다. 현재는 키를 연결하지 않아 실제 Gemini 응답이 생성되지 않습니다. 연결 검증에는 가상 자료만 사용합니다.",
              ],
              [
                "저장과 가입",
                "연구 기록과 파일은 Supabase에 저장합니다. 회원가입 화면은 시연용이며 입력한 정보로 계정을 만들거나 메일을 보내지 않습니다.",
              ],
            ]
          : [
              [
                "미팅을 남기세요",
                "연구를 만들고 날짜가 정해졌거나 아직 미정인 미팅을 등록하세요. 메모는 자동 저장됩니다.",
              ],
              [
                "수정 방법을 고르세요",
                "피드백을 직접 정리하거나 선택한 원문에서 AI 정리를 요청하세요. 필요한 작업과 수정 결과를 연결하세요.",
              ],
              [
                "교수에게 결과를 보내세요",
                "수정 설명, 파일, 확인 위치를 준비해 지정 교수에게 검토 링크를 전달하세요. 추가 수정이 필요하면 같은 항목에 재확인을 요청하세요.",
              ],
            ]
        ).map(([title, body]) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
        {!privacy && (
          <section className="lp-guide-questions" id="questions">
            <h2>자주 묻는 질문</h2>
            <div className="lp-faq-list">
              {[
                [
                  "AI를 꼭 사용해야 하나요?",
                  "아니요. 메모·피드백·수정 방법과 할 일은 직접 작성할 수 있습니다. AI는 선택한 자료로 요청할 때만 실행합니다.",
                ],
                [
                  "함께 연구하려면 어떻게 하나요?",
                  "연구 설정의 참여자에서 동료를 추가하세요. 다른 활성 참여자가 생기면 공동 기록을 선택할 수 있습니다. 개인 메모와 AI 대화는 자동 공개되지 않습니다.",
                ],
                [
                  "교수에게 어떤 내용이 보이나요?",
                  "지정한 교수 계정은 공유된 검토 항목과 당시 파일을 봅니다. 학생의 개인 메모·대화·전체 작업에는 접근하지 않습니다.",
                ],
                [
                  "원고를 고치면 이전 확인은 어떻게 되나요?",
                  "교수 응답은 보낸 당시 버전에 남습니다. 변경한 항목에 재확인을 요청하면 새 차수가 생깁니다.",
                ],
                [
                  "지금 가입하거나 결제할 수 있나요?",
                  "현재는 발급 계정으로 접속합니다. 가입 화면은 과정 미리보기이며 실제 계정·인증 메일을 만들지 않습니다. Free는 ₩0, Pro·Team은 출시 예정으로 결제는 열리지 않았습니다.",
                ],
              ].map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <Icon name="plus" size={18} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
        <Link className="rms-action primary" to={signedIn ? "/r" : "/login"}>
          {signedIn ? "연구 이어가기" : "시작하기"}
          <Icon name="arrow-right" size={17} />
        </Link>
      </article>
    </PublicFrame>
  );
}
