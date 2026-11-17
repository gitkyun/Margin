"use client";
import { t } from "@/lib/i18n";

/**
 * @author: @kokonutui
 * @description: AI Input Search
 * @version: 4.0.0
 * @date: 2026-10-18
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  Braces,
  Check,
  ChevronDown,
  CornerDownLeft,
  FileText,
  Globe,
  ImageIcon,
  Lightbulb,
  type LucideIcon,
  Plus,
  Settings2,
  Telescope,
  X,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/kokonut/primitives/dropdown-menu";
import { Textarea } from "@/components/kokonut/primitives/textarea";
import { useAutoResizeTextarea } from "@/components/kokonut/primitives/use-auto-resize-textarea";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_OUT_CSS = "ease-[cubic-bezier(0.23,1,0.32,1)]";
const WWW = /^www\./;

export interface SearchTool {
  id: string;
  /** Shown in the menu and on the chip. */
  label: string;
  icon: LucideIcon;
  /** What the trace says while this tool works, e.g. "Searching the web". */
  activity: string;
  /** Placeholder while the tool is picked. */
  placeholder?: string;
  /** True when the tool reads sources, so the trace stacks them up. */
  readsSources?: boolean;
  /** Runs left today. The menu shows them as dots and locks the tool at zero. */
  limit?: number;
  /** One quiet line under the label in the menu. */
  hint?: string;
  /** Any CSS color. Tints the icon tile, the pill and the caret. */
  color?: string;
}

export interface SearchSource {
  /** Stable identity when several grounding links share a redirect host. */
  key?: string;
  /** e.g. "developer.mozilla.org" */
  domain: string;
  title: string;
  /** The site's mark, e.g. a favicon or logo. Wins over the letter avatar. */
  icon?: ReactNode;
  /** Brand colour for the letter avatar; without it, one is derived. */
  color?: string;
}

export interface AIInputSearchProps {
  allowAttachments?: boolean;
  modelControls?: React.ReactNode;
  leadingControl?: React.ReactNode;
  value?: string;
  onValueChange?: (value: string) => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  selectedTool?: string | null;
  onToolChange?: (tool: string | null) => void;
  onAttach?: (files: File[]) => void;
  onStop?: () => void;
  disabled?: boolean;
  busy?: boolean;
  onQueue?: (text: string, tool: SearchTool | null) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;

  placeholder: string;
  tools: SearchTool[];
  /** Tool picked at first. Pass null to start with none. */
  defaultTool?: string | null;
  models: string[];
  defaultModel?: string;
  /**
   * Runs the request. Call `onSource` for each source as it is read, and
   * resolve when the answer is ready; `signal` aborts on Stop.
   */
  onSearch: (
    query: string,
    options: {
      tool: SearchTool | null;
      model: string;
      files: File[];
      signal: AbortSignal;
      onSource: (source: SearchSource) => void;
    },
  ) => Promise<void> | void;
  className?: string;
}

type Phase = "idle" | "working" | "done" | "stopped";

const STACK_MAX = 5;

const fileKey = (file: File) =>
  `${file.name}-${file.size}-${file.lastModified}`;

const seconds = (ms: number) =>
  t("{seconds}초", { seconds: Math.floor(ms / 1000) });

/** A steady hue per domain, so an unbranded site still gets its own colour. */
const hueOf = (domain: string) => {
  let hash = 0;
  for (const char of domain) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return hash;
};

/**
 * The site's avatar: its own icon when given, otherwise its first letter on
 * its brand colour, so the trace needs no favicon service.
 */
function SourceAvatar({
  source,
  ring,
  size = "sm",
}: {
  source: SearchSource;
  ring?: boolean;
  size?: "sm" | "md";
}) {
  const name = source.domain.replace(WWW, "");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-[var(--surface-raised)] [&_img]:size-full [&_svg]:size-3",
        size === "md" ? "size-6 text-[11px]" : "size-5 text-[10px]",
        ring
          ? "ring-2 ring-[var(--line)] "
          : "ring-1 ring-[color-mix(in_srgb,var(--text)_5%,transparent)] ",
      )}
      style={{
        backgroundColor: source.icon
          ? "white"
          : (source.color ?? `oklch(0.6 0.13 ${hueOf(name)})`),
      }}
    >
      {source.icon ?? name.charAt(0).toUpperCase()}
    </span>
  );
}

