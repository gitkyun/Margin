import { t } from "@/lib/i18n";
import { clockText } from "@/lib/recording-timeline";

export interface SyncedTranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  /** 아직 확정되지 않은 문장 */
  pending?: boolean;
  /** 인식이 불확실한 문장 */
  unsure?: boolean;
}

interface SyncedTranscriptProps {
  segments: SyncedTranscriptSegment[];
  currentMs: number;
  onSeek: (startMs: number) => void;
}

/**
 * 오디오 재생 위치와 동기화되는 전사본(Kokonut UI Synced Transcript 패턴).
 * 현재 재생 중인 구간을 강조하고, 문장을 누르면 해당 시점으로 바로 이동해요.
 */
export function SyncedTranscript({
  segments,
  currentMs,
  onSeek,
}: SyncedTranscriptProps) {
  if (!segments.length) return null;
  return (
    <div
      className="synced-transcript"
      role="region"
      aria-label={t("재생 동기화 전사문")}
    >
      {segments.map((seg, idx) => {
        const active =
          currentMs >= seg.startMs &&
          currentMs < Math.max(seg.endMs, seg.startMs + 500);
        return (
          <button
            key={`${seg.startMs}-${idx}`}
            type="button"
            className={`synced-transcript-line${active ? " is-active" : ""}`}
            onClick={() => onSeek(seg.startMs)}
          >
            <span className="synced-transcript-time">
              {clockText(seg.startMs)}
            </span>
            <span
              className={`synced-transcript-text${seg.unsure ? " speech-uncertain" : ""}`}
              title={seg.unsure ? t("인식이 불확실해요") : undefined}
            >
              {seg.pending && `${t("미확정")} · `}
              {seg.text}
            </span>
            {seg.unsure && (
              <span className="sr-only"> ({t("인식이 불확실해요")})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
