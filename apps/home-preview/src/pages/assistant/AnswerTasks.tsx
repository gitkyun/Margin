import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";

/**
 * 답 아래 [할 일 추가]를 누르면 펼치는 할 일 제안 줄(IA v2 06 §2.4).
 * 줄마다 [선택]을 눌러야 그 줄만 할 일이 되고, 고르지 않은 제안은 할 일이 아닙니다.
 */
export function AnswerTasks({
  id,
  suggestions,
  added,
  busy,
  disabled,
  onAdd,
  onOpen,
}: {
  id: string;
  suggestions: string[];
  added: { title: string; taskId: string }[];
  /** 지금 추가하는 줄 */
  busy: string | null;
  disabled?: boolean;
  onAdd: (title: string) => void;
  onOpen: (taskId: string) => void;
}) {
  return (
    <section
      id={id}
      className="assistant-answer-tasks"
      aria-label={t("할 일 제안")}
    >
      <p className="assistant-answer-tasks-head">
        {t("할 일 제안 {count}개 · 고른 것만 할 일이 돼요", {
          count: suggestions.length,
        })}
      </p>
      <ul>
        {suggestions.map((title) => {
          const done = added.find((a) => a.title === title);
          return (
            <li key={title}>
              <span className="assistant-answer-tasks-title">{title}</span>
              {done ? (
                <span className="assistant-answer-tasks-done">
                  <Icon name="check" size={14} />
                  {t("추가함")}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("'{title}' 할 일 열기", { title })}
                    onClick={() => onOpen(done.taskId)}
                  >
                    {t("열기")}
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("'{title}' 할 일로 선택", { title })}
                  disabled={disabled || busy !== null}
                  onClick={() => onAdd(title)}
                >
                  {busy === title ? t("추가 중") : t("선택")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