function SourceStack({ sources }: { sources: SearchSource[] }) {
  const shown = sources.slice(-STACK_MAX);
  if (shown.length === 0) {
    return (
      <span className="size-5 shrink-0 rounded-full border border-[color-mix(in_srgb,var(--text)_15%,transparent)] border-dashed " />
    );
  }
  // Sites stack up as they are read; the newest lands at the end.
  return (
    <span className="flex shrink-0 items-center">
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((source, i) => (
          <motion.span
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            className={cn(i > 0 && "-ml-1")}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            initial={{ opacity: 0, x: -6, filter: "blur(2px)" }}
            key={source.key ?? source.domain}
            layout="position"
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <SourceAvatar ring source={source} />
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

/**
 * Small white key that sits on the grey frame: the frame's own buttons
 * (Change, Sources) share it so the bands read as one piece.
 */
const frameKey = cn(
  "flex h-6 shrink-0 items-center gap-1.5 rounded-md bg-[var(--surface-raised)] px-2 font-medium text-[11px] text-[var(--text)] shadow-[0_1px_1px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.04)] outline-hidden ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]",
  "transition-[background-color,box-shadow] duration-150",
  EASE_OUT_CSS,
  "hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_20%,transparent)]",
  "  dark:shadow-none   ",
);

/** The sources open as a second card in the frame, under the first. */
function SourceList({ id, sources }: { id: string; sources: SearchSource[] }) {
  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      id={id}
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <ol className="max-h-60 overflow-y-auto rounded-[18px] bg-[var(--surface-raised)] py-1 shadow-[0_1px_2px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.04)] ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  ">
        {sources.map((source, i) => (
          <motion.li
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className={cn(
              "mx-1 flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-xs",
              "transition-colors duration-150",
              EASE_OUT_CSS,
              "hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)] ",
            )}
            initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
            key={source.key ?? source.domain}
            // A short cascade, capped so a long list doesn't drag.
            transition={{
              duration: 0.2,
              ease: EASE_OUT,
              delay: Math.min(i, 8) * 0.03,
            }}
          >
            <SourceAvatar size="md" source={source} />
            <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)] ">
              {source.title}
            </span>
            <span className="hidden shrink-0 text-[var(--text-tertiary)] sm:block ">
              {source.domain}
            </span>
            <span className="w-5 shrink-0 text-right text-[11px] text-[var(--text-tertiary)] tabular-nums ">
              {i + 1}
            </span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
}

const traceLabel = (
  phase: Phase,
  tool: SearchTool | null,
  count: number,
): string => {
  if (tool?.id === "web_search") {
    if (phase === "working")
      return count > 0
        ? t("웹 출처를 확인하고 있어요")
        : (tool.activity ?? t("웹 검색 응답을 기다리고 있어요"));
    if (phase === "stopped")
      return count > 0
        ? t("웹 출처 {count}개를 확인하고 멈췄어요", { count })
        : t("멈췄어요");
    return count > 0
      ? t("웹 출처 {count}개를 확인했어요", { count })
      : t("웹 출처가 반환되지 않았어요");
  }
  if (phase === "working") {
    if (count > 0) {
      return t("연구 기록을 읽고 있어요");
    }
    return tool?.activity ?? t("답변을 만들고 있어요");
  }
  if (phase === "stopped") {
    return count > 0
      ? t("기록 {count}개를 읽고 멈췄어요", { count })
      : t("멈췄어요");
  }
  return count > 0 ? t("기록 {count}개를 읽었어요", { count }) : t("끝났어요");
};

/** Under the box: what the run is doing now, then what it read. */
function Trace({
  phase,
  tool,
  sources,
  elapsed,
  expanded,
  onToggle,
  listId,
}: {
  phase: Phase;
  tool: SearchTool | null;
  sources: SearchSource[];
  elapsed: number;
  expanded: boolean;
  onToggle: () => void;
  listId: string;
}) {
  const finished = phase === "done" || phase === "stopped";
  const canOpen = finished && sources.length > 0;
  const label = traceLabel(phase, tool, sources.length);
  const ToolIcon = tool?.icon;

  return (
    <div>
      {/* A band on the frame, the twin of the header above the card. */}
      <div className="flex h-9 items-center gap-2.5 pr-1.5 pl-3 text-xs">
        {tool?.readsSources || !ToolIcon ? (
          <SourceStack sources={sources} />
        ) : (
          <span
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-raised)] text-(--tool) ring-1 ring-[color-mix(in_srgb,var(--text)_10%,transparent)]  "
            style={
              { "--tool": tool?.color ?? "currentColor" } as React.CSSProperties
            }
          >
            <ToolIcon aria-hidden="true" className="size-3" />
          </span>
        )}
        <span className="relative min-w-0 flex-1">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className={cn(
                "block truncate",
                finished
                  ? "text-[var(--text-secondary)] "
                  : "text-[var(--text-tertiary)] ",
              )}
              exit={{ opacity: 0, filter: "blur(2px)", y: -6 }}
              initial={{ opacity: 0, filter: "blur(2px)", y: 6 }}
              key={label}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              {label}
              {phase === "working" && sources.length > 0 && (
                <span className="text-[var(--text-tertiary)] tabular-nums ">
                  {" "}
                  · {sources.length}
                </span>
              )}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="shrink-0 text-[var(--text-tertiary)] tabular-nums ">
          {seconds(elapsed)}
        </span>
        <AnimatePresence initial={false}>
          {canOpen && (
            <motion.button
              animate={{ opacity: 1, filter: "blur(0px)" }}
              aria-controls={listId}
              aria-expanded={expanded}
              className={frameKey}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              onClick={onToggle}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              type="button"
            >
              {expanded ? t("근거 접기") : t("근거 보기")}
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3 opacity-50 transition-transform duration-200",
                  EASE_OUT_CSS,
                  expanded && "rotate-180",
                )}
              />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {expanded && <SourceList id={listId} sources={sources} />}
      </AnimatePresence>
    </div>
  );
}

const ghostButton = cn(
  "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[var(--text-secondary)] text-xs outline-hidden ",
  "transition-[background-color,color] duration-150",
  EASE_OUT_CSS,
  "hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)]  ",
  "data-[state=open]:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] data-[state=open]:text-[var(--text)]  ",
  "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_15%,transparent)] ",
);

const menuPanel =
  "origin-(--radix-dropdown-menu-content-transform-origin) rounded-xl border-[color-mix(in_srgb,var(--text)_10%,transparent)] p-1 shadow-[0_8px_24px_-8px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.18)]  ";

/**
 * Width of what an element holds, so its wrapper can animate to it rather
 * than snap when a label changes.
 */
function useContentWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry.borderBoxSize[0].inlineSize);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Runs left as dots, so a metered tool reads at a glance. */
function RunsLeft({ left, limit }: { left: number; limit: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-0.5"
      title={
        left > 0
          ? t("오늘 {count}번 남았어요", { count: left })
          : t("오늘은 다 썼어요")
      }
    >
      {Array.from({ length: limit }, (_, i) => (
        <span
          className={cn(
            "size-1.5 rounded-full",
            i < left
              ? "bg-(--tool)"
              : "bg-[color-mix(in_srgb,var(--text)_10%,transparent)] ",
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: dots are positional
          key={i}
        />
      ))}
    </span>
  );
}

/**
 * Tools trigger and picked tool in one pill: picking a tool morphs the
 * pill into it (icon, name, tint and an x) instead of adding a second chip.
 */
function ToolPill({
  tools,
  tool,
  remaining,
  open,
  onOpenChange,
  onSelect,
  onCloseAutoFocus,
}: {
  tools: SearchTool[];
  tool: SearchTool | null;
  remaining: Record<string, number>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string | null) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const [innerRef, width] = useContentWidth<HTMLSpanElement>();

  const Icon = tool?.icon ?? Settings2;
  const label = tool?.label ?? t("요청 종류");

  // Number keys pick a tool while the menu is open.
  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const index = Number(event.key) - 1;
    const picked = tools[index];
    if (!(Number.isInteger(index) && picked)) {
      return;
    }
    const left = remaining[picked.id];
    if (left !== undefined && left <= 0) {
      return;
    }
    event.preventDefault();
    onSelect(picked.id === tool?.id ? null : picked.id);
    onOpenChange(false);
  };

  return (
    <motion.div
      animate={{ width }}
      className="h-8 min-w-0 shrink-0 overflow-hidden rounded-full"
      style={{ "--tool": tool?.color ?? "currentColor" } as React.CSSProperties}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      <span className="flex h-full w-max items-center" ref={innerRef}>
        <DropdownMenu modal={false} onOpenChange={onOpenChange} open={open}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={
                tool
                  ? t("요청 종류: {value} · 바꾸기", { value: tool.label })
                  : t("요청 종류")
              }
              className={cn(
                // A plain ghost control, like the model picker: no outline,
                // just the tool's coloured icon and its name.
                "group flex h-8 items-center gap-1.5 rounded-full pr-2 pl-2.5 text-xs outline-hidden",
                "transition-[background-color,color] duration-150",
                EASE_OUT_CSS,
                "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_15%,transparent)] ",
                "hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)] data-[state=open]:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] data-[state=open]:text-[var(--text)]    ",
                tool
                  ? "font-medium text-[var(--text-secondary)] "
                  : "text-[var(--text-secondary)] ",
              )}
              type="button"
            >
              <span className="relative inline-grid size-4 shrink-0 place-items-center">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, filter: "blur(0px)", rotate: 0 }}
                    className="col-start-1 row-start-1 text-(--tool)"
                    exit={{ opacity: 0, filter: "blur(2px)", rotate: 30 }}
                    initial={{ opacity: 0, filter: "blur(2px)", rotate: -30 }}
                    key={tool?.id ?? "tools"}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className="relative inline-grid">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    className="col-start-1 row-start-1 max-w-[4rem] truncate whitespace-nowrap sm:max-w-none"
                    exit={{ opacity: 0, filter: "blur(2px)", y: -4 }}
                    initial={{ opacity: 0, filter: "blur(2px)", y: 4 }}
                    key={label}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    {label}
                  </motion.span>
                </AnimatePresence>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-3 shrink-0 opacity-50 transition-transform duration-200 group-data-[state=open]:rotate-180",
                  EASE_OUT_CSS,
                )}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className={cn(menuPanel, "w-72")}
            onCloseAutoFocus={onCloseAutoFocus}
            onKeyDown={onMenuKeyDown}
            // Below the box by default; Radix flips it up when there is no
            // room, so it also works with the composer at the bottom of a chat.
            side="bottom"
            sideOffset={8}
          >
            <div className="flex items-center justify-between px-2 pt-1.5 pb-1 text-[11px] text-[var(--text-tertiary)] ">
              <span>{t("요청 종류")}</span>
              <span>
                {t("숫자 1~{count}로 골라요", { count: tools.length })}
              </span>
            </div>
            {tools.map((item, i) => {
              const ItemIcon = item.icon;
              const isSelected = item.id === tool?.id;
              const left = remaining[item.id];
              const spent = left !== undefined && left <= 0;
              return (
                <DropdownMenuCheckboxItem
                  checked={isSelected}
                  className={cn(
                    "group/item flex items-center gap-2.5 rounded-lg px-2 py-1.5 [&>span:first-child]:hidden",
                    "focus:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] ",
                  )}
                  disabled={spent}
                  key={item.id}
                  // Picking the active tool again clears it, like the pill's x.
                  onCheckedChange={(checked) =>
                    onSelect(checked ? item.id : null)
                  }
                  style={
                    {
                      "--tool": item.color ?? "currentColor",
                    } as React.CSSProperties
                  }
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-(--tool)">
                    <ItemIcon aria-hidden="true" className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-xs",
                          isSelected
                            ? "text-[var(--text)] "
                            : "text-[var(--text-secondary)] ",
                        )}
                      >
                        {item.label}
                      </span>
                      {left !== undefined && item.limit !== undefined && (
                        <RunsLeft left={left} limit={item.limit} />
                      )}
                    </span>
                    {item.hint && (
                      <span className="block truncate text-[11px] text-[var(--text-tertiary)] ">
                        {spent ? t("오늘은 다 썼어요") : item.hint}
                      </span>
                    )}
                  </span>
                  {isSelected ? (
                    <Check
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-[var(--text)] "
                      strokeWidth={2.25}
                    />
                  ) : (
                    <kbd className="w-3.5 shrink-0 text-center font-sans text-[11px] text-[var(--text-tertiary)] tabular-nums ">
                      {i + 1}
                    </kbd>
                  )}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <AnimatePresence initial={false} mode="popLayout">
          {tool && (
            <motion.button
              animate={{ opacity: 1, filter: "blur(0px)" }}
              aria-label={t("{label} 선택 해제", { label: tool.label })}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] outline-hidden ",
                "transition-[background-color,color] duration-150",
                EASE_OUT_CSS,
                "hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--text)]  ",
                "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_15%,transparent)] ",
              )}
              exit={{
                opacity: 0,
                filter: "blur(2px)",
                transition: { duration: 0.1 },
              }}
              initial={{ opacity: 0, filter: "blur(2px)" }}
              onClick={() => onSelect(null)}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              type="button"
            >
              <X aria-hidden="true" className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </span>
    </motion.div>
  );
}

