"use client";

/**
 * @author: @kokonutui
 * @description: AI Inline Edit
 * @version: 1.1.0
 * @date: 2026-10-21
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  PenLine,
  RotateCw,
  Square,
} from "lucide-react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** A rewrite: the text, a Promise of it, or a stream of text deltas. */
export type Rewrite = string | Promise<string> | AsyncIterable<string>;

export interface AIInlineEditProps {
  title?: string;
  /** The document, one string per paragraph. Read once, on mount. */
  paragraphs?: string[];
  /**
   * Rewrites the selected text. Return the text, a Promise of it, or a stream
   * of deltas (like the AI SDK's `textStream`); the bar shows it working until
   * the text is complete, then writes the changes in. `attempt` counts up with
   * each Try again, so you can ask for a different take. `signal` aborts when
   * the person presses Stop. Throw and the bar shows the error's message.
   */
  rewrite?: (
    text: string,
    instruction: string,
    attempt: number,
    signal: AbortSignal,
  ) => Rewrite;
  /** Called with every paragraph once a rewrite is accepted. */
  onChange?: (paragraphs: string[]) => void;
  className?: string;
}

interface Span {
  p: number;
  start: number;
  end: number;
}

interface Op {
  kind: "same" | "del" | "add";
  word: string;
  /** Whitespace after the word, kept outside the styled span. */
  gap: string;
  key: string;
}

type Phase =
  | "idle"
  | "prompt"
  | "thinking"
  | "streaming"
  | "review"
  | "settling"
  | "discarding";
type Action = "shorter" | "clearer" | "friendlier" | "grammar";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const BAR_WIDTH = 384;
const PAD = 16;
const WORD = /\S+\s*/g;
const TRAILING = /\s+$/;
const SPACE = /\s/;
const APPLE = /Mac|iPhone|iPad/;
const SENTENCE = /[^.!?]+[.!?]+\s*/g;
const SHORT_HINT = /short|concise|trim|tight|brief/;
const FRIENDLY_HINT = /friend|warm|casual|kind|human/;
const GRAMMAR_HINT = /grammar|typo|fix|spell|proof/;

const ACTIONS: { id: Action; label: string }[] = [
  { id: "shorter", label: t("더 간결하게") },
  { id: "clearer", label: t("더 명확하게") },
  { id: "friendlier", label: t("더 자연스럽게") },
  { id: "grammar", label: t("문장 다듬기") },
];

const DEMO_PARAGRAPHS = [
  "We are really excited to share that the new billing dashboard is finally ready to ship next week. In order to make the rollout as smooth as possible, we will be enabling it for a small number of workspaces first.",
  "Due to the fact that invoices are now generated in real time, some customers might notice that their totals look different then before. Support should reach out to anyone who's account has more then three seats.",
  "If you have any questions at all, please don't hesitate to reach out to the team in #billing.",
];

/** Opens on the sentence that needs the most help. */
const DEMO_SELECTION: Span = {
  p: 1,
  start: 0,
  end: DEMO_PARAGRAPHS[1].indexOf("before.") + "before.".length,
};

/** Hand-written takes for the demo sentences, two per action. */
const CANNED: Record<string, Partial<Record<Action, string[]>>> = {
  "We are really excited to share that the new billing dashboard is finally ready to ship next week.":
    {
      shorter: [
        "The new billing dashboard ships next week.",
        "The billing dashboard is ready and ships next week.",
      ],
      clearer: [
        "The new billing dashboard is ready and ships next week.",
        "Next week we ship the new billing dashboard.",
      ],
      friendlier: [
        "Good news: the new billing dashboard is ready and ships next week!",
        "We're thrilled to say the new billing dashboard ships next week.",
      ],
    },
  "In order to make the rollout as smooth as possible, we will be enabling it for a small number of workspaces first.":
    {
      shorter: [
        "To keep the rollout smooth, we'll enable it for a few workspaces first.",
        "We'll start with a few workspaces to keep the rollout smooth.",
      ],
      clearer: [
        "We'll turn it on for a few workspaces first so the rollout goes smoothly.",
        "To keep the rollout smooth, a few workspaces get it first.",
      ],
      friendlier: [
        "To keep things smooth, we'll switch it on for a handful of workspaces first.",
        "We're starting with a handful of workspaces so everything goes smoothly.",
      ],
    },
  "Due to the fact that invoices are now generated in real time, some customers might notice that their totals look different then before.":
    {
      shorter: [
        "Invoices now update in real time, so some totals may look different than before.",
        "Since invoices now update live, some totals may differ from before.",
      ],
      clearer: [
        "Invoices are now generated in real time, so some customers will see totals that differ from before.",
        "Because invoices now update in real time, some customers' totals will change from what they saw before.",
      ],
      friendlier: [
        "Heads up: invoices now update in real time, so a few customers might spot totals that look a little different than before.",
        "Invoices now update live, so don't worry if a few totals look a little different than before.",
      ],
      grammar: [
        "Due to the fact that invoices are now generated in real time, some customers might notice that their totals look different than before.",
      ],
    },
  "Support should reach out to anyone who's account has more then three seats.":
    {
      shorter: [
        "Support should contact accounts with more than three seats.",
        "Support will contact accounts over three seats.",
      ],
      clearer: [
        "Support should contact every account with more than three seats.",
        "Any account with more than three seats will hear from Support.",
      ],
      friendlier: [
        "Support will check in with anyone whose account has more than three seats.",
        "Our Support team will say hi to every account with more than three seats.",
      ],
      grammar: [
        "Support should reach out to anyone whose account has more than three seats.",
      ],
    },
  "If you have any questions at all, please don't hesitate to reach out to the team in #billing.":
    {
      shorter: [
        "Questions? Ask the team in #billing.",
        "Send questions to #billing.",
      ],
      clearer: [
        "Send any questions to the team in #billing.",
        "The team in #billing can answer any questions.",
      ],
      friendlier: [
        "Got questions? Just ping the team in #billing, we're happy to help.",
        "Questions are always welcome in #billing!",
      ],
    },
};

