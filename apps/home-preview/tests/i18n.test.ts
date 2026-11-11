// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { dateLocale, setLangForTest, t } from "../src/lib/i18n";
import { ja } from "../src/i18n/ja";
import { formatClock } from "../src/lib/time-format";
// @ts-expect-error 검사 스크립트는 타입 선언이 없는 .mjs입니다.
import { dictionaryKeys, scan } from "../scripts/i18n-scan.mjs";

afterEach(() => setLangForTest("ko"));

describe("화면 언어", () => {
  it("한국어에서는 원문을 그대로 쓰고 자리 표시만 채운다", () => {
    expect(t("오전")).toBe("오전");
    expect(t("할 일 {count}개", { count: 3 })).toBe("할 일 3개");
    expect(dateLocale()).toBe("ko-KR");
  });

  it("일본어에서는 사전의 문구를 쓴다", () => {
    setLangForTest("ja");
    expect(t("오전")).toBe("午前");
    expect(dateLocale()).toBe("ja-JP");
    expect(formatClock("14:30", "12h")).toBe("午後 2:30");
    expect(formatClock("14:30", "24h")).toBe("14:30");
  });

  it("사전에 없는 문구는 빈칸 대신 한국어 원문을 보여 준다", () => {
    setLangForTest("ja");
    expect(t("사전에 없는 문구 {n}", { n: 1 })).toBe("사전에 없는 문구 1");
  });

  it("없는 자리 표시는 지우지 않고 남긴다", () => {
    expect(t("{a}와 {b}", { a: "가" })).toBe("가와 {b}");
  });
});

describe("일본어 사전이 화면 문구를 모두 덮는지", () => {
  const { unwrapped, keys } = scan() as {
    unwrapped: { file: string; line: number; text: string }[];
    keys: { file: string; key: string }[];
  };
  const dictionary = dictionaryKeys() as Map<
    string,
    { file: string; value: string }[]
  >;

  it("소스에 t()로 감싸지 않은 한글 화면 문구가 없다", () => {
    expect(
      unwrapped.map((item) => `${item.file}:${item.line} ${item.text}`),
    ).toEqual([]);
  });

  it("t()에 쓴 모든 열쇠가 일본어 사전에 있다", () => {
    const missing = [...new Set(keys.map((item) => item.key))].filter(
      (key) => /[가-힣]/.test(key) && !dictionary.has(key),
    );
    expect(missing).toEqual([]);
  });

  it("번역문에 한글이 남아 있지 않고, 자리 표시가 원문과 같다", () => {
    const problems: string[] = [];
    const slots = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const [key, entries] of dictionary)
      for (const { file, value } of entries) {
        if (/[가-힣]/.test(value))
          problems.push(`${file}: 한글이 남음 → ${key}`);
        if (slots(key).join() !== slots(value).join())
          problems.push(`${file}: 자리 표시가 다름 → ${key}`);
      }
    expect(problems).toEqual([]);
  });

  it("같은 열쇠가 여러 파일에 있으면 번역이 같다", () => {
    const conflicts = [...dictionary]
      .filter(
        ([, entries]) => new Set(entries.map((entry) => entry.value)).size > 1,
      )
      .map(
        ([key, entries]) =>
          `${key} → ${entries.map((entry) => `${entry.file}: ${entry.value}`).join(" | ")}`,
      );
    expect(conflicts).toEqual([]);
  });

  it("실제로 불러온 사전도 같은 열쇠를 가진다", () => {
    expect(Object.keys(ja).length).toBe(dictionary.size);
  });
});
