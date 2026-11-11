import { t } from "@/lib/i18n";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { ModalContainer, ModalHeading } from "@montage-ui/core";
import { Dialog } from "./ui/dialog";
import { Icon } from "./icons";
import { useExperience } from "@/lib/experience";
import {
  buildCommands,
  rankSections,
  type CommandEntry,
} from "@/lib/command-items";
import { commandFilter } from "@/lib/hangul-search";
import type { BackState } from "@/pages/student/shared";
import "./command-palette.css";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 연구 안에서 열면 그 연구의 기록·화면을 보여 줍니다. */
  researchId?: string;
}

/**
 * 팔레트로 다른 기록을 열 때 지금 화면을 '돌아올 곳'으로 넘깁니다(QA F-004).
 * 이름은 지금 화면의 제목(h1), 없으면 탭 제목의 첫 부분을 써요.
 * 받는 쪽의 readBackState가 앱 안 주소만 받아들입니다.
 */
export function backFrom(location: {
  pathname: string;
  search: string;
}): BackState {
  const heading = document
    .querySelector("#main-content h1")
    ?.textContent?.trim();
  const label = heading || document.title.split(" · ")[0]?.trim() || "";
  return { from: { path: `${location.pathname}${location.search}`, label } };
}

/**
 * ⌘K 명령 팔레트. 겉모양은 Montage Modal, 목록·키보드 이동·걸러 내기는 cmdk가 맡습니다.
 * 한글 조합 중 Enter는 cmdk가 무시하고, 초성(ㅁㅌ)과 덜 친 글자(밑)도 찾습니다.
 */
export function CommandPalette({
  open,
  onOpenChange,
  researchId,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const { data } = useExperience();
  const navigate = useNavigate();
  const location = useLocation();
  const searching = query.trim().length > 0;
  const sections = useMemo(
    () => rankSections(buildCommands({ data, researchId, searching }), query),
    [data, researchId, searching, query],
  );

  function changeOpen(next: boolean) {
    onOpenChange(next);
    if (!next) setQuery("");
  }

  function run(entry: CommandEntry) {
    changeOpen(false);
    navigate(entry.action.to, { state: backFrom(location) });
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <ModalContainer
        className="command-palette"
        variant="popup"
        size="large"
        aria-describedby={undefined}
      >
        <ModalHeading as="h2" className="command-palette-title">
          {t("명령 팔레트")}
        </ModalHeading>
        <Command label={t("명령 팔레트")} filter={commandFilter} loop>
          <div className="command-palette-field">
            <Icon name="search" size={20} />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder={
                researchId
                  ? t("기록 제목, 화면, 할 일을 찾아요")
                  : t("연구 이름이나 화면을 찾아요")
              }
              autoFocus
            />
            <kbd>esc</kbd>
          </div>
          <Command.List className="command-palette-list">
            <Command.Empty className="command-palette-empty">
              {t("‘{query}’와 맞는 항목이 없어요.", { query: query.trim() })}
            </Command.Empty>
            {sections.map((section) => (
              <Command.Group key={section.id} heading={section.heading}>
                {section.entries.map((entry) => (
                  <Command.Item
                    key={entry.id}
                    value={entry.id}
                    keywords={entry.keywords}
                    onSelect={() => run(entry)}
                  >
                    <Icon name={entry.icon} size={18} />
                    <span className="command-palette-label">{entry.label}</span>
                    {entry.shortcut ? (
                      <span
                        className="command-palette-keys"
                        aria-label={t("단축키 {keys}", {
                          keys: entry.shortcut,
                        })}
                      >
                        {entry.shortcut.split(" ").map((key) => (
                          <kbd key={key}>{key}</kbd>
                        ))}
                      </span>
                    ) : (
                      entry.hint && <small>{entry.hint}</small>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <p className="command-palette-help" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> {t("이동")}
            </span>
            <span>
              <kbd>Enter</kbd> {t("열기")}
            </span>
            <span>{t("초성으로도 찾아요 (ㅁㅌ → 미팅)")}</span>
          </p>
        </Command>
      </ModalContainer>
    </Dialog>
  );
}
