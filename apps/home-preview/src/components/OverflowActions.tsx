import { t } from "@/lib/i18n";
import { useMediaQuery } from "@/lib/use-media-query";
import { Button } from "./ui/button";
import { Icon } from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface OverflowActionItem {
  id: string;
  label: string;
  icon: string;
  onSelect: () => void;
  disabled?: boolean;
  variant?: "outline" | "default" | "ghost";
}

interface OverflowActionsProps {
  /** 넓은 화면과 좁은 화면 모두에 항상 보이는 주 버튼 */
  primary?: OverflowActionItem[];
  /** 넓은 화면에서는 버튼으로, 모바일(< 768px)에서는 '더보기(···)' 메뉴로 접히는 보조 버튼 */
  secondary: OverflowActionItem[];
  moreLabel?: string;
}

/**
 * 오버플로우 액션 바(beUI Overflow Actions 패턴).
 * 폭이 좁은 화면에서 버튼이 여러 줄로 깨지지 않게 보조 버튼을 ··· 메뉴로 접어요.
 */
export function OverflowActions({
  primary = [],
  secondary,
  moreLabel,
}: OverflowActionsProps) {
  const compact = useMediaQuery("(max-width: 767px)");
  return (
    <>
      {!compact &&
        secondary.map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant={item.variant ?? "outline"}
            disabled={item.disabled}
            onClick={item.onSelect}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </Button>
        ))}
      {primary.map((item) => (
        <Button
          key={item.id}
          size="sm"
          variant={item.variant ?? "default"}
          disabled={item.disabled}
          onClick={item.onSelect}
        >
          <Icon name={item.icon} size={16} />
          {item.label}
        </Button>
      ))}
      {compact && secondary.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={moreLabel ?? t("더보기")}
            >
              <Icon name="more" size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {secondary.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => {
                  if (!item.disabled) item.onSelect();
                }}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
