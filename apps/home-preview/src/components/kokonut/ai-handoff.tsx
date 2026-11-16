"use client";

/**
 * @author: @kokonutui
 * @description: AI Handoff
 * @version: 1.1.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Headset } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export interface HandoffAgent {
  name: string;
  initials: string;
  /** Tailwind classes for the avatar's colours. */
  tone: string;
}

/** Where the handoff is, from your support queue. */
export type HandoffStatus = "waiting" | "joined";

export interface AIHandoffProps {
  /** The user's message, drawn as a bubble. Only the demo draws one by default. */
  prompt?: string;
  /** What the assistant says before handing over. */
  message?: string;
  team?: string;
  /** What the person taking over gets, so nobody asks twice. */
  shared?: string[];
  /** The team. The first one is who picks it up, so put them first. */
  agents?: HandoffAgent[];
  /** Place in line. Live, pass each new place; the demo counts down from it. */
  position?: number;
  /**
   * Pass it to drive the card from your queue: `waiting` shows `position`,
   * `joined` brings the first agent in. Leave it out and the demo plays on
   * `stepMs`.
   */
  status?: HandoffStatus;
  /**
   * The agent's first message. Live, they show as typing until you pass it;
   * the demo types for a moment, then shows it.
   */
  reply?: string;
  /** One line under the team while waiting. */
  waitHint?: string;
  /** Demo only: ms per place in line. */
  stepMs?: number;
  /** Shows "Keep chatting with AI" while waiting. */
  onStay?: () => void;
  className?: string;
  waitingLabel?: string;
  actionLabel?: string;
}

type Status = "waiting" | "picking" | "joined" | "stayed";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
const TYPING_MS = 1600;
/** How long the picked agent is shown before they join. */
const PICK_MS = 900;
/** How long the agent avatar takes to fly into the joined line, in s. */
const FLIGHT_S = 0.5;

const DEMO_AGENTS: HandoffAgent[] = [
  {
    name: "Nora",
    initials: "N",
    tone: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]",
  },
  {
    name: "Theo",
    initials: "T",
    tone: "bg-[var(--selected-fill)] text-[var(--brand)]  ",
  },
  {
    name: "Ama",
    initials: "A",
    tone: "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]",
  },
];

const DEMO_SHARED = [
  "Two charges of $24.00 on Nov 3",
  "Invoice INV-2291, card ending 4242",
  "You’d like one of them refunded",
];

const place = (n: number) => {
  if (n <= 1) {
    return t("다음 순서");
  }
  const suffix = { 2: "nd", 3: "rd" }[n] ?? "th";
  return t("대기 순서 {count}", { count: n });
};

const DEMO = {
  prompt: "I got charged twice for October",
  message:
    "I can see both charges. Refunds need someone on the billing team, so I’m handing you over with the details.",
  reply:
    "Hi Mara, Nora here. I can see the duplicate and I’ve refunded $24.00. It’ll be back on your card in 3 to 5 days.",
};

/** The chat text around the card: the demo's only when it's the demo. */
function shownText(
  text: Pick<AIHandoffProps, "prompt" | "message" | "reply">,
  isDemo: boolean,
) {
  if (!isDemo) {
    return text;
  }
  return {
    prompt: text.prompt ?? DEMO.prompt,
    message: text.message ?? DEMO.message,
    reply: text.reply ?? DEMO.reply,
  };
}

/**
 * Where the handoff is. Live it follows `status` and `position`; the demo
 * moves up the line on `stepMs`. Either way the first agent is shown picking
 * it up for a moment before they join.
 */
function useQueue(
  statusProp: HandoffStatus | undefined,
  position: number,
  stepMs: number,
) {
  const driven = statusProp !== undefined;
  const [status, setStatus] = useState<Status>("waiting");
  const [counted, setLine] = useState(position);
  const line = driven ? position : counted;

  // Live: the queue says they've joined, so they're picked, then join.
  useEffect(() => {
    if (statusProp === "joined" && status === "waiting") {
      setStatus("picking");
    }
  }, [statusProp, status]);

  // Demo: moves up the line, then the first agent joins.
  useEffect(() => {
    if (status !== "waiting" || driven) {
      return;
    }
    const t = setTimeout(() => {
      if (line > 1) {
        setLine((n) => n - 1);
      } else {
        setStatus("picking");
      }
    }, stepMs);
    return () => clearTimeout(t);
  }, [status, line, stepMs, driven]);

  // Holds on who picked it up, then they join.
  useEffect(() => {
    if (status !== "picking") {
      return;
    }
    const t = setTimeout(() => setStatus("joined"), PICK_MS);
    return () => clearTimeout(t);
  }, [status]);

  return { status, setStatus, line };
}

