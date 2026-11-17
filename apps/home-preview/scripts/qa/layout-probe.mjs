#!/usr/bin/env node
/**
 * 배치 측정 도구: 로그인 후 화면의 틀(본문 폭, 제목 자리, 머리 버튼, 탭·도구 줄)을 숫자로 재고
 * 배치 규칙(docs/design/patterns.md §2-2 "배치 규칙")의 합격 기준으로 판정합니다.
 *
 * Playwright(devDependency)와 설치된 Chrome을 씁니다. 결과는 저장소에 커밋하지 않습니다.
 *
 * 쓰는 법 (apps/home-preview):
 *   1) 미리보기 모드로 개발 서버를 켭니다.
 *      VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 5174
 *   2) node scripts/qa/layout-probe.mjs [옵션]
 *
 * 옵션:
 *   --base URL          기본 http://localhost:5174
 *   --only a,b          화면 이름(scripts/qa/routes.mjs의 name)만. 예: --only home,meetings
 *   --widths 390,1440   기본 390,768,1024,1440
 *   --theme light|dark  기본 light
 *   --stress            사이드바 메뉴 이름, h1, 목록 행 제목·보조 설명, 버튼 글자, 배지, 입력 라벨의
 *                       글자를 3배로 늘린 뒤 잰다(화면 밖 요소, 말줄임 없는 넘침, 겹친 글자).
 *   --shots 폴더        잰 상태 그대로 전체 페이지 캡처(<화면>-<너비>-<테마>[-stress].png)
 *   --check             합격 기준으로 화면별 PASS/FAIL을 출력하고 실패가 있으면 종료 코드 1
 *   --out 파일          JSON 줄을 파일에도 남긴다
 *
 * 출력: 화면×너비마다 JSON 한 줄.
 *   main      main.workspace-content 안쪽(패딩을 뺀) left/right/top
 *   root      본문 루트(main의 첫 보이는 자식)의 class·left/right/top
 *   h1        left/top/fontSize/lineHeight (없으면 null)
 *   back      머리 위에 뒤로 가기 줄이 있으면 true (이때 h1 top은 판정하지 않고 root top만 본다)
 *   buttons   .page-header의 행동 칸(.page-actions) 안 버튼 높이 목록
 *   tabsTop / toolbarTop / contentTop   탭, 도구 줄, 첫 내용 블록의 top
 *   hscroll   가로 스크롤(px)
 *   stress    --stress일 때 { offscreen, unclipped, overlaps } (각각 최대 12개)
 *
 * 합격 기준(--check, 오차 1px):
 *   root left/right = main 안쪽 left/right · h1 left = main 안쪽 left · h1 top = main 안쪽 top
 *   h1 글자 크기 768 이상 28px, 767 이하 22px · 머리 버튼 높이 40 · 가로 스크롤 0
 *   --stress: 화면 밖 요소 0, 겹친 글자 0
 *   같은 너비에서 화면 간 h1 left/top 차이는 맨 끝에 한 번 더 모아 보여 줍니다
 *   (집중 모드처럼 사이드바가 접히는 화면은 left가 달라 따로 표시).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { ROUTES } from "./routes.mjs";

/** 로그인 후 화면이 아닌 것(공개 소개·로그인·가입·온보딩)은 재지 않습니다. */
const PUBLIC = new Set([
  "landing",
  "features",
  "pricing",
  "guide",
  "login",
  "signup",
  "onboarding",
]);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const base = arg("base", "http://localhost:5174");
const widths = arg("widths", "390,768,1024,1440").split(",").map(Number);
const theme = arg("theme", "light");
const only = (arg("only", "") || "").split(",").filter(Boolean);
const stress = flag("stress");
const check = flag("check");
const shots = arg("shots", "");
const outFile = arg("out", "");
const TOL = 1;

