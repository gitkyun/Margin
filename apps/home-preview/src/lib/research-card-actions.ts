import { t } from "./i18n";

/** 내 연구 목록(/r) 카드의 동작. 우클릭 메뉴와 ⋯ 메뉴가 같은 목록을 씁니다. */
export type ResearchCardActionId =
  | "open"
  | "open-tab"
  | "settings"
  | "archive"
  | "unarchive"
  | "trash"
  | "restore";

export type ResearchListView = "active" | "archived" | "trash";

export interface ResearchCardAction {
  id: ResearchCardActionId;
  label: string;
  icon: string;
  /** 되돌리기 어려운 쪽(휴지통)이면 메뉴에서 위험 색으로 보여 줍니다. */
  danger?: boolean;
  /** 앞 묶음과 구분선으로 나눕니다. */
  separated?: boolean;
}

export function researchListView(value: string | null): ResearchListView {
  return value === "archived" || value === "trash" ? value : "active";
}

/**
 * 카드에서 고를 수 있는 동작. 보관·휴지통·복원은 소유자만 할 수 있어요(서버도 같은 규칙).
 * 휴지통의 연구는 열 수 없어 복원만 남깁니다(완전 삭제는 카드 아래 버튼과 슬라이드 확인).
 */
export function researchCardActions(
  view: ResearchListView,
  owner: boolean,
): ResearchCardAction[] {
  if (view === "trash")
    return owner ? [{ id: "restore", label: t("복원"), icon: "refresh" }] : [];
  const open: ResearchCardAction[] = [
    { id: "open", label: t("열기"), icon: "arrow-right" },
    { id: "open-tab", label: t("새 탭에서 열기"), icon: "external" },
    { id: "settings", label: t("연구 설정"), icon: "settings" },
  ];
  if (!owner) return open;
  return [
    ...open,
    view === "archived"
      ? {
          id: "unarchive",
          label: t("진행 중으로 복원"),
          icon: "refresh",
          separated: true,
        }
      : { id: "archive", label: t("보관"), icon: "folder", separated: true },
    { id: "trash", label: t("휴지통으로 옮기기"), icon: "trash", danger: true },
  ];
}

/** 카드 상태 배지. 투고 D-Day는 카드 아래 줄에 이미 있어 넣지 않아요. */
export function researchStatusBadge(view: ResearchListView): {
  label: string;
  tone: "green" | "neutral" | "red";
} {
  if (view === "trash") return { label: t("휴지통"), tone: "red" };
  if (view === "archived") return { label: t("보관됨"), tone: "neutral" };
  return { label: t("진행 중"), tone: "green" };
}
