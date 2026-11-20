import { useState } from "react";
import { Switch } from "@montage-ui/core";
import { Choice } from "@/components/experience";
import { TimeField } from "@/components/ui/date-field";
import { formatDate } from "@/lib/domain";
import { t } from "@/lib/i18n";
import {
  CADENCE_EVERY,
  CADENCE_WEEKDAYS,
  everyLabel,
  weekdayName,
  nextCadenceDate,
  readCadence,
  type MeetingCadence,
} from "@/lib/recurrence";
import { formatClock } from "@/lib/time-format";
import { friendlyError } from "@/lib/supabase";
import { useWorkspace } from "@/lib/workspace";
import "./meeting-cadence.css";

const DEFAULT_CADENCE: MeetingCadence = { weekday: 3, time: "14:00", every: 1 };

/**
 * 설정 › 이 연구 › 미팅 주기(IA v2 07 §1.3). 바꾸면 바로 연구에 저장하고,
 * '다음 미팅 잡기'를 열 때 날짜·시각을 미리 채우는 데만 씁니다.
 */
export function MeetingCadenceSection({ researchId }: { researchId?: string }) {
  const { data, saveResearch } = useWorkspace();
  const research = data.researches.find((r) => r.id === researchId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!research) return null;
  const cadence = readCadence(research.meetingCadence);
  const readOnly = !!research.archivedAt;

  async function save(next: MeetingCadence | null) {
    if (!research) return;
    setBusy(true);
    setError("");
    try {
      const { meetingCadence: _drop, ...rest } = research;
      await saveResearch(next ? { ...rest, meetingCadence: next } : rest);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const change = (patch: Partial<MeetingCadence>) =>
    cadence && void save({ ...cadence, ...patch });

  const next =
    cadence &&
    nextCadenceDate(
      cadence,
      data.meetings.filter((m) => m.researchId === research.id),
    );
  return (
    <section className="settings-section meeting-cadence">
      <h2>{t("미팅 주기")}</h2>
      <p>
        {t(
          "‘다음 미팅 잡기’를 열 때 날짜를 미리 채워요. 미팅을 자동으로 만들지 않아요.",
        )}
      </p>
      {error && (
        <p className="rms-error" role="alert">
          {error}
        </p>
      )}
      {readOnly && <p>{t("보관한 연구는 미팅 주기를 바꿀 수 없어요.")}</p>}
      <div className="preferences-list">
        <label>
          <span>{t("정해진 미팅 요일이 있어요")}</span>
          <Switch
            checked={!!cadence}
            disabled={busy || readOnly}
            onCheckedChange={(on: boolean) =>
              void save(on ? DEFAULT_CADENCE : null)
            }
          />
        </label>
      </div>
      {cadence && (
        <div className="meeting-cadence-fields">
          <div className="meeting-cadence-field">
            <span aria-hidden>{t("요일")}</span>
            <Choice
              label={t("요일")}
              value={String(cadence.weekday)}
              disabled={busy || readOnly}
              options={CADENCE_WEEKDAYS.map((day) => ({
                value: String(day),
                label: weekdayName(day),
              }))}
              onChange={(value) => change({ weekday: Number(value) })}
            />
          </div>
          <div className="meeting-cadence-field">
            <span aria-hidden>{t("시각")}</span>
            <TimeField
              aria-label={t("시각")}
              value={cadence.time}
              disabled={busy || readOnly}
              onChange={(time) => time && change({ time })}
            />
          </div>
          <div className="meeting-cadence-field">
            <span aria-hidden>{t("간격")}</span>
            <Choice
              label={t("간격")}
              value={String(cadence.every)}
              disabled={busy || readOnly}
              options={CADENCE_EVERY.map((every) => ({
                value: String(every),
                label: everyLabel(every),
              }))}
              onChange={(value) => change({ every: Number(value) })}
            />
          </div>
        </div>
      )}
      {cadence && next && (
        <p className="meeting-cadence-next" aria-live="polite">
          {t("다음 차례: {date} {time}", {
            date: formatDate(next),
            time: formatClock(cadence.time),
          })}
        </p>
      )}
    </section>
  );
}
