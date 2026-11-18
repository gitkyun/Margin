#!/usr/bin/env python3
"""Margin 전체 화면 자동 캡처 · UI QA 실행기.

    python scripts/qa/python/capture_all.py --mode smoke
    python scripts/qa/python/capture_all.py --mode standard --compare baseline
    python scripts/qa/python/capture_all.py approve --run latest --page home      # 기준 이미지 승인(별도 작업)

자세한 사용법은 README.md.
"""

from __future__ import annotations

import argparse
import itertools
import json
import os
import platform
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import auth  # noqa: E402
import browsers as browsers_mod  # noqa: E402
import capture  # noqa: E402
import report  # noqa: E402
import safari_runner  # noqa: E402
import scenarios as scn  # noqa: E402
import visual_diff  # noqa: E402
from config import (  # noqa: E402
    BASELINE_ROOT,
    BROWSERS,
    DEFAULT_BASE_URL,
    MODES,
    REPO_DIR,
    RESULTS_ROOT,
    THEMES,
    VIEWPORTS,
    boundary_viewports,
    host_os_tag,
)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Margin 화면 캡처 · UI QA")
    p.add_argument("command", nargs="?", choices=["run", "approve", "list"], default="run")
    p.add_argument("--mode", choices=list(MODES), default="smoke")
    p.add_argument("--browser", help="chrome,webkit,safari,chrome-stable (쉼표). 기본: 모드 설정")
    p.add_argument("--viewport", help=f"쉼표 구분: {','.join(VIEWPORTS)}")
    p.add_argument("--boundaries", action="store_true", help="반응형 경계 너비(664·768·864·992·1024·1200 전후)도 검사")
    p.add_argument("--theme", choices=["light", "dark", "both"], help="기본: 모드 설정")
    p.add_argument("--page", help="화면 묶음(쉼표): home,meetings,tasks,docs,flow,assistant ...")
    p.add_argument("--scenario", help="시나리오 id(쉼표)")
    p.add_argument("--changed", nargs="?", const="main", metavar="REF", help="git 변경 파일 기준으로 영향 받는 화면만(기본 REF=main)")
    p.add_argument("--compare", metavar="baseline|실행폴더", help="기준 이미지 또는 이전 실행 결과와 시각 비교")
    p.add_argument("--base-url", default=os.environ.get("MARGIN_QA_BASE_URL", DEFAULT_BASE_URL))
    p.add_argument("--target", choices=["preview", "connected"], default="preview", help="preview: 가상 데이터(서버 없음) / connected: 서버 계정 로그인")
    p.add_argument("--role", default=None, help="이 역할의 시나리오만")
    p.add_argument("--out", help="결과 폴더(기본 qa-results/runs/<시각>)")
    p.add_argument("--headed", action="store_true", help="브라우저 창을 보이며 실행")
    p.add_argument("--fail-on", choices=["never", "failed", "confirmed"], default="never", help="종료 코드 기준(기본: 항상 0)")
    p.add_argument("--no-report", action="store_true")
    p.add_argument("--run", default="latest", help="approve: 승인할 실행 폴더(기본 latest)")
    p.add_argument("--yes", action="store_true", help="approve: 확인 질문 없이 진행")
    return p.parse_args(argv)


def git_info() -> dict[str, str]:
    def run(*a: str) -> str:
        try:
            return subprocess.run(["git", *a], cwd=REPO_DIR, capture_output=True, text=True, check=True).stdout.strip()
        except Exception:  # noqa: BLE001
            return ""

    return {"commit": run("rev-parse", "--short", "HEAD"), "branch": run("branch", "--show-current"), "dirty": bool(run("status", "--porcelain", "--", "apps/home-preview/src"))}


