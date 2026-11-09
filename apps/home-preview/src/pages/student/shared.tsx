import { Segments } from "@/components/experience";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TextField, TextFieldContent } from "@montage-ui/core";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/icons";
import { useNavigationGuard } from "@/lib/navigation-guard";

function readDraftFields(root: HTMLDivElement) {
  return (
    JSON.stringify(
      [
        ...root.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input, textarea, select"),
      ].map((field) => {
        if (
          field instanceof HTMLInputElement &&
          ["checkbox", "radio"].includes(field.type)
        )
          return [field.type, field.value, field.checked];
        if (field instanceof HTMLInputElement && field.type === "file")
          return [
            field.type,
            [...(field.files ?? [])].map((file) => [
              file.name,
              file.size,
              file.lastModified,
            ]),
          ];
        return [field.tagName, field.name, field.value];
      }),
    ) +
    JSON.stringify(
      [...root.querySelectorAll("[data-draft-value]")].map((field) =>
        field.getAttribute("data-draft-value"),
      ),
    )
  );
}

function FormNavigationGuard({
  active,
  busy,
  label,
  onDiscard,
  children,
  onDirtyChange,
  onCancel,
}: {
  onDirtyChange?(dirty: boolean): void;
  onCancel?(): void;
  active: boolean;
  busy: boolean;
  label: string;
  onDiscard(): void;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const baseline = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const bind = useCallback((node: HTMLDivElement | null) => {
    root.current = node;
    if (node && baseline.current === null)
      baseline.current = readDraftFields(node);
  }, []);
  useEffect(() => {
    if (!active) {
      baseline.current = null;
      setDirty(false);
    } else if (root.current && baseline.current === null) {
      baseline.current = readDraftFields(root.current);
      setDirty(false);
    }
  }, [active]);
  useNavigationGuard({
    dirty: active && dirty,
    busy: active && busy,
    label,
    onDiscard: () => {
      setDirty(false);
      onDiscard();
    },
  });
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  function check() {
    if (root.current && baseline.current !== null)
      setDirty(readDraftFields(root.current) !== baseline.current);
  }
  useEffect(() => {
    if (!active || !root.current) return;
    const observer = new MutationObserver(check);
    observer.observe(root.current, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-draft-value"],
    });
    return () => observer.disconnect();
  }, [active]);
  return (
    <div
      ref={bind}
      onInputCapture={check}
      onChangeCapture={check}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        const button = target.closest("button");
        if (button?.textContent?.trim() === "취소" && onCancel) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        } else queueMicrotask(check);
      }}
    >
      {children}
    </div>
  );
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  busy = false,
  children,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => {
    if (!open) {
      setDirty(false);
      setDiscardOpen(false);
    }
  }, [open]);
  function requestClose(nextOpen: boolean) {
    if (busy) return;
    if (!nextOpen && dirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  }
  return (
    <>
      {" "}
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogContent
          className="student-dialog"
          showCloseButton={!busy}
          aria-busy={busy}
          onEscapeKeyDown={(event: { preventDefault(): void }) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event: { preventDefault(): void }) => {
            if (busy) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {description ?? "내용을 확인하고 저장하세요."}
            </DialogDescription>
          </DialogHeader>
          <FormNavigationGuard
            active={open}
            busy={busy}
            label={title}
            onDiscard={() => onOpenChange(false)}
            onDirtyChange={setDirty}
            onCancel={() => requestClose(false)}
          >
            {children}
          </FormNavigationGuard>
        </DialogContent>
      </Dialog>
      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="student-dialog">
          <DialogHeader>
            <DialogTitle>저장하지 않고 닫을까요?</DialogTitle>
            <DialogDescription>입력한 내용은 사라져요.</DialogDescription>
          </DialogHeader>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              계속 작성
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDirty(false);
                setDiscardOpen(false);
                onOpenChange(false);
              }}
            >
              버리고 닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function LabeledInput({
  label,
  required,
  hint,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-name">
        {label}
        {required && <span className="required-mark"> *</span>}
      </span>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
      />
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
export function LabeledText({
  label,
  required,
  hint,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="field">
      <span className="field-name">
        {label}
        {required && <span className="required-mark"> *</span>}
      </span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
      />
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}
/** 목록 범위 필터. 선택지마다 실제로 보일 항목 수를 함께 표시한다. */
export function FilterSegments({
  options,
  value,
  onChange,
  counts,
  label,
}: {
  options: readonly (readonly [string, string])[];
  value: string;
  onChange(value: string): void;
  counts?: Record<string, number>;
  label: string;
}) {
  return (
    <Segments
      value={value}
      onChange={onChange}
      label={label}
      options={options.map(([value, label]) => ({
        value,
        label,
        count: counts?.[value],
      }))}
    />
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "이름으로 찾기",
}: {
  value: string;
  onChange(value: string): void;
  placeholder?: string;
}) {
  return (
    <TextField
      className="student-search"
      // 좁은 화면에서는 줄 전체, 768px 이상에서는 내용 너비(Montage 반응형 속성)
      width="100%"
      sm={{ width: "auto" }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      leadingContent={
        <TextFieldContent variant="icon">
          <Icon name="search" size={17} />
        </TextFieldContent>
      }
    />
  );
}
export function BackLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="student-back" to={to}>
      <Icon name="arrow-left" size={16} />
      {children}
    </Link>
  );
}
export function ErrorNotice({ error }: { error: string | null }) {
  return error ? (
    <div className="student-error" role="alert">
      <Icon name="warning" size={17} />
      <span>{error}</span>
    </div>
  ) : null;
}
export function useSaving() {
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  async function perform(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "저장하지 못했어요. 입력한 내용은 그대로 있어요.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return { saving, error, setError, perform };
}
export function SaveActions({
  saving,
  onCancel,
  label = "저장",
}: {
  saving: boolean;
  onCancel(): void;
  label?: string;
}) {
  return (
    <div className="form-actions">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving}
      >
        취소
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? "저장 중" : label}
      </Button>
    </div>
  );
}
export function LinkChip({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link className="student-link-chip" to={to}>
      {children}
      <Icon name="arrow-up-right" size={13} />
    </Link>
  );
}

export function WorkTabs({
  researchId,
  selected,
}: {
  researchId: string;
  selected: "feedback" | "tasks" | "results";
}) {
  return (
    <nav className="work-tabs" aria-label="피드백과 할 일">
      <Link
        to={`/r/${researchId}/feedback`}
        aria-current={selected === "feedback" ? "page" : undefined}
      >
        피드백
      </Link>
      <Link
        to={`/r/${researchId}/tasks`}
        aria-current={selected === "tasks" ? "page" : undefined}
      >
        할 일
      </Link>
      <Link
        to={`/r/${researchId}/results`}
        aria-current={selected === "results" ? "page" : undefined}
      >
        수정 결과
      </Link>
    </nav>
  );
}
