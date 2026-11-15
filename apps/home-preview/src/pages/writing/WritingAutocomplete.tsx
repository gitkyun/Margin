import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { uid, type AIInput } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { useAIRequestOptions } from "@/lib/ai-request-options";

interface WritingAutocompleteProps {
  editor: Editor | null;
  researchId: string;
  documentId: string;
  title: string;
  revision: number;
  /** 저장하지 않은 변경이 있는지 */
  dirty: boolean;
  /** 지금 본문을 저장하고 저장된 문서를 돌려줘요(실패하면 오류를 던져요). */
  saveFirst(): Promise<{ revision: number }>;
  disabled: boolean;
  preview: boolean;
  runAI: (input: AIInput) => Promise<{
    answer?: string;
    candidates: Array<{ body?: string; method?: string }>;
  }>;
}

/**
 * 집필실 AI 자동완성(Kokonut UI AI Autocomplete 패턴).
 * 사용자가 ‘문장 이어쓰기’를 누르면 현재 문단 뒤를 제안하고, Tab으로 본문에 넣거나 Esc로 닫아요.
 */
export function WritingAutocomplete({
  editor,
  researchId,
  documentId,
  title,
  revision,
  dirty,
  saveFirst,
  disabled,
  preview,
  runAI,
}: WritingAutocompleteProps) {
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const aiOptions = useAIRequestOptions();
  // 키 처리기가 항상 최신 제안·편집기를 보도록 ref로 들고 있어요.
  const latest = useRef({ suggestion, editor });
  latest.current = { suggestion, editor };

  useEffect(() => {
    if (!suggestion) return;
    const onKey = (e: KeyboardEvent) => {
      const { editor: current, suggestion: text } = latest.current;
      if (!current || !text || e.isComposing) return;
      if (e.key !== "Tab" && e.key !== "Escape") return;
      // 본문에 커서가 있고 열린 창이 없을 때만 가로채요(다른 입력·창의 Tab/Esc는 그대로 둬요).
      const inEditor =
        e.target instanceof Node && current.view.dom.contains(e.target);
      if (
        !inEditor ||
        document.querySelector('[role="dialog"], [aria-modal="true"]')
      )
        return;
      e.preventDefault();
      if (e.key === "Tab") accept();
      else setSuggestion("");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // accept는 latest ref만 읽어서 다시 만들 필요가 없어요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!suggestion]);

  function accept() {
    const { editor: current, suggestion: text } = latest.current;
    if (!current || !text) return;
    current.chain().focus().insertContent(` ${text}`).run();
    setSuggestion("");
  }

  async function requestSuggestion() {
    if (!editor || busy || disabled) return;
    const typed = editor.getText();
    if (!typed.trim()) return;
    setBusy(true);
    try {
      // 저장한 원고와 같은 저장 횟수로만 실행해요. 저장하지 않은 내용은 먼저 저장해요.
      const savedRevision = dirty ? (await saveFirst()).revision : revision;
      if (editor.getText() !== typed) {
        toast.info(t("저장하는 사이 본문이 바뀌었어요. 다시 눌러 주세요."));
        return;
      }
      const excerpt = typed.trim().slice(-600);
      const res = await runAI({
        // 서버의 이어쓰기 전용 방식이에요. 답 문장만 받고 후보는 쌓지 않아요.
        mode: "continue_writing",
        ...aiOptions(),
        researchId,
        question: t(
          "아래 문단 바로 뒤에 자연스럽게 이어질 한두 문장만 간결하게 제안해 주세요.",
        ),
        sourceText: excerpt,
        contexts: [
          {
            kind: "documents",
            id: documentId,
            title,
            revision: savedRevision,
            text: excerpt,
          },
        ],
        clientRunId: uid(),
      });
      const text = res.answer?.trim() ?? "";
      if (!text) {
        toast.info(t("이어 쓸 문장을 찾지 못했어요."));
        return;
      }
      setSuggestion(text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="writing-autocomplete">
      {suggestion ? (
        <div
          className="writing-autocomplete-card"
          role="status"
          aria-live="polite"
        >
          <p className="writing-autocomplete-ghost">{suggestion}</p>
          <div className="writing-autocomplete-actions">
            <small>{t("Tab으로 반영 · Esc로 닫기")}</small>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSuggestion("")}
            >
              {t("닫기")}
            </Button>
            <Button type="button" size="sm" onClick={accept}>
              {t("문장 넣기")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="writing-autocomplete-trigger">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || disabled}
            title={
              preview
                ? t("미리보기에서는 AI 이어쓰기를 쓸 수 없어요.")
                : undefined
            }
            onClick={() => void requestSuggestion()}
          >
            <Icon name="sparkles" size={14} />
            {busy ? t("문장 생성 중") : t("AI 이어쓰기")}
          </Button>
        </div>
      )}
    </div>
  );
}