def seed_and_discover(browser, base_url: str, needed: list[dict[str, str]], vp, args) -> tuple[dict | None, dict[str, Any]]:
    """가상 데이터를 한 번 만들어(IndexedDB) 저장하고, 동적 주소(연구·미팅·자료 …)를 찾습니다."""
    ids: dict[str, Any] = {"detail": {}}
    ctx = capture.new_context(browser, vp, "light", base_url)
    try:
        page = ctx.new_page()
        page.goto(f"{base_url}/r", wait_until="domcontentloaded", timeout=30000)
        link = page.locator("a[href^='/r/']").filter(has_not=page.locator("[data-never]"))
        page.wait_for_function(
            "() => [...document.querySelectorAll('a')].some(a => /^\\/r\\/[0-9a-f-]{36}$/.test(a.getAttribute('href')||''))", timeout=20000
        )
        ids["research"] = page.evaluate(
            "() => [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).find(h => /^\\/r\\/[0-9a-f-]{36}$/.test(h||''))"
        )
        for d in needed:
            page.goto(f"{base_url}{ids['research']}/{d['of']}", wait_until="domcontentloaded")
            capture.wait_ready(page, {})
            found = page.evaluate(
                "(p) => { const re = new RegExp(p); return [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))].find(h => re.test(h)) ?? null }",
                d["pattern"],
            )
            ids["detail"][f"{d['of']}|{d['pattern']}"] = found
        return ctx.storage_state(indexed_db=True), ids
    except Exception as error:  # noqa: BLE001
        ids["error"] = str(error).splitlines()[0][:200]
        return None, ids
    finally:
        ctx.close()


def compare_source(args) -> Path | None:
    """--compare 가 가리키는 기준 폴더 루트. baseline → BASELINE_ROOT, 그 외는 이전 실행의 screenshots/."""
    if not args.compare:
        return None
    if args.compare == "baseline":
        return BASELINE_ROOT
    run_dir = resolve_run(args.compare)
    return run_dir / "screenshots"


def resolve_run(name: str) -> Path:
    path = RESULTS_ROOT / "latest" if name == "latest" else (Path(name) if Path(name).is_absolute() else RESULTS_ROOT / "runs" / name)
    path = path.resolve()
    if not (path / "manifest.json").exists():
        raise SystemExit(f"실행 결과를 찾을 수 없어요: {path}")
    return path


def baseline_file(src_root: Path, args, browser: str, vp, theme: str, filename: str) -> Path:
    if args.compare == "baseline":
        return visual_diff.baseline_dir(browser, vp.key, vp.dpr, theme, src_root) / filename
    return src_root / browser / vp.key / theme / filename