/** Plain-language fixes for any text the demo has no hand-written take for. */
const RULES: Record<Action, [RegExp, string][]> = {
  grammar: [
    [/\bthen before\b/g, "than before"],
    [/\bmore then\b/g, "more than"],
    [/\bwho's account\b/g, "whose account"],
    [/ {2,}/g, " "],
  ],
  shorter: [
    [/^We are really excited to share that /, ""],
    [/\bIn order to\b/g, "To"],
    [/\bin order to\b/g, "to"],
    [/\bDue to the fact that\b/g, "Because"],
    [/\bas smooth as possible\b/g, "smooth"],
    [/\ba small number of\b/g, "a few"],
    [/\bwe will be enabling\b/g, "we'll enable"],
    [/\bmight notice that\b/g, "may see that"],
    [/ (really|finally|at all|just)\b/g, ""],
    [/\bplease don't hesitate to reach out to\b/g, "ask"],
  ],
  clearer: [
    [/\bDue to the fact that\b/g, "Because"],
    [/\bIn order to\b/g, "To"],
    [/\bin order to\b/g, "to"],
    [/\ba small number of\b/g, "a few"],
    [/\bthen before\b/g, "than before"],
    [/\bmore then\b/g, "more than"],
    [/\bwho's account\b/g, "whose account"],
  ],
  friendlier: [
    [/\bwe will be\b/g, "we'll be"],
    [/\bWe are\b/g, "We're"],
    [/\bShould\b/g, "Could"],
    [/\bshould reach out to\b/g, "will check in with"],
    [/\bplease don't hesitate to reach out to\b/g, "just ping"],
    [/\bsome customers\b/g, "a few folks"],
  ],
};

/** A second pass for Try again when nothing hand-written is left. */
const AGAIN: [RegExp, string][] = [
  [/\bwe will\b/g, "we'll"],
  [/\bit is\b/g, "it's"],
  [/\bdo not\b/g, "don't"],
  [/\bmight\b/g, "may"],
  [/\bshould\b/g, "will"],
];

const actionFor = (instruction: string): Action => {
  const s = instruction.toLowerCase();
  if (SHORT_HINT.test(s)) {
    return "shorter";
  }
  if (FRIENDLY_HINT.test(s)) {
    return "friendlier";
  }
  if (GRAMMAR_HINT.test(s)) {
    return "grammar";
  }
  return "clearer";
};

const applyRules = (text: string, rules: [RegExp, string][]) => {
  let out = text;
  for (const [pattern, to] of rules) {
    out = out.replace(pattern, to);
  }
  return out;
};

const capitalize = (text: string, like: string) =>
  like[0] && like[0] === like[0].toUpperCase()
    ? text.charAt(0).toUpperCase() + text.slice(1)
    : text;

const demoRewrite = (text: string, instruction: string, attempt: number) => {
  const action = actionFor(instruction);
  const sentences = (text.match(SENTENCE) ?? []).map((s) => s.trim());
  if (sentences.length > 0 && sentences.join(" ") === text.trim()) {
    const takes = sentences.map((s) => {
      const canned = CANNED[s]?.[action];
      return canned ? canned[attempt % canned.length] : undefined;
    });
    if (takes.every(Boolean)) {
      return takes.join(" ");
    }
  }
  let out = applyRules(text, RULES[action]);
  if (attempt > 0) {
    out = applyRules(out, AGAIN);
  }
  return capitalize(out.trim(), text);
};

const split = (text: string) =>
  (text.match(WORD) ?? []).map((w) => {
    const gap = w.match(TRAILING)?.[0] ?? "";
    return { word: w.slice(0, w.length - gap.length), gap };
  });

/** Word-level diff, deletions before insertions in each changed run. */
const diff = (from: string, to: string): Op[] => {
  const a = split(from);
  const b = split(to);
  const lcs = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] =
        a[i].word === b[j].word
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let dels: Op[] = [];
  let adds: Op[] = [];
  const flush = () => {
    ops.push(...dels, ...adds);
    dels = [];
    adds = [];
  };
  const make = (kind: Op["kind"], w: { word: string; gap: string }) => ({
    kind,
    word: w.word,
    gap: w.gap || " ",
    key: `${kind}${ops.length + dels.length + adds.length}:${w.word}`,
  });
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i].word === b[j].word) {
      flush();
      ops.push(make("same", b[j]));
      i++;
      j++;
    } else if (
      j >= b.length ||
      (i < a.length && lcs[i + 1][j] >= lcs[i][j + 1])
    ) {
      dels.push(make("del", a[i]));
      i++;
    } else {
      adds.push(make("add", b[j]));
      j++;
    }
  }
  flush();
  // The selection ends on a word, so the last op should not add a space.
  const last = ops.at(-1);
  if (last) {
    last.gap = "";
  }
  return ops;
};

