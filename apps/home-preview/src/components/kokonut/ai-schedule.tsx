"use client";

/**
 * @author: @kokonutui
 * @description: AI Schedule
 * @version: 1.1.0
 * @date: 2026-11-05
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { Globe, Video } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

/** A span of hours in the day, e.g. [9.5, 11] for 9:30 to 11:00. */
type Span = [number, number];

export interface ScheduleSlot {
  id: string;
  weekday: string;
  month: string;
  day: number;
  /** As shown, e.g. "10:00 – 10:30". */
  time: string;
  /** The slot itself, in hours. */
  at: Span;
  /** Your busy blocks that day. */
  you: Span[];
  /** Their busy blocks that day. */
  them: Span[];
  note?: string;
}

export interface SchedulePerson {
  name: string;
  initials: string;
}

export interface AIScheduleProps {
  /** The user's message, drawn as a bubble. Only the demo draws one by default. */
  prompt?: string;
  /** What the assistant says above the times. */
  message?: string;
  /** What it says once booked, from the slot that was booked. */
  confirmation?: (slot: ScheduleSlot) => ReactNode;
  /** The event's name, on each slot. */
  title?: string;
  duration?: string;
  timezone?: string;
  with?: SchedulePerson;
  me?: SchedulePerson;
  /** The free times, usually a tool's output. Leave it out for the demo. */
  slots?: ScheduleSlot[];
  /**
   * Books the slot. Resolve once the invite is out. Throw and the times come
   * back with the error's message, e.g. when the slot was just taken.
   */
  onBook?: (slot: ScheduleSlot) => Promise<void>;
  className?: string;
  availability?: {
    ids: readonly string[];
    disabled: boolean;
    onToggle(id: string, next: boolean): void;
  };
  confirmedSlotId?: string;
}

type Status = "pick" | "booking" | "booked";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** The day strip runs from 8:00 to 18:00. */
const DAY_START = 8;
const DAY_HOURS = 10;

const DEMO_SLOTS: ScheduleSlot[] = [
  {
    id: "tue",
    weekday: "Tue",
    month: "Nov",
    day: 11,
    time: "10:00 – 10:30",
    at: [10, 10.5],
    you: [
      [8.5, 9.5],
      [13, 14.5],
    ],
    them: [
      [9, 10],
      [11, 12],
      [15, 16],
    ],
    note: "Before her 11:00",
  },
  {
    id: "wed",
    weekday: "Wed",
    month: "Nov",
    day: 12,
    time: "14:30 – 15:00",
    at: [14.5, 15],
    you: [
      [9, 11],
      [15.5, 17],
    ],
    them: [
      [10, 12.5],
      [13, 14.5],
    ],
  },
  {
    id: "thu",
    weekday: "Thu",
    month: "Nov",
    day: 13,
    time: "16:00 – 16:30",
    at: [16, 16.5],
    you: [
      [10, 12],
      [14, 16],
    ],
    them: [
      [8.5, 9.5],
      [12, 15.5],
    ],
    note: "End of day for both",
  },
];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const DEMO_TEXT = {
  prompt: "Find 30 minutes with Priya next week for the roadmap",
  message:
    "You’re both free at these times. Pick one and I’ll send the invite.",
  confirmation: (slot: ScheduleSlot) =>
    `Booked for ${slot.weekday} at ${slot.time.split(" ")[0]}. Priya has the invite with a video link, and I put the roadmap doc in the notes.`,
};

/** The chat text around the card: the demo's only when it's the demo. */
function shownText(
  text: Pick<AIScheduleProps, "prompt" | "message" | "confirmation">,
  isDemo: boolean,
) {
  if (!isDemo) {
    return text;
  }
  return {
    prompt: text.prompt ?? DEMO_TEXT.prompt,
    message: text.message ?? DEMO_TEXT.message,
    confirmation: text.confirmation ?? DEMO_TEXT.confirmation,
  };
}

const reasonOf = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Couldn’t book it. Try again.";

