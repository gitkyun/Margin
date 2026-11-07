import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import "./material-upload-field.css";

// Aceternity File Upload's grid/lifted-file pattern, adapted to RMS's real
// upload transaction. Progress and linking states are supplied by the caller.
export function MaterialUploadField({
  file,
  busy,
  progress,
  pending,
  onSelect,
  onClear,
  onAbort,
}: {
  file: File | null;
  busy: boolean;
  progress: number | null;
  pending: boolean;
  onSelect: (file: File | undefined) => void;
  onClear: () => void;
  onAbort: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const reduced = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  const transferring = busy && progress !== null && progress < 100;
  const connecting = busy && (progress === 100 || pending);
  const percentage = Math.min(100, Math.max(0, progress ?? 0));
  const fileSize = file
    ? file.size >= 1048576
      ? `${(file.size / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`
    : "";
  return (
    <div className="mu-field">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy || pending}
        hidden
        onChange={(e) => {
          onSelect(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <motion.button
        type="button"
        className={`mu-dropzone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
        disabled={busy || pending}
        aria-describedby={hintId}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy && !pending) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy && !pending) onSelect(e.dataTransfer.files[0]);
        }}
        whileHover={reduced || busy || pending ? undefined : "hover"}
        animate={dragging && !reduced ? "hover" : "rest"}
        initial="rest"
      >
        <span className="mu-grid" aria-hidden="true" />
        <span className="mu-file-stack" aria-hidden="true">
          <motion.span
            className="mu-sheet mu-sheet-back"
            variants={{
              rest: { rotate: -9, y: 1 },
              hover: { rotate: -16, y: -5 },
            }}
          />
          <motion.span
            className="mu-sheet mu-sheet-front"
            variants={{
              rest: { y: 0, rotate: 3 },
              hover: { y: -9, rotate: 0 },
            }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
          >
            <Icon name={file ? "file" : "upload"} size={25} />
          </motion.span>
        </span>
        <strong>
          {file
            ? "파일을 바꾸려면 클릭하거나 끌어 놓으세요"
            : "여기에 PDF를 놓아주세요"}
        </strong>
        <span id={hintId} className="mu-dropzone-hint">
          {file
            ? "등록 전까지 다른 파일로 바꿀 수 있습니다"
            : "또는 클릭해서 파일 선택 · 최대 20 MB"}
        </span>
      </motion.button>
      <AnimatePresence initial={false}>
        {file && (
          <motion.div
            className="mu-file-row"
            key="selected-file"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -5 }}
            transition={{ duration: 0.18 }}
          >
            <span className="mu-pdf-icon" aria-hidden="true">
              <Icon name="file" size={23} />
              <small>PDF</small>
            </span>
            <div className="mu-file-info">
              <strong>{file.name}</strong>
              <div>
                <span>{fileSize}</span>
                <span className="mu-state">
                  {connecting
                    ? "자료 연결 중"
                    : transferring
                      ? "업로드 중"
                      : pending
                        ? "파일 저장 완료 · 연결 대기"
                        : "선택됨"}
                </span>
              </div>
            </div>
            {!busy && !pending && (
              <button
                type="button"
                className="mu-remove"
                aria-label={`${file.name} 선택 해제`}
                title="파일 선택 해제"
                onClick={onClear}
              >
                <Icon name="close" size={17} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {busy && progress !== null && (
        <div className="mu-transfer" role="status" aria-live="polite">
          <div className="mu-transfer-caption">
            <span>
              {connecting
                ? "업로드를 마쳤습니다. 자료에 연결하고 있어요."
                : "파일을 안전하게 올리고 있어요."}
            </span>
            <strong>
              {connecting ? (
                <Icon name="check" size={17} />
              ) : (
                `${Math.round(percentage)}%`
              )}
            </strong>
          </div>
          <progress
            max={100}
            value={percentage}
            aria-label="파일 업로드 진행"
          />
          {transferring && (
            <Button type="button" variant="ghost" size="sm" onClick={onAbort}>
              <Icon name="close" size={14} />
              업로드 중단
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Aceternity Stateful Button pattern, using real request state without timers
// or simulated success. The existing success toast follows a server save.
export function MaterialSubmitLabel({
  busy,
  label,
}: {
  busy: boolean;
  label: string;
}) {
  const reduced = useReducedMotion();
  return (
    <span className="mu-submit-label">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          className="mu-submit-icon"
          key={busy ? "busy" : "ready"}
          initial={reduced ? false : { opacity: 0, scale: 0.65 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduced ? undefined : { opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.12 }}
        >
          {busy ? (
            <span className="mu-spinner" aria-hidden="true" />
          ) : (
            <Icon name="check" size={16} />
          )}
        </motion.span>
      </AnimatePresence>
      {busy ? "저장 중" : label}
    </span>
  );
}