interface Indexed {
  op: Op;
  index: number;
}

/** Groups neighbouring removed or added words; kept words stand alone. */
const runs = (ops: Op[]) => {
  const out: Indexed[][] = [];
  for (const [index, op] of ops.entries()) {
    const last = out.at(-1);
    if (last && op.kind !== "same" && last[0].op.kind === op.kind) {
      last.push({ op, index });
    } else {
      out.push([{ op, index }]);
    }
  }
  return out;
};

const join = (run: Indexed[]) =>
  run.map((r, k) => r.op.word + (k < run.length - 1 ? r.op.gap : "")).join("");

/** Character offset of a DOM position inside a paragraph. */
const offsetIn = (para: HTMLElement, node: Node, at: number) => {
  const pre = document.createRange();
  pre.selectNodeContents(para);
  pre.setEnd(node, at);
  return pre.toString().length;
};

/** Grows a range to whole words and trims the spaces at its ends. */
const snap = (text: string, start: number, end: number) => {
  let from = start;
  let to = end;
  while (from > 0 && !SPACE.test(text[from - 1])) {
    from--;
  }
  while (to < text.length && !SPACE.test(text[to])) {
    to++;
  }
  while (from < to && SPACE.test(text[from])) {
    from++;
  }
  while (to > from && SPACE.test(text[to - 1])) {
    to--;
  }
  return { from, to };
};

/** The page selection as a word-snapped span of one paragraph, if any. */
const readSelection = (
  selection: Selection | null,
  root: HTMLElement,
  doc: string[],
): Span | null => {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const start = range.startContainer;
  const el = start.nodeType === 1 ? (start as Element) : start.parentElement;
  const para = el?.closest<HTMLElement>("[data-para]");
  if (!(para && root.contains(para))) {
    return null;
  }
  const p = Number(para.dataset.para);
  const text = doc[p];
  const end = para.contains(range.endContainer)
    ? offsetIn(para, range.endContainer, range.endOffset)
    : text.length;
  const { from, to } = snap(
    text,
    offsetIn(para, start, range.startOffset),
    end,
  );
  return to - from < 2 ? null : { p, start: from, end: to };
};

/** ⌘ on Apple devices, Ctrl elsewhere. Starts as ⌘ so the server render matches. */
const useModKey = () => {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    if (!APPLE.test(navigator.userAgent)) {
      setMod("Ctrl ");
    }
  }, []);
  return mod;
};

const stepDelay = (op: Op) => {
  if (op.kind === "add") {
    return 34 + Math.min(42, op.word.length * 6);
  }
  return op.kind === "del" ? 26 : 16;
};

const isStream = (value: Rewrite): value is AsyncIterable<string> =>
  typeof value === "object" && Symbol.asyncIterator in value;

/** The whole text of a rewrite, gathering a stream's deltas. */
async function collect(result: Rewrite) {
  if (!isStream(result)) {
    return await result;
  }
  let text = "";
  for await (const delta of result) {
    text += delta;
  }
  return text;
}

const reasonOf = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Couldn’t rewrite that. Try again.";

