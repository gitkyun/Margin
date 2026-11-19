import { MIN_PASSWORD_LENGTH, PASSWORD_HELP } from "../lib/password-policy";
import { PasswordStrength } from "@/components/PasswordStrength";
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
import { Disclosure } from "@/components/ui/disclosure";
import { t } from "@/lib/i18n";
import { SubscriptionPlans } from "@/components/SubscriptionPlans";
import { CloudShader } from "@/components/marketing/CloudShader";
import { CoverText, RevealLine } from "@/components/marketing/TextEffects";
import { FooterControls } from "@/components/marketing/FooterControls";
import { FooterGlyphField } from "@/components/marketing/FooterGlyphField";
import { PublicNavigation } from "@/components/marketing/PublicNavigation";
import { LanguageMenu } from "@/components/LanguageMenu";
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
import { configured } from "@/lib/supabase";
import { GuideReplay } from "@/components/GuideReplay";
import { PRIVATE_BY_DEFAULT, PROFESSOR_VISIBILITY } from "@/lib/sharing-copy";
import { TextLink } from "@/components/common";

/** 히어로 제목 등장(최대 600ms)이 끝난 뒤에 시작 버튼 강조를 돌립니다. */
const HERO_SETTLE_MS = 700;

const journey = [
  {
    label: t("미팅 기록"),
    icon: "mic",
    title: t("미팅 원문에서 피드백을 골라내요"),
    body: t(
      "녹음과 한국어 전사로 미팅을 남기고, 피드백, 결정 사항, 질문을 나눠 정리하세요.",
    ),
    color: "blue",
  },
  {
    label: t("수정 방법"),
    icon: "sparkles",
    title: t("연구 도우미가 수정 방법을 제안해요"),
    body: t(
      "연구 도우미가 제안한 수정 방법과 가정을 읽고, 내 연구에 맞는 방법을 선택하세요.",
    ),
    color: "sky",
  },
  {
    label: t("원고 작성"),
    icon: "edit",
    title: t("버전을 남기고 바뀐 문장을 비교해요"),
    body: t(
      "저장만으로는 버전이 생기지 않아요. 비교하고 싶은 시점에 직접 남기세요.",
    ),
    color: "azure",
  },
  {
    label: t("교수 검토"),
    icon: "check-circle",
    title: t("항목마다 교수님 응답을 받아요"),
    body: t(
      "수정 설명과 파일을 검토 링크 하나로 묶어, 교수님께 직접 전달하세요.",
    ),
    color: "ice",
  },
];

type FaqItem = readonly [question: string, answer: string];

/** 소개 화면의 자주 묻는 질문: 쓰기 전에 알아야 할 것 */
const INTRO_FAQ: readonly FaqItem[] = [
  [
    t("AI 없이도 사용할 수 있나요?"),
    t(
      "네. 메모, 피드백, 수정 방법, 할 일, 검토 요청은 모두 직접 쓸 수 있어요. AI는 직접 요청할 때만 실행되고, 직접 고른 AI 제안만 기록에 들어가요.",
    ),
  ],
  [
    t("교수님께는 어디까지 보이나요?"),
    `${PROFESSOR_VISIBILITY} ${t("개인 메모, AI 대화, 선택하지 않은 AI 제안은 보이지 않아요.")}`,
  ],
  [
    t("지금 가입하거나 결제할 수 있나요?"),
    t(
      "초대 없이 이메일로 가입할 수 있어요. Free는 ₩0이고, Pro와 Team은 출시 예정이라 결제는 아직 열리지 않았어요.",
    ),
  ],
];

