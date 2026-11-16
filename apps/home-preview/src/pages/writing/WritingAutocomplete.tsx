import { useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AcceptBar,
  AutocompleteGhost,
} from "@/components/kokonut/ai-autocomplete";
import "./kokonut-writing.css";
import { Extension, type Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { uid, type AIInput } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { useAIRequestOptions } from "@/lib/ai-request-options";

/** 이어쓰기는 문서 끝이 아니라 현재 커서 바로 앞의 문맥을 사용합니다. */
export function continuationExcerpt(editor: Editor): string {
  return editor.state.doc
    .textBetween(0, editor.state.selection.to, "\n")
    .trim()
    .slice(-600);
}

interface GhostState {
  text: string;
  pos: number;
}

type GhostMeta = { type: "set"; text: string; pos: number } | { type: "clear" };

export const aiAutocompleteKey = new PluginKey<GhostState>(
  "margin-ai-autocomplete",
);

const EMPTY_GHOST: GhostState = { text: "", pos: 0 };

/** 커서 뒤에 회색 이어쓰기 제안을 띄우는 TipTap 장식 확장. 문서 내용에는 남지 않아요. */
export const AIAutocompleteGhost = Extension.create({
  name: "marginAIAutocomplete",
  addProseMirrorPlugins() {
    return [
      new Plugin<GhostState>({
        key: aiAutocompleteKey,
        state: {
          init: () => EMPTY_GHOST,
          apply(tr, value) {
            const meta = tr.getMeta(aiAutocompleteKey) as GhostMeta | undefined;
            if (meta?.type === "clear") return EMPTY_GHOST;
            if (meta?.type === "set") return { text: meta.text, pos: meta.pos };
            if (tr.docChanged) return EMPTY_GHOST;
            if (
              tr.selectionSet &&
              (!tr.selection.empty || tr.selection.to !== value.pos)
            )
              return EMPTY_GHOST;
            return value;
          },
        },
        props: {
          decorations(state) {
            const value = aiAutocompleteKey.getState(state);
            if (!value?.text) return null;
            const pos = Math.min(
              Math.max(0, value.pos),
              state.doc.content.size,
            );
            const widget = Decoration.widget(
              pos,
              () => {
                const span = document.createElement("span");
                span.className = "writing-autocomplete-ghost-inline";
                span.setAttribute("aria-hidden", "true");
                span.innerHTML = renderToStaticMarkup(
                  <AutocompleteGhost ghost={` ${value.text}`} />,
                );
                return span;
              },
              { side: 1 },
            );
            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },
});

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
 * 커서 뒤에 회색 글로 제안을 띄우고, Tab으로 전체를 넣고, →(ArrowRight)로 한 단어씩 넣으며, Esc로 닫아요.
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
  const latest = useRef({ suggestion, editor });
  latest.current = { suggestion, editor };

  useEffect(() => {
    if (!editor) return;
    const clearInvalidSuggestion = () => {
      if (!aiAutocompleteKey.getState(editor.state)?.text) setSuggestion("");
    };
    editor.on("transaction", clearInvalidSuggestion);
    return () => {
      editor.off("transaction", clearInvalidSuggestion);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (suggestion) {
      const pos = editor.state.selection.to;
      editor.view.dispatch(
        editor.state.tr.setMeta(aiAutocompleteKey, {
          type: "set",
          text: suggestion,
          pos,
        }),
      );
    } else {
      editor.view.dispatch(
        editor.state.tr.setMeta(aiAutocompleteKey, { type: "clear" }),
      );
    }
  }, [editor, suggestion]);

  useEffect(
    () => () => {
      if (editor && !editor.isDestroyed) {
        editor.view.dispatch(
          editor.state.tr.setMeta(aiAutocompleteKey, { type: "clear" }),
        );
      }
    },
    [editor],
  );

  useEffect(() => {
    if (!suggestion) return;
    const onKey = (e: KeyboardEvent) => {
      const { editor: current, suggestion: text } = latest.current;
      if (!current || !text || e.isComposing) return;
      if (e.key !== "Tab" && e.key !== "Escape" && e.key !== "ArrowRight")
        return;
      const inEditor =
        e.target instanceof Node && current.view.dom.contains(e.target);
      if (
        !inEditor ||
        document.querySelector('[role="dialog"], [aria-modal="true"]')
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Tab") accept();
      else if (e.key === "ArrowRight") acceptOneWord();
      else setSuggestion("");
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!suggestion]);

  function accept() {
    const { editor: current, suggestion: text } = latest.current;
    if (!current || !text) return;
    setSuggestion("");
    current.chain().focus().insertContent(` ${text}`).run();
  }

  function acceptOneWord() {
    const { editor: current, suggestion: text } = latest.current;
    if (!current || !text) return;
    const match = /^\s*\S+/.exec(text);
    if (!match) {
      accept();
      return;
    }
    const word = match[0].trimStart();
    const rest = text.slice(match[0].length).trimStart();
    current.chain().focus().insertContent(` ${word}`).run();
    setSuggestion(rest);
  }

  async function requestSuggestion() {
    if (!editor || busy || disabled) return;
    const typed = editor.getText();
    const requestedAt = editor.state.selection.to;
    if (!typed.trim()) return;
    setBusy(true);
    try {
      const savedRevision = dirty ? (await saveFirst()).revision : revision;
      if (editor.getText() !== typed) {
        toast.info(t("저장하는 사이 본문이 바뀌었어요. 다시 눌러 주세요."));
        return;
      }
      const excerpt = continuationExcerpt(editor);
      const res = await runAI({
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
      if (
        editor.isDestroyed ||
        editor.getText() !== typed ||
        !editor.state.selection.empty ||
        editor.state.selection.to !== requestedAt
      )
        return;
      if (!text) {
        toast.info(t("이어 쓸 문장을 찾지 못했어요."));
        return;
      }
      setSuggestion(text);
      editor.commands.focus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="writing-autocomplete">
      {suggestion ? (
        <AcceptBar visible onAccept={accept} onWord={acceptOneWord} />
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
