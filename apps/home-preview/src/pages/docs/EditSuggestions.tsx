import { t } from "@/lib/i18n";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Extension, getTextSerializersFromSchema } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import type { SavedAICandidate } from "@/lib/domain";
import {
  placeSuggestions,
  textMap,
  type PlacedSuggestion,
} from "@/lib/edit-suggestions";

interface MarkItem {
  id: string;
  from: number;
  to: number;
  body: string;
  active: boolean;
}

const suggestKey = new PluginKey<MarkItem[]>("editSuggestions");

/** 단축키가 부를 함수. 화면(훅)이 채웁니다. 처리하지 않으면 false를 돌려 원래 키 동작을 둡니다. */
export interface SuggestionKeys {
  next?: () => boolean;
  prev?: () => boolean;
  apply?: () => boolean;
  dismiss?: () => boolean;
}

/**
 * 본문 안 수정 제안 표시(IA v2 05 §3.6). 지울 글자는 취소선(옅은 빨강), 넣을 글자는 밑줄(옅은 파랑)로
 * 꾸밈만 그리고 글에는 남기지 않습니다. 적용하기 전까지 글은 바뀌지 않습니다.
 */
export const EditSuggestionMarks = Extension.create<
  Record<string, never>,
  { keys: SuggestionKeys }