/** 사용 안내의 자주 묻는 질문: 쓰는 중에 생기는 것 */
const GUIDE_FAQ: readonly FaqItem[] = [
  [
    t("동료와 함께 쓰려면 어떻게 하나요?"),
    t(
      "연구 설정에서 마진 계정이 있는 동료를 초대하세요. 동료가 수락하면 공동 기록과 할 일, 일정 조율을 함께 쓸 수 있어요. 개인 메모와 AI 대화는 자동으로 공개되지 않아요.",
    ),
  ],
  [
    t("AI 제안을 선택하면 할 일이 끝나나요?"),
    t(
      "아니요. 선택한 방법은 할 일에 추가할 수 있어요. 할 일을 끝냈다는 표시는 직접 해요.",
    ),
  ],
  [
    t("버전은 언제 생기나요?"),
    t(
      "저장만으로는 버전이 생기지 않아요. 비교하고 싶은 시점에 ‘지금 버전 남기기’로 직접 남겨요.",
    ),
  ],
  [
    t("검토 링크를 만들면 교수님께 바로 가나요?"),
    t("아니요. 링크만 만들어져요. 복사해서 교수님께 직접 전달해 주세요."),
  ],
  [
    t("다시 고치면 이전 검토는 사라지나요?"),
    t(
      "아니요. 보낸 설명, 파일, 교수님 응답은 그때 그대로 남아요. 고친 항목에 다시 확인을 요청하면 2차, 3차 검토로 따로 쌓여요.",
    ),
  ],
];

