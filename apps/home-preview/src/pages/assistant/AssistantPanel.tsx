import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PanelFrame } from "@/components/margin-panel/MarginPanel";
import { Icon } from "@/components/icons";
import { StatusBadge, InlineEmpty } from "@/components/common";
import { modeLabels } from "@/lib/experience";
import { formatDateTime, type SavedAICandidate } from "@/lib/domain";
import { t } from "@/lib/i18n";

export type AssistantPanelTab = "suggestions" | "runs";

/** 한 번에 고를 수 있는 근거 수 */
export const MAX_SOURCES = 8;

const RUN_STATE_LABELS: Record<string, string> = {
  running: t("실행 중"),
  complete: t("성공"),
  failed: t("실패"),
  cancelled: t("중단"),
};

interface RunRecord {
  id: string;
  mode: string;
  status: string;
  createdAt: string;
  model?: string | null;
  error?: string | null;
}

export interface AssistantPanelProps {
  tab: AssistantPanelTab;
  onTab(tab: AssistantPanelTab): void;
  onClose(): void;
  pending: SavedAICandidate[];
  onAdopt(candidate: SavedAICandidate): void;
  onDismiss(candidate: SavedAICandidate): void;
  runs: RunRecord[];
  onCancelRun(runId: string): void;
}

/**
 * 연구 도우미 작업대의 여백 패널. 제안(확인할 AI 제안), 기록(실행 내역).
 * 연구 도우미는 이 연구의 기록을 항상 전부 읽으므로 기록을 고르는 탭은 없습니다.
 */
export function AssistantPanel(props: AssistantPanelProps) {
  const { tab, onTab, onClose, pending, runs } = props;
  return (
    <PanelFrame
      className="assistant-panel"
      title={t("연구 도우미")}
      onClose={onClose}
      tab={tab}
      onTab={(value) => onTab(value as AssistantPanelTab)}
      tabs={[
        { value: "suggestions", label: t("제안"), count: pending.length },
        { value: "runs", label: t("실행 내역") },
      ]}
    >
      {tab === "suggestions" && <SuggestionsTab {...props} />}
      {tab === "runs" && (
        <RunsTab runs={runs} onCancelRun={props.onCancelRun} />
      )}
    </PanelFrame>
  );
}

function SuggestionsTab({ pending, onAdopt, onDismiss }: AssistantPanelProps) {
  return (
    <div className="panel-frame-body">
      <h3>
        {t("확인할 AI 제안")}
        <span className="count-chip">{pending.length}</span>
      </h3>
      {pending.map((item) => (
        <article key={item.id} className="candidate-overview-row">
          <div>
            <StatusBadge>
              {modeLabels[item.mode ?? ""] ?? t("AI 제안")}
            </StatusBadge>
            <h4>{item.title}</h4>
            <p>{item.candidate.body ?? item.candidate.method}</p>
            {item.candidate.sourceQuote && (
              <blockquote>
                <small>{t("원문 인용")}</small>
                {item.candidate.sourceQuote}
              </blockquote>
            )}
            {item.candidate.assumptions && (
              <p className="candidate-assumption">
                {t("확인할 가정: {assumptions}", {
                  assumptions: item.candidate.assumptions,
                })}
              </p>
            )}
          </div>
          <div className="button-row">
            <Button size="sm" variant="ghost" onClick={() => onDismiss(item)}>
              {t("사용하지 않기")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAdopt(item)}>
              {t("선택하기")}
            </Button>
          </div>
          <small className="panel-frame-note">
            {t(
              "선택한 제안만 기록에 남아요. 선택하지 않은 제안은 나만 볼 수 있어요.",
            )}
          </small>
        </article>
      ))}
      {!pending.length && (
        <InlineEmpty variant="panel">
          {t("AI 제안이 나오면 여기에 표시돼요.")}
        </InlineEmpty>
      )}
    </div>
  );
}

function RunsTab({
  runs,
  onCancelRun,
}: Pick<AssistantPanelProps, "runs" | "onCancelRun">) {
  return (
    <div className="panel-frame-body">
      <h3>{t("실행 내역")}</h3>
      {runs.map((run) => (
        <div className="run-row" key={run.id}>
          <Icon
            name={
              run.status === "complete"
                ? "check"
                : run.status === "failed"
                  ? "warning"
                  : "sparkles"
            }
            size={18}
          />
          <div>
            <strong>{modeLabels[run.mode] ?? t("연구 대화")}</strong>
            <small>
              {formatDateTime(run.createdAt)}
              {run.model && ` · ${run.model}`}
            </small>
            {run.error && <p>{run.error}</p>}
          </div>
          <StatusBadge
            tone={
              run.status === "complete"
                ? "green"
                : run.status === "failed"
                  ? "red"
                  : "neutral"
            }
          >
            {RUN_STATE_LABELS[run.status]}
          </StatusBadge>
          {run.status === "running" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCancelRun(run.id)}
            >
              {t("중단")}
            </Button>
          )}
        </div>
      ))}
      {!runs.length && (
        <InlineEmpty variant="panel">
          {t("아직 실행 내역이 없어요.")}
        </InlineEmpty>
      )}
      <p className="panel-frame-note">
        {t("이번 달 사용량은")} <Link to="?settings=usage">{t("설정")}</Link>
        {t("에서 볼 수 있어요.")}
      </p>
    </div>
  );
}
