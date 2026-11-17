import { t } from "@/lib/i18n";

/** IA v2 상단 메뉴 넷(00 D3, 02 §3.1). 휴대폰 아래 탭(02 §6)도 같은 목록을 씁니다. */
export interface ShellMenu {
  key: "home" | "meetings" | "tasks" | "docs";
  /** `/r/:id` 뒤에 붙는 경로. 홈은 빈 문자열. */
  path: string;
  /** 미리보기 말풍선·단축키 표시에 쓰는 지금 화면 경로 */
  previewPath: string;
  label: string;
  /** `components/icons.tsx`의 아이콘 이름 */
  icon: string;
  /** 이 메뉴를 켜는 다른 경로(아직 옮기지 않은 화면 포함) */
  alsoActive: readonly string[];
}

export const SHELL_MENUS: readonly ShellMenu[] = [
  {
    key: "home",
    path: "",
    previewPath: "",
    label: t("홈"),
    icon: "home",
    alsoActive: ["/flow", "/planning"],
  },
  {
    key: "meetings",
    path: "meetings",
    previewPath: "meetings",
    label: t("미팅"),
    icon: "calendar",
    alsoActive: ["/results", "/reviews"],
  },
  {
    key: "tasks",
    path: "tasks",
    previewPath: "tasks",
    label: t("할 일"),
    icon: "tasks",
    alsoActive: ["/feedback"],
  },
  {
    key: "docs",
    path: "docs",
    previewPath: "writing",
    label: t("글·자료"),
    icon: "file",
    alsoActive: ["/writing", "/materials"],
  },
];

function startsWithSegment(rest: string, prefix: string): boolean {
  return rest === prefix || rest.startsWith(`${prefix}/`);
}

/** 지금 주소에서 이 메뉴가 켜져 있는지. 연구 밖 주소면 모두 꺼집니다. */
export function isMenuActive(
  menu: ShellMenu,
  researchId: string,
  pathname: string,
): boolean {
  const base = `/r/${researchId}`;
  if (pathname !== base && !pathname.startsWith(`${base}/`)) return false;
  const rest = pathname.slice(base.length).replace(/\/$/, "");
  if (menu.alsoActive.some((path) => startsWithSegment(rest, path)))
    return true;
  return menu.path ? startsWithSegment(rest, `/${menu.path}`) : rest === "";
}
