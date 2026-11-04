import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icons";
import { useWorkspace } from "@/lib/workspace";
import {
  recordBase,
  type AICandidate,
  type AIInput,
  type BaseRecord,
} from "@/lib/domain";
import { ErrorNotice } from "./shared";

// Closing only hides the panel: generation keeps running and candidates stay
// until the student stops generation or the source changes.
export function AIWorkbench({
  title,
  input,
  hidden = false,
  stale = false,
  onClose,
  onRefresh,
  onSave,
}: {
  title: string;
  input: AIInput;
  hidden?: boolean;
  stale?: boolean;
  onClose(): void;
  onRefresh(): void;
  onSave(candidate: AICandidate, base: BaseRecord): Promise<void>;
}) {
  const { runAI, mode } = useWorkspace();
  const [running, setRunning] = useState(false);
  const [candidates, setCandidates] = useState<AICandidate[]>([]);
  const [saved, setSaved] = useState<number[]>([]);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const candidateBases = useRef<BaseRecord[]>([]);
  const savingRef = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
      controller.current?.abort();
    },
    [],
  );
  async function generate() {
    if (running || savingRef.current) return;
    const current = ++sequence.current;
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setError(null);
    try {
      const result = await runAI(input, abort.signal);
      if (current !== sequence.current) return;
      candidateBases.current = result.candidates.map(() =>
        recordBase(input.researchId),
      );
      setCandidates(result.candidates);
      setSaved([]);
      setModel(result.model);
    } catch (e) {
      if (current === sequence.current && !abort.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "제안을 불러오지 못했습니다. 직접 작성하거나 다시 시도하세요.",
        );
    } finally {
      if (current === sequence.current) setRunning(false);
    }
  }
  function cancel() {
    sequence.current++;
    controller.current?.abort();
    setRunning(false);
    setError("생성을 중단했습니다. 작성한 기록은 바뀌지 않았습니다.");
  }
  function edit(index: number, change: Partial<AICandidate>) {
    setCandidates((items) =>
      items.map((item, i) => (i === index ? { ...item, ...change } : item)),
    );
  }
  async function saveCandidate(candidate: AICandidate, index: number) {
    if (savingRef.current || saved.includes(index)) return;
    if (stale) {
      setError(
        "AI를 실행한 뒤 원문이 바뀌었습니다. 현재 원문으로 다시 제안받아 주세요.",
      );
      return;
    }
    if (
      !candidate.title.trim() ||
      !(candidate.method ?? candidate.body ?? "").trim()
    ) {
      setError("제목과 내용을 입력하세요.");
      return;
    }
    savingRef.current = true;
    setSaving(index);
    setError(null);
    try {
      await onSave(candidate, candidateBases.current[index]);
      setSaved((ids) => [...ids, index]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  }
  return (
    <aside className="ai-workbench" aria-label={title} hidden={hidden}>
      <div className="ai-workbench-heading">
        <div className="ai-workbench-title">
          <Icon name="sparkles" size={18} />
          <h3>{title}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="AI 영역 닫기"
          disabled={saving !== null}
          onClick={onClose}
        >
          <Icon name="close" size={17} />
        </Button>
      </div>
      <div className="ai-scope">
        <span>사용할 범위</span>
        <strong>
          {input.mode === "organize_meeting"
            ? "이 미팅에 저장된 원문 메모"
            : "선택한 피드백과 연결된 원문"}
        </strong>
        <small>
          {input.sourceText.length.toLocaleString()}자
          {input.sourceRevision ? ` · 원문 v${input.sourceRevision}` : ""}
        </small>
      </div>
      <p className="ai-disclosure">
        원문과 AI가 제안한 내용을 구분해 확인한 뒤 필요한 항목만 저장하세요.
      </p>
      {mode === "preview" && (
        <p className="student-inline-note">
          현재는 로컬 미리보기입니다. AI는 서버 연결 후 실행할 수 있습니다.
        </p>
      )}
      {stale && (
        <p className="student-inline-note" role="status">
          AI를 실행한 뒤 원문이 바뀌었습니다. 아래 후보는 이전 원문 기준이라
          저장할 수 없습니다.
        </p>
      )}
      <div className="button-row">
        {running ? (
          <Button variant="outline" onClick={cancel}>
            생성 중단
          </Button>
        ) : stale ? (
          <Button onClick={onRefresh} disabled={saving !== null}>
            <Icon name="refresh" size={16} />
            현재 원문으로 다시 준비
          </Button>
        ) : (
          <Button
            onClick={generate}
            disabled={saving !== null || !input.sourceText.trim()}
          >
            <Icon name="sparkles" size={16} />
            {candidates.length ? "다시 제안받기" : "제안받기"}
          </Button>
        )}
      </div>
      {running && (
        <div className="ai-running" role="status">
          <span className="ai-dot-matrix" aria-hidden="true">
            {Array.from({ length: 25 }, (_, i) => (
              <i key={i} style={{ animationDelay: `${i * 36}ms` }} />
            ))}
          </span>
          <span>
            선택한 내용을 읽고 정리하고 있습니다.
            <small>완료되기 전에는 원문과 작업이 바뀌지 않습니다.</small>
          </span>
        </div>
      )}
      <ErrorNotice error={error} />
      {candidates.length > 0 && (
        <div className="ai-candidate-list">
          {candidates.map((candidate, index) => (
            <section
              className={`ai-candidate ${saved.includes(index) ? "is-saved" : ""}`}
              key={index}
            >
              <div className="ai-candidate-number">
                {input.mode === "organize_meeting" ? "정리 항목" : "수정 방안"}{" "}
                {index + 1}
                {saved.includes(index) && <span>저장됨</span>}
              </div>
              {input.mode === "organize_meeting" && (
                <label className="field">
                  <span className="field-name">종류</span>
                  <select
                    className="native-select"
                    value={candidate.category ?? "feedback"}
                    onChange={(e) =>
                      edit(index, {
                        category: e.target.value as AICandidate["category"],
                      })
                    }
                    disabled={saving !== null || saved.includes(index)}
                  >
                    <option value="feedback">피드백</option>
                    <option value="decision">결정 사항</option>
                    <option value="question">질문</option>
                  </select>
                </label>
              )}
              <label className="field">
                <span className="field-name">제목</span>
                <Input
                  aria-label={`${index + 1}번 후보 제목`}
                  value={candidate.title}
                  onChange={(e) => edit(index, { title: e.target.value })}
                  disabled={saving !== null || saved.includes(index)}
                />
              </label>
              {candidate.sourceQuote && (
                <blockquote className="source-excerpt">
                  <small>원문에서 확인한 내용</small>
                  {candidate.sourceQuote}
                </blockquote>
              )}
              <label className="field">
                <span className="field-name">
                  {input.mode === "organize_meeting"
                    ? "정리한 내용"
                    : "제안하는 수정 방법"}
                </span>
                <Textarea
                  aria-label={`${index + 1}번 후보 내용`}
                  value={candidate.method ?? candidate.body ?? ""}
                  onChange={(e) =>
                    edit(
                      index,
                      input.mode === "organize_meeting"
                        ? { body: e.target.value }
                        : { method: e.target.value },
                    )
                  }
                  disabled={saving !== null || saved.includes(index)}
                  rows={4}
                />
              </label>
              {input.mode === "suggest_revisions" && (
                <>
                  <label className="field">
                    <span className="field-name">예상 결과</span>
                    <Textarea
                      value={candidate.expectedResult ?? ""}
                      onChange={(e) =>
                        edit(index, { expectedResult: e.target.value })
                      }
                      disabled={saving !== null || saved.includes(index)}
                      rows={2}
                    />
                  </label>
                  <label className="field">
                    <span className="field-name">필요한 자료·추가 작업</span>
                    <Textarea
                      value={candidate.requiredMaterials ?? ""}
                      onChange={(e) =>
                        edit(index, { requiredMaterials: e.target.value })
                      }
                      disabled={saving !== null || saved.includes(index)}
                      rows={2}
                    />
                  </label>
                </>
              )}
              {candidate.assumptions && (
                <div className="ai-assumption">
                  <small>확인이 필요한 가정</small>
                  <p>{candidate.assumptions}</p>
                </div>
              )}
              <Button
                variant="outline"
                disabled={saving !== null || saved.includes(index) || stale}
                onClick={() => saveCandidate(candidate, index)}
              >
                {saved.includes(index) ? (
                  <>
                    <Icon name="check" size={15} />
                    저장됨
                  </>
                ) : saving === index ? (
                  "저장 중…"
                ) : input.mode === "organize_meeting" ? (
                  "이 항목 저장"
                ) : (
                  "수정 방안 저장"
                )}
              </Button>
            </section>
          ))}
        </div>
      )}
      {model && <p className="meta ai-model">실제 API 응답 · {model}</p>}
    </aside>
  );
}
