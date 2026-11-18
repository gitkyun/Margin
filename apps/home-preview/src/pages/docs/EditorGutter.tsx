import { t } from "@/lib/i18n";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Popover } from "radix-ui";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { feedbackLabels, type Feedback, type Task } from "@/lib/domain";
import { isHandled, marginGroups } from "@/lib/doc-margin";

const HEADINGS =
  ".rms-document-editor h1,.rms-document-editor h2,.rms-document-editor h3";
/** 무리 사이 최소 간격(px). 같은 높이에 몰리면 아래로 밀어 겹치지 않게 합니다. */
const GAP = 8;

/**
 * 글 여백(IA v2 05 §3.5): 이 글을 고칠 할 일이 그 제목 높이에 체크 상자로,
 * 딸린 피드백이 번호 동그라미로 보입니다. 제목을 못 찾으면 맨 위에 모읍니다.
 */
export function EditorGutter({
  paper,
  tasks,
  headings,
  numbers,
  onToggle,
  onOpenTask,
  onOpenFeedback,
}: {
  paper: RefObject<HTMLElement | null>;
  tasks: Task[];
  headings: string[];
  numbers: Map<string, number>;
  onToggle: (task: Task) => void;
  onOpenTask: (id: string) => void;
  onOpenFeedback: (id: string) => void;
}) {
  const groups = marginGroups(tasks, headings);
  const nodes = useRef<(HTMLDivElement | null)[]>([]);
  const [tops, setTops] = useState<number[]>([]);
  // 본문이 바뀌거나 폭이 바뀔 때마다 제목 높이를 다시 잽니다(같으면 그리지 않음).
  const measure = useRef(() => {});
  measure.current = () => {
    const root = paper.current;
    if (!root) return;
    const base = root.getBoundingClientRect().top;
    const elements = [...root.querySelectorAll<HTMLElement>(HEADINGS)];
    let floor = 0;
    const next = groups.map((group, index) => {
      const el =
        group.anchor === null
          ? null
          : elements.find((h) => h.textContent?.trim() === group.anchor);
      const raw = el ? el.getBoundingClientRect().top - base : 0;
      const top = Math.max(raw, floor);
      floor = top + (nodes.current[index]?.offsetHeight ?? 0) + GAP;
      return Math.round(top);
    });
    setTops((prev) =>
      prev.length === next.length && prev.every((v, i) => v === next[i])
        ? prev
        : next,
    );
  };
  useLayoutEffect(() => measure.current());
  useLayoutEffect(() => {
    const root = paper.current;
    if (!root) return;
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(root);
    return () => observer.disconnect();
  }, [paper]);

  if (!groups.length) return <div className="editor-gutter" aria-hidden />;
  return (
    <aside className="editor-gutter" aria-label={t("이 글을 고칠 할 일")}>
      {groups.map((group, index) => (
        <div
          key={group.anchor ?? "\u0000top"}
          ref={(node) => {
            nodes.current[index] = node;
          }}
          className="editor-gutter-group"
          style={{ top: tops[index] ?? 0 }}
        >
          {group.tasks.map((task) => {
            const done = task.status === "done";
            return (
              <div key={task.id} className="editor-gutter-task">
                <span className="editor-gutter-row">
                  <input
                    type="checkbox"
                    checked={done}
                    title={task.title}
                    aria-label={t("{title} 완료", { title: task.title })}
                    onChange={() => onToggle(task)}
                  />
                  <button
                    type="button"
                    className="editor-gutter-open"
                    title={task.title}
                    aria-label={t("{title} 열기", { title: task.title })}
                    onClick={() => onOpenTask(task.id)}
                  >
                    <Icon name="chevron-right" size={14} />
                  </button>
                </span>
                {task.feedbackIds.map((id) => {
                  const number = numbers.get(id);
                  if (!number) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      className="editor-gutter-num"
                      aria-label={t("피드백 {number} 열기", { number })}
                      onClick={() => onOpenFeedback(id)}
                    >
                      {number}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

/**
 * 도구 줄 2의 '피드백 n/m 다룸'(05 §3.5). 이 글의 할 일에 딸린 피드백 가운데
 * 학생이 수정 결과 있음·보류·고치지 않음으로 둔 수입니다. 연결된 피드백이 없으면 그리지 않습니다.
 */
export function FeedbackHandled({
  items,
  onOpen,
}: {
  items: { feedback: Feedback; number: number }[];
  onOpen: (id: string) => void;
}) {
  if (!items.length) return null;
  const handled = items.filter((item) =>
    isHandled(item.feedback.status),
  ).length;
  return (
    <div className="editor-toolbar-2">
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="ghost" size="sm">
            {t("피드백 {handled}/{total} 다룸", {
              handled,
              total: items.length,
            })}
            <Icon name="chevron-down" size={14} />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="editor-feedback-popover"
            align="start"
            sideOffset={6}
            collisionPadding={16}
          >
            <p className="editor-feedback-note">
              {t(
                "학생이 표시한 처리 상태를 센 수예요. 교수 응답은 피드백 상세에서 따로 보여요.",
              )}
            </p>
            <ul>
              {items.map(({ feedback, number }) => (
                <li key={feedback.id}>
                  <Popover.Close asChild>
                    <button type="button" onClick={() => onOpen(feedback.id)}>
                      <span className="editor-gutter-num" aria-hidden>
                        {number}
                      </span>
                      <span className="editor-feedback-title">
                        {feedback.title}
                      </span>
                      <small
                        data-handled={isHandled(feedback.status) || undefined}
                      >
                        {feedbackLabels[feedback.status]}
                      </small>
                    </button>
                  </Popover.Close>
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