export default function AISchedule({
  prompt,
  message,
  confirmation,
  title = "Roadmap sync",
  duration = "30 min",
  timezone = "CET",
  with: guest = { name: "Priya Shah", initials: "PS" },
  me = { name: "You", initials: "M" },
  slots: slotsProp,
  onBook = () => wait(900),
  className,
  availability,
  confirmedSlotId,
}: AIScheduleProps) {
  const slots = slotsProp ?? DEMO_SLOTS;
  const shown = shownText(
    { prompt, message, confirmation },
    slotsProp === undefined,
  );
  const name = useId();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState(confirmedSlotId ?? slots[0]?.id);
  const [status, setStatus] = useState<Status>(
    confirmedSlotId ? "booked" : "pick",
  );
  const slot = slots.find((s) => s.id === selected) ?? slots[0];
  const first = guest.name.split(" ")[0];
  const visible = status === "booked" ? [slot] : slots;

  const book = async () => {
    setStatus("booking");
    setError(undefined);
    try {
      await onBook(slot);
      setStatus("booked");
    } catch (e) {
      setError(reasonOf(e));
      setStatus("pick");
    }
  };

  const select = (id: string) => {
    setSelected(id);
    setError(undefined);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn("flex w-full max-w-md flex-col gap-4", className)}
        data-state={error ? "error" : status}
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

        <div className="rounded-[22px] bg-[color-mix(in_srgb,var(--text)_4%,transparent)] p-1 ">
          <div className="flex h-8 items-center justify-between px-3 text-[12px] text-[var(--text-tertiary)] ">
            <span className="truncate">
              <span className="font-medium text-[var(--text-secondary)] ">
                {duration}
              </span>{" "}
              · {guest.name}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Globe aria-hidden="true" className="size-3" />
              {timezone}
            </span>
          </div>

          <fieldset
            className="min-w-0 rounded-[18px] bg-[var(--surface-raised)] p-1 shadow-[0_1px_2px_rgb(var(--semantic-foreground-neutral-primary-rgb)/0.04)] ring-1 ring-[color-mix(in_srgb,var(--text)_6%,transparent)]  "
            disabled={status !== "pick" || availability?.disabled}
          >
            <legend className="sr-only">{t("가능한 시간 선택")}</legend>
            <AnimatePresence initial={false}>
              {visible.map((s) => (
                <motion.div
                  animate={{ height: "auto", opacity: 1 }}
                  className="overflow-hidden"
                  exit={{ height: 0, opacity: 0 }}
                  initial={{ height: 0, opacity: 0 }}
                  key={s.id}
                  transition={{ duration: 0.35, ease: EASE_OUT }}
                >
                  <SlotRow
                    booked={status === "booked"}
                    checked={
                      availability
                        ? availability.ids.includes(s.id)
                        : s.id === selected
                    }
                    guest={first}
                    name={name}
                    multiple={!!availability}
                    onSelect={() =>
                      availability
                        ? availability.onToggle(
                            s.id,
                            !availability.ids.includes(s.id),
                          )
                        : select(s.id)
                    }
                    slot={s}
                    title={title}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </fieldset>

          <div className="flex h-12 items-center gap-3 pr-1.5 pl-3">
            <AnimatePresence initial={false} mode="popLayout">
              {status === "booked" ? (
                <motion.span
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-[12.5px] text-[var(--text-secondary)] "
                  initial={{ opacity: 0, filter: "blur(3px)" }}
                  key="sent"
                  transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.2 }}
                >
                  <span className="flex gap-0.5">
                    <Avatar person={me} tone="you" />
                    <Avatar person={guest} tone="them" />
                  </span>
                  <span className="truncate">
                    {t("이 시간으로 확정했어요")}
                  </span>
                  <DrawnCheck />
                </motion.span>
              ) : (
                <Footnote error={error} key={error ? "error" : "legend"} />
              )}
            </AnimatePresence>
            {status !== "booked" && !availability && (
              <BookButton
                busy={status === "booking"}
                label={t("시간 확정")}
                onClick={book}
              />
            )}
          </div>
        </div>

        <AnimatePresence>
          {status === "booked" && shown.confirmation ? (
            <motion.p
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              className="text-[15px] text-[var(--text)] leading-7 "
              initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
              transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.45 }}
            >
              {shown.confirmation(slot)}
            </motion.p>
          ) : null}
        </AnimatePresence>
        <p aria-live="polite" className="sr-only">
          {status === "booking" ? t("확정하는 중") : ""}
          {status === "booked" ? t("시간을 확정했어요") : ""}
        </p>
      </div>
    </MotionConfig>
  );
}

