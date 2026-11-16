"use client";
import { t } from "@/lib/i18n";

/**
 * @author: @kokonutui
 * @description: AI Attachment
 * @version: 1.1.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import {
  AnimatePresence,
  animate,
  MotionConfig,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface AttachedFile {
  name: string;
  /** In bytes. */
  size: number;
  pages: number;
}

/** A run of text, or a citation to a page (1-based). */
export type AnswerPart = string | { page: number };

/** Where the file is: on its way up, being read, read, or failed. */
export type AttachmentStatus = "uploading" | "reading" | "done" | "error";

export interface AIAttachmentProps {
  pageNumbers?: number[];
  file?: AttachedFile;
  /** The user's message under the file. Only the demo draws one by default. */
  prompt?: string;
  /** The answer, with page citations. Shown once the file is read; it can stream. */
  answer?: AnswerPart[];
  /**
   * Pass it to drive the card from your upload and parser; leave it out and
   * the demo plays on `uploadMs` and `pageMs`.
   */
  status?: AttachmentStatus;
  /** Share of the file uploaded, 0 to 1, while `uploading`. */
  uploaded?: number;
  /** Pages read so far, while `reading`. */
  pagesRead?: number;
  /** Seconds the reading took, shown once it's done. */
  duration?: number;
  /** Why it failed, when `status` is `error`. */
  error?: string;
  /** Demo only: how long the upload takes, in ms. */
  uploadMs?: number;
  /** Demo only: how long each page takes to read, in ms. */
  pageMs?: number;
  className?: string;
}

type Phase = AttachmentStatus;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** Line widths on a page thumbnail, in %, cycled per page. */
const LINES = [92, 100, 84, 96, 70, 100, 88, 60];
/** Which line of a page a citation points at. */
const CITED_LINE = 3;

const DEMO_FILE: AttachedFile = {
  name: "Q3-board-report.pdf",
  size: 4_200_000,
  pages: 12,
};