function FaqList({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="lp-faq-list">
      {items.map(([question, answer]) => (
        <Disclosure
          key={question}
          summary={
            <>
              {question}
              <Icon name="plus" size={18} />
            </>
          }
        >
          <p>{answer}</p>
        </Disclosure>
      ))}
    </div>
  );
}
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
        {t("본문으로 이동")}
      </a>
      <header className="lp-header">
        <div className="lp-nav-shell">
          <Link to="/" className="lp-brand" aria-label={t("마진(Margin) 홈")}>
            <ResearchMark small />
            <BrandWordmark />
          </Link>
          <PublicNavigation
            open={menu}
            signedIn={signedIn}
            onNavigate={() => setMenu(false)}
          />
          <div className="lp-nav-actions">
            <LanguageMenu className="language-segments-in-header" />
            {!signedIn && (
              <Link className="lp-login" to="/login">
                {t("로그인")}
              </Link>
            )}
            <Button asChild>
              <Link to={signedIn ? "/r" : "/signup"}>
                {signedIn ? t("내 연구 열기") : t("시작하기")}
                <Icon name="arrow-right" size={16} />
              </Link>
            </Button>
            <button
              className="lp-menu-toggle"
              aria-label={t("메뉴")}
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
            <Link className="lp-brand" to="/" aria-label={t("마진(Margin) 홈")}>
              <ResearchMark />
              <BrandWordmark />
            </Link>
            <p>
              {t("미팅 기록과 피드백, 할 일, 원고 버전을")}
              <br />
              {t("연구별로 정리해요.")}
            </p>
            <Link className="lp-footer-start" to={signedIn ? "/r" : "/signup"}>
              {signedIn ? t("내 연구 열기") : t("시작하기")}
              <Icon name="arrow-right" size={18} />
            </Link>
          </div>
          <div className="lp-footer-columns">
            <div>
              <h3>{t("서비스")}</h3>
              <Link to="/">{t("서비스 소개")}</Link>
              <Link to="/features">{t("주요 기능")}</Link>
              <Link to="/pricing">{t("플랜")}</Link>
              <a href="mailto:admin@margin.com">{t("문의")}</a>
              <Link to={signedIn ? "/r" : "/login"}>
                {signedIn ? t("내 연구") : t("로그인")}
              </Link>
            </div>
            <div>
              <h3>{t("기능")}</h3>
              <Link to="/features?view=meeting">{t("미팅과 기록")}</Link>
              <Link to="/features?view=ai">{t("AI와 수정 방법")}</Link>
              <Link to="/features?view=writing">{t("작성과 버전 비교")}</Link>
              <Link to="/features?view=review">{t("교수 검토")}</Link>
            </div>
            <div>
              <h3>{t("도움말")}</h3>
              <Link to="/guide">{t("사용 안내")}</Link>
              <Link to="/guide#questions">{t("자주 묻는 질문")}</Link>
              <Link to="/privacy">{t("자료와 개인정보")}</Link>
              <Link to="/signup">
                {configured ? t("가입하기") : t("가입 과정 미리보기")}
              </Link>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span>
              © {new Date().getFullYear()} {t("마진")}
            </span>
            <span>{t("흩어진 기록을 모아, 다음 연구가 되도록")}</span>
            <FooterControls />
          </div>
        </div>
      </footer>
    </div>
  );
}
/** 미리보기 창 상단 메뉴와 장면마다 켜지는 메뉴: 미팅 원문 → 미팅, 수정 방법 → 할 일(피드백), 글 → 글·자료, 검토 → 미팅(검토 보기) */
const PREVIEW_MENUS = [t("홈"), t("미팅"), t("할 일"), t("글·자료")];
const PREVIEW_MENU_OF_SCENE = [1, 2, 3, 1];
function ProductPreview({ index }: { index: number }) {
  const content = [
    <div className="lp-preview-note" key="note">
      <span className="lp-preview-tag">
        <Icon name="microphone" size={14} />
        {t("미팅 원문")}
      </span>
      <p className="lp-demo-title">{t("비교 기준을 더 분명히 해볼까요?")}</p>
      <p>
        {t(
          "연구 목적, 자료 수집 방법, 분석 관점을 나누어 비교해 주세요. 다음 미팅에는 기준을 고른 이유도 설명해 주세요.",
        )}
      </p>
      <div className="lp-note-candidates">
        <span>
          <Icon name="feedback" size={16} />
          {t("피드백 1개")}
        </span>
        <span>
          <Icon name="tasks" size={16} />
          {t("결정 사항 1개")}
        </span>
        <span>
          <Icon name="help" size={16} />
          {t("질문 1개")}
        </span>
      </div>
    </div>,
    <div className="lp-preview-ai" key="ai">
      <div className="lp-assistant-name">
        <AssistantFace />
        <span>
          {t("연구 도우미")}
          <small>{t("선택한 피드백으로 수정 방법 제안")}</small>
        </span>
      </div>
      <div className="lp-method">
        <span>{t("방법 1")}</span>
        <p className="lp-demo-title">
          {t("세 가지 기준으로 비교표 다시 만들기")}
        </p>
        <p>{t("연구 목적 · 자료 수집 방법 · 분석 관점")}</p>
        <span className="lp-example-selected">
          <Icon name="check" size={14} />
          {t("선택한 방법")}
        </span>
      </div>
      <div className="lp-method lp-method-alt">
        <span>{t("방법 2")}</span>
        <p className="lp-demo-title">
          {t("핵심 선행연구 두 편을 깊게 비교하기")}
        </p>
      </div>
      <div className="lp-model-meta">
        <Icon name="sparkles" size={14} />
        {t("보통")}
        <em>{t("예시 · 실제 AI 결과 아님")}</em>
      </div>
    </div>,
    <div className="lp-preview-writing" key="writing">
      <div className="lp-version-top">
        <span>
          <Icon name="file" size={16} />
          {t("연구 계획서")}
        </span>
        <span>{t("버전 v2")}</span>
      </div>
      <p className="lp-demo-title">{t("2. 선행연구 비교")}</p>
      <p>
        {t("본 연구는 선행연구를")}{" "}
        <mark>{t("연구 목적, 자료 수집 방법, 분석 관점")}</mark>
        {t("에 따라 비교한다.")}
      </p>
      <div className="lp-writing-ghosts">
        <i />
        <i />
        <i />
      </div>
      <div className="lp-version-bottom">
        <span>
          <Icon name="check-circle" size={14} />
          {t("v1과 달라진 부분")}
        </span>
        <Icon name="layers" size={18} />
      </div>
    </div>,
    <div className="lp-preview-review" key="review">
      <span className="lp-preview-tag">
        <Icon name="lock" size={14} />
        {t("지정 교수에게만 공개")}
      </span>
      <p className="lp-demo-title">{t("선행연구 비교표 수정")}</p>
      <p>
        {t(
          "비교 기준을 세 가지로 나누고, 각 기준을 선택한 이유를 덧붙였습니다.",
        )}
      </p>
      <div className="lp-review-file">
        <Icon name="file" size={23} />
        <span>
          {t("연구계획서_v2.pdf")}
          <small>{t("볼 위치 4~5쪽 · 보낸 파일 그대로")}</small>
        </span>
      </div>
      <div className="lp-reviewed">
        <Icon name="check-circle" size={17} />
        {t("수정 내용 확인")}
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
        <span>{t("내 연구")}</span>
        {/* 로그인 뒤 화면처럼 상단 메뉴 넷(IA v2 07 §6). 장면이 있는 메뉴가 켜집니다. */}
        <span className="lp-mini-menu" aria-hidden="true">
          {PREVIEW_MENUS.map((label, menu) => (
            <span
              key={label}
              className={
                menu === PREVIEW_MENU_OF_SCENE[index] ? "selected" : ""
              }
            >
              {label}
            </span>
          ))}
        </span>
        <span className="lp-window-example">{t("사용 예시")}</span>
      </div>
      <div className="lp-window-body">
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
          <h1>
            <RevealLine>{t("흩어진 기록을 모아,")}</RevealLine>
            <br />
            <RevealLine delay={0.12}>
              <CoverText>{t("다음 연구가 되도록")}</CoverText>
            </RevealLine>
          </h1>
          <p>
            {t("미팅 메모, 피드백, 할 일, 원고 버전을 연구별로 정리하고")}
            <br />
            {t("고친 내용은 교수님께 검토를 요청할 수 있어요.")}
          </p>
          <div className="lp-hero-actions">
            <StartGlow delay={HERO_SETTLE_MS}>
              <Button asChild size="lg">
                <Link to={signedIn ? "/r" : "/signup"}>
                  {signedIn ? t("내 연구 열기") : t("시작하기")}
                  <Icon name="arrow-right" size={19} />
                </Link>
              </Button>
            </StartGlow>
            <Button asChild variant="outline" size="lg">
              <a href="#workflow">
                {t("사용 방법 보기")}
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
              aria-label={t("기능 미리보기")}
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
            {t("미팅 기록부터 교수 검토까지 한 연구에 모여요.")}
          </span>
        </div>
      </section>
      <section className="lp-section lp-features" id="features">
        <div className="lp-section-heading">
          <h2>{t("주요 기능")}</h2>
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
              <h3>{t("지난 피드백을 쉽게 찾아요")}</h3>
              <p>
                {t("미팅 메모에서 정리한 피드백은 원문과 함께 남아요.")}
                <br />
                {t("할 일에서도 연결된 피드백을 바로 확인할 수 있어요.")}
              </p>
              <Link className="lp-feature-more" to="/features?view=meeting">
                {t("자세히 보기")} <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-ai">
            <div className="lp-feature-visual">
              <div className="lp-cute-chat">
                <AssistantFace size={64} />
                <div className="lp-chat-bubble">
                  {t("비교표를 어떻게 고칠까요?")}
                  <span>{t("선택한 피드백 1개")}</span>
                </div>
                <div className="lp-chat-response">
                  <Icon name="sparkles" size={17} />
                  {t("수정 방법 두 가지를 제안할게요.")}
                </div>
                <div className="lp-chat-composer">
                  <span>{t("궁금한 내용을 적어 주세요")}</span>
                  <Icon name="paperclip" size={16} />
                  <span className="lp-think-chip">
                    {t("보통")}
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
              <h3>{t("AI 제안은 직접 골라요")}</h3>
              <p>
                {t("원문에서 확인한 내용과 AI 제안, 확인할 가정을")}
                <br />
                {t("나눠서 보여 줘요.")}
              </p>
              <Link className="lp-feature-more" to="/features?view=ai">
                {t("자세히 보기")} <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-writing">
            <div className="lp-feature-visual" id="writing-preview">
              <ComparePreview
                before={t("선행연구를 비교해 보았다. 기존 연구와 차이가 있다.")}
                after={t(
                  "선행연구를 연구 목적·자료 수집 방법·분석 관점에 따라 비교하였다.",
                )}
              />
            </div>
            <div className="lp-feature-copy">
              <span className="lp-feature-icon">
                <Icon name="edit" size={22} />
              </span>
              <h3>{t("이전 원고와 바뀐 부분을 확인해요")}</h3>
              <p>
                {t(
                  "비교할 버전은 직접 남기고, 고친 내용은 수정 결과로 정리하세요.",
                )}
              </p>
              <Link className="lp-feature-more" to="/features?view=writing">
                {t("자세히 보기")} <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          </SpotlightCard>
          <SpotlightCard className="lp-feature-card lp-feature-review">
            <div className="lp-feature-visual" id="review-preview">
              <div className="lp-review-stack">
                <div>
                  <Icon name="file" size={22} />
                  <span>
                    {t("연구계획서_v2.pdf")}
                    <small>{t("보낸 설명과 파일 그대로")}</small>
                  </span>
                  <span>v2</span>
                </div>
                <div>
                  <span className="lp-professor-avatar">{t("교")}</span>
                  <span>
                    {t("비교 기준이 더 명확해졌네요.")}
                    <small>{t("수정 내용 확인")}</small>
                  </span>
                  <Icon name="check-circle" size={22} />
                </div>
              </div>
            </div>
            <div className="lp-feature-copy">
              <span className="lp-feature-icon">
                <Icon name="check-circle" size={22} />
              </span>
              <h3>{t("항목마다 교수님 응답을 받아요")}</h3>
              <p>
                {t(
                  "검토 링크를 만들어 직접 전달하면, 교수님이 항목마다 응답을 남겨요.",
                )}
                <br />
                {PROFESSOR_VISIBILITY}
              </p>
              <Link className="lp-feature-more" to="/features?view=review">
                {t("자세히 보기")} <Icon name="arrow-right" size={15} />
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
            <h2>{t("이렇게 사용해요")}</h2>
            <div role="group" aria-label={t("기능별 사용 방법")}>
              {journey.map((j, i) => (
                <button
                  key={j.label}
                  onClick={() => setFeature(i)}
                  aria-pressed={feature === i}
                >
                  <Icon name={j.icon} size={23} />
                  {j.label}
                  <Icon name="arrow-right" size={19} />
                </button>
              ))}
            </div>
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
            {t("녹음부터 일정 조율까지,")}
            <br />
            {t("연구에 필요한 기능")}
          </h2>
          <p>{t("AI 없이도 기록, 자료, 일정 기능을 모두 쓸 수 있어요.")}</p>
        </div>
        <div className="lp-capability-row">
          {[
            {
              icon: "mic",
              title: t("녹음과 전사"),
              body: t("녹음하면서 한국어 전사문도 함께 남길 수 있어요."),
            },
            {
              icon: "calendar",
              title: t("미팅 준비"),
              body: t("보여 드릴 할 일과 파일, 물어볼 질문을 모아 둬요."),
            },
            {
              icon: "folder",
              title: t("자료"),
              body: t(
                "파일은 버전별로 쌓이고, 그 파일을 쓴 기록으로 바로 갈 수 있어요.",
              ),
            },
            {
              icon: "users",
              title: t("공동연구자"),
              body: t(
                "동료를 초대해 공동 기록을 함께 쓰고 미팅 시간을 조율해요.",
              ),
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
                  <Icon name="arrow-right" size={20} />
                </span>
              </Link>
            </SpotlightCard>
          ))}
        </div>
      </section>
      <section className="lp-section lp-pricing" id="plans">
        <div className="lp-section-heading lp-heading-centered">
          <h2>{t("연구 규모에 맞는 플랜")}</h2>
          <p>{t("지금은 Free 플랜만 제공해요.")}</p>
        </div>
        <SubscriptionPlans publicView signedIn={signedIn} />
      </section>
      <section className="lp-section lp-faq" id="faq">
        <div>
          <h2>
            {t("궁금한 점이")}
            <br />
            {t("남아 있나요?")}
          </h2>
          <Link to="/guide">
            {t("사용 안내 보기")}
            <Icon name="arrow-right" size={17} />
          </Link>
        </div>
        <FaqList items={INTRO_FAQ} />
      </section>
      <section className="lp-close">
        <BrandMark inverse />
        <h2>{t("마진 시작하기")}</h2>
        <StartGlow tone="on-brand">
          <Link
            className="lp-button lp-button-on-brand"
            to={signedIn ? "/r" : "/signup"}
          >
            {signedIn ? t("내 연구 열기") : t("시작하기")}
            <Icon name="arrow-right" size={20} />
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
      t("남길 내용"),
      t("미팅 메모, 녹음과 한국어 전사문, 다음에 물어볼 질문을 남겨요."),
    ],
    [
      t("정리하기"),
      t(
        "원문을 보며 피드백, 결정 사항, 질문을 직접 정리하거나 AI 제안 중 필요한 항목을 선택해요.",
      ),
    ],
    [
      t("다음 미팅"),
      t(
        "할 일과 자료를 다음 미팅 준비에 넣어 두고, 지난 기록도 다시 볼 수 있어요.",
      ),
    ],
  ],
  [
    [
      t("읽는 기록"),
      t("연구 도우미는 이 연구의 미팅, 피드백, 문서, 자료를 읽어요."),
    ],
    [
      t("읽고 판단하기"),
      t(
        "원문에서 확인한 내용, 제안하는 수정 방법, 확인할 가정을 나눠서 보여 줘요.",
      ),
    ],
    [
      t("선택한 다음"),
      t(
        "고른 방법은 고쳐서 저장하고, 필요하면 할 일로 만들어요. 선택하지 않은 AI 제안은 공유되지 않아요.",
      ),
    ],
  ],
  [
    [
      t("작성할 문서"),
      t("연구 계획서와 원고를 쓰고, 비교할 버전은 저장과 따로 직접 남겨요."),
    ],
    [
      t("버전 비교"),
      t(
        "두 버전에서 바뀐 문장을 비교해요. 이전 버전으로 되돌려도 기존 버전은 지워지지 않고 새 버전이 생겨요.",
      ),
    ],
    [
      t("검토 준비"),
      t("수정 설명과 그 시점의 PDF를 묶어 검토 요청에 넣을 항목을 준비해요."),
    ],
  ],
  [
    [t("공개 범위"), PROFESSOR_VISIBILITY],
    [
      t("항목별 응답"),
      t(
        "교수님은 항목마다 ‘수정 내용 확인’ 또는 ‘추가 수정 필요’를 남기고, ‘추가 수정 필요’에는 이유를 댓글로 적어요.",
      ),
    ],
    [
      t("다시 고친 뒤"),
      t(
        "고친 항목만 다시 확인을 요청할 수 있어요. 새 검토가 2차, 3차로 추가되고 이전 파일과 응답은 그대로 남아요.",
      ),
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
          <h1>{t("미팅부터 교수 검토까지")}</h1>
          <p>
            {t("기능마다 무엇을 남기고 다음에 무엇을 할 수 있는지 확인하세요.")}
          </p>
        </div>
        <div className="lp-tour-layout">
          <div
            className="lp-tour-index"
            role="group"
            aria-label={t("둘러볼 기능 선택")}
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
              {t("처음이라면 사용 안내 보기")}{" "}
              <Icon name="arrow-right" size={16} />
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
          <span>{t("연구를 만들고 미팅 기록부터 시작하세요.")}</span>
          <Button asChild size="lg">
            <Link to={signedIn ? "/r" : "/login"}>
              {signedIn ? t("내 연구 열기") : t("로그인")}
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
          <h1>{t("연구 방식에 맞는 플랜")}</h1>
          <p>
            {t("지금은 Free 플랜만 제공해요. Pro와 Team은 출시 예정이에요.")}
          </p>
        </div>
        <SubscriptionPlans publicView signedIn={signedIn} />
        <div className="lp-plan-help">
          <Icon name="users" size={24} />
          <div>
            <h2>{t("함께 쓰려면 Team 플랜이 필요한가요?")}</h2>
            <p>
              {t(
                "아니요. 초대한 공동연구자가 수락하면 Free에서도 공동 기록을 쓸 수 있어요. Team은 연구실 운영을 위해 준비 중인 플랜이고, 결제는 아직 열리지 않았어요.",
              )}
            </p>
            <Link to="/#faq">
              {t("자주 묻는 질문 보기")} <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </div>
      </section>
    </PublicFrame>
  );
}