function ModelMenu({
  models,
  selected,
  onSelect,
  onCloseAutoFocus,
}: {
  models: string[];
  selected: string;
  onSelect: (model: string) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("모델: {value} · 바꾸기", { value: selected })}
          className={cn(ghostButton, "group gap-1 pr-2")}
          type="button"
        >
          {/* Only the name swaps; the chevron stays put. */}
          <span className="relative inline-grid">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="col-start-1 row-start-1 whitespace-nowrap"
                exit={{ opacity: 0, filter: "blur(2px)" }}
                initial={{ opacity: 0, filter: "blur(2px)" }}
                key={selected}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                {/* Phones get the family name only, to leave room for the chip. */}
                <span className="sm:hidden">{selected.split(" ")[0]}</span>
                <span className="hidden sm:inline">{selected}</span>
              </motion.span>
            </AnimatePresence>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180",
              EASE_OUT_CSS,
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(menuPanel, "w-44")}
        onCloseAutoFocus={onCloseAutoFocus}
        side="bottom"
        sideOffset={8}
      >
        {models.map((model) => (
          <DropdownMenuItem
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg px-2 text-xs",
              model === selected
                ? "text-[var(--text)] "
                : "text-[var(--text-tertiary)] ",
            )}
            key={model}
            onSelect={() => onSelect(model)}
          >
            <span className="flex-1">{model}</span>
            {model === selected && (
              <Check
                aria-hidden="true"
                className="size-3.5"
                strokeWidth={2.25}
              />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <motion.li
      animate={{ opacity: 1, filter: "blur(0px)" }}
      className="flex h-8 max-w-48 items-center gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--text)_4%,transparent)] pr-1 pl-2 text-[var(--text-secondary)] text-xs  "
      exit={{ opacity: 0, filter: "blur(2px)", transition: { duration: 0.1 } }}
      initial={{ opacity: 0, filter: "blur(2px)" }}
      layout="position"
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      <FileText aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="truncate">{file.name}</span>
      <button
        aria-label={t("{name} 첨부 해제", { name: file.name })}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] outline-hidden transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_15%,transparent)]    "
        onClick={onRemove}
        type="button"
      >
        <X aria-hidden="true" className="size-3" />
      </button>
    </motion.li>
  );
}