export default function AIHandoff({
  prompt,
  message,
  team = "Billing",
  shared = DEMO_SHARED,
  agents = DEMO_AGENTS,
  position = 3,
  status: statusProp,
  reply,
  waitHint = "Usually replies in about 2 min",
  stepMs = 1300,
  onStay,
  className,
  waitingLabel,
  actionLabel = t("AI와 계속 대화"),
}: AIHandoffProps) {
  const id = useId();
  const driven = statusProp !== undefined;
  const shown = shownText({ prompt, message, reply }, !driven);
  const { status, setStatus, line } = useQueue(statusProp, position, stepMs);
  const [typingDemo, setTyping] = useState(true);
  // Live, the agent types until you pass their first message.
  const typing = driven ? shown.reply === undefined : typingDemo;
  const [landed, setLanded] = useState(false);
  const agent = agents[0];
  const picking = status === "picking";
  const open = status === "waiting" || picking;

  // They type for a moment before the first message lands.
  useEffect(() => {
    if (status !== "joined") {
      return;
    }
    const land = setTimeout(() => setLanded(true), FLIGHT_S * 1000 + 50);
    const t = setTimeout(() => setTyping(false), TYPING_MS);
    return () => {
      clearTimeout(land);
      clearTimeout(t);
    };
  }, [status]);

  const stay = () => {
    setStatus("stayed");
    onStay?.();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("flex w-full max-w-md flex-col gap-4", className)}
        data-state={status}
      >
        {shown.prompt ? (
          <p className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-[var(--surface-muted)] px-3.5 py-2 text-[14px] text-[var(--text)] leading-snug  ">
            {shown.prompt}
          </p>
        ) : null}
        {shown.message ? (
          <p className="text-[15px] text-[var(--text)] leading-7 ">
            {shown.message}
          </p>
        ) : null}

        <AutoHeight className="rounded-[22px] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] ">
          <AnimatePresence initial={false} mode="popLayout">
            {open ? (
              <motion.div
                exit={{ opacity: 0, filter: "blur(4px)" }}
                key="card"
                transition={{ duration: 0.2 }}
              >
                <div className="flex h-8 items-center gap-2 px-3 text-[12px] text-[var(--text-tertiary)] ">
                  <Headset aria-hidden="true" className="size-3.5" />
                  <span className="min-w-0 truncate">
                    {t("넘길 곳")}{" "}
                    <span className="font-medium text-[var(--text-secondary)] ">
                      {team}
                    </span>
                  </span>
                  <span className="relative ml-auto h-4 shrink-0 overflow-hidden tabular-nums">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        animate={{ y: 0, opacity: 1 }}
                        className="block leading-4"
                        exit={{ y: -10, opacity: 0 }}
                        initial={{ y: 10, opacity: 0 }}
                        key={picking ? "picked" : line}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                      >
                        {picking
                          ? `${agent.name} is joining`
                          : (waitingLabel ?? place(line))}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </div>

                <div className="rounded-[18px] bg-[var(--surface-raised)] shadow-[0_1px_2px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.04)] ring-1 ring-[color-mix(in_srgb,var(--text)_6%,transparent)]  ">
                  <p className="px-3.5 pt-3 font-medium text-[11.5px] text-[var(--text-tertiary)] ">
                    {t("교수님이 보게 될 것")}
                  </p>
                  <ul className="space-y-1.5 px-3.5 pt-2 pb-3 text-[13px]">
                    {shared.map((item, i) => (
                      <li
                        className="flex items-center gap-2.5 text-[var(--text-secondary)] "
                        key={item}
                      >
                        <DrawnCheck delay={0.25 + i * 0.22} />
                        <span className="min-w-0 truncate">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-2.5 border-[color-mix(in_srgb,var(--text)_6%,transparent)] border-t px-3.5 py-2.5 ">
                    <span className="flex">
                      {agents.map((a, i) => (
                        <motion.span
                          animate={{ opacity: picking && i > 0 ? 0.25 : 1 }}
                          className={cn(
                            "-ml-1 flex size-6 items-center justify-center rounded-full font-semibold text-[10px] ring-2 transition-[box-shadow] duration-200 first:ml-0",
                            picking && i === 0
                              ? "ring-[var(--line-strong)] "
                              : "ring-[var(--line)] ",
                            a.tone,
                          )}
                          initial={false}
                          key={a.name}
                          layoutId={i === 0 ? `${id}-agent` : undefined}
                          style={{ zIndex: agents.length - i }}
                          title={a.name}
                          transition={{ duration: 0.3, ease: EASE_OUT }}
                        >
                          {a.initials}
                        </motion.span>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--text-tertiary)] ">
                      {picking ? `${agent.name} picked it up` : waitHint}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    "flex justify-end px-1 pt-1",
                    driven && !onStay && "hidden",
                  )}
                >
                  <button
                    className="h-8 rounded-full px-3 font-medium text-[12.5px] text-[var(--text-secondary)] outline-hidden transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)] active:bg-[color-mix(in_srgb,var(--text)_7%,transparent)] disabled:opacity-50    "
                    disabled={picking}
                    onClick={stay}
                    type="button"
                  >
                    {actionLabel}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="flex h-9 items-center gap-2 px-3 text-[12.5px] text-[var(--text-tertiary)] "
                initial={{ opacity: 0, filter: "blur(3px)" }}
                key="folded"
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.1 }}
              >
                <Headset aria-hidden="true" className="size-3.5" />
                <span className="min-w-0 truncate">
                  {status === "joined"
                    ? `Handed over to ${team} with ${shared.length} details`
                    : "Handoff cancelled"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </AutoHeight>

        <AnimatePresence initial={false} mode="popLayout">
          {status === "joined" && (
            <motion.div
              animate={{ opacity: 1 }}
              className="flex flex-col gap-3"
              initial={{ opacity: 0 }}
              key="joined"
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3 text-[12px] text-[var(--text-tertiary)] ">
                <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--text)_8%,transparent)] " />
                <span className="flex items-center gap-2">
                  <motion.span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full font-semibold text-[9px]",
                      agent.tone,
                    )}
                    // Shared only for the flight in; once landed it stays put
                    // while the messages below it change height.
                    layoutId={landed ? undefined : `${id}-agent`}
                    transition={{ duration: FLIGHT_S, ease: EASE_IN_OUT }}
                  >
                    {agent.initials}
                  </motion.span>
                  <span>
                    <span className="font-medium text-[var(--text-secondary)] ">
                      {agent.name}
                    </span>{" "}
                    from {team} joined
                  </span>
                </span>
                <span className="h-px flex-1 bg-[color-mix(in_srgb,var(--text)_8%,transparent)] " />
              </div>

              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="flex items-end gap-2"
                initial={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.35 }}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-[11px]",
                    agent.tone,
                  )}
                >
                  {agent.initials}
                </span>
                {/* Typing dots and the reply are two bubbles that crossfade,
                    so the bubble never stretches its text mid-way. */}
                <AnimatePresence initial={false} mode="popLayout">
                  {typing ? (
                    <motion.span
                      className="flex h-9 items-center gap-1 rounded-2xl rounded-bl-md bg-[var(--surface-raised)] px-3.5 ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  "
                      exit={{ opacity: 0, filter: "blur(2px)" }}
                      key="typing"
                      transition={{ duration: 0.15 }}
                    >
                      <span className="sr-only">{agent.name} is typing</span>
                      {[0, 1, 2].map((d) => (
                        <motion.span
                          animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
                          className="size-1.5 rounded-full bg-[var(--hover-fill)] "
                          key={d}
                          transition={{
                            duration: 0.9,
                            delay: d * 0.15,
                            repeat: Number.POSITIVE_INFINITY,
                          }}
                        />
                      ))}
                    </motion.span>
                  ) : (
                    <motion.p
                      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                      className="min-w-0 max-w-[85%] rounded-2xl rounded-bl-md bg-[var(--surface-raised)] px-3.5 py-2 text-[14px] text-[var(--text)] leading-6 ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]   "
                      initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
                      key="reply"
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                    >
                      {shown.reply}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          )}

          {status === "stayed" && (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-[var(--text)] leading-7 "
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              key="stayed"
              transition={{ duration: 0.35, ease: EASE_OUT }}
            >
              Okay, I’ll stay with you. I can’t refund it myself, but I can
              draft the request so it’s ready whenever you want to send it.
            </motion.p>
          )}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {status === "waiting" ? (waitingLabel ?? place(line)) : ""}
          {status === "joined" ? `${agent.name} from ${team} joined` : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

function DrawnCheck({ delay }: { delay: number }) {
  return (
    <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_10%,transparent)] ">
      <svg
        aria-hidden="true"
        className="size-2.5 text-[var(--success)] "
        fill="none"
        viewBox="0 0 16 16"
      >
        <motion.path
          animate={{ pathLength: 1, opacity: 1 }}
          d="M3.5 8.5l3 3 6-7"
          initial={{ pathLength: 0, opacity: 0 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
          transition={{ duration: 0.3, ease: EASE_OUT, delay }}
        />
      </svg>
    </span>
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
      <div className="p-1" ref={innerRef}>
        {children}
      </div>
    </motion.div>
  );
}
