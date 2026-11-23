import { t } from "@/lib/i18n";
import { Icon } from "@/components/icons";
import { Choice } from "@/components/experience";

export interface VisibilityControlProps {
  value: "private" | "shared";
  onChange(next: "private" | "shared"): void;
  disabled?: boolean;
  hasCollaborators?: boolean;
  compact?: boolean;
}

/** 자료 공개 범위 선택(Wave 2 Slice 1: 신규 자료 기본값 private). */
export function VisibilityControl({
  value,
  onChange,
  disabled = false,
  hasCollaborators = false,
  compact = false,
}: VisibilityControlProps) {
  return (
    <div className="visibility-control">
      <Choice
        compact={compact}
        label={t("공개 범위")}
        value={value}
        disabled={disabled}
        onChange={(next) => onChange(next as "private" | "shared")}
        options={[
          { value: "private", label: t("나만 보기") },
          { value: "shared", label: t("함께 보기") },
        ]}
      />
      <p className="visibility-control-hint">
        <Icon name={value === "private" ? "lock" : "users"} size={13} />
        <span>
          {disabled
            ? t("작성자만 공개 범위를 바꿀 수 있어요.")
            : value === "private"
              ? hasCollaborators
                ? t("나만 볼 수 있어요. 공유 미팅에 연결해도 자동으로 공개되지 않아요.")
                : t("기본으로 나만 보기 상태로 저장돼요.")
              : t("이 연구에 참여한 공동연구자도 함께 볼 수 있어요.")}
        </span>
      </p>
    </div>
  );
}