const DEMO_ANSWER: AnswerPart[] = [
  "Revenue grew 18% to $4.2M, almost all of it from the new enterprise tier",
  { page: 3 },
  ". Churn fell to 2.1% after the onboarding rework",
  { page: 6 },
  ". The one risk it flags is hiring: two senior roles are still open, which pushed the EU launch to Q1",
  { page: 9 },
  ".",
];

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1)} MB`;

const DEMO_PROMPT = "What changed this quarter? Keep it short.";

/** Uploads, then reads a page at a time, for the demo. */
function usePlayback(
  pages: number,
  uploadMs: number,
  pageMs: number,
  active: boolean,
) {
  const [phase, setPhase] = useState<Phase>("uploading");
  const uploaded = useMotionValue(0);
  /** Pages read so far; the one being read is at this index. */
  const [read, setRead] = useState(0);

  // Uploads on a motion value, so the ring and byte count move every frame
  // without re-rendering the chat.
  useEffect(() => {
    if (phase !== "uploading" || !active) {
      return;
    }
    const controls = animate(uploaded, 1, {
      duration: uploadMs / 1000,
      ease: [0.33, 1, 0.68, 1],
      onComplete: () => setPhase("reading"),
    });
    return () => controls.stop();
  }, [phase, uploadMs, uploaded, active]);

  // Reads one page at a time.
  useEffect(() => {
    if (phase !== "reading" || !active) {
      return;
    }
    if (read >= pages) {
      const t = setTimeout(() => setPhase("done"), 300);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRead((n) => n + 1), pageMs);
    return () => clearTimeout(t);
  }, [phase, read, pages, pageMs, active]);

  return { phase, read, uploaded, seconds: (pages * pageMs) / 1000 };
}

/** Eases the upload ring to the share your upload reports. */
function useUploadValue(target: number | undefined) {
  const value = useMotionValue(target ?? 0);
  useEffect(() => {
    if (target === undefined) {
      return;
    }
    const controls = animate(value, target, { duration: 0.3, ease: "easeOut" });
    return () => controls.stop();
  }, [target, value]);
  return value;
}

export default function AIAttachment({
  pageNumbers,
  file = DEMO_FILE,
  prompt,
  answer,
  status,
  uploaded: uploadedProp,
  pagesRead,
  duration,
  error,
  uploadMs = 1400,
  pageMs = 260,
  className,
}: AIAttachmentProps) {
  const driven = status !== undefined;
  const isDemo = !driven && answer === undefined;
  const reduce = useReducedMotion();
  const playback = usePlayback(file.pages, uploadMs, pageMs, !driven);
  const drivenUpload = useUploadValue(uploadedProp);
  const phase = status ?? playback.phase;
  const uploaded = driven ? drivenUpload : playback.uploaded;
  const read = driven ? (pagesRead ?? 0) : playback.read;
  const shownPrompt = prompt ?? (isDemo ? DEMO_PROMPT : undefined);
  const shownAnswer = answer ?? (isDemo ? DEMO_ANSWER : []);
  const [lit, setLit] = useState<number | null>(null);

  const done = phase === "done";
  const failed = phase === "error";
  const secondsTaken = driven ? duration : playback.seconds;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("flex w-full max-w-md flex-col gap-4", className)}
        data-state={phase}
      >
        <div className="flex flex-col items-end gap-1.5">
          <FileChip file={file} phase={phase} progress={uploaded} />
          {shownPrompt ? (
            <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--surface-muted)] px-3.5 py-2 text-[14px] text-[var(--text)] leading-snug  ">
              {shownPrompt}
            </p>
          ) : null}
        </div>

        <AnimatePresence>
          {phase !== "uploading" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[22px] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] p-1 "
              initial={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              <div className="flex h-8 items-center gap-2 overflow-hidden px-3 text-[12px]">
                <span className="relative flex size-3.5 items-center justify-center">
                  <AnimatePresence initial={false} mode="popLayout">
                    {failed ? (
                      <motion.span
                        animate={{ opacity: 1 }}
                        className="size-2 rounded-full bg-[var(--danger)]"
                        initial={{ opacity: 0 }}
                        key="failed"
                      />
                    ) : null}
                    {done ? (
                      <motion.svg
                        animate={{ opacity: 1 }}
                        aria-hidden="true"
                        className="size-3.5 text-[var(--success)] "
                        fill="none"
                        initial={{ opacity: 0 }}
                        key="done"
                        viewBox="0 0 16 16"
                      >
                        <motion.path
                          animate={{ pathLength: 1 }}
                          d="M3.5 8.5l3 3 6-7"
                          initial={{ pathLength: 0 }}
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          transition={{ duration: 0.35, ease: EASE_OUT }}
                        />
                      </motion.svg>
                    ) : null}
                    {done || failed ? null : (
                      <motion.span exit={{ opacity: 0 }} key="spin">
                        <Spinner />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className={cn(
                      "min-w-0 truncate font-medium",
                      failed
                        ? "text-[var(--danger)] "
                        : "text-[var(--text-secondary)] ",
                    )}
                    exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
                    initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
                    key={phase}
                    transition={{ duration: 0.22, ease: EASE_OUT }}
                  >
                    {bandLabel(phase, file, error)}
                  </motion.span>
                </AnimatePresence>
                <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--text-tertiary)] tabular-nums ">
                  {bandCount(phase, read, file.pages, secondsTaken)}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1 rounded-[18px] bg-[var(--surface-raised)] p-3 shadow-[0_1px_2px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.04)] ring-1 ring-[color-mix(in_srgb,var(--text)_6%,transparent)] sm:gap-1.5  ">
                {Array.from({ length: file.pages }, (_, i) => (
                  <Page
                    index={
                      pageNumbers?.[i] === undefined ? i : pageNumbers[i] - 1
                    }
                    // biome-ignore lint/suspicious/noArrayIndexKey: pages are a fixed, ordered list
                    key={i}
                    lit={lit === i + 1}
                    pageMs={pageMs}
                    reduce={Boolean(reduce)}
                    state={pageState(i, read, phase)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {done && shownAnswer.length > 0 && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-[var(--text)] leading-7 "
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.15 }}
            >
              {shownAnswer.map((part, i) =>
                typeof part === "string" ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: answer parts are static
                  <Fragment key={i}>{part}</Fragment>
                ) : (
                  <Cite
                    active={lit === part.page}
                    // biome-ignore lint/suspicious/noArrayIndexKey: answer parts are static
                    key={i}
                    onLight={setLit}
                    page={part.page}
                  />
                ),
              )}
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {phase === "uploading" ? "" : bandLabel(phase, file, error)}
        </p>
      </div>
    </MotionConfig>
  );
}

const bandLabel = (phase: Phase, file: AttachedFile, error?: string) => {
  if (phase === "done") {
    return file.pages
      ? t("읽은 페이지 {count}쪽", { count: file.pages })
      : t("자료 준비됨");
  }
  if (phase === "error") {
    return error ?? t("{name}을 읽지 못했어요", { name: file.name });
  }
  return t("{name} 읽는 중", { name: file.name });
};

const bandCount = (
  phase: Phase,
  read: number,
  pages: number,
  seconds?: number,
) => {
  if (phase === "done") {
    return seconds === undefined ? "" : `${seconds.toFixed(1)}s`;
  }
  if (!pages) return "";
  if (phase === "error") {
    return `${read} / ${pages}`;
  }
  return `${Math.min(read + 1, pages)} / ${pages}`;
};

type PageState = "waiting" | "reading" | "read";

const pageState = (i: number, read: number, phase: Phase): PageState => {
  if (phase === "done" || i < read) {
    return "read";
  }
  return i === read && phase === "reading" ? "reading" : "waiting";
};

function FileChip({
  file,
  phase,
  progress,
}: {
  file: AttachedFile;
  phase: Phase;
  progress: MotionValue<number>;
}) {
  const uploading = phase === "uploading";
  const sent = useTransform(
    progress,
    (p) => `${mb(file.size * p)} of ${mb(file.size)}`,
  );
  return (
    <div className="flex w-60 max-w-[85%] items-center gap-2.5 rounded-2xl bg-[var(--surface-raised)] p-2 pr-3 ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  ">
      <span className="relative flex h-10 w-8 shrink-0 items-end justify-center rounded-[6px] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] pb-1 ring-1 ring-[color-mix(in_srgb,var(--danger)_15%,transparent)] ">
        <span className="absolute top-0 right-0 size-2 rounded-bl-[3px] bg-[color-mix(in_srgb,var(--danger)_20%,transparent)]" />
        <span className="font-bold text-[7.5px] text-[var(--danger)] tracking-wide ">
          {file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "FILE"}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-[13px] text-[var(--text)] ">
          {file.name}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-[var(--text-tertiary)] tabular-nums ">
          {uploading ? (
            <motion.span>{sent}</motion.span>
          ) : (
            [
              file.pages ? t("{count}쪽", { count: file.pages }) : "",
              file.size ? mb(file.size) : "",
            ]
              .filter(Boolean)
              .join(" · ")
          )}
        </span>
      </span>
      <AnimatePresence initial={false}>
        {uploading && (
          <motion.svg
            aria-hidden="true"
            className="size-4 shrink-0 -rotate-90"
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            viewBox="0 0 16 16"
          >
            <circle
              className="stroke-[var(--text-tertiary)] "
              cx="8"
              cy="8"
              fill="none"
              r="7"
              strokeWidth="1.75"
            />
            <motion.circle
              className="stroke-[var(--text)] "
              cx="8"
              cy="8"
              fill="none"
              r="7"
              strokeLinecap="round"
              strokeWidth="1.75"
              style={{ pathLength: progress }}
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A page thumbnail. A scan line passes over it while it is read. */
function Page({
  index,
  state,
  lit,
  pageMs,
  reduce,
}: {
  index: number;
  state: PageState;
  lit: boolean;
  pageMs: number;
  reduce: boolean;
}) {
  const lines = index === 0 ? 5 : 7;
  return (
    <motion.div
      animate={{
        y: lit && !reduce ? -3 : 0,
        opacity: state === "waiting" ? 0.45 : 1,
      }}
      className={cn(
        "relative flex aspect-[3/4] min-w-0 flex-col gap-[2px] overflow-hidden rounded-[3px] bg-[var(--surface-raised)] p-[3px] ring-1 transition-[box-shadow] duration-200 ",
        state === "reading" &&
          "ring-[color-mix(in_srgb,var(--brand)_60%,transparent)] ",
        state !== "reading" &&
          (lit
            ? "ring-[var(--warning)] "
            : "ring-[color-mix(in_srgb,var(--text)_10%,transparent)] "),
      )}
      initial={false}
      transition={{ duration: 0.25, ease: EASE_OUT }}
    >
      {index === 0 && (
        <span className="mb-[2px] h-[3px] w-3/5 rounded-full bg-[var(--hover-fill)] " />
      )}
      {Array.from({ length: lines }, (_, l) => (
        <span
          className={cn(
            "h-[1.5px] rounded-full transition-colors duration-300",
            state === "waiting"
              ? "bg-[var(--hover-fill)] "
              : "bg-[var(--hover-fill)] ",
            lit && l === CITED_LINE && "bg-[var(--warning)] ",
          )}
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are decoration
          key={l}
          style={{ width: `${LINES[(l + index) % LINES.length]}%` }}
        />
      ))}
      {state === "reading" && (
        <motion.span
          animate={{ y: "0%" }}
          className="absolute inset-0 border-[var(--brand)] border-b bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]  "
          initial={{ y: "-100%" }}
          transition={{ duration: pageMs / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

/** A page citation. Hover or focus it to light the page it points at. */
function Cite({
  page,
  active,
  onLight,
}: {
  page: number;
  active: boolean;
  onLight: (page: number | null) => void;
}) {
  return (
    <button
      aria-label={t("{page}쪽 미리보기", { page })}
      className={cn(
        "mx-0.5 inline-flex h-5 translate-y-[-1px] items-center rounded-md px-1.5 align-middle font-medium text-[11px] tabular-nums outline-hidden transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--warning)_40%,transparent)]",
        active
          ? "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]"
          : "bg-[var(--surface-muted)] text-[var(--text-secondary)]  ",
      )}
      onBlur={() => onLight(null)}
      onFocus={() => onLight(page)}
      onPointerEnter={(e) => e.pointerType === "mouse" && onLight(page)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onLight(null)}
      type="button"
    >
      p.{page}
    </button>
  );
}

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className="size-3.5 text-[var(--text-secondary)] "
      fill="none"
      transition={{
        duration: 0.6,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }}
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        opacity="0.2"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.75"
      />
    </motion.svg>
  );
}
