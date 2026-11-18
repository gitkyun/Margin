"""캡처 엔진: 시나리오 하나를 (브라우저·화면 크기·테마) 조합에서 실행해 스크린샷과 검사 결과를 만듭니다.

안정화 원칙(고정 sleep 금지): 시계 고정 → 애니메이션 정지 CSS → 화면 준비 신호 → 글꼴·이미지 로딩 →
레이아웃이 연속 N프레임 같아질 때까지 대기. networkidle 만으로 판단하지 않습니다.
한 시나리오가 실패해도 나머지는 계속 돕니다.
"""

from __future__ import annotations

import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from config import (
    FIXED_TIME_ISO,
    LOCALE,
    READY_TIMEOUT_MS,
    STABLE_FRAMES,
    THEME_COOKIE,
    TIMEZONE,
    Viewport,
)
from layout_checks import run_layout_checks, summarize

FREEZE_CSS = """
*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;
transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}
"""
# 스크린샷에서 가릴 요소(시간·무작위 값). 시계 고정으로 대부분 해결되고, 나머지는 시나리오 mask 로 추가합니다.
GLOBAL_MASKS = ["[data-qa-mask]"]
ERROR_TEXTS = ["이 부분을 표시하지 못했어요"]  # SectionBoundary 의 대체 화면

STABLE_JS = """
async ({frames, timeout}) => {
  const sig = () => {
    const els = document.querySelectorAll('main *, [role=dialog] *, #public-main *');
    let h = els.length * 31 + document.documentElement.scrollHeight * 7 + document.documentElement.scrollWidth;
    for (let i = 0; i < els.length && i < 600; i++) {
      const r = els[i].getBoundingClientRect();
      h = (h * 31 + Math.round(r.x) * 3 + Math.round(r.y) * 5 + Math.round(r.width) * 7 + Math.round(r.height)) % 1000000007;
    }
    return h;
  };
  const start = performance.now();
  let last = -1, same = 0;
  while (performance.now() - start < timeout) {
    await Promise.race([new Promise((r) => requestAnimationFrame(r)), new Promise((r) => setTimeout(r, 120))]);
    const s = sig();
    same = s === last ? same + 1 : 0;
    last = s;
    if (same >= frames) return {stable: true, ms: Math.round(performance.now() - start)};
  }
  return {stable: false, ms: Math.round(performance.now() - start)};
}
"""

ASSETS_JS = """
async (timeout) => {
  const t0 = performance.now();
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, timeout))]); } catch {}
  const imgs = [...document.images].filter((i) => i.loading !== 'lazy' || i.getBoundingClientRect().top < innerHeight * 2);
  await Promise.race([
    Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))),
    new Promise((r) => setTimeout(r, Math.max(500, timeout - (performance.now() - t0)))),
  ]);
  const badFonts = [...document.fonts].filter((f) => f.status === 'error').map((f) => f.family);
  const pending = imgs.filter((i) => !i.complete).length;
  return {badFonts, pendingImages: pending};
}
"""

SCROLLER_JS = """
(sel) => {
  const cands = sel ? [...document.querySelectorAll(sel)] : [...document.querySelectorAll('main, main *, [role=dialog] *')];
  let best = null, area = 0;
  for (const el of cands) {
    const s = getComputedStyle(el);
    if (!/auto|scroll/.test(s.overflowY) || el.scrollHeight <= el.clientHeight + 2) continue;
    const a = el.clientWidth * el.clientHeight;
    if (a > area) { best = el; area = a; }
  }
  if (!best) {
    const de = document.scrollingElement;
    if (de.scrollHeight > innerHeight + 2) return {mode: 'document', scrollHeight: de.scrollHeight, clientHeight: innerHeight, selector: null};
    return null;
  }
  best.setAttribute('data-qa-scroller', '1');
  return {mode: 'element', scrollHeight: best.scrollHeight, clientHeight: best.clientHeight, selector: '[data-qa-scroller]'};
}
"""


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9가-힣]+", "-", text.lower()).strip("-")


def context_kwargs(vp: Viewport) -> dict[str, Any]:
    return dict(
        viewport={"width": vp.width, "height": vp.height},
        device_scale_factor=vp.dpr,
        is_mobile=vp.mobile,
        has_touch=vp.touch,
        locale=LOCALE,
        timezone_id=TIMEZONE,
        reduced_motion="reduce",
        service_workers="block",
    )


