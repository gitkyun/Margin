/**
 * 일본어 사전. 열쇠는 한국어 원문, 값은 일본어 문구입니다.
 * 영역별 파일(`./*.ts`)을 모두 모읍니다. 같은 열쇠가 여러 파일에 있으면 뜻이 같아야 합니다.
 * 용어와 말투는 docs/design/ux-writing-ja.md를 따릅니다.
 */
const modules = import.meta.glob<Record<string, string>>("./*.ts", {
  eager: true,
  import: "default",
});

export const ja: Record<string, string> = Object.assign(
  {},
  ...Object.entries(modules)
    .filter(([path]) => path !== "./index.ts")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, dictionary]) => dictionary),
);
