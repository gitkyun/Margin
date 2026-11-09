#!/usr/bin/env node
/**
 * 화면 회귀 그물: 여러 너비·테마로 화면을 캡처하고 배치 검사와 계산된 스타일을 JSON으로 남깁니다.
 * 두 번 찍은 결과를 비교해 바뀐 스타일·새로 생긴 배치 문제를 보여 줍니다.
 *
 * 의존성 없음: 설치된 Chrome을 헤드리스로 띄우고 Node 22의 WebSocket으로 DevTools 프로토콜을 씁니다.
 * 결과(스크린샷·JSON)는 저장소에 커밋하지 않습니다. 기본 위치는 시스템 임시 폴더입니다.
 *
 * 쓰는 법 (apps/home-preview):
 *   1) 미리보기 모드로 개발 서버를 켭니다.
 *      VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 5174
 *   2) 캡처: node scripts/qa/screens.mjs capture [--base http://localhost:5174] [--out 폴더]
 *            [--widths 360,390,768,1024,1440] [--themes light,dark] [--only home,meetings]
 *   3) 비교: node scripts/qa/screens.mjs compare 이전/results.json 이후/results.json
 *
 * Chrome 위치는 CHROME_PATH로 바꿀 수 있습니다.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ROUTES, STYLE_PROBES } from "./routes.mjs";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { ok, fail } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error
          ? fail(new Error(`${msg.error.message}`))
          : ok(msg.result ?? {});
      } else if (msg.method) this.events.push(msg);
    };
  }
  open() {
    return new Promise((ok, fail) => {
      this.ws.onopen = ok;
      this.ws.onerror = fail;
    });
  }
  call(method, params = {}) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((ok, fail) => this.pending.set(id, { ok, fail }));
  }
  async evaluate(expression) {
    const r = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    return r.result?.value;
  }
}

async function launchChrome() {
  const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!chrome)
    throw new Error("Chrome을 찾지 못했어요. CHROME_PATH를 지정해 주세요.");
  const profile = mkdtempSync(join(tmpdir(), "margin-qa-profile-"));
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let tabs;
  for (let i = 0; i < 60 && !tabs; i++) {
    try {
      tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    } catch {
      await sleep(200);
    }
  }
  if (!tabs) throw new Error("Chrome 디버깅 포트에 연결하지 못했어요.");
  const cdp = new Cdp(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await cdp.open();
  await cdp.call("Page.enable");
  await cdp.call("Runtime.enable");
  await cdp.call("Network.enable");
  const close = () => {
    proc.kill();
    rmSync(profile, { recursive: true, force: true });
  };
  return { cdp, close };
}

/** 화면에서 바로 계산하는 배치 검사(가로 넘침, 화면 밖 요소, 말줄임, 버튼 두 줄, 마지막 줄 한두 글자). */
const LAYOUT_CHECK = `(() => {
  const W = innerWidth, d = document, de = d.documentElement;
  const off = [], clip = [], wrap = [], orph = [];
  const label = (el) => (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase());
  const textLines = (el) => { const tw = d.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const s = new Set();
    while ((n = tw.nextNode())) { if (!n.textContent.trim()) continue; const rg = d.createRange(); rg.selectNodeContents(n); [...rg.getClientRects()].forEach((x) => x.width > 1 && s.add(Math.round(x.top))); }
    return s.size; };
  for (const el of d.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || el.closest("[aria-hidden=true],.sr-only")) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.right > W + 1 && cs.position !== "fixed" && !el.closest("canvas,svg")) {
      let p = el.parentElement, clipped = false;
      while (p) { if (/hidden|clip|auto|scroll/.test(getComputedStyle(p).overflowX)) { clipped = true; break; } p = p.parentElement; }
      if (!clipped) off.push(label(el));
    }
    if ((cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none") && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && el.textContent.trim()) clip.push(el.textContent.trim().slice(0, 28));
    if (el.matches("button,[role=tab],[role=radio],a[data-slot=button]") && el.textContent.trim() && textLines(el) > 1) wrap.push(el.textContent.trim().slice(0, 22));
  }
  for (const el of d.querySelectorAll("h1,h2,h3,h4,p,li,dt,dd,figcaption,label")) {
    const t = el.textContent.trim(); if (!t || el.closest("[aria-hidden=true]")) continue;
    const rg = d.createRange(); rg.selectNodeContents(el);
    const rs = [...rg.getClientRects()].filter((x) => x.width > 1);
    const rows = [...new Set(rs.map((x) => Math.round(x.bottom)))]; if (rows.length < 2) continue;
    const last = Math.max(...rows);
    const w = rs.filter((x) => Math.round(x.bottom) === last).reduce((a, x) => a + x.width, 0);
    if (w < parseFloat(getComputedStyle(el).fontSize) * 2.3) orph.push(t.slice(-12));
  }
  const u = (a) => [...new Set(a)].slice(0, 10);
  return { theme: de.dataset.theme, hscroll: de.scrollWidth - W, offscreen: u(off), clipped: u(clip), wrappedControls: u(wrap), orphans: u(orph) };
})()`;

const styleDump = (probes) => `(() => {
  const props = ["color","backgroundColor","borderColor","fontSize","fontWeight","lineHeight","borderRadius","height","boxShadow"];
  const out = {};
  for (const sel of ${JSON.stringify(probes)}) {
    [...document.querySelectorAll(sel)].slice(0, 3).forEach((el, i) => {
      const cs = getComputedStyle(el);
      out[sel + "#" + i] = Object.fromEntries(props.map((p) => [p, p === "height" ? Math.round(el.getBoundingClientRect().height) + "px" : cs[p]]));
    });
  }
  return out;
})()`;

