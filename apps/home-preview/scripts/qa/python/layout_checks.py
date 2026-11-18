"""배치 검사 실행기: layout_check.js 를 페이지에서 돌리고 결과를 분류합니다."""

from __future__ import annotations

from pathlib import Path
from typing import Any

JS_FILE = Path(__file__).with_name("layout_check.js")
_JS_SOURCE = JS_FILE.read_text(encoding="utf-8").strip()

# 어느 화면에서든 정상으로 보는 영역(팝오버·목록 상자·PDF·달력·의도적 가로 스크롤).
GLOBAL_ALLOW_SELECTORS = [
    "[role=listbox]",
    "[role=menu]",
    "[data-radix-popper-content-wrapper]",
    "[role=tooltip]",
    "[data-allow-hscroll]",
    "[role=tablist]",
    ".react-pdf__Page",
    ".pdf-viewer",
    ".fc",
    "[class*=\"fc-\"]",
    ".rms-segments",
    "[data-slot=tabs]",
    "[data-slot=tabs-list]",
    "canvas",
    "svg",
]

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def run_layout_checks(page, scenario_ignores: list[dict[str, str]] | None = None) -> dict[str, Any]:
    """페이지의 배치를 검사해 {issues, counts, metrics} 를 돌려줍니다.

    scenario_ignores: [{"kind": "text-clipped", "selector": ".foo", "reason": "…"}] 형태.
    kind 가 맞고(생략 시 모든 kind) 선택자에 해당하는 요소 안에 이슈가 있으면 allowed 로 바꾸고 이유를 남깁니다.
    """
    result = page.evaluate(f"({_JS_SOURCE})", {"allowSelectors": GLOBAL_ALLOW_SELECTORS})
    issues = result["issues"]
    for ign in scenario_ignores or []:
        sel = ign.get("selector")
        if not sel:
            continue
        for issue in issues:
            if issue["classification"] == "allowed":
                continue
            if ign.get("kind") not in (None, "*", issue["kind"]):
                continue
            rect = issue.get("rect")
            if not rect:
                continue
            try:
                # 이슈 요소의 중심점이 예외 선택자 요소 안에 있는지로 판단합니다.
                inside = page.evaluate(
                    """([sel, x, y]) => {
                        try {
                            const el = document.elementFromPoint(x, y);
                            return !!el && !!el.closest(sel);
                        } catch { return false; }
                    }""",
                    [sel, rect["x"] + rect["w"] / 2, rect["y"] + rect["h"] / 2],
                )
            except Exception:  # noqa: BLE001 - 잘못된 선택자는 무시하고 원본 분류를 유지
                inside = False
            if inside:
                issue["classification"] = "allowed"
                issue["reason"] = ign.get("reason", "시나리오 예외")
    issues.sort(key=lambda i: (i["classification"] != "confirmed", SEVERITY_ORDER.get(i["severity"], 3)))
    return result


def summarize(issues: list[dict[str, Any]]) -> dict[str, int]:
    out = {"confirmed": 0, "suspect": 0, "allowed": 0}
    for issue in issues:
        out[issue["classification"]] = out.get(issue["classification"], 0) + 1
    return out