def do_run(args: argparse.Namespace) -> int:
    mode = MODES[args.mode]
    target_kind = auth.check_target(args.base_url, args.target)
    all_scn = scn.load_scenarios()
    pages = args.page.split(",") if args.page else None
    changed_files: list[str] = []
    if args.changed:
        pages, changed_files = scn.changed_pages(args.changed)
        print(f"변경 감지({args.changed}): 파일 {len(changed_files)}개 → 화면 {pages or '공용 변경: smoke 전체'}")
    selected = scn.select(all_scn, mode["tier"], pages, args.scenario.split(",") if args.scenario else None, args.role)
    if args.changed and pages is None:
        selected = scn.select(all_scn, "smoke", None, None, args.role)
    if not selected:
        print("선택된 시나리오가 없어요."); return 2

    browser_names = args.browser.split(",") if args.browser else mode["browsers"]
    for b in browser_names:
        if b not in BROWSERS:
            raise SystemExit(f"알 수 없는 브라우저: {b} (가능: {', '.join(BROWSERS)})")
    vp_names = args.viewport.split(",") if args.viewport else mode["viewports"]
    all_vps = {**VIEWPORTS, **(boundary_viewports() if args.boundaries else {})}
    if args.boundaries and not args.viewport:
        vp_names = list(vp_names) + list(boundary_viewports())
    viewports = [all_vps[n] for n in vp_names]
    themes = list(THEMES) if args.theme == "both" else ([args.theme] if args.theme else mode["themes"])

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    out = Path(args.out).resolve() if args.out else RESULTS_ROOT / "runs" / stamp
    shots_root = out / "screenshots"
    shots_root.mkdir(parents=True, exist_ok=True)
    cmp_root = compare_source(args)

    runnable = [s for s in selected if not s.get("unavailable") and (s.get("needs", "preview") == args.target or args.target == "connected")]
    skipped = [s for s in selected if s.get("unavailable") or s.get("needs", "preview") != args.target and args.target == "preview"]
    records: list[dict[str, Any]] = []
    for s in skipped:
        records.append(base_record(s, "-", None, None, "skipped", s.get("unavailable") or f"{s.get('needs')} 모드 전용"))

    playwright_browsers = [b for b in browser_names if b != "safari"]
    versions: dict[str, str] = {}
    started = time.time()
    total = len(runnable) * len(viewports) * len(themes) * len(playwright_browsers)
    done = 0
    if playwright_browsers:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as pw:
            for bname in playwright_browsers:
                try:
                    handle = browsers_mod.launch(pw, bname, args.headed)
                except RuntimeError as error:
                    print(f"[{bname}] {error}")
                    for s in runnable:
                        records.append(base_record(s, bname, None, None, "skipped", f"브라우저를 실행하지 못했어요: {str(error).splitlines()[0]}"))
                    continue
                versions[bname] = handle.version
                print(f"\n=== {bname} {handle.version} ({handle.label}) ===")
                state, ids = seed_and_discover(handle.browser, args.base_url, scn.detail_requests(runnable), VIEWPORTS["desktop"], args)
                if state is None:
                    why = ids.get("error", "가상 데이터를 준비하지 못했어요")
                    print(f"  시드 실패: {why}")
                    for s in runnable:
                        records.append(base_record(s, bname, None, None, "skipped", f"테스트 데이터 준비 실패: {why}"))
                    handle.close()
                    continue
                for theme, vp in itertools.product(themes, viewports):
                    for s in runnable:
                        done += 1
                        url_path, why = scn.resolve_url(s, ids)
                        rec = base_record(s, bname, vp, theme, "skipped", why)
                        if s.get("min_width") and vp.width < s["min_width"]:
                            rec["reason"] = f"{s['min_width']}px 미만 화면에는 이 기능이 없어요(모바일은 하단 탭 바). 해당 없음으로 기록"
                            records.append(rec); print(f"  [{done}/{total}] 해당없음 {s['id']} @{vp.width}"); continue
                        if url_path is None:
                            records.append(rec); print(f"  [{done}/{total}] 미검사 {s['id']} — {why}"); continue
                        base_name = shots_root / bname / vp.key / theme / s["id"]
                        ctx = capture.new_context(handle.browser, vp, theme, args.base_url, state)
                        try:
                            page = ctx.new_page()
                            res = capture.run_scenario(page, s, args.base_url + url_path, base_name, mode["tier"], args.base_url)
                        finally:
                            ctx.close()
                        rec.update(res)
                        rec["url"] = url_path
                        attach_compare(rec, shots_root, out, cmp_root, args, bname, vp, theme)
                        records.append(rec)
                        c = rec["counts"]
                        flag = rec["status"] if rec["status"] != "passed" else "ok"
                        print(f"  [{done}/{total}] {bname:7} {vp.key:14} {theme:5} {s['id']:22} {flag:6} 확인된 {c['confirmed']} / 의심 {c['suspect']} / 예외 {c['allowed']}  {rec.get('reason','')[:70]}")
                handle.close()

    safari_status = None
    if "safari" in browser_names:
        print("\n=== safari (실제 Safari) ===")
        safari_status = run_safari(args, runnable, viewports, themes, out, shots_root, records, cmp_root)

    manifest = build_manifest(args, mode, out, records, selected, browser_names, viewports, themes, versions, target_kind, safari_status, time.time() - started, all_scn, changed_files)
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "results.json").write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "issues.json").write_text(json.dumps(flatten_issues(records), ensure_ascii=False, indent=1), encoding="utf-8")
    if not args.no_report:
        report.build(out, manifest, records)
    link_latest(out)
    print_summary(manifest, out)
    return exit_code(args.fail_on, records)


def base_record(s, browser, vp, theme, status, reason) -> dict[str, Any]:
    return {
        "key": f"{browser}|{vp.key if vp else '-'}|{theme or '-'}|{s['id']}",
        "scenario": s["id"], "page": s["page"], "title": s["title"], "role": s.get("role", "student"),
        "browser": browser, "viewport": ({"name": vp.name, "width": vp.width, "height": vp.height, "dpr": vp.dpr, "mobile": vp.mobile, "touch": vp.touch} if vp else None),
        "theme": theme, "status": status, "reason": reason, "shots": [], "issues": [], "counts": {"confirmed": 0, "suspect": 0, "allowed": 0},
        "runtime": {"errors": [], "console": [], "network": []}, "steps": [], "url": s.get("route") or s.get("detail", {}).get("of", ""),
        "repro": repro_command(s, browser, vp, theme),
    }