/**
 * The band on the frame above the card, as in AI Input Selector: says what
 * the picked tool will do, and swaps with a short blur when the tool does.
 */
function ToolHeader({
  tool,
  left,
  onOpenTools,
}: {
  tool: SearchTool | null;
  left: number | undefined;
  onOpenTools: () => void;
}) {
  const Icon = tool?.icon ?? Settings2;
  const text = tool
    ? (tool.hint ?? tool.label)
    : t("요청 종류 없이 질문에 답해요");
  const swap = {
    animate: { opacity: 1, filter: "blur(0px)", y: 0 },
    exit: { opacity: 0, filter: "blur(2px)", y: -6 },
    initial: { opacity: 0, filter: "blur(2px)", y: 6 },
    transition: { duration: 0.2, ease: EASE_OUT },
  };
  return (
    <div
      className="flex h-9 items-center gap-2 overflow-hidden pr-1.5 pl-3 text-xs"
      style={{ "--tool": tool?.color ?? "currentColor" } as React.CSSProperties}
    >
      <span className="relative min-w-0 flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={swap.animate}
            className="flex min-w-0 items-center gap-2"
            exit={swap.exit}
            initial={swap.initial}
            key={tool?.id ?? "none"}
            transition={swap.transition}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "size-3.5 shrink-0",
                tool ? "text-(--tool)" : "text-[var(--text-tertiary)] ",
              )}
            />
            <span className="truncate text-[var(--text-secondary)] ">
              {text}
            </span>
            {left !== undefined && tool?.limit !== undefined && (
              <span className="flex shrink-0 items-center gap-1.5 text-[var(--text-tertiary)] tabular-nums ">
                <RunsLeft left={left} limit={tool.limit} />
                {left} left
              </span>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      <button
        className={cn(frameKey, "pr-1")}
        onClick={onOpenTools}
        type="button"
      >
        {tool ? t("바꾸기") : t("요청 종류 고르기")}
        <kbd className="flex size-4 items-center justify-center rounded-[4px] bg-[color-mix(in_srgb,var(--text)_5%,transparent)] font-normal font-sans text-[10px] text-[var(--text-tertiary)]  ">
          /
        </kbd>
      </button>
    </div>
  );
}

