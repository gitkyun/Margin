"use client";

/**
 * @author: @kokonutui
 * @description: AI Send
 * @version: 1.1.0
 * @date: 2026-10-31
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Check, Mail } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export interface DraftEmail {
  from: string;
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
}

export interface AISendProps {
  /** The user's message, drawn as a bubble. Only the demo draws one by default. */
  prompt?: string;
  /** What the assistant says above the draft. */
  message?: string;
  /**
   * The email, usually a tool's input. It can stream in: the body follows
   * it until the person edits it. Leave it out for the demo.
   */
  draft?: DraftEmail;
  /** The model is still writing the draft, so Send waits. */
  writing?: boolean;
  /** Seconds you have to undo before it really sends. */
  undoSeconds?: number;
  /**
   * Called once the undo window has passed, with the final text. Return a
   * Promise to show it sending until it resolves; throw and the draft comes
   * back with the error's message.
   */
  onSend?: (draft: DraftEmail) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  sendLabel?: string;
}

type Status = "draft" | "pending" | "sending" | "sent";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
const RING = 2 * Math.PI * 8;

const DEMO_DRAFT: DraftEmail = {
  from: "mara@northwind.co",
  toName: "Sam Rivera",
  toEmail: "sam@northwind.co",
  subject: "Launch review moved to Thursday",
  body: "Hi Sam,\n\nQuick heads up: the launch review is now Thursday at 2pm, same room. Design needs the extra day to finish the flows.\n\nThanks,\nMara",
};

const DEMO_TEXT = {
  prompt: "Tell Sam the launch review moved to Thursday at 2",
  message: "Here’s a draft. Change anything you like before it goes.",
};

const reasonOf = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : t("메일을 보내지 못했어요. 다시 시도해 주세요.");

