import { useId } from "react";
import { Popover } from "radix-ui";
import { Checkbox } from "@montage-ui/core";
import { t } from "@/lib/i18n";
import { toggleValue } from "@/lib/filter-params";
import { Button } from "@/components/ui/button";
import { Icon } from "./icons";
import "./filter-menu.css";

export interface FilterOption {
  value: string;
  label: string;
  /** 이 선택지를 고르면 보일 항목 수(다른 묶음의 선택은 반영한 값) */
  count?: number;
}

export interface FilterGroup {
  key: string;
  label: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onChange(values: string[]): void;
}

interface FilterMenuProps {
  groups: readonly FilterGroup[];
  onClear(): void;
}

/**
 * 여러 개를 고르는 목록 필터. 버튼에 고른 개수를 보이고, 고른 것은 버튼 옆 칩으로도 보여
 * 하나씩 뺄 수 있어요. 아무것도 고르지 않으면 전체예요.
 */
export function FilterMenu({ groups, onClear }: FilterMenuProps) {
  const baseId = useId();
  const total = groups.reduce((sum, group) => sum + group.selected.length, 0);
  const chips = groups.flatMap((group) =>
    group.selected.map((value) => ({
      group,
      value,
      label:
        group.options.find((option) => option.value === value)?.label ?? value,
    })),
  );
  return (
    <div className="filter-menu">
      <Popover.Root>
        <Popover.Trigger asChild>
          {/* 도구 줄의 SegmentedControl·찾기 칸과 같은 높이(40)로 둡니다. */}
          <Button
            variant="outline"
            aria-label={
              total ? t("필터, {count}개 선택함", { count: total }) : t("필터")
            }
          >
            <Icon name="filter" size={15} />
            {t("필터")}
            {total > 0 && (
              <span className="filter-menu-count" key={total}>
                {total}
              </span>
            )}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="filter-menu-content"
            align="start"
            sideOffset={6}
            collisionPadding={16}
          >
            {groups.map((group) => (
              <fieldset key={group.key} className="filter-menu-group">
                <legend>{group.label}</legend>
                {group.options.map((option) => {
                  const id = `${baseId}-${group.key}-${option.value}`;
                  const checked = group.selected.includes(option.value);
                  return (
                    <label key={option.value} className="filter-menu-option">
                      <Checkbox
                        id={id}
                        size="small"
                        checked={checked}
                        onCheckedChange={() =>
                          group.onChange(
                            toggleValue(group.selected, option.value),
                          )
                        }
                      />
                      <span>{option.label}</span>
                      {option.count !== undefined && (
                        <small>{option.count}</small>
                      )}
                    </label>
                  );
                })}
              </fieldset>
            ))}
            <div className="filter-menu-footer">
              <Button
                variant="ghost"
                size="sm"
                disabled={!total}
                onClick={onClear}
              >
                {t("모두 지우기")}
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {chips.map(({ group, value, label }) => (
        <span key={`${group.key}-${value}`} className="filter-menu-chip">
          {label}
          <button
            type="button"
            aria-label={t("{label} 필터 빼기", { label })}
            onClick={() =>
              group.onChange(group.selected.filter((item) => item !== value))
            }
          >
            <Icon name="close" size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
