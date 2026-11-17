import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import { formatDateTime } from "@/lib/domain";
import { handoffState, type AssistantHandoff } from "@/lib/assistant-handoff";
import { t } from "@/lib/i18n";
import "./assistant-side-panel.css";

/** 사이드 창에 보여 줄 최근 대화 수 */
const RECENT_LIMIT = 5;

/**
 * 아이콘 줄의 연구 도우미 탭(IA v2 02 §4.1). 누르면 이 창이 열리고 화면은 그대로 둡니다.
 * 질문을 보내거나, 대화를 고르거나, '전체 화면으로 열기'를 눌렀을 때만 연구 도우미 화면으로 갑니다.
 */
export function AssistantSidePanel({
  researchId,
  onClose,
}: {
  researchId: string;
  onClose(): void;
}) {
  const { data } = useWorkspace();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const path = `/r/${researchId}/assistant`;
  const conversations = data.conversations
    .filter((c) => c.researchId === researchId && !c.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT);
  const pending = data.aiCandidates.filter(
    (c) => c.researchId === researchId && c.status === "pending",
  ).length;

  // 화면으로 넘어가면 이 창은 닫습니다(같은 내용이 두 곳에 뜨지 않게).
  const go = (handoff?: AssistantHandoff, search = "") => {
    onClose();
    navigate(
      { pathname: path, search },
      handoff ? { state: handoffState(handoff) } : undefined,
    );
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (draft.trim()) go({ ask: draft.trim() });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };

  return (
    <section
      className="assistant-side-panel"
      aria-labelledby="assistant-side-heading"
    >
      <header className="assistant-side-head">
        <h2 id="assistant-side-heading">{t("연구 도우미")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("전체 화면으로 열기")}
          title={t("전체 화면으로 열기")}
          onClick={() => go()}
        >
          <Icon name="arrow-up-right" size={18} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("연구 도우미 창 닫기")}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </Button>
      </header>
      <form className="assistant-side-form" onSubmit={submit}>
        <textarea
          aria-label={t("연구 도우미에게 물어보기")}
          placeholder={t("이 연구에 대해 물어보세요")}
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="assistant-side-form-row">
          <small>{t("보내면 연구 도우미 화면에서 답을 이어서 봐요.")}</small>
          <Button type="submit" size="sm" disabled={!draft.trim()}>
            {t("보내기")}
          </Button>
        </div>
      </form>
      {pending > 0 && (
        <Link
          className="item-detail-link"
          to={`${path}?tab=overview`}
          onClick={onClose}
        >
          {t("확인할 AI 제안 {count}개", { count: pending })}
          <Icon name="chevron-right" size={14} />
        </Link>
      )}
      <section className="assistant-side-recent">
        <h3>{t("최근 대화")}</h3>
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            className="assistant-side-conversation"
            onClick={() => go({ conversationId: conversation.id })}
          >
            <span>{conversation.title || t("제목 없는 대화")}</span>
            <small>{formatDateTime(conversation.updatedAt)}</small>
          </button>
        ))}
        {!conversations.length && (
          <p className="item-detail-empty">{t("아직 나눈 대화가 없어요.")}</p>
        )}
      </section>
    </section>
  );
}
