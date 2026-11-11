import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelFrame } from "@/components/margin-panel/MarginPanel";
import { Icon } from "@/components/icons";
import { StatusBadge } from "@/components/common";
import { modeLabels } from "@/lib/experience";
import {
  formatDateTime,
  type AIContext,
  type SavedAICandidate,
} from "@/lib/domain";
import { t } from "@/lib/i18n";

export type AssistantPanelTab = "sources" | "suggestions" | "runs";

/** 한 번에 고를 수 있는 근거 수 */
export const MAX_SOURCES = 8;

const KIND_LABELS: Record<string, string> = {
  meetings: t("미팅 메모"),
  feedback: t("피드백"),
  documents: t("문서"),
  tasks: t("할 일"),
  phases: t("연구 단계"),
  attachments: t("내 첨부 파일"),
  versions: t("PDF 파일"),
};

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

interface PdfVersion {
  id: string;
  fileName: string;
  number: number;
}

export interface AssistantPanelProps {
  tab: AssistantPanelTab;
  onTab(tab: AssistantPanelTab): void;
  onClose(): void;
  /** 실행·업로드 중에는 근거를 바꾸지 못하게 합니다. */
  busy: boolean;
  /** 미팅 정리는 미팅 메모 하나만 근거로 씁니다. */
  single: boolean;
  contexts: AIContext[];
  sourceOptions: AIContext[];
  onToggleSource(context: AIContext): void;
  onRemoveSource(index: number): void;
  onAttach(): void;
  versions: PdfVersion[];
  page: number;
  onPage(page: number): void;
  onAddPdf(versionId: string): void;
  pending: SavedAICandidate[];
  onAdopt(candidate: SavedAICandidate): void;
  onDismiss(candidate: SavedAICandidate): void;
  runs: RunRecord[];
  onCancelRun(runId: string): void;
}

const sameSource = (a: AIContext, b: AIContext) =>
  a.kind === b.kind && a.id === b.id;

/**
 * 연구 도우미 작업대의 여백 패널. 근거(고른 기록), 제안(확인할 AI 제안), 기록(실행 기록).
 * 근거는 늘 이 패널 위쪽에서 보이고, 같은 자리에서 바꿉니다(모달 없음).
 */
export function AssistantPanel(props: AssistantPanelProps) {
  const { tab, onTab, onClose, contexts, pending, runs } = props;
  return (
    <PanelFrame
      className="assistant-panel"
      title={t("연구 도우미")}
      onClose={onClose}
      tab={tab}
      onTab={(value) => onTab(value as AssistantPanelTab)}
      tabs={[
        { value: "sources", label: t("근거"), count: contexts.length },
        { value: "suggestions", label: t("제안"), count: pending.length },
        { value: "runs", label: t("기록") },
      ]}
    >
      {tab === "sources" && <SourcesTab {...props} />}
      {tab === "suggestions" && <SuggestionsTab {...props} />}
      {tab === "runs" && (
        <RunsTab runs={runs} onCancelRun={props.onCancelRun} />
      )}
    </PanelFrame>
  );
}

function SourcesTab({
  busy,
  single,
  contexts,
  sourceOptions,
  onToggleSource,
  onRemoveSource,
  onAttach,
  versions,
  page,
  onPage,
  onAddPdf,
}: AssistantPanelProps) {
  return (
    <div className="panel-frame-body">
      <h3>
        {t("고른 근거")}
        <span className="count-chip">
          {contexts.length} / {single ? 1 : MAX_SOURCES}
        </span>
      </h3>
      {contexts.length ? (
        <ul className="assistant-sources">
          {contexts.map((context, index) => (
            <li key={`${context.kind}-${context.id}`}>
              <Icon name="file" size={15} />
              <span>
                {context.title}
                {context.page
                  ? ` · ${t("{page}쪽", { page: context.page })}`
                  : ""}
                <small>{KIND_LABELS[context.kind] ?? t("기록")}</small>
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={busy}
                aria-label={t("{title} 근거에서 빼기", {
                  title: context.title,
                })}
                onClick={() => onRemoveSource(index)}
              >
                <Icon name="close" size={13} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet-placeholder">
          {single
            ? t("정리할 미팅 메모를 하나 골라 주세요.")
            : t(
                "아래에서 기록을 고르거나 파일을 첨부해 주세요. 고른 기록만 읽어요.",
              )}
        </p>
      )}
      <div className="source-picker">
        <Button variant="outline" disabled={busy} onClick={onAttach}>
          <Icon name="upload" size={18} />
          {t("PDF·TXT·MD 첨부")}
        </Button>
        <h3>{t("연구 기록")}</h3>
        {sourceOptions.map((option) => {
          const selected = contexts.some((c) => sameSource(c, option));
          return (
            <button
              type="button"
              key={`${option.kind}-${option.id}`}
              disabled={busy}
              aria-pressed={selected}
              onClick={() => onToggleSource(option)}
            >
              <Icon name="file" size={17} />
              <span>
                {option.title}
                <small>{KIND_LABELS[option.kind]}</small>
              </span>
              <Icon name={selected ? "check" : "plus"} size={16} />
            </button>
          );
        })}
        {!sourceOptions.length && (
          <p className="quiet-placeholder">
            {t("아직 고를 수 있는 연구 기록이 없어요.")}
          </p>
        )}
        {!!versions.length && (
          <>
            <h3>{t("PDF 파일")}</h3>
            <label className="field">
              {t("읽을 페이지")}
              <Input
                type="number"
                min={1}
                max={1000}
                value={page}
                onChange={(e) => onPage(Number(e.target.value))}
              />
            </label>
            {versions.map((version) => (
              <button
                type="button"
                key={version.id}
                disabled={busy}
                onClick={() => onAddPdf(version.id)}
              >
                <Icon name="file" size={17} />
                <span>
                  {version.fileName}
                  <small>
                    v{version.number} · {t("{page}쪽", { page })}
                  </small>
                </span>
                <Icon name="plus" size={16} />
              </button>
            ))}
          </>
        )}
      </div>
    </div>
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
            <span className="rms-pill">
              {modeLabels[item.mode ?? ""] ?? t("AI 제안")}
            </span>
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
        <p className="quiet-placeholder">
          {t("AI 제안이 나오면 여기에 표시돼요.")}
        </p>
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
      <h3>{t("실행 기록")}</h3>
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
        <p className="quiet-placeholder">{t("아직 실행 기록이 없어요.")}</p>
      )}
      <p className="panel-frame-note">
        {t("이번 달 사용량은")}{" "}
        <Link to="/account?tab=usage">{t("계정 설정")}</Link>
        {t("에서 볼 수 있어요.")}
      </p>
    </div>
  );
}