/** 화면 안에서 실행: 틀 측정. */
function measure() {
  const r1 = (n) => Math.round(n * 10) / 10;
  const visible = (el) => {
    if (!el || !el.checkVisibility?.({ visibilityProperty: true }))
      return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const main = document.querySelector("main.workspace-content");
  const hscroll = document.documentElement.scrollWidth - innerWidth;
  if (!main) return { main: null, hscroll };
  const cs = getComputedStyle(main);
  const mr = main.getBoundingClientRect();
  const inner = {
    left: r1(mr.left + parseFloat(cs.paddingLeft)),
    right: r1(mr.right - parseFloat(cs.paddingRight)),
    top: r1(mr.top + parseFloat(cs.paddingTop)),
  };
  const skip = (el) =>
    el.matches(".sr-only, script, style, [hidden]") ||
    getComputedStyle(el).position === "fixed" ||
    getComputedStyle(el).position === "absolute";
  const rootEl = [...main.children].find((el) => visible(el) && !skip(el));
  const rr = rootEl?.getBoundingClientRect();
  const h1El = [...main.querySelectorAll("h1")].find(visible);
  const hr = h1El?.getBoundingClientRect();
  const hcs = h1El && getComputedStyle(h1El);
  const header = h1El?.closest(".page-header") ?? null;
  // 머리 위의 뒤로 가기 줄: 머리(없으면 h1)보다 위에 있는 보이는 링크·버튼
  const headTop = (header ?? h1El)?.getBoundingClientRect().top ?? 0;
  const back =
    !!h1El &&
    [...main.querySelectorAll("a, button")].some((el) => {
      if (!visible(el) || (header ?? h1El).contains(el)) return false;
      const r = el.getBoundingClientRect();
      return r.bottom <= headTop + 1 && r.top >= inner.top - 1;
    });
  // 머리 버튼 = 오른쪽 행동 칸(.page-actions)의 버튼. 메타 줄의 글자 링크는 세지 않는다.
  const buttons = [
    ...main.querySelectorAll(
      ".page-header .page-actions button, .page-header .page-actions [data-slot=button]",
    ),
  ]
    .filter(visible)
    .map((b) => r1(b.getBoundingClientRect().height));
  const tabs = [...main.querySelectorAll("[role=tablist]")].find(visible);
  const toolbar = [...main.querySelectorAll(".page-toolbar")].find(visible);
  // 첫 내용 블록: 머리·탭·도구 줄 다음에 오는 첫 보이는 형제
  let content = null;
  const isHead = (el) =>
    el === header ||
    el.contains(header) ||
    el.matches("[role=tablist], .page-toolbar") ||
    !!el.querySelector(":scope > [role=tablist]") ||
    (tabs && el.contains(tabs) && el.getBoundingClientRect().height < 80);
  if (header) {
    let scope = header;
    while (scope && scope !== main && !content) {
      let sib = scope.nextElementSibling;
      while (sib && (!visible(sib) || isHead(sib) || skip(sib)))
        sib = sib.nextElementSibling;
      if (sib) content = sib;
      else scope = scope.parentElement;
    }
  }
  const cls = (el) =>
    el
      ? el.tagName.toLowerCase() +
        (typeof el.className === "string" && el.className.trim()
          ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
          : "")
      : null;
  return {
    main: inner,
    root: rr
      ? {
          el: cls(rootEl),
          left: r1(rr.left),
          right: r1(rr.right),
          top: r1(rr.top),
        }
      : null,
    h1: hr
      ? {
          left: r1(hr.left),
          top: r1(hr.top),
          fontSize: parseFloat(hcs.fontSize),
          lineHeight: parseFloat(hcs.lineHeight),
          inHeader: !!header,
        }
      : null,
    back,
    buttons,
    tabsTop: tabs ? r1(tabs.getBoundingClientRect().top) : null,
    toolbarTop: toolbar ? r1(toolbar.getBoundingClientRect().top) : null,
    content: content
      ? { el: cls(content), top: r1(content.getBoundingClientRect().top) }
      : null,
    hscroll,
  };
}

/** 화면 안에서 실행: 글자를 3배로 늘린다. */
function inflate() {
  const targets = [
    ".sidebar .nav-item > span:not(.nav-dot)",
    ".sidebar .workspace-switch strong",
    "main h1",
    "main button",
    "main a[data-slot=button]",
    "main [role=tab]",
    "main .status-badge",
    "main [data-component=content-badge]",
    "main label",
    "main .field-label",
  ];
  // 목록 행의 제목·보조 설명: 행·항목·카드 안의 제목과 문단
  const rowScope =
    'main li, main [class*="row"], main [class*="item"], main [class*="card"], main [class*="list"] > a';
  const rowText = "h2, h3, h4, strong, p, small";
  const els = new Set();
  for (const sel of targets)
    document.querySelectorAll(sel).forEach((el) => els.add(el));
  document
    .querySelectorAll(rowScope)
    .forEach((row) =>
      row.querySelectorAll(rowText).forEach((el) => els.add(el)),
    );
  const nodes = new Set();
  for (const el of els) {
    if (el.closest(".sr-only, [aria-hidden=true], svg, canvas, .ProseMirror"))
      continue;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) if (n.data.trim()) nodes.add(n);
  }
  for (const n of nodes) {
    const t = n.data.trim();
    n.data = `${t} ${t} ${t}`;
  }
  return nodes.size;
}

