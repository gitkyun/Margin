/**
 * 회귀 그물이 도는 화면 목록. `:research`는 미리보기 모드의 첫 연구로 바뀝니다.
 * 상세 화면은 `detailOf` 목록 화면에서 `detailPattern`에 맞는 첫 링크를 따라갑니다.
 * 교수 화면(`/reviews/:id`)은 검토 요청 목록의 첫 공유 링크를 씁니다.
 */
export const ROUTES = [
  { name: "landing", path: "/" },
  { name: "features", path: "/features" },
  { name: "pricing", path: "/pricing" },
  { name: "guide", path: "/guide" },
  { name: "login", path: "/login" },
  { name: "signup", path: "/signup" },
  { name: "research-list", path: "/r" },
  { name: "account", path: "/account" },
  { name: "home", path: ":research" },
  { name: "planning", path: ":research/planning" },
  { name: "calendar", path: ":research/planning?tab=calendar" },
  { name: "meetings", path: ":research/meetings" },
  {
    name: "meeting-detail",
    detailOf: "meetings",
    detailPattern: "^/r/[^/]+/meetings/[^/?#]+$",
  },
  { name: "writing", path: ":research/writing" },
  { name: "feedback", path: ":research/feedback" },
  {
    name: "feedback-detail",
    detailOf: "feedback",
    detailPattern: "^/r/[^/]+/feedback/[^/?#]+$",
  },
  { name: "results", path: ":research/results" },
  {
    name: "result-detail",
    detailOf: "results",
    detailPattern: "^/r/[^/]+/results/[^/?#]+$",
  },
  { name: "tasks", path: ":research/tasks" },
  { name: "materials", path: ":research/materials" },
  {
    name: "material-detail",
    detailOf: "materials",
    detailPattern: "^/r/[^/]+/materials/[^/?#]+$",
  },
  { name: "reviews", path: ":research/reviews" },
  {
    name: "review-detail",
    detailOf: "reviews",
    detailPattern: "^/reviews/[^/?#]+$",
  },
  { name: "assistant", path: ":research/assistant" },
  { name: "settings", path: ":research/settings" },
];

/** 계산된 스타일을 비교할 요소. 역할이 같은 요소가 화면·테마마다 같게 보이는지 봅니다. */
export const STYLE_PROBES = [
  ".page-title",
  ".page-description",
  ".page-header [data-slot=button]",
  ".nav-item.active",
  "[role=tab][aria-selected=true]",
  "[data-component=segmented-control-item][data-active=true]",
  ".lp-header a[data-slot=button]",
  ".lp-hero-actions a",
  "main h2",
];
