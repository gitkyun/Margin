import { dateLocale, t } from "@/lib/i18n";
import type { MeetingPoll } from "@/lib/domain";
import { timeParts } from "@/lib/time-format";
import AISchedule, {
  type ScheduleSlot,
} from "@/components/kokonut/ai-schedule";

export interface AvailabilityGridProps {
  poll: MeetingPoll;
  available: readonly string[];
  editable: boolean;
  onToggle(optionId: string, next: boolean): void;
  describedBy?: string;
}

/** Kokonut AI Schedule 원본 카드에 실제 후보·참여자 응답을 연결합니다. */
export function AvailabilityGrid({
  poll,
  available,
  editable,
  onToggle,
  describedBy,
}: AvailabilityGridProps) {
  const total = poll.participants.length;
  const slots: ScheduleSlot[] = poll.options.map((option) => {
    const start = new Date(option.start),
      end = new Date(option.end);
    const at: [number, number] = [
      start.getHours() + start.getMinutes() / 60,
      end.getHours() + end.getMinutes() / 60,
    ];
    const count = poll.participants.filter((person) =>
      person.available.includes(option.id),
    ).length;
    return {
      id: option.id,
      weekday: start.toLocaleDateString(dateLocale(), { weekday: "short" }),
      month: start.toLocaleDateString(dateLocale(), { month: "short" }),
      day: start.getDate(),
      time: `${start.toLocaleTimeString(dateLocale(), timeParts())} – ${end.toLocaleTimeString(dateLocale(), timeParts())}`,
      at,
      you: available.includes(option.id) ? [] : [at],
      them: count === total ? [] : [at],
      note: t("{count}/{total}명 가능", { count, total }),
    };
  });
  if (!slots.length) return null;
  return (
    <div aria-describedby={describedBy}>
      <AISchedule
        key={`${poll.id}:${poll.selectedOptionId ?? ""}`}
        slots={slots}
        title={poll.title}
        duration={t("시간 조율")}
        timezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
        with={{
          name: t("참여자 {count}명", { count: total }),
          initials: String(total),
        }}
        me={{ name: t("내 선택"), initials: t("나") }}
        confirmedSlotId={poll.selectedOptionId ?? undefined}
        availability={{ ids: available, disabled: !editable, onToggle }}
      />
    </div>
  );
}