/** 화면 안에서 실행: 화면 밖 요소, 말줄임 없는 넘침, 겹친 글자. */
function stressReport() {
  const W = innerWidth;
  const label = (el) => {
    const c =
      typeof el.className === "string" && el.className.trim()
        ? "." + el.className.trim().split(/\s+/)[0]
        : el.tagName.toLowerCase();
    return `${c} "${el.textContent.trim().slice(0, 18)}"`;
  };
  const hiddenByAncestor = (el) => {
    // 조상이 잘라 내거나 스크롤하는 영역 안이면 [보이는 사각형]으로 줄인다
    let r = el.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    let scroller = false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      const ox = cs.overflowX,
        oy = cs.overflowY;
      const pr = p.getBoundingClientRect();
      if (/hidden|clip|auto|scroll/.test(ox)) {
        box.l = Math.max(box.l, pr.left);
        box.r = Math.min(box.r, pr.right);
        if (/auto|scroll/.test(ox)) scroller = true;
      }
      if (/hidden|clip|auto|scroll/.test(oy)) {
        box.t = Math.max(box.t, pr.top);
        box.b = Math.min(box.b, pr.bottom);
      }
    }
    return { box, scroller, r };
  };
  const off = [],
    unclipped = [],
    texts = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest(".sr-only, [aria-hidden=true], svg, canvas")) continue;
    if (
      !el.checkVisibility?.({
        visibilityProperty: true,
        opacityProperty: true,
      })
    )
      continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const direct = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.data.trim(),
    );
    const { box, scroller } = hiddenByAncestor(el);
    const shown = box.r - box.l > 1 && box.b - box.t > 1;
    // 1) 화면 밖: 잘리지도 스크롤되지도 않는데 뷰포트 밖으로 나감
    if (
      cs.position !== "fixed" &&
      (r.right > W + 1 || r.left < -1) &&
      box.r > W + 1 &&
      !scroller
    )
      off.push(label(el));
    // 2) 말줄임 없는 넘침: 글자가 칸보다 넓은데 말줄임·줄 수 제한·스크롤이 없음
    if (
      direct &&
      el.clientWidth > 0 &&
      el.scrollWidth > el.clientWidth + 1 &&
      cs.textOverflow !== "ellipsis" &&
      cs.webkitLineClamp === "none" &&
      !/auto|scroll/.test(cs.overflowX)
    )
      unclipped.push(label(el));
    // 3) 겹침 후보: 글자를 직접 담은 요소의 글자 사각형
    if (direct && shown) {
      const rects = [];
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.data.trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        for (const x of rg.getClientRects())
          if (x.width > 1 && x.height > 1) {
            const l = Math.max(x.left, box.l),
              t = Math.max(x.top, box.t),
              rr = Math.min(x.right, box.r),
              b = Math.min(x.bottom, box.b);
            if (rr - l > 1 && b - t > 1) rects.push([l, t, rr, b]);
          }
      }
      if (rects.length) texts.push({ el, rects });
    }
  }
  const overlaps = [];
  for (let i = 0; i < texts.length; i++)
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i],
        b = texts[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      let hit = false;
      for (const x of a.rects) {
        for (const y of b.rects) {
          const w = Math.min(x[2], y[2]) - Math.max(x[0], y[0]);
          const h = Math.min(x[3], y[3]) - Math.max(x[1], y[1]);
          if (w > 2 && h > 2) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      // 위에 떠 있는 층(고정 머리, 메뉴)이 가린 것은 겹침이 아니라 가림이라 뺀다
      if (hit) {
        const fixed = (el) => {
          for (let p = el; p; p = p.parentElement)
            if (/fixed|sticky/.test(getComputedStyle(p).position)) return true;
          return false;
        };
        if (fixed(a.el) !== fixed(b.el)) continue;
        overlaps.push(`${label(a.el)} × ${label(b.el)}`);
      }
    }
  const u = (a) => [...new Set(a)];
  const cut = (a) => ({ count: u(a).length, items: u(a).slice(0, 12) });
  return {
    offscreen: cut(off),
    unclipped: cut(unclipped),
    overlaps: cut(overlaps),
  };
}

/** 합격 기준. 실패 이유 목록을 돌려준다(비어 있으면 PASS). */
function judge(row) {
  const fails = [];
  const near = (a, b) => Math.abs(a - b) <= TOL;
  if (!row.main) return ["main.workspace-content 없음"];
  if (!row.root) fails.push("본문 루트 없음");
  else {
    if (!near(row.root.left, row.main.left))
      fails.push(`루트 left ${row.root.left} ≠ main ${row.main.left}`);
    if (!near(row.root.right, row.main.right))
      fails.push(`루트 right ${row.root.right} ≠ main ${row.main.right}`);
    if (!near(row.root.top, row.main.top))
      fails.push(`루트 top ${row.root.top} ≠ main ${row.main.top}`);
  }
  if (!row.h1) fails.push("h1 없음");
  else {
    if (!near(row.h1.left, row.main.left))
      fails.push(`h1 left ${row.h1.left} ≠ main ${row.main.left}`);
    if (!row.back && !near(row.h1.top, row.main.top))
      fails.push(`h1 top ${row.h1.top} ≠ main ${row.main.top}`);
    const want = row.width >= 768 ? 28 : 22;
    if (row.h1.fontSize !== want)
      fails.push(`h1 ${row.h1.fontSize}px ≠ ${want}px`);
    if (!row.h1.inHeader) fails.push("h1이 PageHeader(.page-header) 밖");
  }
  const bad = row.buttons.filter((h) => !near(h, 40));
  if (bad.length) fails.push(`머리 버튼 높이 ${[...new Set(bad)].join("/")}`);
  if (row.hscroll > 0) fails.push(`가로 스크롤 ${row.hscroll}px`);
  if (row.stress) {
    if (row.stress.offscreen.count)
      fails.push(`긴 글: 화면 밖 ${row.stress.offscreen.count}`);
    if (row.stress.overlaps.count)
      fails.push(`긴 글: 겹침 ${row.stress.overlaps.count}`);
  }
  return fails;
}

async function settle(page) {
  await page
    .waitForSelector("main.workspace-content h1", { timeout: 6000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
}

async function fullShot(page, file) {
  // 셸이 화면 높이에 맞춰 안쪽에서 스크롤될 수 있어, 본문 높이만큼 뷰포트를 늘려 찍는다
  const size = page.viewportSize();
  const height = await page.evaluate(() => {
    const m = document.querySelector("main.workspace-content");
    const doc = document.documentElement.scrollHeight;
    if (!m) return doc;
    let extra = 0;
    for (let p = m; p; p = p.parentElement)
      extra = Math.max(extra, p.scrollHeight - p.clientHeight);
    return Math.max(doc, innerHeight + extra);
  });
  const tall = Math.min(Math.max(height, size.height), 12000);
  if (tall !== size.height) {
    await page.setViewportSize({ width: size.width, height: tall });
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: file, fullPage: true });
  if (tall !== size.height) await page.setViewportSize(size);
}

const browser = await chromium.launch({ channel: "chrome" });
const rows = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await context.addCookies([{ name: "margin-theme", value: theme, url: base }]);
  const page = await context.newPage();
  // 연구 주소 찾기
  await page.goto(`${base}/r`);
  await page.waitForTimeout(3500);
  const hrefs = () =>
    page.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll("a[href]")].map((a) =>
          a.getAttribute("href"),
        ),
      ),
    ]);
  const research = (await hrefs()).find((h) => /^\/r\/[0-9a-f-]{36}$/.test(h));
  if (!research)
    throw new Error(
      "/r에서 연구를 찾지 못했어요. 미리보기 모드(Supabase 값 비움)로 서버를 켰는지 확인해 주세요.",
    );
  const wanted = ROUTES.filter(
    (r) => !PUBLIC.has(r.name) && (!only.length || only.includes(r.name)),
  );
  const routes = [];
  for (const r of wanted) {
    if (!r.detailOf) {
      routes.push({
        name: r.name,
        path: r.path.replace(":research", research),
      });
      continue;
    }
    await page.goto(`${base}${research}/${r.detailOf}`);
    await page.waitForTimeout(2200);
    const re = new RegExp(r.detailPattern);
    const path = (await hrefs()).find((h) => re.test(h));
    if (path) routes.push({ name: r.name, path });
    else console.error(`# ${r.name}: 상세 링크를 찾지 못해 건너뜀`);
  }
  if (shots) mkdirSync(resolve(shots), { recursive: true });
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(base + route.path);
      await settle(page);
      if (stress) {
        await page.evaluate(inflate);
        await page.waitForTimeout(400);
      }
      const m = await page.evaluate(measure);
      const row = { route: route.name, width, theme, ...m };
      if (stress) row.stress = await page.evaluate(stressReport);
      if (shots)
        await fullShot(
          page,
          join(
            resolve(shots),
            `${route.name}-${width}-${theme}${stress ? "-stress" : ""}.png`,
          ),
        );
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
} finally {
  await browser.close();
  if (outFile)
    writeFileSync(
      resolve(outFile),
      rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
    );
}