/** The colour key under the times, or why booking failed. */
function Footnote({ error }: { error?: string }) {
  if (error) {
    return (
      <motion.span
        animate={{ opacity: 1 }}
        className="min-w-0 flex-1 truncate text-[12px] text-[var(--danger)] "
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        key="error"
        role="alert"
        title={error}
        transition={{ duration: 0.2 }}
      >
        {error}
      </motion.span>
    );
  }
  return (
    <motion.span
      className="flex min-w-0 flex-1 items-center gap-3 text-[11.5px] text-[var(--text-tertiary)] "
      exit={{ opacity: 0, filter: "blur(3px)" }}
      key="legend"
      transition={{ duration: 0.2 }}
    >
      <Key className="bg-[var(--hover-fill)] " label={t("선택 안 함")} />
      <Key className="bg-[var(--brand)]" label={t("후보 시간")} />
    </motion.span>
  );
}

function SlotRow({
  slot,
  name,
  checked,
  booked,
  title,
  guest,
  onSelect,
  multiple = false,
}: {
  slot: ScheduleSlot;
  guest: string;
  name: string;
  checked: boolean;
  booked: boolean;
  title: string;
  onSelect: () => void;
  multiple?: boolean;
}) {
  return (
    <label
      className={cn(
        "relative block rounded-[14px] p-2.5 transition-colors duration-150 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[color-mix(in_srgb,var(--brand)_40%,transparent)]",
        booked ? "cursor-default" : "cursor-pointer",
        !booked &&
          checked &&
          "bg-[color-mix(in_srgb,var(--surface-muted)_80%,transparent)] ",
        !(booked || checked) && "hover:bg-[var(--surface-muted)] ",
      )}
    >
      <span className="flex items-center gap-3">
        <input
          checked={checked}
          className="sr-only"
          name={name}
          onChange={onSelect}
          type={multiple ? "checkbox" : "radio"}
          value={slot.id}
        />
        <span className="flex w-10 shrink-0 flex-col overflow-hidden rounded-[9px] bg-[var(--surface-raised)] text-center ring-1 ring-[color-mix(in_srgb,var(--text)_8%,transparent)]  ">
          <span className="bg-[var(--danger)] py-px font-semibold text-[8.5px] text-[var(--surface-raised)] uppercase tracking-wider">
            {slot.month}
          </span>
          <span className="py-0.5 font-semibold text-[15px] text-[var(--text)] leading-5 ">
            {slot.day}
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              className="block truncate font-medium text-[13.5px] text-[var(--text)] "
              exit={{ opacity: 0, y: -4, filter: "blur(2px)" }}
              initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
              key={booked ? "title" : "time"}
              transition={{ duration: 0.25, ease: EASE_OUT }}
            >
              {booked ? title : `${slot.weekday} · ${slot.time}`}
            </motion.span>
          </AnimatePresence>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--text-tertiary)] ">
            {booked
              ? `${slot.weekday} · ${slot.time}`
              : (slot.note ?? t("참여자가 고른 시간이에요"))}
          </span>
        </span>

        <AnimatePresence initial={false} mode="popLayout">
          {booked ? (
            <motion.span
              animate={{ opacity: 1, x: 0 }}
              className="flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[var(--selected-fill)] px-2.5 font-medium text-[11.5px] text-[var(--brand)]  "
              initial={{ opacity: 0, x: 6 }}
              key="call"
              transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.15 }}
            >
              <Video aria-hidden="true" className="size-3" />
              {t("확정된 시간")}
            </motion.span>
          ) : (
            <motion.span
              aria-hidden="true"
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-150",
                checked
                  ? "bg-[var(--text)] ring-[var(--line-strong)]  "
                  : "ring-[var(--line-strong)] ",
              )}
              exit={{ opacity: 0 }}
              key="radio"
              transition={{ duration: 0.15 }}
            >
              <motion.span
                animate={{ scale: checked ? 1 : 0.5, opacity: checked ? 1 : 0 }}
                className="size-1.5 rounded-full bg-[var(--surface-raised)] "
                initial={false}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence initial={false}>
        {checked && !booked && (
          <motion.span
            animate={{ height: "auto", opacity: 1 }}
            className="block overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
          >
            <DayLanes guest={guest} slot={slot} />
          </motion.span>
        )}
      </AnimatePresence>
    </label>
  );
}

