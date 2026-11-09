import { respondDown, respondUp, theme } from "@montage-ui/core";

/**
 * 너비 기준은 Montage 4.2.0 breakpoint 하나만 씁니다.
 * xs 0 · sm 768 · md 992 · lg 1200 · xl 1600 (px)
 *
 * 화면 너비(이 값)와 컴포넌트 크기(size)·색 테마(data-theme)는 서로 다른 축입니다.
 * "모바일 다크"처럼 묶은 값을 만들지 않습니다.
 *
 * 콘텐츠 최대 폭은 Montage containerStyle 기준(기본 1060, 넓게 1400)을 따릅니다.
 * 토큰 JSON의 1100·1440은 Figma 프레임 폭이지 breakpoint가 아닙니다.
 */
export const breakpoints = theme.light.breakpoint;

export type BreakpointKey = keyof typeof breakpoints;

/** `@media only screen and (min-width: …)` — 해당 너비 이상 */
export const mediaUp = (key: BreakpointKey) => respondUp(breakpoints[key]);

/** `@media only screen and (max-width: … - 1px)` — 해당 너비 미만 */
export const mediaDown = (key: BreakpointKey) => respondDown(breakpoints[key]);

/** JS에서 쓸 media query 문자열(useMediaQuery 등) */
export const queryDown = (key: BreakpointKey) =>
  `(max-width: ${parseInt(breakpoints[key], 10) - 1}px)`;
export const queryUp = (key: BreakpointKey) =>
  `(min-width: ${breakpoints[key]})`;

export const CONTAINER_MAX_WIDTH = { normal: 1060, wide: 1400 } as const;