export default function AIInlineEdit({
  title = "Billing launch update",
  paragraphs = DEMO_PARAGRAPHS,
  rewrite = demoRewrite,
  onChange,
  className,
}: AIInlineEditProps) {
  const reduceMotion = useReducedMotion();
  const [doc, setDoc] = useState(paragraphs);
  const [span, setSpan] = useState<Span | null>(
    paragraphs === DEMO_PARAGRAPHS ? DEMO_SELECTION : null,
  );
  const [phase, setPhase] = useState<Phase>(
    paragraphs === DEMO_PARAGRAPHS ? "prompt" : "idle",
  );
  const [instruction, setInstruction] = useState("");
  const [label, setLabel] = useState("");
  const [versions, setVersions] = useState<string[]>([]);
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [head, setHead] = useState(0);
  const [flash, setFlash] = useState<Span | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController>(undefined);
  /** Null until measured, so the bar never renders (or animates in) at 0,0. */
  const [bar, setBar] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const barRef = useRef<HTMLDivElement>(null);
  const pointerDown = useRef(false);

  const selected = span ? doc[span.p].slice(span.start, span.end) : "";
  const current = versions[version] ?? "";
  const ops = useMemo(
    () => (current ? diff(selected, current) : []),
    [selected, current],
  );
  const editing = phase !== "idle" && phase !== "prompt";
  const mod = useModKey();
  const unchanged = phase === "review" && current === selected;

  // Place the bar under the selection, clamped to the card.
  const place = useCallback(() => {
    const region = regionRef.current;
    const box = docRef.current;
    if (!(region && box)) {
      return;
    }
    const rects = Array.from(region.getClientRects());
    const lastRect = rects.at(-1);
    if (!lastRect) {
      return;
    }
    const b = box.getBoundingClientRect();
    const width = Math.min(BAR_WIDTH, b.width - PAD * 2);
    const left = Math.min(...rects.map((r) => r.left)) - b.left;
    setBar({
      x: Math.max(PAD, Math.min(left - 6, b.width - width - PAD)),
      y: lastRect.bottom - b.top + 10,
      width,
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: head, version and doc move the selection
  useLayoutEffect(() => {
    if (span) {
      place();
    }
  }, [span, place, head, version, doc]);

  useEffect(() => {
    const box = docRef.current;
    if (!box) {
      return;
    }
    const observer = new ResizeObserver(() => place());
    observer.observe(box);
    return () => observer.disconnect();
  }, [place]);

  // Run the write head through the diff.
  useEffect(() => {
    if (phase !== "streaming") {
      return;
    }
    if (reduceMotion || head >= ops.length) {
      setHead(ops.length);
      setPhase("review");
      return;
    }
    const id = setTimeout(() => setHead((h) => h + 1), stepDelay(ops[head]));
    return () => clearTimeout(id);
  }, [phase, head, ops, reduceMotion]);

  // Keep focus inside the bar as its controls swap, so Escape keeps working.
  useEffect(() => {
    let target: HTMLButtonElement | null = null;
    if (phase === "streaming") {
      target = skipRef.current;
    } else if (phase === "review") {
      const accept = acceptRef.current;
      target = accept && !accept.disabled ? accept : discardRef.current;
    }
    target?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // The accepted words glow for a moment, then settle into the text.
  useEffect(() => {
    if (!flash) {
      return;
    }
    const on = setTimeout(() => setFlashOn(false), 80);
    const off = setTimeout(() => setFlash(null), 1300);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [flash]);

  const clear = useCallback(() => {
    setSpan(null);
    setBar(null);
    setPhase("idle");
    setVersions([]);
    setVersion(0);
    setAttempt(0);
    setInstruction("");
  }, []);

  // Clicking away drops a selection that has not been sent yet.
  useEffect(() => {
    if (phase !== "prompt") {
      return;
    }
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        clear();
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [phase, clear]);

  const capture = useCallback(() => {
    const selection = window.getSelection();
    const next =
      docRef.current && readSelection(selection, docRef.current, doc);
    if (!next) {
      return false;
    }
    selection?.removeAllRanges();
    setSpan(next);
    setPhase("prompt");
    setInstruction("");
    requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true }),
    );
    return true;
  }, [doc]);

  // Touch selections settle without a pointerup, so watch them too.
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(id);
      if (pointerDown.current || editing) {
        return;
      }
      id = setTimeout(capture, 450);
    };
    document.addEventListener("selectionchange", onChange);
    return () => {
      clearTimeout(id);
      document.removeEventListener("selectionchange", onChange);
    };
  }, [capture, editing]);

  const show = (next: string) => {
    const seen = versions.indexOf(next);
    if (seen >= 0) {
      setVersion(seen);
      setPhase("review");
      return;
    }
    setVersions((v) => [...v, next]);
    setVersion(versions.length);
    setHead(0);
    setPhase("streaming");
  };

  const run = (text: string, nextAttempt: number) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLabel(text);
    setAttempt(nextAttempt);
    setError(undefined);
    const result = rewrite(selected, text, nextAttempt, controller.signal);
    if (typeof result === "string") {
      show(result);
      return;
    }
    setPhase("thinking");
    collect(result).then(
      (next) => {
        if (!controller.signal.aborted) {
          show(next);
        }
      },
      (e: unknown) => {
        if (!controller.signal.aborted) {
          setError(reasonOf(e));
          setPhase("prompt");
        }
      },
    );
  };

  /** Stop waiting on the model, back to where the person was. */
  const stop = () => {
    abortRef.current?.abort();
    setPhase(versions.length > 0 ? "review" : "prompt");
  };

  const accept = () => {
    if (!span || phase !== "review") {
      return;
    }
    setPhase("settling");
    timerRef.current = setTimeout(
      () => {
        const text = doc[span.p];
        const next = [...doc];
        next[span.p] =
          text.slice(0, span.start) + current + text.slice(span.end);
        setDoc(next);
        onChange?.(next);
        setFlash({
          p: span.p,
          start: span.start,
          end: span.start + current.length,
        });
        setFlashOn(true);
        clear();
      },
      reduceMotion ? 0 : 180,
    );
  };

  /** Added words fade and struck ones come back before the text resets. */
  const discard = () => {
    if (phase !== "review") {
      return;
    }
    setPhase("discarding");
    timerRef.current = setTimeout(clear, reduceMotion ? 0 : 160);
  };

  /** Escape steps back one phase. */
  const stepBack = () => {
    if (phase === "thinking") {
      stop();
    } else if (phase === "streaming") {
      setVersions((v) => v.slice(0, -1));
      setVersion((v) => Math.max(0, v - 1));
      setPhase(versions.length > 1 ? "review" : "prompt");
    } else if (phase === "review") {
      discard();
    } else if (phase === "prompt") {
      clear();
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      stepBack();
    } else if (
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey) &&
      phase === "review"
    ) {
      event.preventDefault();
      accept();
    }
  };

  // Escape and Mod+Enter work anywhere inside the card.
  const keyRef = useRef(onKeyDown);
  useEffect(() => {
    keyRef.current = onKeyDown;
  });
  useEffect(() => {
    const root = rootRef.current;
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    root?.addEventListener("keydown", onKey);
    return () => root?.removeEventListener("keydown", onKey);
  }, []);

  const renderRegion = () => {
    if (!editing || phase === "thinking") {
      return (
        <mark className="rounded-[3px] bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-inherit [box-decoration-break:clone] ">
          {selected}
        </mark>
      );
    }
    return runs(ops).map((run) => (
      <DiffRun head={head} key={run[0].op.key} phase={phase} run={run} />
    ));
  };
  const renderParagraph = (text: string, p: number) => {
    if (span?.p === p) {
      return (
        <>
          {text.slice(0, span.start)}
          <span ref={regionRef}>{renderRegion()}</span>
          {text.slice(span.end)}
        </>
      );
    }
    if (flash?.p === p) {
      return (
        <>
          {text.slice(0, flash.start)}
          <span
            className={cn(
              "rounded-[3px] transition-colors duration-1000 [box-decoration-break:clone]",
              flashOn
                ? "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] "
                : "bg-transparent",
            )}
          >
            {text.slice(flash.start, flash.end)}
          </span>
          {text.slice(flash.end)}
        </>
      );
    }
    return text;
  };

  const lastPara = span?.p === doc.length - 1;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "w-full max-w-lg rounded-2xl bg-[var(--surface-raised)] ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  ",
          className,
        )}
        ref={rootRef}
      >
        <header className="flex items-center gap-2 border-[color-mix(in_srgb,var(--text)_6%,transparent)] border-b px-5 py-3 ">
          <PenLine
            aria-hidden="true"
            className="size-3.5 text-[var(--text-tertiary)] "
          />
          <h2 className="min-w-0 flex-1 truncate font-medium text-[13px] text-[var(--text)] ">
            {title}
          </h2>
          <span className="text-[12px] text-[var(--text-tertiary)] ">
            {t("초안")}
          </span>
        </header>

        <div
          className={cn(
            "relative px-5 pt-4 transition-[padding] duration-200",
            editing && "select-none",
          )}
          onPointerDown={() => {
            pointerDown.current = true;
          }}
          onPointerUp={(event) => {
            pointerDown.current = false;
            if (editing || barRef.current?.contains(event.target as Node)) {
              return;
            }
            if (!capture() && phase === "prompt") {
              clear();
            }
          }}
          ref={docRef}
          style={{ paddingBottom: span && lastPara ? 132 : 20 }}
        >
          {doc.map((text, p) => (
            <p
              className="mb-3 cursor-text text-[15px] text-[var(--text-secondary)] leading-7 selection:bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] last:mb-0  "
              data-para={p}
              // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs never reorder
              key={p}
            >
              {renderParagraph(text, p)}
            </p>
          ))}

          <AnimatePresence>
            {span && bar && (
              <motion.div
                animate={{ opacity: 1, scale: 1, x: bar.x, y: bar.y }}
                aria-label={t("AI로 고쳐 쓰기")}
                className="absolute top-0 left-0 z-20 origin-top-left overflow-hidden rounded-xl bg-[var(--surface-raised)] shadow-[0_12px_32px_-12px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.25)] ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  dark:shadow-[0_12px_32px_-12px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.7)] "
                exit={{
                  opacity: 0,
                  scale: 0.98,
                  transition: { duration: 0.12, ease: EASE_OUT },
                }}
                initial={{ opacity: 0, scale: 0.97, x: bar.x, y: bar.y - 4 }}
                key="bar"
                ref={barRef}
                role="group"
                style={{ width: bar.width }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <BarBody phase={barPhase(phase)}>
                  {phase === "prompt" && (
                    <PromptBar
                      error={error}
                      inputRef={inputRef}
                      instruction={instruction}
                      onInstruction={setInstruction}
                      onRun={(text) => run(text, 0)}
                    />
                  )}
                  {(phase === "streaming" || phase === "thinking") && (
                    <div className="flex h-11 items-center gap-2 pr-1.5 pl-3">
                      <Dots />
                      <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)] ">
                        {t("문장을 고쳐 쓰는 중")}
                        <span className="text-[var(--text-tertiary)] ">
                          {" "}
                          · {label}
                        </span>
                      </p>
                      <button
                        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--surface-muted)] hover:text-[var(--text)]   "
                        onClick={() => {
                          if (phase === "thinking") {
                            stop();
                            return;
                          }
                          setHead(ops.length);
                          setPhase("review");
                        }}
                        ref={skipRef}
                        type="button"
                      >
                        <Square
                          aria-hidden="true"
                          className="size-2.5 fill-current"
                        />
                        {phase === "thinking" ? t("중단") : t("바로 보기")}
                      </button>
                    </div>
                  )}
                  {(phase === "review" ||
                    phase === "settling" ||
                    phase === "discarding") && (
                    <ReviewBar
                      acceptRef={acceptRef}
                      count={versions.length}
                      discardRef={discardRef}
                      label={
                        unchanged ? t("이미 자연스러운 문장이에요") : label
                      }
                      mod={mod}
                      onAccept={accept}
                      onAgain={() => run(label, attempt + 1)}
                      onDiscard={discard}
                      onVersion={setVersion}
                      unchanged={unchanged}
                      version={version}
                    />
                  )}
                </BarBody>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="flex h-10 items-center border-[color-mix(in_srgb,var(--text)_6%,transparent)] border-t px-5 ">
          <p className="text-[12px] text-[var(--text-tertiary)] ">
            {t("고칠 문장을 선택해 주세요")}
          </p>
        </footer>
        <p aria-live="polite" className="sr-only">
          {phase === "review"
            ? t("수정안을 확인하고 반영하거나 버려 주세요.")
            : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

/** Phases that look the same share one bar, so it doesn't crossfade. */
function barPhase(phase: Phase): Phase {
  if (phase === "settling" || phase === "discarding") {
    return "review";
  }
  return phase === "thinking" ? "streaming" : phase;
}

export function PromptBar({
  instruction,
  onInstruction,
  onRun,
  inputRef,
  error,
}: {
  error?: string;
  instruction: string;
  onInstruction: (value: string) => void;
  onRun: (text: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <form
        className="flex h-11 items-center gap-2 pr-1.5 pl-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (instruction.trim()) {
            onRun(instruction.trim());
          }
        }}
      >
        <input
          aria-label={t("선택한 문장을 어떻게 고칠지 알려 주세요")}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text)] outline-hidden placeholder:text-[var(--text-tertiary)]   [@media(pointer:coarse)]:text-base"
          onChange={(event) => onInstruction(event.target.value)}
          placeholder={t("어떻게 고칠까요?")}
          ref={inputRef}
          value={instruction}
        />
        <button
          aria-label={t("고쳐 쓰기")}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--text)] text-[var(--surface-raised)] transition-[background-color,opacity] duration-150 hover:bg-[var(--hover-fill)] active:bg-[var(--hover-fill)] disabled:opacity-30    "
          disabled={!instruction.trim()}
          type="submit"
        >
          <ArrowUp className="size-3.5" />
        </button>
      </form>
      {error ? (
        <p className="px-3 pb-2 text-[12px] text-[var(--danger)] " role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1 border-[color-mix(in_srgb,var(--text)_6%,transparent)] border-t p-1.5 ">
        {ACTIONS.map((action) => (
          <button
            className="h-7 rounded-lg px-2.5 text-[12px] text-[var(--text-secondary)] outline-hidden transition-colors duration-100 hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:bg-[var(--surface-muted)]    "
            key={action.id}
            onClick={() => onRun(action.label)}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
}

export function ReviewBar({
  label,
  count,
  version,
  unchanged,
  acceptRef,
  discardRef,
  onVersion,
  onAgain,
  onDiscard,
  onAccept,
  mod,
}: {
  label: string;
  mod: string;
  count: number;
  version: number;
  unchanged: boolean;
  acceptRef: RefObject<HTMLButtonElement | null>;
  discardRef: RefObject<HTMLButtonElement | null>;
  onVersion: (v: number) => void;
  onAgain: () => void;
  onDiscard: () => void;
  onAccept: () => void;
}) {
  const ghost =
    "flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-[var(--text-secondary)] outline-hidden transition-colors duration-100 hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_15%,transparent)] disabled:pointer-events-none disabled:opacity-40    ";
  return (
    <div className="flex h-11 items-center gap-1 pr-1.5 pl-2">
      {count > 1 && (
        <div className="flex shrink-0 items-center text-[12px] text-[var(--text-tertiary)] tabular-nums ">
          <button
            aria-label={t("이전 제안")}
            className={cn(ghost, "px-1")}
            disabled={version === 0}
            onClick={() => onVersion(version - 1)}
            type="button"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          {version + 1}/{count}
          <button
            aria-label={t("다음 제안")}
            className={cn(ghost, "px-1")}
            disabled={version === count - 1}
            onClick={() => onVersion(version + 1)}
            type="button"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
      <p
        className={cn(
          "min-w-0 truncate text-[12px] text-[var(--text-tertiary)] ",
          count > 1 ? "pl-0.5" : "pl-1",
        )}
      >
        {label}
      </p>
      <div className="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          aria-label={t("다시 쓰기")}
          className={ghost}
          onClick={onAgain}
          title={t("다시 쓰기")}
          type="button"
        >
          <RotateCw className="size-3.5" />
        </button>
        <button
          className={ghost}
          onClick={onDiscard}
          ref={discardRef}
          type="button"
        >
          {t("버리기")}
        </button>
        <button
          className="flex h-7 items-center gap-1.5 rounded-lg bg-[var(--text)] px-2.5 font-medium text-[12px] text-[var(--surface-raised)] outline-hidden transition-colors duration-150 hover:bg-[var(--hover-fill)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_30%,transparent)] focus-visible:ring-offset-1 active:bg-[var(--hover-fill)]      "
          disabled={unchanged}
          onClick={onAccept}
          ref={acceptRef}
          type="button"
        >
          {t("반영")}
          <kbd className="font-sans text-[11px] opacity-60">{mod}↵</kbd>
        </button>
      </div>
    </div>
  );
}

function DiffRun({
  run,
  head,
  phase,
}: {
  run: Indexed[];
  head: number;
  phase: Phase;
}) {
  const streaming = phase === "streaming";
  const settling = phase === "settling";
  const discarding = phase === "discarding";
  const done = run.filter((r) => !streaming || r.index < head);
  const pending = run.filter((r) => streaming && r.index >= head);
  const caret =
    streaming && done.some((r) => r.index === head - 1) ? <Caret /> : null;
  const kind = run[0].op.kind;
  const gap = run.at(-1)?.op.gap ?? "";

  if (kind === "same") {
    return (
      <span>
        {run[0].op.word}
        {caret}
        {gap}
      </span>
    );
  }
  if (kind === "del") {
    return (
      <span
        className={cn(
          "transition-opacity duration-150",
          settling && "opacity-0",
        )}
      >
        {done.length > 0 && (
          <del
            className={cn(
              "transition-[color,text-decoration-color] duration-150",
              discarding
                ? "text-inherit no-underline decoration-transparent"
                : "text-[var(--text-tertiary)] decoration-red-500/60  ",
            )}
          >
            {join(done)}
          </del>
        )}
        {caret}
        {done.length > 0 && pending.length > 0 && " "}
        {join(pending)}
        {gap}
      </span>
    );
  }
  if (done.length === 0) {
    return null;
  }
  return (
    <span>
      <ins
        className={cn(
          "rounded-[3px] no-underline transition-[background-color,color,opacity] duration-300 [box-decoration-break:clone]",
          discarding && "opacity-0 duration-150",
          settling
            ? "bg-transparent"
            : "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]  ",
        )}
      >
        {done.map((r, k) => (
          <motion.span
            animate={{ opacity: 1, filter: "blur(0px)" }}
            initial={{ opacity: 0, filter: "blur(3px)" }}
            key={r.op.key}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            {r.op.word}
            {k < done.length - 1 ? r.op.gap : ""}
          </motion.span>
        ))}
      </ins>
      {caret}
      {gap}
    </span>
  );
}

/** Grows and shrinks with its content, and crossfades between phases. */
function BarBody({ phase, children }: { phase: Phase; children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      initial={false}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <div ref={innerRef}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(2px)" }}
            initial={{ opacity: 0, filter: "blur(2px)" }}
            key={phase}
            transition={{ duration: 0.15, ease: EASE_OUT }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Caret() {
  return (
    <span
      aria-hidden="true"
      className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[3px] rounded-full bg-[var(--text)] "
    />
  );
}

function Dots() {
  return (
    <span aria-hidden="true" className="flex gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          animate={{ opacity: [0.25, 1, 0.25] }}
          className="size-1 rounded-full bg-[var(--hover-fill)] "
          key={i}
          transition={{
            duration: 1,
            repeat: Number.POSITIVE_INFINITY,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

/** Original diff renderer, exported for the existing rich-text editor adapter. */
export function InlineDiffPreview({
  before,
  after,
}: {
  before: string;
  after: string;
}) {
  const ops = useMemo(() => diff(before, after), [before, after]);
  const reduceMotion = useReducedMotion();
  const [head, setHead] = useState(0);
  useEffect(() => {
    setHead(0);
  }, [before, after]);
  useEffect(() => {
    if (reduceMotion || head >= ops.length) return;
    const timer = setTimeout(
      () => setHead((value) => value + 1),
      stepDelay(ops[head]),
    );
    return () => clearTimeout(timer);
  }, [head, ops, reduceMotion]);
  return (
    <p className="px-5 py-4 text-[15px] text-[var(--text-secondary)] leading-7">
      {runs(ops).map((run) => (
        <DiffRun
          head={reduceMotion ? ops.length : head}
          key={run[0].op.key}
          phase={head >= ops.length || reduceMotion ? "review" : "streaming"}
          run={run}
        />
      ))}
    </p>
  );
}

/** Original floating bar and phase crossfade, with the app supplying selection and actions. */
export function InlineEditBar({
  phase,
  instruction,
  onInstruction,
  onRun,
  onStop,
  onAccept,
  onDiscard,
  unchanged,
  label,
  error,
  position,
  focusPrompt = true,
}: {
  phase: "prompt" | "thinking" | "review";
  instruction: string;
  onInstruction: (text: string) => void;
  onRun: (instruction: string) => void;
  onStop: () => void;
  onAccept: () => void;
  onDiscard: () => void;
  unchanged: boolean;
  label: string;
  error?: string;
  position: { x: number; y: number; width: number };
  /** false이면 prompt 단계에서 자동으로 입력칸에 포커스하지 않고 ⌘/(Ctrl+/)로 진입합니다. */
  focusPrompt?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const mod = useModKey();
  useEffect(() => {
    if (phase === "prompt") {
      if (focusPrompt) inputRef.current?.focus({ preventScroll: true });
    } else if (phase === "review") {
      const accept = acceptRef.current;
      const target = accept && !accept.disabled ? accept : discardRef.current;
      target?.focus({ preventScroll: true });
    }
  }, [phase, focusPrompt]);
  useEffect(() => {
    if (focusPrompt || phase !== "prompt") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key === "/"
      ) {
        event.preventDefault();
        event.stopPropagation();
        inputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusPrompt, phase]);
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        aria-keyshortcuts={!focusPrompt ? "Meta+/ Control+/" : undefined}
        aria-label={t("AI로 고쳐 쓰기")}
        className="fixed z-[100] origin-top-left overflow-hidden rounded-xl bg-[var(--surface-raised)] shadow-[0_12px_32px_-12px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.25)] ring-1 ring-[var(--line)]"
        exit={{
          opacity: 0,
          scale: 0.98,
          transition: { duration: 0.12, ease: EASE_OUT },
        }}
        initial={{ opacity: 0, scale: 0.97, y: -4 }}
        role="group"
        style={{
          left: position.x,
          top: position.y,
          width: position.width,
        }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") {
            event.preventDefault();
            phase === "thinking" ? onStop() : onDiscard();
          } else if (
            event.key === "Enter" &&
            (event.metaKey || event.ctrlKey) &&
            phase === "review"
          ) {
            event.preventDefault();
            onAccept();
          }
        }}
      >
        <BarBody phase={phase}>
          {phase === "prompt" && (
            <PromptBar
              instruction={instruction}
              onInstruction={onInstruction}
              onRun={onRun}
              inputRef={inputRef}
              error={error}
            />
          )}
          {phase === "thinking" && (
            <div className="flex h-11 items-center gap-2 pr-1.5 pl-3">
              <Dots />
              <p className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-secondary)]">
                {t("문장을 고쳐 쓰는 중")}
              </p>
              <button
                className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                onClick={onStop}
                type="button"
              >
                <Square className="size-2.5 fill-current" />
                {t("중단")}
              </button>
            </div>
          )}
          {phase === "review" && (
            <ReviewBar
              label={label}
              count={1}
              version={0}
              unchanged={unchanged}
              acceptRef={acceptRef}
              discardRef={discardRef}
              onVersion={() => {}}
              onAgain={() => onRun(label)}
              onDiscard={onDiscard}
              onAccept={onAccept}
              mod={mod}
            />
          )}
        </BarBody>
      </motion.div>
    </MotionConfig>
  );
}