def repro_command(s, browser, vp, theme) -> str:
    parts = ["python scripts/qa/python/capture_all.py", f"--scenario {s['id']}", "--mode full"]
    if browser != "-":
        parts.append(f"--browser {browser}")
    if vp:
        parts.append(f"--viewport {vp.name}")
    if theme:
        parts.append(f"--theme {theme}")
    return " ".join(parts) + "  (미리보기 서버: VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 5174)"


def attach_compare(rec, shots_root: Path, out: Path, cmp_root: Path | None, args, bname, vp, theme) -> None:
    if cmp_root is None:
        return
    for shot in rec["shots"]:
        cur = shots_root / bname / vp.key / theme / shot["file"]
        base = baseline_file(cmp_root, args, bname, vp, theme, shot["file"])
        diff_path = out / "differences" / bname / vp.key / theme / shot["file"]
        result = visual_diff.compare_images(cur, base, diff_path)
        result["baseline"] = os.path.relpath(base, out) if base.exists() else None
        result["diff"] = os.path.relpath(diff_path, out) if result.get("diff") else None
        shot["compare"] = result


def run_safari(args, runnable, viewports, themes, out, shots_root, records, cmp_root) -> dict[str, Any]:
    sel_vps = [v for v in viewports if v.name in ("desktop", "phone")] or viewports[:1]
    res = safari_runner.run(args.base_url, runnable, sel_vps, themes, shots_root)
    print(f"  상태: {res['status']} {res['reason']}")
    by_id = {s["id"]: s for s in runnable}
    if res["status"] != "ran":
        for s in runnable:
            records.append(base_record(s, "safari", None, None, "skipped", res["reason"]))
        return {"status": res["status"], "reason": res["reason"]}
    vps = {v.name: v for v in sel_vps}
    for r in res["records"]:
        s, vp = by_id[r["scenario"]], vps[r["viewport"]]
        rec = base_record(s, "safari", vp, "light", r["status"], r.get("reason", ""))
        rec["issues"] = r["issues"]
        rec["counts"] = capture.summarize(r["issues"])
        if r.get("shot"):
            rec["shots"] = [{"label": "화면", "kind": "viewport", "file": Path(r["shot"]).name}]
        records.append(rec)
    return {"status": "ran", "reason": ""}


def flatten_issues(records) -> list[dict[str, Any]]:
    out = []
    for r in records:
        for i in r["issues"]:
            out.append({"record": r["key"], "scenario": r["scenario"], "browser": r["browser"], "viewport": r["viewport"]["name"] if r["viewport"] else None, "theme": r["theme"], **i})
        for kind in ("errors", "console", "network"):
            for msg in r["runtime"][kind]:
                out.append({"record": r["key"], "scenario": r["scenario"], "browser": r["browser"], "viewport": r["viewport"]["name"] if r["viewport"] else None, "theme": r["theme"], "kind": f"runtime-{kind}", "classification": "confirmed" if kind == "errors" else "suspect", "severity": "high" if kind == "errors" else "medium", "selector": "-", "detail": msg})
    return out


def build_manifest(args, mode, out, records, selected, browser_names, viewports, themes, versions, target_kind, safari_status, seconds, all_scn, changed_files) -> dict[str, Any]:
    try:
        import playwright
        pw_version = getattr(playwright, "__version__", "?")
    except Exception:  # noqa: BLE001
        pw_version = "?"
    return {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "mode": args.mode, "mode_note": mode["note"], "command": " ".join(sys.argv),
        "base_url": args.base_url, "target": args.target, "target_kind": target_kind,
        "compare": args.compare, "changed": args.changed, "changed_files": changed_files,
        "browsers": {b: {"label": BROWSERS[b][1], "version": versions.get(b)} for b in browser_names},
        "safari": safari_status or ({"status": "not_requested", "reason": "--browser safari 로 켭니다(macOS, safaridriver 설정 필요)"}),
        "webkit_note": "WebKit 결과는 Playwright WebKit 기준이며 실제 Safari 와 같지 않을 수 있어요." if "webkit" in browser_names else "",
        "viewports": [v.__dict__ for v in viewports], "themes": themes,
        "platform": {"os": host_os_tag(), "system": platform.platform(), "python": platform.python_version(), "playwright": pw_version},
        "git": git_info(), "duration_s": round(seconds, 1),
        "scenarios_selected": [s["id"] for s in selected], "scenarios_total": len(all_scn),
        "coverage": scn.coverage(all_scn), "existing_route_names": scn.existing_route_names(),
    }


