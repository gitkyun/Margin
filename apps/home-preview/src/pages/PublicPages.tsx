import { MIN_PASSWORD_LENGTH, PASSWORD_HELP } from "../lib/password-policy";
import { Input } from "@/components/ui/input";
import {
  BrandMark,
  BrandWordmark,
  AssistantMascot,
} from "@/components/brand/Brand";
import { useState, useEffect, type ReactNode } from "react";
import { useTheme } from "@/lib/theme";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/icons";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { CloudShader } from "@/components/marketing/CloudShader";
import { CoverText, RevealLine } from "@/components/marketing/TextEffects";
import { FooterControls } from "@/components/marketing/FooterControls";
import { FooterGlyphField } from "@/components/marketing/FooterGlyphField";
import { PublicNavigation } from "@/components/marketing/PublicNavigation";
import {
  WorkflowStack,
  useStackedWorkflow,
} from "@/components/marketing/WorkflowStack";
import {
  MergeFlow,
  SpotlightCard,
  StartGlow,
  ComparePreview,
} from "@/components/marketing/MarketingEffects";
import { Button } from "@/components/ui/button";
import { GuideReplay } from "@/components/GuideReplay";

/** 히어로 제목 등장(최대 600ms)이 끝난 뒤에 시작 버튼 강조를 돌립니다. */
const HERO_SETTLE_MS = 700;