/** Both calendars for the day, so you can see why the slot is free. */
function DayLanes({ slot, guest }: { slot: ScheduleSlot; guest: string }) {
  const dayStart = Math.min(DAY_START, Math.floor(slot.at[0]));
  const dayHours =
    Math.max(DAY_START + DAY_HOURS, Math.ceil(slot.at[1])) - dayStart;
  const pct = (h: number) => `${((h - dayStart) / dayHours) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / dayHours) * 100}%`;
  const lane = (label: string, spans: Span[]) => (
    <span className="flex h-3 items-center gap-2">
      <span className="w-10 shrink-0 truncate text-[10.5px] text-[var(--text-tertiary)] ">
        {label}
      </span>
      <span className="relative h-1.5 flex-1 rounded-full bg-[var(--surface-muted)] ">
        {spans.map(([a, b]) => (
          <span
            className="absolute inset-y-0 rounded-full bg-[var(--hover-fill)] "
            key={a}
            style={{ left: pct(a), width: width(a, b) }}
          />
        ))}
      </span>
    </span>
  );

  return (
    <span className="mt-2.5 ml-[52px] flex flex-col gap-1.5 pb-0.5">
      <span className="relative flex flex-col gap-1">
        {lane(t("내 선택"), slot.you)}
        {lane(guest, slot.them)}
        <span className="pointer-events-none absolute inset-y-0 right-0 left-12">
          <motion.span
            animate={{ opacity: 1, scaleY: 1 }}
            className="absolute -inset-y-0.5 min-w-1 rounded-[3px] bg-[var(--brand)]"
            initial={{ opacity: 0, scaleY: 0.4 }}
            style={{ left: pct(slot.at[0]), width: width(...slot.at) }}
            transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.15 }}
          />
        </span>
      </span>
      <span className="relative ml-12 h-3 text-[10px] text-[var(--text-tertiary)] tabular-nums leading-3 ">
        {[dayStart + 1, dayStart + dayHours / 2, dayStart + dayHours - 1].map(
          (h) => (
            <span
              className="absolute top-0 -translate-x-1/2"
              key={h}
              style={{ left: pct(h) }}
            >
              {`${h}:00`}
            </span>
          ),
        )}
      </span>
    </span>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn("h-1 w-2.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function Avatar({
  person,
  tone,
}: {
  person: SchedulePerson;
  tone: "you" | "them";
}) {
  return (
    <span
      className={cn(
        "flex size-6 items-center justify-center rounded-full font-semibold text-[9.5px]",
        tone === "you"
          ? "bg-[var(--text)] text-[var(--surface-raised)]  "
          : "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]",
      )}
      title={person.name}
    >
      {person.initials}
    </span>
  );
}

function DrawnCheck() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0 text-[var(--success)] "
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
        strokeWidth="2"
        transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.45 }}
      />
    </svg>
  );
}

function BookButton({
  busy,
  label,
  onClick,
}: {
  busy: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-9 min-w-[96px] items-center justify-center rounded-full bg-[var(--text)] px-4 font-medium text-[13px] text-[var(--surface-raised)] outline-hidden transition-colors duration-150 hover:bg-[var(--text)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--brand)_50%,transparent)] focus-visible:ring-offset-2 active:bg-[var(--hover-fill)] disabled:cursor-default    dark:focus-visible:ring-offset-zinc-900 "
      disabled={busy}
      onClick={onClick}
      type="button"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          className="flex items-center"
          exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
          initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
          key={busy ? "busy" : label}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {busy ? <Spinner /> : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className="size-4"
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
        opacity="0.25"
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