/** 가입·초대 화면 왼쪽 안내. 가입 미리보기와 초대 가입(`AuthLayout`)이 함께 씁니다. */
export function AuthStory() {
  return (
    <div className="auth-story">
      <h1>
        {t("지난 미팅에서")}
        <br />
        {t("다음 미팅까지")}
      </h1>
      <p>
        {t("피드백, 할 일, 원고 버전, 교수님 응답을")}
        <br />
        {t("연구별로 모아 둬요.")}
      </p>
      <div className="auth-proof">
        <Icon name="lock" size={19} />
        <span>
          {PRIVATE_BY_DEFAULT}
          <br />
          {PROFESSOR_VISIBILITY}
        </span>
      </div>
    </div>
  );
}

export function SignupPage() {
  const [step, setStep] = useState(0),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [passwordProblem, setPasswordProblem] = useState(""),
    [role, setRole] = useState("student");
  return (
    <PublicFrame compact>
      <section className="signup-layout">
        <AuthStory />
        <div className="auth-panel">
          <span className="demo-label">{t("가입 과정 미리보기")}</span>
          {step === 0 ? (
            <>
              <h2>{t("마진 시작하기")}</h2>
              <p>
                {t("가입 과정을 미리 보는 화면이에요.")}
                <br />
                {t(
                  "실제 계정은 만들어지지 않고, 입력한 정보는 서버로 보내지 않아요.",
                )}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  // 입력 부품이 minLength를 넘기지 않아 3자도 통과했어요(감사 B1).
                  if (password.length < MIN_PASSWORD_LENGTH) {
                    setPasswordProblem(PASSWORD_HELP);
                    return;
                  }
                  setPasswordProblem("");
                  setPassword("");
                  setStep(1);
                }}
              >
                <label className="field">
                  {t("이름")}
                  <Input
                    required
                    maxLength={40}
                    autoComplete="off"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("예: 홍길동")}
                  />
                </label>
                <label className="field">
                  {t("이메일")}
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
                  {t("비밀번호")}
                  <Input
                    type="password"
                    minLength={MIN_PASSWORD_LENGTH}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={PASSWORD_HELP}
                  />
                  <PasswordStrength value={password} />
                  <small>{t("실제로 쓰는 비밀번호는 입력하지 마세요.")}</small>
                  {passwordProblem && (
                    <span className="rms-error" role="alert">
                      {passwordProblem}
                    </span>
                  )}
                </label>
                <fieldset className="role-choice">
                  <legend>{t("어떤 목적으로 사용하나요?")}</legend>
                  {[
                    ["student", t("학생"), t("내 연구 기록과 수정 관리")],
                    ["professor", t("교수"), t("학생의 검토 요청 확인")],
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
                  {t("가입 미리보기 마치기")}
                  <Icon name="arrow-right" size={18} />
                </Button>
              </form>
              <p className="auth-switch">
                {t("발급받은 계정이 있나요?")}{" "}
                <Link to="/login">{t("로그인")}</Link>
              </p>
            </>
          ) : (
            <div className="signup-finish" role="status">
              <Icon name="check-circle" size={38} />
              <h2>
                {t("{name}님,", { name })}
                <br />
                {t("가입 미리보기를 마쳤어요")}
              </h2>
              <p>
                {email}
                <br />
                {t("선택한 이용 목적: {role}", {
                  role: role === "student" ? t("학생") : t("교수"),
                })}
              </p>
              <p>
                {t("실제 계정은 만들어지지 않았고,")}
                <br />
                {t("인증 메일도 보내지 않았어요.")}
              </p>
              <Link className="rms-action primary full" to="/login">
                {t("발급받은 계정으로 로그인")}
                <Icon name="arrow-right" size={18} />
              </Link>
              <Button
                variant="outline"
                fullWidth
                size="lg"
                onClick={() => setStep(0)}
              >
                {t("입력 화면으로 돌아가기")}
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
        <TextLink to="/">
          <Icon name="arrow-left" size={16} />
          {t("서비스 소개")}
        </TextLink>
        <h1>{privacy ? t("자료와 개인정보") : t("마진 사용 안내")}</h1>
        <p>
          {privacy
            ? t(
                "마진은 수업 시연을 위해 제한적으로 공개한 서비스예요. 아래 내용은 지금 서비스가 동작하는 방식을 설명하며, 정식 이용약관이나 개인정보 처리방침을 대신하지 않아요.",
              )
            : t("미팅 기록부터 교수 검토 요청까지, 기본 사용 순서를 안내해요.")}
        </p>
        {!privacy && signedIn && <GuideReplay />}
        {(privacy
          ? [
              [
                t("개인 기록과 공유"),
                t(
                  "공동연구자가 없으면 기록은 나만 볼 수 있어요. 공동연구자가 참여하면 ‘나만 보기’로 둔 기록을 뺀 나머지를 함께 봐요. 개인 메모, 녹음 전사문, AI 대화, 선택하지 않은 AI 제안은 항상 나만 볼 수 있어요. 교수님께는 검토 요청에 넣은 항목과 그때의 파일, 연구 이름과 연구 방향(목적·질문)만 공개되고, 일정 조율에 초대하면 그 일정도 보여요.",
                ),
              ],
              [
                t("AI 처리"),
                t(
                  "연구 도우미에게 질문하면 그 연구에서 내가 볼 수 있는 기록(미팅, 피드백, 할 일, 문서, 첨부 파일 등)과 입력한 질문을 Google의 AI 모델로 보내 처리해요. AI 대화, 선택하지 않은 AI 제안, 녹음과 전사문은 보내지 않아요. 웹 검색에는 질문만 보내요.",
                ),
              ],
              [
                t("라인 로그인과 이메일"),
                t(
                  "라인으로 시작하면 라인에서 이름, 프로필 사진, 이메일 주소를 받아요. 이메일 주소는 마진 계정을 만들고 확인하는 데, 그리고 검토 요청·초대 같은 서비스 알림 메일을 보내는 데에만 쓰고 광고에는 쓰지 않아요. 이메일 제공에 동의하지 않으면 라인으로 가입할 수 없어요. 받은 정보를 지우려면 문의 주소로 알려 주세요.",
                ),
              ],
              [
                t("저장과 가입"),
                t(
                  "연구 기록과 파일은 Supabase에 저장해요. 초대 없이 가입할 수 있고, 가입할 때 이메일 확인 메일을 한 번 보내요.",
                ),
              ],
            ]
          : [
              [
                t("미팅 기록하기"),
                t(
                  "연구를 만들고 위 메뉴의 ‘미팅’에서 [기록 추가]로 다음 미팅을 잡거나 녹음을 시작하세요. 날짜가 정해지지 않았어도 등록할 수 있어요. 메모는 자동으로 저장돼요.",
                ),
              ],
              [
                t("수정 방법 고르기"),
                t(
                  "미팅 기록에서 [정리하기]를 누르거나 피드백을 직접 추가하세요. 피드백을 누르면 오른쪽 창에서 수정 방법을 직접 쓰거나 연구 도우미에게 제안받을 수 있어요. 고른 방법은 할 일로 만들고, 고친 뒤에는 수정 결과로 남기세요.",
                ),
              ],
              [
                t("교수님께 검토 요청하기"),
                t(
                  "수정 결과에서, 또는 ‘미팅’의 검토 요청 보기에서 [검토 요청 만들기]를 누르세요. 수정 설명, 파일, 먼저 볼 위치를 담아 검토 링크를 만들고, 교수님께 직접 전달해 주세요. 교수님은 항목마다 ‘수정 내용 확인’ 또는 ‘추가 수정 필요’를 남겨요. ‘추가 수정 필요’를 받은 항목은 고친 뒤 다시 확인을 요청할 수 있어요.",
                ),
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
            <h2>{t("자주 묻는 질문")}</h2>
            <FaqList items={GUIDE_FAQ} />
          </section>
        )}
        <Link className="rms-action primary" to={signedIn ? "/r" : "/signup"}>
          {signedIn ? t("내 연구 열기") : t("시작하기")}
          <Icon name="arrow-right" size={17} />
        </Link>
      </article>
    </PublicFrame>
  );
}