def link_latest(out: Path) -> None:
    link = RESULTS_ROOT / "latest"
    try:
        if link.is_symlink() or link.exists():
            link.unlink()
        link.symlink_to(out.resolve(), target_is_directory=True)
    except OSError:
        pass


def print_summary(manifest, out: Path) -> None:
    recs = json.loads((out / "results.json").read_text(encoding="utf-8"))
    st = {k: sum(1 for r in recs if r["status"] == k) for k in ("passed", "failed", "skipped")}
    conf = sum(r["counts"]["confirmed"] for r in recs)
    sus = sum(r["counts"]["suspect"] for r in recs)
    errs = sum(len(r["runtime"]["errors"]) for r in recs)
    print(f"\n성공 {st['passed']} · 실패 {st['failed']} · 미검사 {st['skipped']} | 확인된 오류 {conf} · 의심 {sus} · 실행 오류 {errs} | {manifest['duration_s']}초")
    print(f"리포트: {out / 'index.html'}\n최신 링크: {RESULTS_ROOT / 'latest' / 'index.html'}")


def exit_code(fail_on: str, records) -> int:
    if fail_on == "failed" and any(r["status"] == "failed" for r in records):
        return 1
    if fail_on == "confirmed" and any(r["status"] == "failed" or r["counts"]["confirmed"] or r["runtime"]["errors"] for r in records):
        return 1
    return 0


def do_approve(args) -> int:
    run_dir = resolve_run(args.run)
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    recs = json.loads((run_dir / "results.json").read_text(encoding="utf-8"))
    pages = args.page.split(",") if args.page else None
    ids = args.scenario.split(",") if args.scenario else None
    pick: list[tuple[str, Path]] = []
    for r in recs:
        if r["status"] != "passed" or not r["viewport"]:
            continue
        if (pages and r["page"] not in pages) or (ids and r["scenario"] not in ids):
            continue
        vp = r["viewport"]
        for shot in r["shots"]:
            if shot["kind"] == "failure":
                continue
            src = run_dir / "screenshots" / r["browser"] / f"{vp['name']}-{vp['width']}" / r["theme"] / shot["file"]
            rel = visual_diff.baseline_dir(r["browser"], f"{vp['name']}-{vp['width']}", vp["dpr"], r["theme"], Path("")) / shot["file"]
            pick.append((str(rel), src))
    if not pick:
        print("승인할 스크린샷이 없어요(--page/--scenario 조건을 확인하세요)."); return 1
    print(f"실행 {run_dir.name} (git {manifest['git']['commit']}) 의 스크린샷 {len(pick)}장을 기준으로 승인합니다 → {BASELINE_ROOT}")
    if not args.yes and input("기존 기준 이미지를 덮어씁니다. 계속할까요? [y/N] ").strip().lower() != "y":
        print("취소했어요."); return 1
    print(f"{visual_diff.approve(run_dir / 'screenshots', pick)}장 승인했어요.")
    return 0


def do_list(args) -> int:
    sc = scn.load_scenarios()
    print(f"시나리오 {len(sc)}개 (모드별 포함: smoke ⊂ standard ⊂ full)\n")
    for s in sc:
        extra = f"  [미검사: {s['unavailable'][:40]}…]" if s.get("unavailable") else ""
        print(f"{s['tiers']:9} {s['page']:10} {s['id']:22} {s['title']}{extra}")
    cov = scn.coverage(sc)
    print("\n라우트 커버리지(RmsApp.tsx):")
    for r in cov["routes"]:
        print(f"  {r['status']:12} {r['route']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    try:
        if args.command == "approve":
            return do_approve(args)
        if args.command == "list":
            return do_list(args)
        return do_run(args)
    except auth.TargetNotAllowed as error:
        print(f"중단: {error}")
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
