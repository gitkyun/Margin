import { Fragment, type ReactNode } from "react";
import { ContextMenu } from "radix-ui";
import { t } from "@/lib/i18n";
import { Icon } from "./icons";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type {
  ResearchCardAction,
  ResearchCardActionId,
} from "@/lib/research-card-actions";
import "./research-card-menu.css";

interface ResearchCardMenuProps {
  actions: ResearchCardAction[];
  onAction(id: ResearchCardActionId): void;
  disabled?: boolean;
}

/**
 * 연구 카드 우클릭 메뉴. 마우스 사용자의 지름길이고, 같은 동작은 카드의 ⋯ 메뉴에도 있어요
 * (키보드 사용자는 ⋯ 메뉴를 씁니다). 동작이 없으면 브라우저 기본 메뉴를 그대로 둡니다.
 */
export function ResearchCardContextMenu({
  actions,
  onAction,
  disabled = false,
  children,
}: ResearchCardMenuProps & { children: ReactNode }) {
  if (!actions.length) return <>{children}</>;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild disabled={disabled}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="research-context-menu">
          {actions.map((action) => (
            <Fragment key={action.id}>
              {action.separated && (
                <ContextMenu.Separator className="research-context-separator" />
              )}
              <ContextMenu.Item
                className="research-context-item"
                data-danger={action.danger || undefined}
                onSelect={() => onAction(action.id)}
              >
                <Icon name={action.icon} size={16} />
                {action.label}
              </ContextMenu.Item>
            </Fragment>
          ))}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

/** 카드 아래의 ⋯ 메뉴. 우클릭 메뉴와 같은 동작을 키보드로도 고를 수 있게 합니다. */
export function ResearchCardMoreMenu({
  name,
  actions,
  onAction,
  disabled = false,
}: ResearchCardMenuProps & { name: string }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={t("{name} 더보기", { name })}
        >
          <Icon name="more" size={18} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {actions.map((action) => (
          <Fragment key={action.id}>
            {action.separated && <DropdownMenuSeparator />}
            <DropdownMenuItem onSelect={() => onAction(action.id)}>
              <Icon name={action.icon} size={16} />
              {action.label}
            </DropdownMenuItem>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