function SendStopButton({
  running,
  canSubmit,
  onSubmit,
  onStop,
}: {
  running: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onStop: () => void;
}) {
  const [innerRef, width] = useContentWidth<HTMLSpanElement>();
  const live = running || canSubmit;
  // A worded key rather than an arrow: t("질문 보내기") with the return glyph, which
  // turns into t("중단") while a run is going. Only the face swaps; the key
  // eases to the new width. Phones get the glyph alone.
  const face = running ? "stop" : "ask";
  return (
    <motion.button
      animate={{ width }}
      aria-label={running ? t("중단") : t("질문 보내기")}
      className={cn(
        "h-8 shrink-0 overflow-hidden rounded-[10px]",
        "transition-[background-color,color,box-shadow] duration-150",
        EASE_OUT_CSS,
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_20%,transparent)] ",
        live
          ? "bg-[var(--text)] text-[var(--surface-raised)] shadow-[inset_0_1px_0_rgb(var(--semantic-static-white-rgb)/0.12)] hover:bg-[var(--text)]   dark:shadow-none "
          : "bg-[color-mix(in_srgb,var(--text)_5%,transparent)] text-[var(--text-tertiary)]  ",
      )}
      disabled={!live}
      onClick={running ? onStop : onSubmit}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      type="button"
    >
      <span className="flex h-full w-max items-center" ref={innerRef}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ opacity: 1, filter: "blur(0px)" }}
            className="flex h-8 items-center gap-1.5 px-2 font-medium text-xs sm:pr-2 sm:pl-3"
            exit={{
              opacity: 0,
              filter: "blur(2px)",
              transition: { duration: 0.08 },
            }}
            initial={{ opacity: 0, filter: "blur(2px)" }}
            key={face}
            transition={{ duration: 0.16, ease: EASE_OUT }}
          >
            {face === "stop" ? (
              <>
                <span className="max-sm:hidden">{t("중단")}</span>
                <span className="flex size-4 items-center justify-center">
                  <span className="size-2 rounded-[2px] bg-current" />
                </span>
              </>
            ) : (
              <>
                <span className="max-sm:hidden">{t("질문 보내기")}</span>
                <CornerDownLeft
                  aria-hidden="true"
                  className="size-4 sm:size-3.5 sm:opacity-60"
                />
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

export default function AI_Input_Search({
  allowAttachments = true,
  modelControls,
  leadingControl,
  value: controlledValue,
  onValueChange,
  selectedModel: controlledModel,
  onModelChange,
  selectedTool: controlledTool,
  onToolChange,
  onAttach,
  onStop,
  disabled = false,
  busy = false,
  onQueue,
  inputRef,
  placeholder,
  tools,
  defaultTool = null,
  models,
  defaultModel = "",
  onSearch,
  className,
}: AIInputSearchProps) {
  const [localValue, setLocalValue] = useState("");
  const value = controlledValue ?? localValue;
  const setValue = (next: string) => {
    setLocalValue(next);
    onValueChange?.(next);
  };
  const [localToolId, setLocalToolId] = useState<string | null>(defaultTool);
  const toolId = controlledTool === undefined ? localToolId : controlledTool;
  const setToolId = (next: string | null) => {
    setLocalToolId(next);
    onToolChange?.(next);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [localModel, setLocalModel] = useState(defaultModel);
  const model = controlledModel ?? localModel;
  const setModel = (next: string) => {
    setLocalModel(next);
    onModelChange?.(next);
  };
  const [files, setFiles] = useState<File[]>([]);
  const [remaining, setRemaining] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      tools.flatMap((t) => (t.limit === undefined ? [] : [[t.id, t.limit]])),
    ),
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [runTool, setRunTool] = useState<SearchTool | null>(null);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 56,
    maxHeight: 200,
  });

  const tool = tools.find((t) => t.id === toolId) ?? null;
  const running = busy || phase === "working";

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (inputRef) inputRef.current = textareaRef.current;
  }, [inputRef, textareaRef]);

  // The clock ticks only while a run is going, from zero each time.
  useEffect(() => {
    if (!running) {
      return;
    }
    const start = performance.now();
    const timer = setInterval(() => setElapsed(performance.now() - start), 100);
    return () => clearInterval(timer);
  }, [running]);

  const pickTool = (id: string | null) => {
    setToolId(id);
    textareaRef.current?.focus();
  };

  // Menus hand focus back to the field, not their trigger, so typing carries on.
  const backToField = (event: Event) => {
    event.preventDefault();
    textareaRef.current?.focus();
  };

  // A metered tool spends a run; at zero it drops off the box.
  const spendRun = (spent: SearchTool | null) => {
    const left = spent ? remaining[spent.id] : undefined;
    if (!spent || left === undefined) {
      return;
    }
    setRemaining((current) => ({ ...current, [spent.id]: left - 1 }));
    if (left - 1 <= 0) {
      setToolId(null);
    }
  };

  const submit = async () => {
    const query = value.trim();
    if (!query || running || disabled) {
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const attached = files;
    setValue("");
    setFiles([]);
    adjustHeight(true);
    setSources([]);
    setElapsed(0);
    setExpanded(false);
    setRunTool(tool);
    setPhase("working");

    spendRun(tool);

    const onSource = (source: SearchSource) => {
      if (controller.signal.aborted) {
        return;
      }
      setSources((current) => [
        ...current.filter(
          (s) => (s.key ?? s.domain) !== (source.key ?? source.domain),
        ),
        source,
      ]);
    };
    try {
      await onSearch(query, {
        tool,
        model,
        files: attached,
        signal: controller.signal,
        onSource,
      });
      if (!controller.signal.aborted) {
        setPhase("done");
      }
    } catch {
      // Stopped: `stop` has already set the phase. Any other failure still
      // ends the run, so the clock and the Stop button don't hang.
      if (!controller.signal.aborted) {
        setPhase("stopped");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("stopped");
    onStop?.();
    textareaRef.current?.focus();
  };

  // Mouse convenience: clicking the box around the field focuses it. Clicks
  // on the controls keep their own behaviour.
  const handleContainerClick = (target: EventTarget) => {
    if (target instanceof Element && target.closest("button, [role=menu]")) {
      return;
    }
    textareaRef.current?.focus();
  };

  const canSubmit = value.trim().length > 0 && !running && !disabled;

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn("mx-auto w-full max-w-lg py-4", className)}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: pointer-only shortcut; the textarea and buttons inside are keyboard reachable */}
        <div
          className="relative w-full cursor-text rounded-[22px] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] p-1 text-left "
          onClick={(e) => handleContainerClick(e.target)}
        >
          <ToolHeader
            left={tool ? remaining[tool.id] : undefined}
            onOpenTools={() => setMenuOpen(true)}
            tool={tool}
          />
          {/* Card on a soft frame, as in AI Prompt; the trace opens in the frame. */}
          <div
            className={cn(
              "flex flex-col rounded-[18px] bg-[var(--surface-raised)] ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  ",
              "shadow-[0_1px_2px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.04),0_6px_20px_-10px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.12)]",
              "transition-shadow duration-150 has-[textarea:focus-visible]:ring-[color-mix(in_srgb,var(--text)_20%,transparent)] ",
            )}
          >
            <AnimatePresence initial={false}>
              {files.length > 0 && (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  <ul
                    aria-label={t("첨부한 파일")}
                    className="flex flex-wrap gap-1.5 px-3 pt-3"
                  >
                    <AnimatePresence initial={false}>
                      {files.map((file) => (
                        <FileChip
                          file={file}
                          key={fileKey(file)}
                          onRemove={() => {
                            setFiles((current) =>
                              current.filter((f) => f !== file),
                            );
                            // The chip leaves with its button; typing carries
                            // on in the field, as in AI Prompt.
                            textareaRef.current?.focus();
                          }}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            <Textarea
              aria-label={t("연구 도우미에게 질문")}
              disabled={disabled}
              maxLength={2000}
              onPaste={(e) => {
                if (!allowAttachments && e.clipboardData.files.length) {
                  e.preventDefault();
                  return;
                }
                if (e.clipboardData.files.length && !disabled && !running) {
                  e.preventDefault();
                  const picked = Array.from(e.clipboardData.files);
                  if (onAttach) {
                    onAttach(picked);
                    if (e.currentTarget instanceof HTMLInputElement)
                      e.currentTarget.value = "";
                    return;
                  }
                  setFiles((current) => [...current, ...picked]);
                }
              }}
              // shadow-none and md:text-[15px] beat the shadow-xs and
              // md:text-sm of the current shadcn Textarea. Touch screens get 16px so
              // iOS does not zoom into the field on focus.
              className="min-h-[56px] w-full resize-none rounded-none border-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-[var(--text)] leading-relaxed shadow-none placeholder:text-[var(--text-tertiary)] focus-visible:ring-0 focus-visible:ring-offset-0 md:text-[15px] dark:bg-transparent   [@media(pointer:coarse)]:text-base"
              onChange={(e) => {
                setValue(e.target.value);
                adjustHeight();
              }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) {
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (running && value.trim() && onQueue) {
                    onQueue(value, tool);
                    setValue("");
                  } else submit();
                } else if (e.key === "Escape" && running) {
                  e.preventDefault();
                  stop();
                } else if (e.key === "/" && value === "") {
                  // "/" in an empty box opens the tools, keyboard first.
                  e.preventDefault();
                  setMenuOpen(true);
                } else if (e.key === "Backspace" && value === "" && toolId) {
                  // Backspace in an empty box takes the chip off, as in a
                  // tag field.
                  e.preventDefault();
                  setToolId(null);
                }
              }}
              placeholder={tool?.placeholder ?? placeholder}
              ref={textareaRef}
              style={tool?.color ? { caretColor: tool.color } : undefined}
              value={value}
            />

            <div className="flex flex-wrap items-center gap-1 px-2.5 pt-1 pb-2.5">
              {leadingControl}
              {allowAttachments && (
                <button
                  aria-label={t("파일 첨부")}
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] outline-hidden ring-1 ring-[color-mix(in_srgb,var(--text)_10%,transparent)]  ",
                    "transition-[background-color,color] duration-150",
                    EASE_OUT_CSS,
                    "hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] hover:text-[var(--text)]  ",
                    "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--text)_20%,transparent)] ",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </button>
              )}
              <input
                className="hidden"
                multiple
                disabled={disabled || !allowAttachments}
                accept=".pdf,.txt,.md"
                onChange={(e) => {
                  if (!allowAttachments) return;
                  const picked = Array.from(e.target.files ?? []);
                  if (onAttach) {
                    onAttach(picked);
                    if (e.currentTarget instanceof HTMLInputElement)
                      e.currentTarget.value = "";
                    return;
                  }
                  // The same file picked twice would share a chip key.
                  setFiles((current) => [
                    ...current,
                    ...picked.filter(
                      (file) =>
                        !current.some((f) => fileKey(f) === fileKey(file)),
                    ),
                  ]);
                  if (e.currentTarget instanceof HTMLInputElement)
                    e.currentTarget.value = "";
                }}
                ref={fileInputRef}
                tabIndex={-1}
                type="file"
              />
              <ToolPill
                onCloseAutoFocus={backToField}
                onOpenChange={setMenuOpen}
                onSelect={pickTool}
                open={menuOpen}
                remaining={remaining}
                tool={tool}
                tools={tools}
              />
              <div className="min-w-0 flex-1" />
              {modelControls ?? (
                <ModelMenu
                  models={models}
                  onCloseAutoFocus={backToField}
                  onSelect={setModel}
                  selected={model}
                />
              )}
              <SendStopButton
                canSubmit={canSubmit}
                onStop={stop}
                onSubmit={submit}
                running={running}
              />
            </div>
          </div>
          <AnimatePresence initial={false}>
            {phase !== "idle" && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <div>
                  <Trace
                    elapsed={elapsed}
                    expanded={expanded}
                    listId={listId}
                    onToggle={() => setExpanded((open) => !open)}
                    phase={phase}
                    sources={sources}
                    tool={runTool}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <output aria-live="polite" className="sr-only">
          {phase === "done" && t("끝났어요")}
          {phase === "stopped" && t("멈췄어요")}
          {phase === "working" && (runTool?.activity ?? t("처리 중"))}
        </output>
      </div>
    </MotionConfig>
  );
}
