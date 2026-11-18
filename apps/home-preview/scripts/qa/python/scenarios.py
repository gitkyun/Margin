"""시나리오 레지스트리 로딩·선택·주소 확정, 라우트 커버리지 계산."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any

from config import (
    APP_DIR,
    PAGE_HINTS,
    REPO_DIR,
    ROUTER_FILE,
    ROUTES_MJS,
    SCENARIOS_FILE,
    TIER_ORDER,
)


def load_scenarios() -> list[dict[str, Any]]:
    data = json.loads(SCENARIOS_FILE.read_text(encoding="utf-8"))
    scenarios = data["scenarios"]
    seen: set[str] = set()
    for s in scenarios:
        if s["id"] in seen:
            raise ValueError(f"시나리오 id 중복: {s['id']}")
        seen.add(s["id"])
        if not s.get("route") and not s.get("detail"):
            raise ValueError(f"{s['id']}: route 또는 detail 이 필요합니다")
    return scenarios


def select(scenarios, tier: str, pages: list[str] | None, ids: list[str] | None, role: str | None = None):
    out = []
    for s in scenarios:
        if TIER_ORDER[s.get("tiers", "full")] > TIER_ORDER[tier]:
            continue
        if pages and s["page"] not in pages:
            continue
        if ids and s["id"] not in ids:
            continue
        if role and s.get("role") != role:
            continue
        out.append(s)
    return out


def changed_pages(since: str) -> tuple[list[str] | None, list[str]]:
    """git 변경 파일 → 영향 받는 page 목록. 공용 파일만 바뀌었으면 None(=smoke 전체)."""
    try:
        diff = subprocess.run(["git", "diff", "--name-only", since], cwd=REPO_DIR, capture_output=True, text=True, check=True).stdout
        untracked = subprocess.run(["git", "ls-files", "--others", "--exclude-standard"], cwd=REPO_DIR, capture_output=True, text=True, check=True).stdout
    except Exception:  # noqa: BLE001
        return None, []
    files = [f for f in (diff + untracked).splitlines() if f.startswith("apps/home-preview/src/") and not f.endswith((".test.ts", ".test.tsx"))]
    pages: set[str] = set()
    for f in files:
        name = f.lower()
        for pattern, page in PAGE_HINTS.items():
            if re.search(pattern, name):
                pages.add(page)
    return (sorted(pages) or None), files


def resolve_url(scenario: dict[str, Any], ids: dict[str, Any]) -> tuple[str | None, str]:
    """시나리오의 실제 주소. 못 찾으면 (None, 이유)."""
    research = ids.get("research")
    detail = scenario.get("detail")
    if detail:
        found = ids.get("detail", {}).get(f"{detail['of']}|{detail['pattern']}")
        return (found, "") if found else (None, f"'{detail['of']}' 목록에서 '{detail['pattern']}' 형식의 링크를 찾지 못했어요(테스트 데이터 부족).")
    route = scenario["route"]
    if "{research}" in route:
        if not research:
            return None, "연구 주소를 찾지 못했어요."
        route = route.replace("{research}", research)
    if "{" in route:
        return None, f"해결할 수 없는 자리표시자: {route}"
    return route, ""


def detail_requests(scenarios) -> list[dict[str, str]]:
    seen, out = set(), []
    for s in scenarios:
        d = s.get("detail")
        if d and (d["of"], d["pattern"]) not in seen:
            seen.add((d["of"], d["pattern"]))
            out.append(d)
    return out


# ---- 라우트 커버리지 ---------------------------------------------------------------------
def router_paths() -> list[str]:
    """RmsApp.tsx 의 <Route path=...> 를 읽어 실제 라우트 목록을 만듭니다."""
    src = ROUTER_FILE.read_text(encoding="utf-8")
    paths = re.findall(r'path="([^"]+)"', src) + [m.replace("${path}", ":legacy") for m in re.findall(r"path=\{`([^`]+)`\}", src)]
    return sorted(set(paths))


def _norm_pattern(p: str) -> list[list[str]]:
    """라우트 → 세그먼트 목록(선택 매개변수 `:id?` 는 있음/없음 두 갈래)."""
    results = [[]]
    for seg in [s for s in p.split("/") if s]:
        if seg.startswith(":") or seg == "*":
            optional = seg.endswith("?")
            tok = "*"
            results = [r + [tok] for r in results] + ([r[:] for r in results] if optional else [])
        else:
            results = [r + [seg] for r in results]
    return results


def _scenario_segments(s: dict[str, Any]) -> list[str] | None:
    if s.get("detail"):
        d = s["detail"]["pattern"]
        d = re.sub(r"\\\?.*", "", d).strip("^$")
        d = re.sub(r"\[[^\]]*\](\{\d+\}|\+|\*)?", "*", d)
        return [x for x in d.split("/") if x]
    route = s.get("route", "")
    route = route.split("?")[0].replace("{research}", "/r/*").replace("{poll}", "*")
    route = re.sub(r"[0-9a-f]{8}-[0-9a-f-]{27}", "*", route)
    return [x for x in route.split("/") if x]


def coverage(scenarios: list[dict[str, Any]]) -> dict[str, Any]:
    covered_sets = [tuple(_scenario_segments(s) or []) for s in scenarios if not s.get("unavailable")]
    covered_sets += [tuple(_norm_pattern(c)[0]) for s in scenarios if not s.get("unavailable") for c in s.get("covers", [])]
    unavailable_sets = {tuple(_scenario_segments(s) or []): s for s in scenarios if s.get("unavailable")}
    rows = []
    for path in router_paths():
        variants = [tuple(v) for v in _norm_pattern(path)]
        hit = [v for v in variants if v in covered_sets]
        status = "covered" if hit else ("unavailable" if any(v in unavailable_sets for v in variants) else "uncovered")
        rows.append({"route": path, "status": status})
    return {"router_file": str(ROUTER_FILE.relative_to(REPO_DIR)), "routes": rows}


def existing_route_names() -> list[str]:
    """기존 회귀 그물(routes.mjs)의 화면 이름. 새 시나리오가 빠진 것이 없는지 보는 참고용입니다."""
    try:
        out = subprocess.run(
            ["node", "--input-type=module", "-e", f"import {{ROUTES}} from '{ROUTES_MJS.as_uri()}'; console.log(JSON.stringify(ROUTES.map(r=>r.name)))"],
            capture_output=True, text=True, timeout=20, cwd=APP_DIR,
        )
        return json.loads(out.stdout) if out.returncode == 0 else []
    except Exception:  # noqa: BLE001
        return []