if (check) {
  let failed = 0;
  console.log("\n# 판정");
  const byRoute = new Map();
  for (const row of rows) {
    const fails = judge(row);
    if (fails.length) failed++;
    if (!byRoute.has(row.route)) byRoute.set(row.route, []);
    byRoute.get(row.route).push({ width: row.width, fails });
  }
  for (const [route, list] of byRoute) {
    const bad = list.filter((x) => x.fails.length);
    console.log(`${bad.length ? "FAIL" : "PASS"}  ${route}`);
    for (const x of bad)
      console.log(`      ${x.width}: ${x.fails.join(" · ")}`);
  }
  // 같은 너비에서 화면 간 h1 자리 차이
  console.log("\n# 화면 간 h1 자리(같은 너비, 뒤로 가기 줄이 없는 화면)");
  for (const width of widths) {
    const list = rows.filter((r) => r.width === width && r.h1 && !r.back);
    if (!list.length) continue;
    const group = (key) => {
      const m = new Map();
      for (const r of list) {
        const v = Math.round(r.h1[key]);
        m.set(v, [...(m.get(v) ?? []), r.route]);
      }
      return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
    };
    for (const key of ["left", "top"]) {
      const g = group(key);
      const [majority, ...rest] = g;
      const outliers = rest.filter(([v]) => Math.abs(v - majority[0]) > TOL);
      console.log(
        `${width} h1 ${key}: ${majority[0]} (${majority[1].length}개 화면)` +
          (outliers.length
            ? " · 다른 값: " +
              outliers
                .map(([v, names]) => `${v} ← ${names.join(",")}`)
                .join(" / ")
            : " · 모두 같음"),
      );
    }
  }
  console.log(
    failed ? `\n실패 ${failed}건(화면×너비)` : "\n모든 화면×너비 통과",
  );
  if (failed) process.exitCode = 1;
}
