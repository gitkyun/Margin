import { useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/icons";

export interface TagChipsProps {
  values: string[];
  onChange: (values: string[]) => void;
  /** 아직 칩이 되지 않은 입력. 저장·다음 단계에서 함께 넣을 수 있게 밖에 둡니다. */
  draft: string;
  onDraftChange: (draft: string) => void;
  /** 목록에 하나를 더한 새 목록. 형식이 틀리거나 겹치거나 꽉 차면 그대로 돌려줍니다. */
  add: (values: string[], value: string) => string[];
  /** 칩이 될 수 있는 글인지(틀리면 칸에 표시하고 글자는 그대로 둠) */
  isValid: (value: string) => boolean;
  max: number;
  /** 칩을 나누는 글자. 이메일은 띄어쓰기도, 키워드는 쉼표·세미콜론·줄바꿈만. */
  separator: RegExp;
  /** 꽉 찼을 때 입력칸 대신 보여 줄 한 줄 */
  fullNote: string;
  placeholder?: string;
  id?: string;
  inputMode?: "email" | "text";
  maxLength?: number;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

/**
 * 칩 태그 입력(affectUI Tag Input 패턴). Enter·구분 글자·붙여넣기로 칩을 만들고, 빈 칸에서 ⌫로 마지막 칩을 지워요.
 * 형식이 틀리면 칸에 표시하고(흔들림은 전역 aria-invalid 규칙) 글자는 그대로 둡니다.
 * 모양은 전역 .email-chips 규칙을 그대로 씁니다.
 */
export function TagChips({
  values,
  onChange,
  draft,
  onDraftChange,
  add,
  isValid,
  max,
  separator,
  fullNote,
  placeholder,
  id,
  inputMode = "text",
  maxLength,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
}: TagChipsProps) {
  const [invalid, setInvalid] = useState(false);
  const full = values.length >= max;
  const valid = (part: string) => !!part.trim() && isValid(part.trim());

  function commit(text: string): boolean {
    const value = text.trim();
    if (!value) return true;
    if (!isValid(value)) {
      setInvalid(true);
      return false;
    }
    onChange(add(values, value));
    onDraftChange("");
    return true;
  }
  /**
   * 구분 글자는 키 이벤트가 아니라 입력값으로 나눠요.
   * 모바일 키보드·자동 완성은 키 이벤트를 제대로 보내지 않기 때문이에요.
   */
  function change(value: string) {
    setInvalid(false);
    if (!separator.test(value)) {
      onDraftChange(value);
      return;
    }
    const parts = value.split(separator);
    const rest = parts.pop() ?? "";
    const rejected = parts.filter((part) => part.trim() && !valid(part));
    onChange(parts.filter(valid).reduce(add, values));
    setInvalid(rejected.length > 0);
    // 틀린 것이 있으면 그것만 남겨 고칠 수 있게 해요.
    onDraftChange(rejected[0] ?? rest);
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && draft.trim()) {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }
  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const parts = event.clipboardData.getData("text").split(separator);
    if (parts.length < 2) return;
    event.preventDefault();
    onChange(parts.filter(valid).reduce(add, values));
    const rejected = parts.filter((part) => part.trim() && !valid(part));
    setInvalid(rejected.length > 0);
    onDraftChange(rejected.join(" "));
  }
  return (
    <div className="email-chips" data-invalid={invalid || undefined}>
      {values.map((value) => (
        <span key={value} className="email-chip">
          {value}
          <button
            type="button"
            aria-label={t("{email} 빼기", { email: value })}
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            <Icon name="close" size={14} />
          </button>
        </span>
      ))}
      {!full && (
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={draft}
          maxLength={maxLength}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={values.length ? undefined : placeholder}
          onChange={(event) => change(event.target.value)}
          onKeyDown={keyDown}
          onPaste={paste}
          onBlur={() => commit(draft)}
        />
      )}
      {full && <small>{fullNote}</small>}
    </div>
  );
}