export default function AISend({
  prompt,
  message,
  draft: draftProp,
  writing = false,
  undoSeconds = 5,
  onSend,
  className,
  disabled = false,
  readOnly = false,
  sendLabel = t("보내기"),
}: AISendProps) {
  const isDemo = draftProp === undefined;
  const draft = draftProp ?? DEMO_DRAFT;
  const shownPrompt = isDemo ? (prompt ?? DEMO_TEXT.prompt) : prompt;
  const shownMessage = isDemo ? (message ?? DEMO_TEXT.message) : message;
  const id = useId();
  const [status, setStatus] = useState<Status>("draft");
  // Follows the draft as it streams in, until the person edits it.
  const [edited, setEdited] = useState<string>();
  const body = edited ?? draft.body;
  const [left, setLeft] = useState(undoSeconds);
  const [error, setError] = useState<string>();
  const sendRef = useRef<HTMLButtonElement>(null);
  const final = useRef<DraftEmail>(draft);
  final.current = { ...draft, body };
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  // Counts down the undo window, then sends for real.
  useEffect(() => {
    if (status !== "pending") {
      return;
    }
    if (left > 0) {
      const t = setTimeout(() => setLeft((n) => n - 1), 1000);
      return () => clearTimeout(t);
    }
    setStatus("sending");
    Promise.resolve()
      .then(() => onSendRef.current?.(final.current))
      .then(
        () => setStatus("sent"),
        (e: unknown) => {
          setError(reasonOf(e));
          setStatus("draft");
        },
      );
  }, [status, left]);

  const send = () => {
    setLeft(undoSeconds);
    setError(undefined);
    setStatus("pending");
  };

  const undo = () => {
    setStatus("draft");
    requestAnimationFrame(() => sendRef.current?.focus());
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("flex w-full max-w-md flex-col gap-4", className)}
        data-state={writing ? "writing" : status}
      >
        {shownPrompt ? (
          <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--surface-muted)] px-3.5 py-2 text-[14px] text-[var(--text)] leading-snug  ">
            {shownPrompt}
          </p>
        ) : null}
        {shownMessage ? (
          <p className="text-[15px] text-[var(--text)] leading-7 ">
            {shownMessage}
          </p>
        ) : null}

        <AutoHeight className="rounded-2xl bg-[var(--surface-raised)] ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  ">
          <AnimatePresence initial={false} mode="popLayout">
            {status === "sent" ? (
              <motion.div
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="flex items-center gap-3 px-4 py-3"
                initial={{ opacity: 0, filter: "blur(3px)" }}
                key="sent"
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.08 }}
              >
                <motion.span
                  animate={{ scale: 1 }}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--surface-raised)] "
                  initial={{ scale: 0.6 }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 26,
                    delay: 0.1,
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className="size-3.5"
                    strokeWidth={2.5}
                  />
                </motion.span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-[var(--text)] ">
                    <span className="font-medium">
                      {t("{name}에게 메일 발송을 요청했어요", {
                        name: draft.toName,
                      })}
                    </span>
                    <span className="text-[var(--text-tertiary)] ">
                      {" "}
                      · {t("방금")}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-[var(--text-tertiary)] ">
                    {draft.subject}
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                exit={{ opacity: 0, filter: "blur(3px)" }}
                key="draft"
                transition={{ duration: 0.2 }}
              >
                <dl className="divide-y divide-[color-mix(in_srgb,var(--text)_6%,transparent)] px-4 text-[13px] ">
                  <Field label={t("받는 사람")}>
                    <span className="text-[var(--text)] ">{draft.toName}</span>{" "}
                    <span className="text-[var(--text-tertiary)] ">
                      {draft.toEmail}
                    </span>
                  </Field>
                  <Field label={t("메일 제목")}>
                    <span className="text-[var(--text)] ">{draft.subject}</span>
                  </Field>
                </dl>
                <label className="sr-only" htmlFor={id}>
                  {t("메일 내용")}
                </label>
                <textarea
                  className={cn(
                    "field-sizing-content block w-full resize-none border-[color-mix(in_srgb,var(--text)_6%,transparent)] border-t bg-transparent px-4 pt-3 pb-4 text-[14px] text-[var(--text)] leading-6 outline-hidden transition-opacity duration-200  ",
                    status !== "draft" && "opacity-50",
                  )}
                  id={id}
                  onChange={(e) => setEdited(e.target.value)}
                  readOnly={readOnly || status !== "draft" || writing}
                  rows={6}
                  value={body}
                />
                <div className="flex items-center gap-2 border-[color-mix(in_srgb,var(--text)_6%,transparent)] border-t px-3 py-2.5 ">
                  <span className="flex items-center gap-1.5 pl-1 text-[12px] text-[var(--text-tertiary)] ">
                    <Mail aria-hidden="true" className="size-3.5" />
                    {draft.from}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <AnimatePresence initial={false}>
                      {status === "pending" && (
                        <motion.button
                          animate={{ opacity: 1, x: 0 }}
                          className="h-8 rounded-lg px-3 font-medium text-[13px] text-[var(--text)] outline-hidden transition-colors duration-100 hover:bg-[var(--surface-muted)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)] active:bg-[var(--hover-fill)]   "
                          exit={{ opacity: 0, x: 6 }}
                          initial={{ opacity: 0, x: 6 }}
                          onClick={undo}
                          transition={{ duration: 0.18, ease: EASE_OUT }}
                          type="button"
                        >
                          {t("되돌리기")}
                        </motion.button>
                      )}
                    </AnimatePresence>
                    <SendButton
                      disabled={writing || disabled || !onSend}
                      left={left}
                      onSend={send}
                      pending={status === "pending" || status === "sending"}
                      ref={sendRef}
                      total={undoSeconds}
                      label={sendLabel}
                    />
                  </div>
                </div>
                {error && status === "draft" ? (
                  <p
                    className="px-4 pb-3 text-[12.5px] text-[var(--danger)] "
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </AutoHeight>
        <p aria-live="polite" className="sr-only">
          {status === "pending"
            ? t("{seconds}초 뒤 메일 발송을 요청해요", { seconds: left })
            : ""}
          {status === "sent" ? t("메일 발송 요청함") : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-10 items-center gap-3">
      <dt className="w-14 shrink-0 text-[var(--text-tertiary)] ">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

/** Send, then a ring that drains while the undo window is open. */
function SendButton({
  pending,
  disabled,
  left,
  total,
  onSend,
  label,
  ref,
}: {
  pending: boolean;
  disabled: boolean;
  left: number;
  total: number;
  onSend: () => void;
  label: string;
  ref: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      className={cn(
        "flex h-8 min-w-[76px] items-center justify-center gap-2 rounded-lg px-3 font-medium text-[13px] outline-hidden transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand)_50%,transparent)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900",
        disabled && !pending && "opacity-50",
        pending
          ? "bg-[var(--surface-muted)] text-[var(--text-secondary)]  "
          : "bg-[var(--brand)] text-[var(--surface-raised)] hover:bg-[var(--brand)]  ",
      )}
      disabled={pending || disabled}
      onClick={onSend}
      ref={ref}
      type="button"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {pending ? (
          <motion.span
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="pending"
            transition={{ duration: 0.15 }}
          >
            <span className="relative flex size-5 items-center justify-center">
              <svg
                aria-hidden="true"
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 20 20"
              >
                <circle
                  className="stroke-[var(--text-tertiary)] "
                  cx="10"
                  cy="10"
                  fill="none"
                  r="8"
                  strokeWidth="1.75"
                />
                <motion.circle
                  animate={{ strokeDashoffset: RING }}
                  className="stroke-[var(--brand)] "
                  cx="10"
                  cy="10"
                  fill="none"
                  initial={{ strokeDashoffset: 0 }}
                  r="8"
                  strokeDasharray={RING}
                  strokeLinecap="round"
                  strokeWidth="1.75"
                  transition={{ duration: total, ease: "linear" }}
                />
              </svg>
              <span className="relative overflow-hidden font-mono text-[10.5px] tabular-nums">
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.span
                    animate={{ y: 0, opacity: 1 }}
                    className="block"
                    exit={{ y: -6, opacity: 0 }}
                    initial={{ y: 6, opacity: 0 }}
                    key={left}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                  >
                    {left > 0 ? left : ""}
                  </motion.span>
                </AnimatePresence>
              </span>
            </span>
            {t("보내는 중")}
          </motion.span>
        ) : (
          <motion.span
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key="send"
            transition={{ duration: 0.15 }}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

/** Eases the card to its content's height when the content swaps. */
function AutoHeight({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight));
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      animate={{ height }}
      className={cn("overflow-hidden", className)}
      initial={false}
      transition={{ duration: 0.3, ease: EASE_DRAWER }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