def new_context(browser, vp: Viewport, theme: str, base_url: str, storage_state=None):
    kwargs = context_kwargs(vp)
    if vp.mobile and browser.browser_type.name == "firefox":  # 방어: Firefox 는 is_mobile 미지원
        kwargs.pop("is_mobile")
    if storage_state:
        kwargs["storage_state"] = storage_state
    ctx = browser.new_context(color_scheme=theme, **kwargs)
    ctx.set_default_timeout(20000)
    ctx.set_default_navigation_timeout(30000)
    ctx.clock.set_fixed_time(datetime.fromisoformat(FIXED_TIME_ISO))
    host = re.sub(r"^https?://", "", base_url).split("/")[0].split(":")[0]
    ctx.add_cookies([{"name": THEME_COOKIE, "value": theme, "domain": host, "path": "/"}])
    ctx.add_init_script(
        "document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');"
        f"s.textContent={FREEZE_CSS!r};document.head.appendChild(s)}});"
    )
    return ctx


class PageProbe:
    """페이지의 실행 오류(예외·콘솔 오류·실패한 요청)를 모읍니다."""

    def __init__(self, page, base_url: str):
        self.errors: list[str] = []
        self.console: list[str] = []
        self.network: list[str] = []
        origin = re.match(r"^https?://[^/]+", base_url).group(0)
        page.on("pageerror", lambda e: self.errors.append(str(e)[:300]))
        page.on("console", lambda m: self.console.append(m.text[:300]) if m.type == "error" else None)
        page.on("requestfailed", lambda r: self.network.append(f"실패 {r.method} {r.url[:120]} — {r.failure}") if r.url.startswith(origin) or "supabase" in r.url else None)

        def on_response(resp):
            if resp.status >= 400 and (resp.url.startswith(origin) or "supabase" in resp.url):
                self.network.append(f"HTTP {resp.status} {resp.request.method} {resp.url[:120]}")

        page.on("response", on_response)


def wait_ready(page, scenario: dict[str, Any], timeout: int = READY_TIMEOUT_MS) -> dict[str, Any]:
    """화면이 찍을 준비가 됐는지 기다립니다. 반환: 단계별 소요·경고."""
    notes: dict[str, Any] = {}
    # 1) 로딩 표시가 사라질 때까지(스켈레톤 role=status 'loading-state')
    page.locator(".loading-state").first.wait_for(state="detached", timeout=timeout) if page.locator(".loading-state").count() else None
    # 2) 시나리오가 정한 준비 신호, 없으면 본문 영역
    ready = scenario.get("ready") or "#main-content, #public-main, main, .not-found, h1"
    page.locator(f"{ready} >> visible=true").first.wait_for(state="visible", timeout=timeout)
    # 3) 글꼴·이미지
    assets = page.evaluate(ASSETS_JS, 5000)
    notes.update(assets)
    # 4) 레이아웃 안정
    stable = page.evaluate(STABLE_JS, {"frames": STABLE_FRAMES, "timeout": 6000})
    notes["stable"] = stable["stable"]
    return notes


def _locator(page, spec: dict[str, Any]):
    if "css" in spec:
        return page.locator(spec["css"]).first
    if "role" in spec:
        return page.get_by_role(spec["role"], name=spec.get("name"), exact=spec.get("exact", True)).first
    if "label" in spec:
        return page.get_by_label(spec["label"]).first
    if "text" in spec:
        return page.get_by_text(spec["text"], exact=spec.get("exact", True)).first
    raise ValueError(f"알 수 없는 선택 방식: {spec}")


def run_steps(page, steps: list[dict[str, Any]]) -> list[str]:
    """상호작용 실행. 필수 단계가 실패하면 예외, optional 이면 건너뛰고 기록합니다."""
    log: list[str] = []
    for step in steps:
        optional = step.get("optional", False)
        try:
            if "click" in step:
                loc = _locator(page, step["click"])
                loc.wait_for(state="visible", timeout=4000 if optional else 8000)
                loc.click(timeout=5000)
                log.append(f"click {step['click']}")
            elif "hover" in step:
                _locator(page, step["hover"]).hover(timeout=5000)
                log.append(f"hover {step['hover']}")
            elif "press" in step:
                page.keyboard.press(step["press"])
                log.append(f"press {step['press']}")
            elif "fill" in step:
                spec = dict(step["fill"])
                _locator(page, spec).fill(spec["value"], timeout=5000)
                log.append(f"fill {spec.get('label') or spec.get('css')}")
            elif "wait" in step:
                page.locator(step["wait"]).first.wait_for(state="visible", timeout=8000)
                log.append(f"wait {step['wait']}")
            else:
                raise ValueError(f"알 수 없는 단계: {step}")
        except Exception as error:  # noqa: BLE001
            if not optional:
                raise RuntimeError(f"단계 실패 {step}: {str(error).splitlines()[0]}") from error
            log.append(f"건너뜀(optional) {step}")
    return log


def _mask_locators(page, selectors: list[str]):
    return [page.locator(s) for s in GLOBAL_MASKS + selectors]


