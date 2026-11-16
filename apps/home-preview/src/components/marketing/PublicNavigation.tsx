import { LanguageMenu } from "@/components/LanguageMenu";
import { NavigationMenu } from "radix-ui";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "@/components/icons";
import { t } from "@/lib/i18n";
import "./public-navigation.css";

const features = [
  ["meeting", "microphone", t("미팅과 기록"), t("녹음·전사와 피드백 정리")],
  ["ai", "sparkles", t("AI와 수정 방법"), t("내 연구 기록으로 제안받기")],
  ["writing", "edit", t("작성과 버전 비교"), t("버전별로 바뀐 문장 비교하기")],
  ["review", "check-circle", t("교수 검토"), t("항목마다 교수님 응답 받기")],
];

export function PublicNavigation({
  open,
  onNavigate,
  signedIn = false,
}: {
  open: boolean;
  onNavigate: () => void;
  signedIn?: boolean;
}) {
  const { pathname } = useLocation();
  return (
    <NavigationMenu.Root
      className={`lp-public-nav ${open ? "is-open" : ""}`}
      aria-label={t("서비스 탐색")}
      delayDuration={100}
    >
      <NavigationMenu.List className="lp-public-nav-list">
        <NavigationMenu.Item className="lp-public-nav-item">
          <NavigationMenu.Trigger
            className="lp-nav-trigger"
            data-current={pathname === "/features"}
          >
            {t("주요 기능")} <Icon name="chevron-down" size={14} />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className="lp-nav-panel lp-nav-feature-panel">
            <div className="lp-nav-feature-links">
              {features.map(([view, icon, label, description]) => (
                <NavigationMenu.Link asChild key={view} onSelect={onNavigate}>
                  <Link
                    className="lp-nav-feature-link"
                    to={`/features?view=${view}`}
                  >
                    <span className="lp-nav-feature-icon">
                      <Icon name={icon} size={21} />
                    </span>
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </NavigationMenu.Link>
              ))}
            </div>
            <NavigationMenu.Link asChild onSelect={onNavigate}>
              <Link className="lp-nav-panel-bottom" to="/features">
                {t("기능 둘러보기")} <Icon name="arrow-right" size={16} />
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link
            asChild
            active={pathname === "/guide"}
            onSelect={onNavigate}
          >
            <Link className="lp-nav-direct" to="/guide">
              {t("사용 안내")}
            </Link>
          </NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link
            asChild
            active={pathname === "/pricing"}
            onSelect={onNavigate}
          >
            <Link className="lp-nav-direct" to="/pricing">
              {t("플랜")}
            </Link>
          </NavigationMenu.Link>
        </NavigationMenu.Item>
        <NavigationMenu.Item className="lp-public-nav-item">
          <NavigationMenu.Trigger className="lp-nav-trigger">
            {t("도움말")} <Icon name="chevron-down" size={14} />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className="lp-nav-panel lp-nav-help-panel">
            <NavigationMenu.Link asChild onSelect={onNavigate}>
              <Link to="/guide#questions">
                <Icon name="help" size={19} />
                <span>{t("자주 묻는 질문")}</span>
              </Link>
            </NavigationMenu.Link>
            <NavigationMenu.Link asChild onSelect={onNavigate}>
              <Link to="/privacy">
                <Icon name="lock" size={19} />
                <span>{t("자료와 개인정보")}</span>
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <div className="lp-mobile-auth">
        <LanguageMenu className="language-segments-in-menu" />
        {!signedIn && (
          <Link to="/login" onClick={onNavigate}>
            {t("로그인")}
          </Link>
        )}
        <Link
          className="lp-mobile-start"
          to={signedIn ? "/r" : "/signup"}
          onClick={onNavigate}
        >
          {signedIn ? t("내 연구 열기") : t("시작하기")}
          <Icon name="arrow-right" size={16} />
        </Link>
      </div>
    </NavigationMenu.Root>
  );
}