>({
  name: "editSuggestions",
  // 줄바꿈(Mod-Enter) 같은 기본 단축키보다 먼저 받되, 지금 제안이 없으면 넘깁니다.
  priority: 1000,
  addStorage() {
    return { keys: {} };
  },
  addKeyboardShortcuts() {
    const keys = () => this.storage.keys;
    return {
      "Alt-]": () => keys().next?.() ?? false,
      "Alt-[": () => keys().prev?.() ?? false,
      "Mod-Enter": () => keys().apply?.() ?? false,
      "Mod-Backspace": () => keys().dismiss?.() ?? false,
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<MarkItem[]>({
        key: suggestKey,
        state: {
          init: () => [],
          apply(tr, items) {
            const next = tr.getMeta(suggestKey) as MarkItem[] | undefined;
            if (next) return next;
            if (!tr.docChanged) return items;
            // 다음에 다시 자리를 잡기 전까지 표시가 글자를 따라가게 옮깁니다.
            return items
              .map((item) => ({
                ...item,
                from: tr.mapping.map(item.from, 1),
                to: tr.mapping.map(item.to, -1),
              }))
              .filter((item) => item.to > item.from);
          },
        },
        props: {
          decorations(state) {
            const items = suggestKey.getState(state) ?? [];
            if (!items.length) return null;
            const decorations: Decoration[] = [];
            for (const item of items) {
              const active = item.active ? " is-active" : "";
              decorations.push(
                Decoration.inline(item.from, item.to, {
                  class: `suggest-del${active}`,
                  "data-suggest": item.id,
                }),
              );
              if (item.body)
                decorations.push(
                  Decoration.widget(
                    item.to,
                    () => {
                      const ins = document.createElement("ins");
                      ins.className = `suggest-ins${active}`;
                      ins.dataset.suggest = item.id;
                      ins.textContent = item.body;
                      return ins;
                    },
                    {
                      side: 1,
                      key: `${item.id}:${item.active}:${item.body}`,
                      ignoreSelection: true,
                    },
                  ),
                );
            }
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

interface Live extends PlacedSuggestion {
  record: SavedAICandidate;
}

/**
 * 이 글의 수정 제안(본인의 대기 중 AI 후보)을 본문에 놓고 적용·적용 안 함을 맡습니다.
 * 자리는 매번 지금 글에서 원문 글자를 찾아 잡으므로, 그 자리를 직접 고치면 제안은 조용히 빠집니다.
 */
export function useEditSuggestions({
  editor,
  records,
  onStatus,
}: {
  editor: Editor | null;
  records: SavedAICandidate[];
  onStatus: (
    record: SavedAICandidate,
    status: "adopted" | "dismissed",
  ) => Promise<void>;
}) {
  const [live, setLive] = useState<Live[]>([]);
  // 편집기 화면(view)은 처음 그린 뒤에 생깁니다. 그 전에는 view를 건드리지 않습니다.
  const [ready, setReady] = useState(!!editor?.isInitialized);
  useEffect(() => {
    if (!editor) return setReady(false);
    if (editor.isInitialized) return setReady(true);
    const onCreate = () => setReady(true);
    editor.on("create", onCreate);
    return () => {
      editor.off("create", onCreate);
    };
  }, [editor]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const hints = useRef(new Map<string, number>());
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const liveRef = useRef(live);
  liveRef.current = live;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;

  const place = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const map = textMap(
      editor.state.doc,
      getTextSerializersFromSchema(editor.schema),
    );
    const byId = new Map(recordsRef.current.map((r) => [r.id, r]));
    const placed = placeSuggestions(
      map,
      recordsRef.current.map((r) => ({
        id: r.id,
        quote: r.candidate.sourceQuote ?? "",
        hint: hints.current.get(r.id) ?? r.candidate.sourceStart ?? 0,
      })),
    );
    for (const p of placed) hints.current.set(p.id, p.start);
    const next = placed.map((p) => ({ ...p, record: byId.get(p.id)! }));
    setLive((prev) =>
      prev.length === next.length &&
      prev.every(
        (p, i) =>
          p.id === next[i].id &&
          p.from === next[i].from &&
          p.to === next[i].to &&
          p.record === next[i].record,
      )
        ? prev
        : next,
    );
  }, [editor]);

  // 글이 바뀔 때마다, 제안 목록이 바뀔 때마다 자리를 다시 잡습니다.
  useEffect(() => {
    if (!editor) return;
    place();
    editor.on("update", place);
    return () => {
      editor.off("update", place);
    };
  }, [editor, place]);
  useEffect(place, [records, place]);

  // 커서가 제안 안에 들어가면 그 제안을 지금 제안으로 둡니다.
  useEffect(() => {
    if (!editor) return;
    const onSelect = () => {
      const { from } = editor.state.selection;
      const hit = liveRef.current.find((p) => from >= p.from && from <= p.to);
      if (hit) setActiveId(hit.id);
    };
    editor.on("selectionUpdate", onSelect);
    return () => {
      editor.off("selectionUpdate", onSelect);
    };
  }, [editor]);
  // 마우스를 올려도 지금 제안이 됩니다.
  useEffect(() => {
    if (!editor || !ready || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const onOver = (event: MouseEvent) => {
      const id = (event.target as HTMLElement | null)
        ?.closest("[data-suggest]")
        ?.getAttribute("data-suggest");
      if (id) setActiveId(id);
    };
    dom.addEventListener("mouseover", onOver);
    return () => dom.removeEventListener("mouseover", onOver);
  }, [editor, ready]);

  const active = live.find((p) => p.id === activeId) ?? null;
  // 그린 표시를 편집기에 넘깁니다(글은 바꾸지 않는 메타 거래).
  useEffect(() => {
    if (!editor || !ready || editor.isDestroyed) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(
        suggestKey,
        live.map((p) => ({
          id: p.id,
          from: p.from,
          to: p.to,
          body: p.record.candidate.body ?? "",
          active: p.id === activeId,
        })),
      ),
    );
  }, [editor, ready, live, activeId]);

  function focusOn(target: Live | undefined) {
    if (!editor || !target) return false;
    setActiveId(target.id);
    editor.chain().focus().setTextSelection(target.from).scrollIntoView().run();
    return true;
  }
  function step(delta: 1 | -1) {
    const list = liveRef.current;
    if (!list.length) return false;
    const index = list.findIndex((p) => p.id === activeRef.current);
    const nextIndex =
      index < 0
        ? delta > 0
          ? 0
          : list.length - 1
        : (index + delta + list.length) % list.length;
    return focusOn(list[nextIndex]);
  }
  /** 글에 넣습니다. 되돌리기(⌘Z)로 되돌릴 수 있습니다. */
  function apply(target: Live | null = active) {
    if (!editor || !target) return false;
    const body = target.record.candidate.body ?? "";
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        if (body) tr.insertText(body, target.from, target.to);
        else tr.delete(target.from, target.to);
        return true;
      })
      .run();
    void onStatus(target.record, "adopted");
    setActiveId(null);
    return true;
  }
  function dismiss(target: Live | null = active) {
    if (!target) return false;
    void onStatus(target.record, "dismissed");
    setActiveId(null);
    return true;
  }
  function applyAll() {
    if (!editor || !live.length) return;
    const list = [...live].sort((a, b) => b.from - a.from);
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        // 뒤에서부터 바꿔 앞쪽 위치가 밀리지 않게 합니다.
        for (const p of list) {
          const body = p.record.candidate.body ?? "";
          if (body) tr.insertText(body, p.from, p.to);
          else tr.delete(p.from, p.to);
        }
        return true;
      })
      .run();
    for (const p of list) void onStatus(p.record, "adopted");
    setActiveId(null);
  }
  function dismissAll() {
    for (const p of live) void onStatus(p.record, "dismissed");
    setActiveId(null);
  }

  // 단축키(05 §3.6): Alt+] 다음, Alt+[ 이전, ⌘/Ctrl+Enter 적용, ⌘/Ctrl+Backspace 적용 안 함
  if (editor && !editor.isDestroyed) {
    const keys = (
      editor.storage as unknown as Record<string, { keys: SuggestionKeys }>
    ).editSuggestions?.keys;
    if (keys) {
      keys.next = () => step(1);
      keys.prev = () => step(-1);
      keys.apply = () => (active ? apply(active) : false);
      keys.dismiss = () => (active ? dismiss(active) : false);
    }
  }

  return {
    live,
    active,
    next: () => step(1),
    prev: () => step(-1),
    apply,
    dismiss,
    applyAll,
    dismissAll,
    /** 지금 놓인 제안 수(다른 곳에서 글이 바뀌어 빠진 수를 셀 때 씁니다) */
    count: live.length,
  };
}

/** 도구 줄 2의 "수정 제안 n개 ‹ › [모두 적용] [모두 적용 안 함]" */
export function SuggestionBar({
  count,
  index,
  onPrev,
  onNext,
  onApplyAll,
  onDismissAll,
}: {
  count: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
  onApplyAll: () => void;
  onDismissAll: () => void;
}) {
  if (!count) return null;
  return (
    <span className="suggest-bar" role="group" aria-label={t("수정 제안")}>
      <span className="suggest-bar-count">
        {index >= 0
          ? t("수정 제안 {index}/{count}", { index: index + 1, count })
          : t("수정 제안 {count}개", { count })}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("이전 제안 (Alt+[)")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onPrev}
      >
        <Icon name="chevron-left" size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("다음 제안 (Alt+])")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onNext}
      >
        <Icon name="chevron-right" size={16} />
      </Button>
      <Button size="sm" variant="outline" onClick={onApplyAll}>
        {t("모두 적용")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDismissAll}>
        {t("모두 적용 안 함")}
      </Button>
    </span>
  );
}

/** 지금 제안 옆의 작은 카드: 이유 한 줄 · [적용] [적용 안 함] */
export function SuggestionCard({
  editor,
  paper,
  target,
  onApply,
  onDismiss,
}: {
  editor: Editor | null;
  paper: RefObject<HTMLElement | null>;
  target: Live | null;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!editor || !target || !paper.current) return setAt(null);
    try {
      const coords = editor.view.coordsAtPos(target.from);
      const box = paper.current.getBoundingClientRect();
      setAt({
        top: coords.bottom - box.top + 6,
        left: Math.max(8, Math.min(coords.left - box.left, box.width - 300)),
      });
    } catch {
      setAt(null);
    }
  }, [editor, paper, target?.id, target?.from]);
  if (!target || !at) return null;
  return (
    <div
      className="suggest-card"
      role="dialog"
      aria-label={t("수정 제안")}
      style={{ top: at.top, left: at.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <p>{target.record.candidate.title}</p>
      <div>
        <Button size="sm" onClick={onApply}>
          {t("적용")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          {t("적용 안 함")}
        </Button>
      </div>
    </div>
  );
}

/** 받은 제안 결과를 알립니다. 원문에서 찾지 못해 뺀 수도 함께. */
export function announceSuggestions(count: number, dropped = 0) {
  if (!count) return;
  toast.success(
    dropped
      ? t(
          "수정 제안 {count}개를 받았어요. 글에서 자리를 찾지 못한 {dropped}개는 뺐어요.",
          { count, dropped },
        )
      : t("수정 제안 {count}개를 받았어요.", { count }),
  );
}