def take_shots(page, scenario: dict[str, Any], out_base: Path, tier: str) -> list[dict[str, Any]]:
    """캡처 방식: viewport | full | element | scroll. 전체(full) 모드에서는 내부 스크롤 영역 상·중·하를 자동 추가."""
    cap = scenario.get("capture") or {"mode": "viewport"}
    mode = cap.get("mode", "viewport")
    masks = _mask_locators(page, scenario.get("mask", []))
    shots: list[dict[str, Any]] = []

    def shoot(suffix: str, kind: str, **kw) -> None:
        path = out_base.with_name(out_base.name + (f"--{suffix}" if suffix else "") + ".png")
        path.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(path), mask=masks, animations="disabled", caret="hide", **kw)
        shots.append({"label": suffix or "화면", "kind": kind, "file": path.name})

    if mode == "full":
        shoot("", "full", full_page=True)
    elif mode == "element":
        loc = page.locator(cap["selector"]).first
        path = out_base.with_name(out_base.name + ".png")
        path.parent.mkdir(parents=True, exist_ok=True)
        loc.screenshot(path=str(path), animations="disabled", caret="hide", mask=masks)
        shots.append({"label": "요소", "kind": "element", "file": path.name})
    else:
        shoot("", "viewport")

    wants_scroll = mode == "scroll" or (tier == "full" and mode == "viewport")
    if wants_scroll:
        info = page.evaluate(SCROLLER_JS, cap.get("selector") if mode == "scroll" else None)
        if info and info["scrollHeight"] - info["clientHeight"] > 120:
            span = info["scrollHeight"] - info["clientHeight"]
            for name, frac in (cap.get("positions") and [(p, {"top": 0, "middle": 0.5, "bottom": 1}[p]) for p in cap["positions"]]) or [("top", 0), ("middle", 0.5), ("bottom", 1)]:
                if name == "top" and shots:  # 위쪽은 기본 캡처와 같아 중복 방지
                    continue
                target = int(span * frac)
                if info["mode"] == "document":
                    page.evaluate("(y)=>window.scrollTo(0,y)", target)
                else:
                    page.evaluate("([s,y])=>{document.querySelector(s).scrollTop=y}", [info["selector"], target])
                page.evaluate(STABLE_JS, {"frames": 2, "timeout": 2000})
                shoot(f"scroll-{name}", "scroll")
            if info["mode"] == "element":
                page.evaluate("([s])=>{document.querySelector(s).scrollTop=0}", [info["selector"]])
            shots[0].setdefault("scroll", {"scrollHeight": info["scrollHeight"], "clientHeight": info["clientHeight"]})
    return shots


def run_scenario(page, scenario: dict[str, Any], url: str, out_base: Path, tier: str, base_url: str) -> dict[str, Any]:
    """시나리오 하나를 실행해 결과 조각(상태·스크린샷·배치 문제·실행 오류)을 돌려줍니다."""
    started = time.time()
    probe = PageProbe(page, base_url)
    result: dict[str, Any] = {"status": "passed", "reason": "", "shots": [], "issues": [], "steps": [], "notes": {}}
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        # 상호작용이 있으면 ready 신호는 '상호작용 뒤' 상태를 가리킵니다. 첫 로딩은 기본 신호로 기다립니다.
        result["notes"].update(wait_ready(page, {} if scenario.get("steps") else scenario))
        if scenario.get("steps"):
            result["steps"] = run_steps(page, scenario["steps"])
            result["notes"].update({"after_steps": wait_ready(page, scenario)})
        # 화면에 에러 대체 문구가 떠 있으면 실행 오류로 기록
        for text in ERROR_TEXTS:
            if page.get_by_text(text).count():
                probe.errors.append(f"화면에 오류 대체 문구 표시: {text}")
        layout = run_layout_checks(page, scenario.get("ignore"))
        result["issues"] = layout["issues"]
        result["metrics"] = layout["metrics"]
        result["shots"] = take_shots(page, scenario, out_base, tier)
    except Exception as error:  # noqa: BLE001 - 시나리오 하나의 실패가 전체를 멈추지 않게 함
        result["status"] = "failed"
        result["reason"] = str(error).splitlines()[0][:300]
        try:  # 실패 화면도 증거로 남깁니다.
            fail = out_base.with_name(out_base.name + "--FAILED.png")
            fail.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(fail), animations="disabled")
            result["shots"] = [{"label": "실패 시점", "kind": "failure", "file": fail.name}]
        except Exception:  # noqa: BLE001
            pass
    result["runtime"] = {"errors": probe.errors, "console": probe.console, "network": probe.network}
    result["counts"] = summarize(result["issues"])
    result["duration_s"] = round(time.time() - started, 2)
    return result
