import { t } from "@/lib/i18n";
import { Segments, SelectField } from "@/components/experience";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Tabs } from "@/components/ui/tabs";
import { useWorkspace } from "@/lib/workspace";
import { unreadReviewNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, TimeField } from "@/components/ui/date-field";
import { TextField, TextFieldContent } from "@montage-ui/core";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      // 배치에 끼지 않는 감싸개입니다(styles.css "대화상자 틀"). 폼이 틀의 세로 배치를 그대로 받습니다.
      className="margin-dialog-guard"
      ref={bind}
      onInputCapture={check}
      onChangeCapture={check}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement;
        const button = target.closest("button");
        if (button?.textContent?.trim() === t("취소") && onCancel) {
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
          disableEscapeKeyDownClose={busy}
          disableOutsideClickClose={busy}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {/* 알려 줄 것이 없으면 설명 줄을 비워 둡니다. 기본 문장을 채우지 않아요. */}
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
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
            <DialogTitle>{t("저장하지 않고 닫을까요?")}</DialogTitle>
            <DialogDescription>
              {t("입력한 내용은 사라져요.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              {t("계속 작성")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDirty(false);
                setDiscardOpen(false);
                onOpenChange(false);
              }}
            >
              {t("버리고 닫기")}
            </Button>
          </DialogFooter>
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
  error,
  inputRef,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  /** 칸 바로 아래에 보여 줄 오류. 입력에 aria-invalid·aria-describedby를 붙여요. */
  error?: string;
  /** 저장을 막았을 때 화면이 포커스를 옮길 입력 */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const errorId = useId();
  return (
    <label className="field">
      <span className="field-name">
        {label}
        {required && <span className="required-mark"> *</span>}
      </span>
      {type === "date" ? (
        <DateField
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
        />
      ) : type === "time" ? (
        <TimeField
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
        />
      ) : (
        <Input
          ref={inputRef}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      )}
      {error && (
        <small id={errorId} className="field-error" role="alert">
          {error}
        </small>
      )}
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
  error,
  textareaRef,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  rows?: number;
  /** 칸 바로 아래에 보여 줄 오류. 입력에 aria-invalid·aria-describedby를 붙여요(흔들림). */
  error?: string;
  /** 저장을 막았을 때 화면이 포커스를 옮길 입력 */
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const errorId = useId();
  return (
    <label className="field">
      <span className="field-name">
        {label}
        {required && <span className="required-mark"> *</span>}
      </span>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <small id={errorId} className="field-error" role="alert">
          {error}
        </small>
      )}
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
  const segments = (
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
  // 항목이 5개 이상이면 767px 이하에서는 선택 상자로 보여 줍니다(배치 규칙 2-3).
  if (options.length < 5) return segments;
  return (
    <>
      <div className="filter-wide">{segments}</div>
      <div className="filter-narrow">
        <SelectField
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {counts?.[value] === undefined
                ? label
                : `${label} ${counts[value]}`}
            </option>
          ))}
        </SelectField>
      </div>
    </>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = t("이름으로 찾기"),
}: {
  value: string;
  onChange(value: string): void;
  placeholder?: string;
}) {
  return (
    <TextField
      // 너비는 도구 줄 틀(.page-search)이 정합니다: 768px 이상 240, 767px 이하 줄 전체.
      className="page-search"
      size="medium"
      width="100%"
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
/** 다른 상세 화면으로 갈 때 함께 넘기는 '돌아올 곳'(location.state). */
export type BackState = { from?: { path: string; label: string } };
/** 앱 안의 연구 화면·검토 요청 주소만 돌아올 곳으로 받습니다. */
export function readBackState(state: unknown): BackState["from"] | null {
  const from = (state as BackState | null)?.from;
  if (!from || typeof from.path !== "string" || typeof from.label !== "string")
    return null;
  const inApp =
    from.path.startsWith("/r/") || from.path.startsWith("/reviews/");
  return inApp && from.label.trim() ? from : null;
}
/**
 * 지금 화면을 '돌아올 곳'으로 넘기는 state를 만듭니다.
 * 받은 상세 화면의 BackLink가 목록 대신 이 화면과 이름을 보여 줘요.
 */
export function useBackState() {
  const location = useLocation();
  return (label: string): BackState => ({
    from: { path: `${location.pathname}${location.search}`, label },
  });
}
export function BackLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  const from = readBackState(useLocation().state);
  return (
    <Link className="student-back" to={from ? from.path : to}>
      <Icon name="arrow-left" size={16} />
      {from ? from.label : children}
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
          : t("저장하지 못했어요. 입력한 내용은 그대로 있어요."),
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
  label = t("저장"),
}: {
  saving: boolean;
  onCancel(): void;
  label?: string;
}) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={saving}
      >
        {t("취소")}
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? t("저장 중") : label}
      </Button>
    </DialogFooter>
  );
}
export function LinkChip({
  to,
  state,
  children,
}: {
  to: string;
  state?: BackState;
  children: ReactNode;
}) {
  return (
    <Link className="student-link-chip" to={to} state={state}>
      {children}
      <Icon name="arrow-up-right" size={13} />
    </Link>
  );
}

/** 피드백·수정 화면의 탭. 할 일은 사이드바 메뉴가 따로 있어 여기에 넣지 않습니다. */
export function WorkTabs({
  researchId,
  selected,
}: {
  researchId: string;
  selected: "feedback" | "results" | "reviews";
}) {
  const navigate = useNavigate();
  const { data, user } = useWorkspace();
  // 탭 숫자: 피드백은 아직 다루지 않은 것, 검토 요청은 안 본 교수 응답·댓글. 0이면 숨겨요.
  const unprocessed = data.feedback.filter(
    (item) => item.researchId === researchId && item.status === "unprocessed",
  ).length;
  const freshResponses = unreadReviewNotifications(
    data,
    user,
    researchId,
  ).length;
  // 사이드바 '피드백' 메뉴 하나에 받은 것 → 고친 것 → 보낸 것을 보기로 둡니다(감사 F1).
  return (
    <Tabs
      className="work-tabs"
      label={t("피드백 보기")}
      value={selected}
      onChange={(tab) => navigate(`/r/${researchId}/${tab}`)}
      options={[
        { value: "feedback", label: t("피드백"), count: unprocessed },
        { value: "results", label: t("수정 결과") },
        { value: "reviews", label: t("검토 요청"), count: freshResponses },
      ]}
    />
  );
}
/** 사이드바 '문서' 메뉴의 두 보기: 쓰는 글과 올린 자료(감사 F1). */
export function DocumentTabs({
  researchId,
  selected,
}: {
  researchId: string;
  selected: "writing" | "materials";
}) {
  const navigate = useNavigate();
  return (
    <Tabs
      className="work-tabs"
      label={t("문서 보기")}
      value={selected}
      onChange={(tab) => navigate(`/r/${researchId}/${tab}`)}
      options={[
        { value: "writing", label: t("글쓰기") },
        { value: "materials", label: t("자료") },
      ]}
    />
  );
}
