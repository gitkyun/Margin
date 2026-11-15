import { t } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { uid, type AICandidate, type AIInput } from "@/lib/domain";
import { useWorkspace } from "@/lib/workspace";
import { useAIRequestOptions } from "@/lib/ai-request-options";
import { useAINotConfigured } from "@/lib/ai-availability";
import { AIWorkbench } from "../student/AIWorkbench";
import { Button } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icons";
import { InlineEmpty, useDisabledReason } from "@/components/common";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  aiReviewKey,
  findQuoteRange,
  isReviewStale,
  rangeText,
  suggestedSentence,
  type DocRange,
} from "./ai-review";
import { WordDiff } from "./WordDiff";

interface PendingApply {
  /** 반영할 원문 위치(확인 창을 열 때 찾음) */
  range: DocRange;
  original: string;
  draft: string;
  /** 넣을 문장을 AI 예시에서 가져왔는지(아니면 원문에서 시작) */
  fromAI: boolean;
  method: string;
}

interface WritingReviewOptions {
  editor: Editor | null;
  researchId: string;
  documentId: string;
  /** 저장된 문서 제목·저장 횟수(서버가 이 값으로 원문이 바뀌었는지 확인해요) */
  savedTitle: string;
  savedRevision: number;
  dirty: boolean;
  busy: boolean;
  /** 저장하지 않은 변경이 있으면 먼저 저장해요(실패하면 오류를 던져요). */
  saveFirst(): Promise<void>;
}

const reducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 글쓰기 여백 패널의 ‘AI 문장 점검’(교차 #3).
 * - 연구 도우미 화면으로 이동하지 않고, 고른 문단(없으면 저장한 문서 전체)만 보내요.
 *   요청은 연구 도우미의 원고 검토(review_writing)와 같은 꼴(contexts: documents)이에요.
 * - 점검 범위는 에디터에 옅게 표시하고, 제안을 고르면 원문과 넣을 문장을 나란히 보여 줘요.
 * - 사용자가 ‘반영’을 눌러야만 그 범위에 넣고(TipTap 트랜잭션), 그사이 원문이 바뀌었으면 막아요.
 */
export function useWritingReview({
  editor,
  researchId,
  documentId,
  savedTitle,
  savedRevision,
  dirty,
  busy,
  saveFirst,
}: WritingReviewOptions) {
  // 점검을 시작했는지, 고른 문단만인지. 다시 시작하면 run이 바뀌어 이전 제안을 비워요.
  const [scope, setScope] = useState<{ selection: boolean } | null>(null);
  const [run, setRun] = useState(0);
  const [pending, setPending] = useState<PendingApply | null>(null);
  const [applyError, setApplyError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { runAI, mode } = useWorkspace();
  const aiOptions = useAIRequestOptions();
  const aiNotConfigured = useAINotConfigured();
  const [inlineInstruction, setInlineInstruction] = useState("");
  const [inlineEdit, setInlineEdit] = useState<{
    range: DocRange;
    original: string;
    rewritten: string;
    instruction: string;
    busy: boolean;
  } | null>(null);
  const settle = useRef<{
    resolve(): void;
    reject(error: Error): void;
  } | null>(null);

  // 패널이 사라질 때 기다리던 확인을 정리해요.
  useEffect(
    () => () => settle.current?.reject(new Error(t("반영을 취소했어요."))),
    [],
  );

  const state = editor ? aiReviewKey.getState(editor.state) : undefined;
  const range = scope && state?.range ? state.range : null;
  const stale = !!editor && !!range && isReviewStale(editor.state);
  const sourceText =
    editor && range ? rangeText(editor.state.doc, range).trim() : "";
  const startReason = useDisabledReason(
    dirty
      ? t("저장한 뒤에 AI 문장 점검을 할 수 있어요.")
      : !editor?.getText().trim()
        ? t("문서에 내용이 있어야 점검할 수 있어요.")
        : "",
  );

  function dispatchMeta(meta: unknown) {
    if (!editor) return;
    editor.view.dispatch(editor.state.tr.setMeta(aiReviewKey, meta));
  }

  /** 지금 선택(없으면 문서 전체)으로 점검을 시작해요. 시작하면 true. */
  function start(): boolean {
    if (!editor || dirty || !editor.getText().trim()) return false;
    const selection = editor.state.selection;
    const selected = !selection.empty;
    dispatchMeta({
      type: "start",
      range: selected
        ? { from: selection.from, to: selection.to }
        : { from: 0, to: editor.state.doc.content.size },
    });
    setScope({ selection: selected });
    setRun((value) => value + 1);
    return true;
  }

  /** 원문이 바뀌었을 때: 먼저 저장하고 지금 범위로 다시 시작해요(이전 제안은 비워요). */
  async function refresh() {
    if (!editor || !range || refreshing) return;
    setRefreshing(true);
    try {
      if (dirty) await saveFirst();
      dispatchMeta({ type: "start", range });
      setRun((value) => value + 1);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  function end() {
    settle.current?.reject(new Error(t("반영을 취소했어요.")));
    settle.current = null;
    dispatchMeta({ type: "clear" });
    setScope(null);
    setPending(null);
  }

  /** AIWorkbench의 ‘선택’: 반영 확인 창을 열고, 사용자가 반영하면 끝나요. */
  function requestApply(candidate: AICandidate): Promise<void> {
    if (!editor || !range)
      return Promise.reject(new Error(t("점검을 다시 시작해 주세요.")));
    if (isReviewStale(editor.state))
      return Promise.reject(
        new Error(
          t(
            "AI를 실행한 뒤 원문이 바뀌었어요. 바뀐 원문으로 다시 제안받아 주세요.",
          ),
        ),
      );
    const quote = candidate.sourceQuote?.trim() ?? "";
    if (!quote)
      return Promise.reject(
        new Error(
          t(
            "이 제안에는 고칠 문장 발췌가 없어 바로 반영할 수 없어요. 제안을 보고 직접 고쳐 주세요.",
          ),
        ),
      );
    const at = findQuoteRange(editor.state.doc, quote, range);
    if (!at)
      return Promise.reject(
        new Error(
          t(
            "고칠 문장을 문서에서 찾지 못했어요. 여러 문단에 걸쳐 있거나 이미 바뀌었을 수 있으니 직접 고쳐 주세요.",
          ),
        ),
      );
    // 에디터에서 그 문장을 강조하고 보이는 곳으로 옮겨요(선택은 바꾸지 않아요).
    dispatchMeta({ type: "focus", focus: at });
    const node = editor.view.domAtPos(at.from).node;
    (node instanceof Element ? node : node.parentElement)?.scrollIntoView({
      block: "center",
      behavior: reducedMotion() ? "instant" : "smooth",
    });
    const method = candidate.method ?? candidate.body ?? "";
    const suggestion = suggestedSentence(method, quote);
    setApplyError("");
    setPending({
      range: at,
      original: quote,
      draft: suggestion.text,
      fromAI: suggestion.fromAI,
      method,
    });
    return new Promise<void>((resolve, reject) => {
      settle.current = { resolve, reject };
    });
  }

  function cancelApply() {
    settle.current?.reject(
      new Error(t("반영을 취소했어요. 문서는 바뀌지 않았어요.")),
    );
    settle.current = null;
    setPending(null);
    dispatchMeta({ type: "focus", focus: null });
  }

  function confirmApply() {
    if (!editor || !pending) return;
    const text = pending.draft.trim();
    if (!text) {
      setApplyError(t("넣을 문장을 입력해 주세요."));
      return;
    }
    // 확인하는 사이 원문이 바뀌었으면 넣지 않아요.
    const current = editor.state.doc.textBetween(
      pending.range.from,
      pending.range.to,
    );
    if (isReviewStale(editor.state) || current !== pending.original) {
      setApplyError(
        t(
          "확인하는 사이 원문이 바뀌어 반영하지 않았어요. 바뀐 원문으로 다시 제안받아 주세요.",
        ),
      );
      return;
    }
    const tr = editor.state.tr.insertText(
      text,
      pending.range.from,
      pending.range.to,
    );
    tr.setMeta(aiReviewKey, { type: "applied" });
    editor.view.dispatch(tr);
    settle.current?.resolve();
    settle.current = null;
    setPending(null);
    toast.success(
      t("제안 문장을 반영했어요. 되돌리려면 ⌘Z(Ctrl+Z)를 눌러 주세요."),
    );
  }

  const input: AIInput | null =
    scope && range
      ? {
          mode: "review_writing",
          researchId,
          question: t("고른 원고 문단을 검토해 주세요."),
          sourceText,
          contexts: [
            {
              kind: "documents",
              id: documentId,
              title:
                savedTitle + (scope.selection ? ` · ${t("선택 문단")}` : ""),
              revision: savedRevision,
              ...(scope.selection ? { text: sourceText } : {}),
            },
          ],
          // 실행마다 새 번호가 필요해요. 화면을 다시 그릴 때마다 새로 만들고, 누를 때의 값이 쓰여요.
          clientRunId: uid(),
        }
      : null;

  async function runInlineEdit(instruction: string) {
    if (!editor || dirty || busy || mode === "preview" || aiNotConfigured)
      return;
    const sel = editor.state.selection;
    if (sel.empty) {
      toast.info(t("고칠 문장을 먼저 선택해 주세요."));
      return;
    }
    const original = editor.state.doc.textBetween(sel.from, sel.to);
    if (!original.trim()) return;
    const targetRange = { from: sel.from, to: sel.to };
    setInlineEdit({
      range: targetRange,
      original,
      rewritten: "",
      instruction,
      busy: true,
    });
    try {
      const res = await runAI({
        mode: "inline_edit",
        ...aiOptions(),
        researchId,
        question: instruction,
        sourceText: original,
        contexts: [
          {
            kind: "documents",
            id: documentId,
            title: `${savedTitle} · ${t("선택 문단")}`,
            revision: savedRevision,
            text: original,
          },
        ],
        clientRunId: uid(),
      });
      const rewritten = res.answer?.trim() ?? "";
      if (!rewritten) {
        toast.info(t("고쳐 쓴 문장을 찾지 못했어요."));
        setInlineEdit(null);
        return;
      }
      setInlineEdit({
        range: targetRange,
        original,
        rewritten,
        instruction,
        busy: false,
      });
    } catch (error) {
      toast.error((error as Error).message);
      setInlineEdit(null);
    }
  }

  function applyInlineEdit() {
    if (!editor || !inlineEdit || !inlineEdit.rewritten.trim()) return;
    if (inlineEdit.range.to > editor.state.doc.content.size) {
      toast.error(
        t(
          "확인하는 사이 원문이 바뀌어 반영하지 않았어요. 바뀐 원문으로 다시 제안받아 주세요.",
        ),
      );
      setInlineEdit(null);
      return;
    }
    const current = editor.state.doc.textBetween(
      inlineEdit.range.from,
      inlineEdit.range.to,
    );
    if (current !== inlineEdit.original) {
      toast.error(
        t(
          "확인하는 사이 원문이 바뀌어 반영하지 않았어요. 바뀐 원문으로 다시 제안받아 주세요.",
        ),
      );
      setInlineEdit(null);
      return;
    }
    editor
      .chain()
      .focus()
      .insertContentAt(inlineEdit.range, inlineEdit.rewritten.trim())
      .run();
    setInlineEdit(null);
    toast.success(
      t("제안 문장을 반영했어요. 되돌리려면 ⌘Z(Ctrl+Z)를 눌러 주세요."),
    );
  }

  const inlinePresets = [
    t("더 간결하게"),
    t("더 명확하게"),
    t("더 자연스럽게"),
    t("문장 다듬기"),
  ];

  const panel = (
    <div className="panel-frame-body writing-review">
      <div className="writing-inline-edit">
        <div className="writing-inline-edit-head">
          <strong>{t("인라인 고쳐 쓰기")}</strong>
          <small>
            {t("선택한 문장을 바로 고쳐 쓰고 단어 차이를 확인해요.")}
          </small>
        </div>
        <div className="writing-inline-presets">
          {inlinePresets.map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant="outline"
              disabled={
                dirty ||
                busy ||
                mode === "preview" ||
                aiNotConfigured ||
                !!inlineEdit?.busy
              }
              title={
                mode === "preview"
                  ? t("미리보기에서는 인라인 고쳐 쓰기를 쓸 수 없어요.")
                  : undefined
              }
              onClick={() => void runInlineEdit(preset)}
            >
              {preset}
            </Button>
          ))}
        </div>
        {inlineEdit && (
          <div className="writing-inline-edit-result" role="status">
            {inlineEdit.busy ? (
              <p>{t("문장을 고쳐 쓰는 중")}</p>
            ) : (
              <>
                <WordDiff
                  before={inlineEdit.original}
                  after={inlineEdit.rewritten}
                />
                <div className="writing-inline-edit-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setInlineEdit(null)}
                  >
                    {t("닫기")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runInlineEdit(inlineEdit.instruction)}
                  >
                    {t("다시 쓰기")}
                  </Button>
                  <Button type="button" size="sm" onClick={applyInlineEdit}>
                    {t("반영")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {input ? (
        <>
          <div className="writing-review-scope">
            <Icon name="sparkles" size={15} />
            <span>
              {scope?.selection
                ? t("에디터에 표시한 선택 문단 {count}자를 점검해요.", {
                    count: sourceText.length.toLocaleString(),
                  })
                : t("저장한 문서 전체 {count}자를 점검해요.", {
                    count: sourceText.length.toLocaleString(),
                  })}
            </span>
          </div>
          <AIWorkbench
            key={run}
            embedded
            title={t("AI 문장 점검")}
            input={input}
            stale={stale}
            onClose={end}
            onRefresh={() => void refresh()}
            onSave={(candidate) => requestApply(candidate)}
          />
          <p className="panel-frame-note">
            {t(
              "제안을 고르면 원문과 넣을 문장을 비교하는 창이 열려요. ‘반영’을 눌러야 문서가 바뀌고, 반영해도 버전은 따로 남기지 않아요.",
            )}
          </p>
          <Button variant="ghost" size="sm" onClick={end}>
            {t("점검 끝내기")}
          </Button>
        </>
      ) : (
        <>
          <InlineEmpty>
            {t(
              "고칠 문단을 선택한 뒤 시작하면 그 부분만, 선택하지 않으면 저장한 문서 전체를 점검해요. 제안은 여기에 보이고 문서는 바로 바뀌지 않아요.",
            )}
          </InlineEmpty>
          <Button
            variant="outline"
            disabled={dirty || busy || !editor?.getText().trim()}
            aria-describedby={startReason.describedBy}
            onClick={() => start()}
          >
            <Icon name="sparkles" size={16} />
            {t("AI 문장 점검 시작")}
          </Button>
          {startReason.node}
        </>
      )}
    </div>
  );

  const dialog = (
    <Dialog
      open={!!pending}
      onOpenChange={(open) => {
        if (!open) cancelApply();
      }}
    >
      <DialogContent className="rms-dialog wide-dialog writing-apply">
        <DialogHeader>
          <DialogTitle>{t("제안 문장 반영")}</DialogTitle>
          <DialogDescription>
            {t(
              "원문과 넣을 문장을 비교하고, 필요하면 고친 뒤 반영해 주세요. ‘반영’을 누르기 전에는 문서가 바뀌지 않아요.",
            )}
          </DialogDescription>
        </DialogHeader>
        {pending && (
          <div className="rms-modal-stack">
            <blockquote className="source-excerpt">
              <small>{t("원문")}</small>
              {pending.original}
            </blockquote>
            <label className="field">
              <span className="field-name">
                {pending.fromAI
                  ? t("넣을 문장 (AI 제안)")
                  : t("넣을 문장 (원문에서 시작)")}
              </span>
              <Textarea
                value={pending.draft}
                rows={4}
                onChange={(e) => {
                  setApplyError("");
                  setPending({ ...pending, draft: e.target.value });
                }}
              />
              <small>
                {pending.fromAI
                  ? t(
                      "AI가 ‘어떻게 고칠지’에 적은 예시 문장이에요. 원문의 주장·수치가 그대로인지 확인해 주세요.",
                    )
                  : t(
                      "AI 제안에서 바로 넣을 문장을 찾지 못해 원문을 넣어 두었어요. 아래 방법을 보고 직접 고쳐 주세요.",
                    )}
              </small>
            </label>
            <WordDiff before={pending.original} after={pending.draft} />
            {pending.method && (
              <Disclosure
                className="writing-apply-method"
                summary={t("AI가 적은 고칠 방법")}
              >
                <p>{pending.method}</p>
              </Disclosure>
            )}
            {applyError && (
              <p className="rms-error" role="alert">
                {applyError}
              </p>
            )}
            <div className="bottom-actions">
              <Button variant="outline" onClick={cancelApply}>
                {t("취소")}
              </Button>
              <Button
                disabled={
                  !pending.draft.trim() ||
                  pending.draft.trim() === pending.original
                }
                onClick={confirmApply}
              >
                {t("반영")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const selectedText =
    editor && !editor.state.selection.empty
      ? editor.state.doc
          .textBetween(editor.state.selection.from, editor.state.selection.to)
          .trim()
      : "";
  const inlineDisabled =
    dirty ||
    busy ||
    mode === "preview" ||
    aiNotConfigured ||
    !!inlineEdit?.busy;
  const selectionBar =
    selectedText || inlineEdit ? (
      <div
        className="writing-selection-bar"
        role="region"
        aria-label={t("선택 문장 고쳐 쓰기")}
      >
        <form
          className="writing-selection-bar-form"
          onSubmit={(e) => {
            e.preventDefault();
            const q = inlineInstruction.trim();
            if (!q) return;
            void runInlineEdit(q);
          }}
        >
          <Input
            value={inlineInstruction}
            onChange={(e) => setInlineInstruction(e.target.value)}
            placeholder={t("어떻게 고칠까요? 예: 더 간결하게")}
            maxLength={500}
            disabled={inlineDisabled}
          />
          <Button
            type="submit"
            size="sm"
            disabled={inlineDisabled || !inlineInstruction.trim()}
          >
            {t("고쳐 쓰기")}
          </Button>
        </form>
        {inlineEdit && (
          <div className="writing-inline-edit-result" role="status">
            {inlineEdit.busy ? (
              <p>{t("문장을 고쳐 쓰는 중")}</p>
            ) : (
              <>
                <WordDiff
                  before={inlineEdit.original}
                  after={inlineEdit.rewritten}
                />
                <div className="writing-inline-edit-actions">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setInlineEdit(null)}
                  >
                    {t("닫기")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void runInlineEdit(inlineEdit.instruction)}
                  >
                    {t("다시 쓰기")}
                  </Button>
                  <Button type="button" size="sm" onClick={applyInlineEdit}>
                    {t("반영")}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    ) : null;

  return { start, active: !!input, panel, dialog, selectionBar };
}
