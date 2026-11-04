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
  return JSON.stringify(
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
  );
}

function FormNavigationGuard({
  active,
  busy,
  label,
  onDiscard,
  children,
}: {
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
  function check() {
    if (root.current && baseline.current !== null)
      setDirty(readDraftFields(root.current) !== baseline.current);
  }
  return (
    <div
      ref={bind}
      onInputCapture={check}
      onChangeCapture={check}
      onClickCapture={() => queueMicrotask(check)}
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
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen: boolean) => {
        if (!busy) onOpenChange(nextOpen);
      }}
    >
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
        >
          {children}
        </FormNavigationGuard>
      </DialogContent>
    </Dialog>
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
    <div className="student-search">
      <Icon name="search" size={17} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
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
          : "저장하지 못했습니다. 입력한 내용은 남아 있습니다.",
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
        {saving ? "저장 중…" : label}
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
