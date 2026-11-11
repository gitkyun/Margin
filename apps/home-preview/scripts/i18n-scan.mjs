#!/usr/bin/env node
/**
 * 화면 문구 검사.
 *  - unwrapped: `t()`로 감싸지 않은 한글 문자열(소스에 직접 적힌 화면 문구)
 *  - keys: `t("…")`에 쓰인 열쇠(일본어 사전에 있어야 함)
 * 한글이 든 줄에 `i18n-ignore` 주석이 있으면 건너뜁니다(화면 문구가 아닌 값).
 *
 *   node scripts/i18n-scan.mjs            전체 요약
 *   node scripts/i18n-scan.mjs src/pages  그 아래만, 줄마다 출력
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HANGUL = /[가-힣]/;
/** 화면 문구가 아닌 파일: 가상 데이터, 한글 검색 규칙, 사전, 테스트 */
const SKIP = [
  /^src\/lab\//, // 시안 화면(제품 문구가 아님)
  /\.test\.tsx?$/,
  /^src\/i18n\//,
  /^src\/lib\/demo\.ts$/,
  /^src\/lib\/hangul-search\.ts$/,
  /^src\/lib\/i18n\.ts$/,
];

export function listSources(dir = "src") {
  const out = [];
  const walk = (current) => {
    for (const name of readdirSync(path.join(root, current))) {
      const relative = `${current}/${name}`;
      if (statSync(path.join(root, relative)).isDirectory()) walk(relative);
      else if (
        /\.tsx?$/.test(name) &&
        !SKIP.some((rule) => rule.test(relative))
      )
        out.push(relative);
    }
  };
  if (statSync(path.join(root, dir)).isDirectory()) walk(dir);
  else out.push(dir);
  return out.sort();
}

function parseSource(text, file) {
  return parse(text, {
    sourceType: "module",
    sourceFilename: file,
    plugins: ["typescript", "jsx"],
  });
}

function children(node) {
  const out = [];
  for (const key of Object.keys(node)) {
    if (
      key === "loc" ||
      key === "leadingComments" ||
      key === "trailingComments"
    )
      continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value)
        if (item && typeof item.type === "string") out.push(item);
    } else if (value && typeof value.type === "string") out.push(value);
  }
  return out;
}

const isTranslateCall = (node) =>
  node.type === "CallExpression" &&
  node.callee.type === "Identifier" &&
  node.callee.name === "t";

/** `tc("뜻", "원문")`: 같은 낱말의 뜻을 나눠 번역할 때 */
const isContextCall = (node) =>
  node.type === "CallExpression" &&
  node.callee.type === "Identifier" &&
  node.callee.name === "tc";

const literalText = (node) =>
  node.type === "StringLiteral"
    ? node.value
    : node.type === "TemplateLiteral" && node.expressions.length === 0
      ? node.quasis[0].value.cooked
      : null;

export function scanFile(relative) {
  const text = readFileSync(path.join(root, relative), "utf8");
  const lines = text.split("\n");
  const unwrapped = [];
  const keys = [];
  const ignored = (node) => {
    for (
      let line = Math.max(1, node.loc.start.line - 1);
      line <= node.loc.end.line;
      line += 1
    )
      if (lines[line - 1]?.includes("i18n-ignore")) return true;
    return false;
  };
  const report = (node, value) => {
    if (!value || !HANGUL.test(value) || ignored(node)) return;
    unwrapped.push({
      file: relative,
      line: node.loc.start.line,
      text: value.trim().replace(/\s+/g, " ").slice(0, 80),
    });
  };
  const visit = (node) => {
    if (isContextCall(node)) {
      const [context, first, ...rest] = node.arguments;
      const contextName = context ? literalText(context) : null;
      const key = first ? literalText(first) : null;
      if (contextName !== null && key !== null) {
        keys.push({ file: relative, key });
        keys.push({ file: relative, key: `${key}@@${contextName}` });
      } else if (first) visit(first);
      for (const argument of rest) visit(argument);
      return;
    }
    if (isTranslateCall(node)) {
      const [first, ...rest] = node.arguments;
      const key = first ? literalText(first) : null;
      if (key !== null) keys.push({ file: relative, key });
      else if (first) visit(first);
      for (const argument of rest) visit(argument);
      return;
    }
    if (node.type === "StringLiteral") report(node, node.value);
    else if (node.type === "JSXText") report(node, node.value);
    else if (node.type === "TemplateElement") report(node, node.value.cooked);
    for (const child of children(node)) visit(child);
  };
  visit(parseSource(text, relative).program);
  return { unwrapped, keys };
}

export function scan(dir = "src") {
  const unwrapped = [];
  const keys = [];
  for (const file of listSources(dir)) {
    const result = scanFile(file);
    unwrapped.push(...result.unwrapped);
    keys.push(...result.keys);
  }
  return { unwrapped, keys };
}

/** 사전 파일들에서 열쇠를 읽습니다(파일을 실행하지 않고 구문만 봅니다). */
export function dictionaryKeys() {
  const dir = path.join(root, "src/i18n/ja");
  const found = new Map();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts") || name === "index.ts") continue;
    const visit = (node) => {
      if (node.type === "ObjectProperty") {
        const key =
          node.key.type === "Identifier" && !node.computed
            ? node.key.name
            : literalText(node.key);
        const value = literalText(node.value);
        if (key !== null && value !== null) {
          if (!found.has(key)) found.set(key, []);
          found.get(key).push({ file: name, value });
        }
      }
      for (const child of children(node)) visit(child);
    };
    visit(
      parseSource(readFileSync(path.join(dir, name), "utf8"), name).program,
    );
  }
  return found;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const targets = process.argv.slice(2);
  const dictionary = dictionaryKeys();
  const results = targets.length ? targets.map((t) => scan(t)) : [scan()];
  const unwrapped = results.flatMap((r) => r.unwrapped);
  const keys = results.flatMap((r) => r.keys);
  const missing = [...new Set(keys.map((k) => k.key))].filter(
    (key) => HANGUL.test(key) && !dictionary.has(key),
  );
  if (targets.length) {
    for (const item of unwrapped)
      console.log(`${item.file}:${item.line}  ${item.text}`);
    for (const key of missing) console.log(`사전에 없음: ${key}`);
  } else {
    const byFile = new Map();
    for (const item of unwrapped)
      byFile.set(item.file, (byFile.get(item.file) ?? 0) + 1);
    for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1]))
      console.log(`${String(count).padStart(4)}  ${file}`);
  }
  console.log(
    `\n감싸지 않은 한글 문구 ${unwrapped.length}개 · t() 열쇠 ${new Set(keys.map((k) => k.key)).size}개 · 사전에 없는 열쇠 ${missing.length}개`,
  );
  process.exit(unwrapped.length || missing.length ? 1 : 0);
}
