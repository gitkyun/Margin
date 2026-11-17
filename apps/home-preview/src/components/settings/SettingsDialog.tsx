import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { t } from "@/lib/i18n";
import { AccountPage, ResearchSettingsPage } from "@/pages/SettingsPage";
import { Icon } from "../icons";
import { ShortcutList } from "../ShortcutHelp";
import type { CSSProperties } from "react";
import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import {
  ACCOUNT_SECTIONS,
  ACCOUNT_TAB,
  RESEARCH_SECTIONS,
  RESEARCH_TAB,
  isResearchSection,
  resolveSettingsSection,
  withSettings,
  type SettingsSection,
  type SettingsSectionInfo,
} from "./settings-sections";
import "./settings-dialog.css";

/** 틀 안에서 연 창이면 history state에 남겨, 닫을 때 뒤로 가기로 닫습니다. */
const OPENED_STATE = { settingsOpened: true } as const;
const CLOSE_DEBOUNCE_MS = 400;

// Montage 대화상자는 층(layer) 밖 규칙으로 크기를 정해, 크기만 인라인 변수로 넘깁니다.
// 실제 값은 settings-dialog.css의 --settings-dialog-*(폭별)에 있습니다.
const FRAME_STYLE = {
  width: "var(--settings-dialog-width)",
  height: "var(--settings-dialog-height)",
  maxWidth: "none",
  maxHeight: "none",
  borderRadius: "var(--settings-dialog-radius)",
  "--modal-content-margin-x": "0px",
  "--modal-content-margin-y": "0px",
  "--modal-content-default-padding-top": "0px",
} as CSSProperties;

/** 지금 주소의 다른 값은 두고 `?settings=`만 붙여 창을 엽니다. */
export function useOpenSettings() {
  const location = useLocation();
  const navigate = useNavigate();
  return (section: SettingsSection) =>
    navigate(
      {
        pathname: location.pathname,
        search: withSettings(location.search, section),
      },
      { state: OPENED_STATE },
    );
}

/**
 * IA v2 설정 창(07 §1). 0단계는 지금 설정 화면을 그대로 담고(`embedded`),
 * 구획 파일 나누기와 미팅 주기(Q7)는 뒤 단계에서 합니다.
 */
export function SettingsDialog({ researchId }: { researchId?: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = new URLSearchParams(location.search).get("settings");
  const resolved = resolveSettingsSection(raw, !!researchId);
  const section = resolved === "invalid" ? null : resolved;
  const [mobileView, setMobileView] = useState<"list" | "content">("content");

  // 틀린 값은 지우고, 연구 밖에서 받은 연구 구획은 프로필로 바꿔 둡니다.
  useEffect(() => {
    if (resolved === null || resolved === raw) return;
    navigate(
      {
        pathname: location.pathname,
        search: withSettings(
          location.search,
          resolved === "invalid" ? null : resolved,
        ),
      },
      { replace: true, state: location.state },
    );
  }, [resolved, raw, location, navigate]);

  useEffect(() => {
    if (!section) setMobileView("content");
  }, [section]);

  const choose = (next: SettingsSection) => {
    setMobileView("content");
    if (next === section) return;
    navigate(
      {
        pathname: location.pathname,
        search: withSettings(location.search, next),
      },
      { replace: true, state: location.state },
    );
  };
  // 닫기가 두 번 불려도(Esc + 바깥 누르기 등) 뒤로 가기는 한 번만 합니다.
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
  }, [section]);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    // 저장 안 한 내용 확인 창에서 '취소'하면 창이 남으니, 잠시 뒤 다시 닫을 수 있게 풉니다.
    window.setTimeout(() => (closing.current = false), CLOSE_DEBOUNCE_MS);
    const opened = (location.state as { settingsOpened?: boolean } | null)
      ?.settingsOpened;
    if (opened) navigate(-1);
    else
      navigate(
        {
          pathname: location.pathname,
          search: withSettings(location.search, null),
        },
        { replace: true },
      );
  };

  return (
    <Dialog open={!!section} onOpenChange={(open) => !open && close()}>
      <DialogContent className="settings-dialog" style={FRAME_STYLE} bare>
        {section && (
          <div className="settings-dialog-frame" data-view={mobileView}>
            <SectionList
              current={section}
              inResearch={!!researchId}
              onChoose={choose}
            />
            <div className="settings-dialog-content">
              <button
                type="button"
                className="settings-dialog-close"
                aria-label={t("닫기")}
                onClick={close}
              >
                <Icon name="close" size={20} />
              </button>
              <button
                type="button"
                className="settings-dialog-back"
                onClick={() => setMobileView("list")}
              >
                <Icon name="chevron-left" size={18} />
                {t("설정")}
              </button>
              <SectionBody section={section} researchId={researchId} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionList({
  current,
  inResearch,
  onChoose,
}: {
  current: SettingsSection;
  inResearch: boolean;
  onChoose: (section: SettingsSection) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  // 왼쪽 목록은 ↑/↓로 옮깁니다(07 §1.1 접근성).
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(
      ref.current?.querySelectorAll<HTMLElement>(".settings-dialog-item") ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  };
  const group = <S extends SettingsSection>(
    title: string,
    sections: readonly SettingsSectionInfo<S>[],
  ) => (
    <div className="settings-dialog-group" role="group" aria-label={title}>
      <p aria-hidden>{title}</p>
      {sections.map((item) => (
        <button
          key={item.id}
          type="button"
          className="settings-dialog-item"
          aria-current={item.id === current ? "page" : undefined}
          onClick={() => onChoose(item.id)}
        >
          <Icon name={item.icon} size={17} />
          {item.label}
        </button>
      ))}
    </div>
  );
  return (
    <nav
      ref={ref}
      className="settings-dialog-nav"
      aria-label={t("설정 항목")}
      onKeyDown={onKeyDown}
    >
      <DialogTitle className="settings-dialog-title">{t("설정")}</DialogTitle>
      {group(t("내 계정"), ACCOUNT_SECTIONS)}
      {inResearch && group(t("이 연구"), RESEARCH_SECTIONS)}
      <div className="settings-dialog-foot">
        <Link to="/guide">{t("사용 안내")}</Link>
        <span aria-hidden>·</span>
        <Link to="/privacy">{t("자료와 개인정보")}</Link>
      </div>
    </nav>
  );
}

function SectionBody({
  section,
  researchId,
}: {
  section: SettingsSection;
  researchId?: string;
}) {
  if (section === "shortcuts")
    return (
      <section className="settings-section">
        <h2>{t("단축키")}</h2>
        <ShortcutList />
      </section>
    );
  if (isResearchSection(section))
    return (
      <ResearchSettingsPage
        embedded
        section={RESEARCH_TAB[section]}
        researchIdOverride={researchId}
      />
    );
  return <AccountPage embedded section={ACCOUNT_TAB[section]} />;
}
