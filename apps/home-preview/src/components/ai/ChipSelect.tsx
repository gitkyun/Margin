import type { ReactNode } from "react";
import { Select } from "@base-ui/react/select";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import "./ai-controls.css";

export interface ChipOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
  /** 고를 수 없는 이유 한 줄(비활성일 때) */
  note?: string;
  disabled?: boolean;
  leading?: ReactNode;
}

/**
 * 입력창 아랫줄의 선택 칩(모델·답변 깊이·요청 종류).
 * Base UI Select가 목록 접근성(listbox)·방향키·글자 이동·Esc·초점 복귀를 맡고,
 * 마진은 모양(칩 + 설명 줄이 있는 목록)만 정합니다.
 */
export function ChipSelect({
  value,
  onChange,
  options,
  label,
  placeholder,
  leading,
  disabled = false,
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  options: ChipOption[];
  /** 접근성 이름. 화면에는 보이지 않고 현재 값과 함께 읽혀요. */
  label: string;
  /** 고른 값이 없을 때 칩에 보일 글(불러오는 중·실패 안내 등) */
  placeholder?: string;
  /** 칩 앞 아이콘. 없으면 고른 항목의 leading을 써요. */
  leading?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const current = options.find((option) => option.value === value);
  const text = current?.label ?? placeholder ?? "";
  return (
    <Select.Root
      value={current ? current.value : null}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
      disabled={disabled}
      modal={false}
    >
      <Select.Trigger
        className={cn("composer-chip", className)}
        aria-label={text ? `${label} · ${text}` : label}
      >
        {leading ?? current?.leading}
        <span className="composer-chip-label">{text}</span>
        <Select.Icon className="composer-chip-caret">
          <Icon name="chevron-down" size={12} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          alignItemWithTrigger={false}
          className="chip-select-positioner"
        >
          <Select.Popup className="chip-select-popup" aria-label={label}>
            <p className="chip-select-heading" aria-hidden="true">
              {label}
            </p>
            <Select.List className="chip-select-list">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  disabled={option.disabled}
                  className="chip-select-item"
                >
                  {option.leading && (
                    <span className="chip-select-leading">
                      {option.leading}
                    </span>
                  )}
                  <span className="chip-select-text">
                    <span className="chip-select-name">
                      <Select.ItemText>{option.label}</Select.ItemText>
                      {option.badge && (
                        <small className="chip-select-badge">
                          {option.badge}
                        </small>
                      )}
                    </span>
                    {(option.note ?? option.description) && (
                      <small className="chip-select-description">
                        {option.note ?? option.description}
                      </small>
                    )}
                  </span>
                  <Select.ItemIndicator className="chip-select-check">
                    <Icon name="check" size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