const journey = [
  {
    label: "미팅 기록",
    icon: "mic",
    title: "미팅 원문에서 피드백을 골라내요",
    body: "녹음과 한국어 전사로 미팅을 남기고, 피드백, 결정 사항, 질문을 나눠 정리하세요.",
    color: "blue",
  },
  {
    label: "수정 방법",
    icon: "sparkles",
    title: "정답 대신 고를 수 있는 수정 방법",
    body: "연구 도우미가 제안한 수정 방법과 가정을 읽고, 내 연구에 맞는 방법을 선택하세요.",
    color: "sky",
  },
  {
    label: "원고 작성",
    icon: "edit",
    title: "버전을 남기고 바뀐 문장을 비교해요",
    body: "저장만으로는 버전이 생기지 않아요. 비교하고 싶은 시점에 직접 남기세요.",
    color: "azure",
  },
  {
    label: "교수 검토",
    icon: "check-circle",
    title: "항목마다 교수님 응답을 받아요",
    body: "수정 설명과 파일을 검토 링크 하나로 묶어, 교수님께 직접 전달하세요.",
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
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(decodeURIComponent(location.hash.slice(1)))
        ?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);
  return (
    <div
      className={`public-site lp-site ${compact ? "public-compact lp-compact" : ""}`}
    >
      <a className="skip-link" href="#public-main">
        본문으로 이동
      </a>
      <header className="lp-header">
        <div className="lp-nav-shell">
          <Link to="/" className="lp-brand" aria-label="마진(Margin) 홈">
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
            <Button asChild>
              <Link to={signedIn ? "/r" : "/signup"}>
                {signedIn ? "내 연구 열기" : "시작하기"}
                <Icon name="arrow-up-right" size={16} />
              </Link>
            </Button>
            <button
              className="lp-menu-toggle"
              aria-label="메뉴"
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
        <FooterGlyphField />
        <div className="lp-footer-inner">
          <div className="lp-footer-intro">
            <Link className="lp-brand" to="/" aria-label="마진(Margin) 홈">
              <ResearchMark />
              <BrandWordmark />
            </Link>
            <p>
              미팅 기록과 피드백, 할 일, 원고 버전을
              <br />
              연구별로 정리해요.
            </p>
            <Link className="lp-footer-start" to={signedIn ? "/r" : "/login"}>
              내 연구 열기
              <Icon name="arrow-up-right" size={18} />
            </Link>
          </div>
          <div className="lp-footer-columns">
            <div>
              <h3>서비스</h3>
              <Link to="/">서비스 소개</Link>
              <Link to="/features">주요 기능</Link>
              <Link to="/pricing">플랜</Link>
              <a href="mailto:admin@margin.com">문의</a>
              <Link to={signedIn ? "/r" : "/login"}>
                {signedIn ? "내 연구" : "로그인"}
              </Link>
            </div>
            <div>
              <h3>기능</h3>
              <Link to="/features?view=meeting">미팅과 기록</Link>
              <Link to="/features?view=ai">AI와 수정 방법</Link>
              <Link to="/features?view=writing">작성과 버전 비교</Link>
              <Link to="/features?view=review">교수 검토</Link>
            </div>
            <div>
              <h3>도움말</h3>
              <Link to="/guide">사용 안내</Link>
              <Link to="/guide#questions">자주 묻는 질문</Link>
              <Link to="/privacy">자료와 개인정보</Link>
              <Link to="/signup">가입 과정 미리보기</Link>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>© {new Date().getFullYear()} 마진</span>
            <span>흩어진 기록을 모아, 다음 연구가 되도록</span>
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
      <p className="lp-demo-title">비교 기준을 더 분명히 해볼까요?</p>
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
          결정 사항 1개
        </span>
        <span>
          <Icon name="help" size={16} />
          질문 1개
        </span>
      </div>
    </div>,
    <div className="lp-preview-ai" key="ai">
      <div className="lp-assistant-name">
        <AssistantFace />
        <span>
          연구 도우미<small>선택한 피드백으로 수정 방법 제안</small>
        </span>
      </div>
      <div className="lp-method">
        <span>방법 1</span>
        <p className="lp-demo-title">세 가지 기준으로 비교표 다시 만들기</p>
        <p>연구 목적 · 자료 수집 방법 · 분석 관점</p>
        <span className="lp-example-selected">
          <Icon name="check" size={14} />
          선택한 방법
        </span>
      </div>
      <div className="lp-method lp-method-alt">
        <span>방법 2</span>
        <p className="lp-demo-title">핵심 선행연구 두 편을 깊게 비교하기</p>
      </div>
      <div className="lp-model-meta">
        <Icon name="sparkles" size={14} />
        보통<em>예시 · 실제 AI 결과 아님</em>
      </div>
    </div>,
    <div className="lp-preview-writing" key="writing">
      <div className="lp-version-top">
        <span>
          <Icon name="file" size={16} />
          연구 계획서
        </span>
        <span>버전 v2</span>
      </div>
      <p className="lp-demo-title">2. 선행연구 비교</p>
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
          v1과 달라진 부분
        </span>
        <Icon name="layers" size={18} />
      </div>
    </div>,
    <div className="lp-preview-review" key="review">
      <span className="lp-preview-tag">
        <Icon name="lock" size={14} />
        지정 교수에게만 공개
      </span>
      <p className="lp-demo-title">선행연구 비교표 수정</p>
      <p>비교 기준을 세 가지로 나누고, 각 기준을 선택한 이유를 덧붙였습니다.</p>
      <div className="lp-review-file">
        <Icon name="file" size={23} />
        <span>
          연구계획서_v2.pdf<small>볼 위치 4~5쪽 · 보낸 파일 그대로</small>
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
        <span>내 연구</span>
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
            <div className="lp-window-filler" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
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
  const stacked = useStackedWorkflow();
  return (
    <PublicFrame signedIn={signedIn}>
      <section className="lp-hero">
        <div className="lp-hero-copy">
          <span className="lp-hero-intro">
            <ResearchMark small />
            논문을 쓰는 사람의 작업 공간
          </span>
          <h1>
            <RevealLine>흩어진 기록을 모아,</RevealLine>
            <br />
            <RevealLine delay={0.12}>
              <CoverText>다음 연구가 되도록</CoverText>
            </RevealLine>
          </h1>
          <p>
            미팅 메모, 피드백, 할 일, 원고 버전을 연구별로 정리하고
            <br />
            고친 내용은 교수님께 검토를 요청할 수 있어요.
          </p>
          <div className="lp-hero-actions">
            <StartGlow delay={HERO_SETTLE_MS}>
              <Button asChild size="lg">
                <Link to={signedIn ? "/r" : "/signup"}>
                  {signedIn ? "내 연구 열기" : "시작하기"}
                  <Icon name="arrow-up-right" size={19} />
                </Link>
              </Button>
            </StartGlow>
            <Button asChild variant="outline" size="lg">
              <a href="#workflow">
                사용 방법 보기
                <Icon name="chevron-down" size={16} />
              </a>
            </Button>
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
              aria-label="기능 미리보기"
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
            미팅 기록부터 교수 검토까지 한 연구에 모여요.
          </span>
        </div>
      </section>
      <section className="lp-section lp-features" id="features">
        <div className="lp-section-heading">
          <h2>
            피드백은 할 일로,
            <br />
            <RevealLine>수정 결과는 검토 요청으로</RevealLine>
          </h2>
          <p>
            지난 미팅 기록을 다시 뒤지지 않아도
            <br />
            남은 할 일을 바로 확인할 수 있어요.
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
              <h3>지난 피드백을 쉽게 찾아요</h3>
              <p>
                미팅 메모에서 정리한 피드백은 원문과 함께 남아요.
                <br />할 일에서도 연결된 피드백을 바로 확인할 수 있어요.
              </p>
              <Link className="lp-feature-more" to="/features?view=meeting">
                자세히 보기 <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-ai">
            <div className="lp-feature-visual">
              <div className="lp-cute-chat">
                <AssistantFace size={64} />
                <div className="lp-chat-bubble">
                  비교표를 어떻게 고칠까요?<span>선택한 피드백 1개</span>
                </div>
                <div className="lp-chat-response">
                  <Icon name="sparkles" size={17} />
                  수정 방법 두 가지를 제안할게요.
                </div>
                <div className="lp-chat-composer">
                  <span>궁금한 내용을 적어 주세요</span>
                  <Icon name="paperclip" size={16} />
                  <span className="lp-think-chip">
                    보통
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
              <h3>제안은 연구 도우미가, 선택은 내가</h3>
              <p>
                원문에서 확인한 내용과 AI 제안, 확인할 가정을
                <br />
                나눠서 보여 줘요.
              </p>
              <Link className="lp-feature-more" to="/features?view=ai">
                자세히 보기 <Icon name="arrow-right" size={15} />
              </Link>
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
              <h3>이전 원고와 바뀐 부분을 확인해요</h3>
              <p>
                비교할 버전은 직접 남기고, 고친 내용은 수정 결과로 정리하세요.
              </p>
              <Link className="lp-feature-more" to="/features?view=writing">
                자세히 보기 <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-review">
            <div className="lp-feature-visual" id="review-preview">
              <div className="lp-review-stack">
                <div>
                  <Icon name="file" size={22} />
                  <span>
                    연구계획서_v2.pdf<small>보낸 설명과 파일 그대로</small>
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
              <h3>교수님께는 검토 요청에 넣은 항목만 보여요</h3>
              <p>
                검토 링크를 만들어 직접 전달하면, 교수님이 항목마다 응답을
                남겨요.
              </p>
              <Link className="lp-feature-more" to="/features?view=review">
                자세히 보기 <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          </SpotlightCard>
        </div>
      </section>
      {stacked ? (
        <WorkflowStack
          steps={journey}
          renderPreview={(i) => <ProductPreview index={i} />}
        />
      ) : (
        <section className="lp-workflow" id="workflow">
          <div className="lp-workflow-select">
            <h2>이렇게 사용해요</h2>
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
              직접 쓰든 AI 제안을 선택하든
              <br />
              기록은 같은 연구에 남아요.
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
      )}
      <section className="lp-section lp-capabilities" id="ai-work">
        <div className="lp-section-heading">
          <h2>
            녹음부터 일정 조율까지,
            <br />
            연구에 필요한 기능
          </h2>
          <p>AI 없이도 기록, 자료, 일정 기능을 모두 쓸 수 있어요.</p>
        </div>
        <div className="lp-capability-row">
          {[
            {
              icon: "mic",
              title: "말한 내용은 기록으로",
              body: "녹음하면서 한국어 전사문도 함께 남길 수 있어요.",
            },
            {
              icon: "calendar",
              title: "다음 미팅은 미리 준비",
              body: "보여 드릴 할 일과 파일, 물어볼 질문을 모아 둬요.",
            },
            {
              icon: "folder",
              title: "자료는 찾기 쉽게",
              body: "파일은 버전별로 쌓이고, 그 파일을 쓴 기록으로 바로 갈 수 있어요.",
            },
            {
              icon: "users",
              title: "공동연구자와 함께",
              body: "동료를 초대해 공동 기록을 함께 쓰고 미팅 시간을 조율해요.",
            },
          ].map((c) => (
            <SpotlightCard key={c.title} className="lp-capability">
              <Link
                className="lp-capability-link"
                to={`/features?view=${({ mic: "meeting", calendar: "meeting", folder: "writing", users: "review" } as Record<string, string>)[c.icon]}`}
              >
                <Icon name={c.icon} size={27} />
                <div>
                  <h3>{c.title}</h3>
                  <p>{c.body}</p>
                </div>
                <span className="lp-capability-arrow">
                  <Icon name="arrow-up-right" size={20} />
                </span>
              </Link>
            </SpotlightCard>
          ))}
        </div>
      </section>
      <section className="lp-section lp-pricing" id="plans">
        <div className="lp-section-heading lp-heading-centered">
          <h2>연구 규모에 맞는 플랜</h2>
          <p>지금은 Free 플랜만 제공해요.</p>
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
            사용 안내 보기
            <Icon name="arrow-up-right" size={17} />
          </Link>
        </div>
        <div className="lp-faq-list">
          {[
            [
              "AI 없이도 사용할 수 있나요?",
              "네. 메모 정리부터 수정 방법, 할 일, 검토 요청까지 모두 AI 없이 할 수 있어요. AI는 선택한 기록으로만 실행되고, AI 제안은 직접 선택한 것만 기록에 들어가요. 선택하지 않은 AI 제안과 AI 대화도 저장되지만 나만 볼 수 있어요.",
            ],
            [
              "교수님께는 어디까지 보이나요?",
              "검토 요청에 넣은 항목과 첨부 파일만 지정한 교수 계정에 보여요. 개인 메모, AI 대화, 선택하지 않은 AI 제안은 교수님께 보이지 않아요.",
            ],
            [
              "동료와 함께 쓰려면 어떻게 하나요?",
              "연구 설정에서 마진 계정이 있는 동료를 초대하세요. 동료가 수락하면 공동 기록과 할 일, 일정 조율을 함께 쓸 수 있어요. 교수님의 검토 권한은 공동 편집 권한과 달라요.",
            ],
            [
              "다시 고치면 이전 검토는 사라지나요?",
              "아니요. 보낸 설명, 파일, 교수님 응답은 그때 그대로 남아요. 고친 항목에 다시 확인을 요청하면 2차, 3차 검토로 따로 쌓여요.",
            ],
            [
              "지금 가입하거나 결제할 수 있나요?",
              "아니요. 지금은 발급받은 계정으로만 로그인할 수 있어요. 가입 과정은 미리 볼 수 있지만 실제 계정은 만들어지지 않아요. 유료 플랜 결제도 아직 열리지 않았어요.",
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
          다음 미팅은
          <br />
          고친 내용부터
        </h2>
        <p>지난 기록을 다시 찾는 시간이 줄어요.</p>
        <StartGlow tone="on-brand">
          <Link
            className="lp-button lp-button-on-brand"
            to={signedIn ? "/r" : "/login"}
          >
            {signedIn ? "내 연구 열기" : "마진 시작하기"}
            <Icon name="arrow-up-right" size={20} />
          </Link>
        </StartGlow>
      </section>
    </PublicFrame>
  );
}

const tourViews = ["meeting", "ai", "writing", "review"];
const tourDetails = [
  [
    [
      "남길 내용",
      "미팅 메모, 녹음과 한국어 전사문, 다음에 물어볼 질문을 남겨요.",
    ],
    [
      "정리하기",
      "원문을 보며 피드백, 결정 사항, 질문을 직접 정리하거나 AI 제안 중 필요한 항목을 선택해요.",
    ],
    [
      "다음 미팅",
      "할 일과 자료를 다음 미팅 준비에 넣어 두고, 지난 기록도 다시 볼 수 있어요.",
    ],
  ],
  [
    ["사용할 기록", "연구 도우미가 읽을 피드백과 원문, 자료를 먼저 선택해요."],
    [
      "읽고 판단하기",
      "원문에서 확인한 내용, 제안하는 수정 방법, 확인할 가정을 나눠서 보여 줘요.",
    ],
    [
      "선택한 다음",
      "고른 방법은 고쳐서 저장하고, 필요하면 할 일로 만들어요. 선택하지 않은 AI 제안은 공유되지 않아요.",
    ],
  ],
  [
    [
      "작성할 문서",
      "연구 계획서와 원고를 쓰고, 비교할 버전은 저장과 따로 직접 남겨요.",
    ],
    [
      "버전 비교",
      "두 버전에서 바뀐 문장을 비교해요. 이전 버전으로 되돌려도 기존 버전은 지워지지 않고 새 버전이 생겨요.",
    ],
    [
      "검토 준비",
      "수정 설명과 그 시점의 PDF를 묶어 검토 요청에 넣을 항목을 준비해요.",
    ],
  ],
  [
    [
      "공개 범위",
      "지정한 교수 계정에만 검토 요청에 넣은 항목과 그때의 파일을 공개해요.",
    ],
    [
      "항목별 응답",
      "교수님은 항목마다 ‘수정 내용 확인’ 또는 ‘추가 수정 필요’를 남기고, ‘추가 수정 필요’에는 이유를 댓글로 적어요.",
    ],
    [
      "다시 고친 뒤",
      "고친 항목만 다시 확인을 요청할 수 있어요. 새 검토가 2차, 3차로 추가되고 이전 파일과 응답은 그대로 남아요.",
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
          <h1>미팅부터 교수 검토까지</h1>
          <p>기능마다 무엇을 남기고 다음에 무엇을 할 수 있는지 확인하세요.</p>
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
              처음이라면 사용 안내 보기 <Icon name="arrow-up-right" size={16} />
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
          <span>연구를 만들고 미팅 기록부터 시작하세요.</span>
          <Button asChild size="lg">
            <Link to={signedIn ? "/r" : "/login"}>
              {signedIn ? "내 연구 열기" : "로그인"}
              <Icon name="arrow-right" size={18} />
            </Link>
          </Button>
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
          <h1>연구 방식에 맞는 플랜</h1>
          <p>지금은 Free 플랜만 제공해요. Pro와 Team은 출시 예정이에요.</p>
        </div>
        <SubscriptionPlans publicView signedIn={signedIn} />
        <div className="lp-plan-help">
          <Icon name="users" size={24} />
          <div>
            <h2>함께 쓰려면 Team 플랜이 필요한가요?</h2>
            <p>
              아니요. 초대한 공동연구자가 수락하면 Free에서도 공동 기록을 쓸 수
              있어요. Team은 연구실 운영을 위해 준비 중인 플랜이고, 결제는 아직
              열리지 않았어요.
            </p>
            <Link to="/guide#questions">
              자주 묻는 질문 보기 <Icon name="arrow-right" size={16} />
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
            지난 미팅에서
            <br />
            다음 미팅까지
          </h1>
          <p>
            피드백, 할 일, 원고 버전, 교수님 응답을
            <br />
            연구별로 모아 둬요.
          </p>
          <div className="auth-proof">
            <Icon name="lock" size={19} />
            <span>
              공동연구자가 참여하기 전에는 기록을 나만 볼 수 있어요.
              <br />
              교수님께는 검토 요청에 넣은 항목만 보여요.
            </span>
          </div>
        </div>
        <div className="auth-panel">
          <span className="demo-label">가입 과정 미리보기</span>
          {step === 0 ? (
            <>
              <h2>마진 시작하기</h2>
              <p>
                가입 과정을 미리 보는 화면이에요.
                <br />
                실제 계정은 만들어지지 않고, 입력한 정보는 서버로 보내지 않아요.
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
                  <Input
                    required
                    maxLength={40}
                    autoComplete="off"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 홍길동"
                  />
                </label>
                <label className="field">
                  이메일
                  <Input
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
                  <Input
                    type="password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={PASSWORD_HELP}
                  />
                  <small>실제로 쓰는 비밀번호는 입력하지 마세요.</small>
                </label>
                <fieldset className="role-choice">
                  <legend>어떤 목적으로 사용하나요?</legend>
                  {[
                    ["student", "학생", "내 연구 기록과 수정 관리"],
                    ["professor", "교수", "학생의 검토 요청 확인"],
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
                <Button fullWidth size="lg" type="submit">
                  가입 미리보기 마치기
                  <Icon name="arrow-right" size={18} />
                </Button>
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
                가입 미리보기를 마쳤어요
              </h2>
              <p>
                {email}
                <br />
                선택한 이용 목적: {role === "student" ? "학생" : "교수"}
              </p>
              <p>
                실제 계정은 만들어지지 않았고,
                <br />
                인증 메일도 보내지 않았어요.
              </p>
              <Link className="rms-action primary full" to="/login">
                발급받은 계정으로 로그인
                <Icon name="arrow-right" size={18} />
              </Link>
              <Button
                variant="outline"
                fullWidth
                size="lg"
                onClick={() => setStep(0)}
              >
                입력 화면으로 돌아가기
              </Button>
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
        <h1>{privacy ? "자료와 개인정보" : "마진 사용 안내"}</h1>
        <p>
          {privacy
            ? "마진은 수업 시연을 위해 제한적으로 공개한 서비스예요. 아래 내용은 지금 구현된 상태를 설명하며, 정식 이용약관이나 개인정보 처리방침을 대신하지 않아요."
            : "미팅 기록부터 교수 검토 요청까지, 기본 사용 순서를 안내해요."}
        </p>
        {!privacy && signedIn && <GuideReplay />}
        {(privacy
          ? [
              [
                "개인 기록과 공유",
                "공동연구자가 없으면 기록은 나만 볼 수 있어요. 공동연구자가 참여하면 ‘나만 보기’로 둔 기록을 뺀 나머지를 함께 봐요. 개인 메모, 녹음 전사문, AI 대화, 선택하지 않은 AI 제안은 항상 나만 볼 수 있어요. 교수님께는 검토 요청에 넣은 항목과 그때의 파일만 공개되고, 일정 조율에 초대하면 그 일정도 보여요.",
              ],
              [
                "AI 처리",
                "AI는 사용자가 선택한 기록과 입력한 질문만 처리하도록 설계했어요. 지금은 Gemini 키를 넣지 않아 실제 AI 응답이 만들어지지 않아요. 동작 확인에는 가상 자료만 써요.",
              ],
              [
                "저장과 가입",
                "연구 기록과 파일은 Supabase에 저장해요. 가입 화면은 미리보기용이라 입력한 정보로 계정을 만들거나 메일을 보내지 않아요.",
              ],
            ]
          : [
              [
                "미팅 기록하기",
                "연구를 만들고 미팅을 등록하세요. 날짜가 정해지지 않았어도 등록할 수 있어요. 메모는 자동으로 저장돼요.",
              ],
              [
                "수정 방법 고르기",
                "피드백을 직접 정리하거나, 선택한 원문으로 AI 정리를 요청하세요. 고른 수정 방법은 할 일로 만들고, 고친 뒤에는 수정 결과로 남기세요.",
              ],
              [
                "교수님께 검토 요청하기",
                "수정 설명, 파일, 먼저 볼 위치를 담아 검토 링크를 만들고, 교수님께 직접 전달해 주세요. 교수님은 항목마다 ‘수정 내용 확인’ 또는 ‘추가 수정 필요’를 남겨요. ‘추가 수정 필요’를 받은 항목은 고친 뒤 다시 확인을 요청할 수 있어요.",
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
                  "아니요. 메모, 피드백, 수정 방법, 할 일은 모두 직접 쓸 수 있어요. AI는 기록을 선택해 요청할 때만 실행돼요.",
                ],
                [
                  "함께 연구하려면 어떻게 하나요?",
                  "연구 설정에서 마진 계정이 있는 동료를 초대하세요. 동료가 초대를 수락하면 기록을 공동 기록으로 지정할 수 있어요. 개인 메모와 AI 대화는 자동으로 공개되지 않아요.",
                ],
                [
                  "교수님께는 어떤 내용이 보이나요?",
                  "지정한 교수 계정에서는 검토 요청에 넣은 항목과 그때의 파일만 볼 수 있어요. 개인 메모, AI 대화, 다른 기록은 볼 수 없어요.",
                ],
                [
                  "원고를 고치면 이전 응답은 어떻게 되나요?",
                  "교수님 응답은 보낸 당시 내용과 함께 그대로 남아요. 고친 항목에 다시 확인을 요청하면 2차 검토가 새로 생겨요.",
                ],
                [
                  "지금 가입하거나 결제할 수 있나요?",
                  "아니요. 지금은 발급받은 계정으로만 로그인할 수 있어요. 가입 화면은 미리보기라 실제 계정이나 인증 메일이 만들어지지 않아요. Free는 ₩0이고, Pro와 Team은 출시 예정이라 결제는 아직 열리지 않았어요.",
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
          {signedIn ? "내 연구 열기" : "시작하기"}
          <Icon name="arrow-right" size={17} />
        </Link>
      </article>
    </PublicFrame>
  );
}