async function discover(cdp, base) {
  await cdp.call("Page.navigate", { url: `${base}/r` });
  await sleep(3000);
  const research = await cdp.evaluate(
    `[...document.querySelectorAll("a")].map((a) => a.getAttribute("href")).find((h) => /^\\/r\\/[0-9a-f-]{36}$/.test(h || ""))`,
  );
  if (!research)
    throw new Error(
      "/r에서 연구를 찾지 못했어요. 미리보기 모드(Supabase 값 비움)로 서버를 켰는지 확인해 주세요.",
    );
  const ids = { research };
  for (const r of ROUTES.filter((r) => r.detailOf)) {
    await cdp.call("Page.navigate", {
      url: `${base}${research}/${r.detailOf}`,
    });
    await sleep(2200);
    ids[r.name] = await cdp.evaluate(
      `(() => { const re = new RegExp(${JSON.stringify(r.detailPattern)}); return [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")))].find((h) => re.test(h)) ?? null; })()`,
    );
  }
  return ids;
}

async function capture() {
  const base = arg("base", "http://localhost:5174");
  const out = resolve(arg("out", mkdtempSync(join(tmpdir(), "margin-qa-"))));
  const widths = arg("widths", "360,390,768,1024,1440").split(",").map(Number);
  const themes = arg("themes", "light,dark").split(",");
  const only = arg("only", "")?.split(",").filter(Boolean);
  mkdirSync(out, { recursive: true });
  const { cdp, close } = await launchChrome();
  const host = new URL(base).hostname;
  const results = [];
  try {
    const ids = await discover(cdp, base);
    const routes = ROUTES.filter((r) => !only?.length || only.includes(r.name))
      .map((r) => ({
        ...r,
        path: r.detailOf
          ? ids[r.name]
          : r.path.replace(":research", ids.research),
      }))
      .filter((r) => r.path);
    for (const theme of themes) {
      await cdp.call("Network.setCookie", {
        name: "margin-theme",
        value: theme,
        domain: host,
        path: "/",
      });
      for (const width of widths) {
        await cdp.call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: width < 768,
        });
        for (const route of routes) {
          cdp.events.length = 0;
          await cdp.call("Page.navigate", { url: base + route.path });
          await sleep(2400);
          const layout = await cdp.evaluate(LAYOUT_CHECK);
          const styles = await cdp.evaluate(styleDump(STYLE_PROBES));
          const errors = cdp.events
            .filter(
              (e) =>
                e.method === "Runtime.exceptionThrown" ||
                (e.method === "Runtime.consoleAPICalled" &&
                  e.params.type === "error"),
            )
            .map((e) =>
              (
                e.params.exceptionDetails?.exception?.description ??
                e.params.args?.[0]?.value ??
                ""
              )
                .toString()
                .slice(0, 200),
            );
          const shot = `${route.name}-${width}-${theme}.png`;
          const png = await cdp.call("Page.captureScreenshot", {
            format: "png",
          });
          writeFileSync(join(out, shot), Buffer.from(png.data, "base64"));
          const row = {
            route: route.name,
            width,
            theme,
            ...layout,
            errors,
            styles,
            shot,
          };
          results.push(row);
          const flags = [
            row.hscroll > 0 && `가로 넘침 ${row.hscroll}px`,
            row.offscreen.length && "화면 밖",
            row.clipped.length && "말줄임",
            row.errors.length && "콘솔 오류",
            row.theme !== theme && "테마 불일치",
          ].filter(Boolean);
          console.log(
            `${route.name.padEnd(18)} ${String(width).padStart(4)} ${theme.padEnd(5)} ${flags.join(", ") || "ok"}`,
          );
        }
      }
    }
  } finally {
    writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 1));
    close();
  }
  console.log(`\n결과: ${out}`);
}

function compare(beforePath, afterPath) {
  const key = (r) => `${r.route} ${r.width} ${r.theme}`;
  const before = new Map(
    JSON.parse(readFileSync(beforePath, "utf8")).map((r) => [key(r), r]),
  );
  const after = JSON.parse(readFileSync(afterPath, "utf8"));
  let changes = 0;
  for (const a of after) {
    const b = before.get(key(a));
    if (!b) continue;
    const lines = [];
    for (const field of [
      "offscreen",
      "clipped",
      "wrappedControls",
      "orphans",
      "errors",
    ]) {
      const added = a[field].filter((x) => !b[field].includes(x));
      if (added.length) lines.push(`  + ${field}: ${added.join(" | ")}`);
    }
    if (a.hscroll > b.hscroll)
      lines.push(`  + 가로 넘침 ${b.hscroll} → ${a.hscroll}px`);
    for (const [probe, style] of Object.entries(a.styles)) {
      const prev = b.styles[probe];
      if (!prev) continue;
      for (const [prop, value] of Object.entries(style))
        if (prev[prop] !== value)
          lines.push(`  ~ ${probe} ${prop}: ${prev[prop]} → ${value}`);
    }
    if (lines.length) {
      changes += lines.length;
      console.log(key(a));
      console.log(lines.join("\n"));
    }
  }
  console.log(changes ? `\n바뀐 곳 ${changes}개` : "바뀐 곳 없음");
}

const [command, ...rest] = process.argv.slice(2);
if (command === "capture") await capture();
else if (command === "compare" && rest.length >= 2) compare(rest[0], rest[1]);
else {
  console.log(
    "사용법: node scripts/qa/screens.mjs capture [--base URL] [--out 폴더] [--widths 360,1440] [--themes light,dark] [--only home]",
  );
  console.log(
    "        node scripts/qa/screens.mjs compare 이전/results.json 이후/results.json",
  );
  process.exitCode = command ? 1 : 0;
}
