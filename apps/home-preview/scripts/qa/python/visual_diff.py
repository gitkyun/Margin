"""기준(Baseline) 스크린샷과 현재 스크린샷 비교.

- 픽셀이 달라졌다고 곧 버그는 아닙니다. 결과는 'identical / minor / changed / size_mismatch / new' 로만 나누고,
  판단은 사람이 합니다(의도한 디자인 변경, 글꼴 렌더링 차이, 플랫폼 차이 포함).
- 기준 이미지는 브라우저·OS·화면 크기·DPR·테마별 폴더에 저장하고, 자동으로 덮어쓰지 않습니다.
  갱신은 별도 명령(`capture_all.py approve`)으로만 합니다.
"""

from __future__ import annotations

import shutil
from collections import deque
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw

from config import BASELINE_ROOT, host_os_tag

PIXEL_TOLERANCE = 12  # 채널 차이가 이 값 이하면 안티앨리어싱 잡음으로 보고 무시
MINOR_RATIO = 0.0015  # 바뀐 픽셀 비율이 이보다 작으면 minor(렌더링 잡음 수준)
CELL = 16  # 변경 영역을 묶는 격자 크기(px)
MAX_REGIONS = 24


def baseline_dir(browser: str, viewport_key: str, dpr: float, theme: str, root: Path = BASELINE_ROOT) -> Path:
    """기준 폴더: <root>/<browser>-<os>/<viewport>-dpr<N>/<theme>/"""
    return root / f"{browser}-{host_os_tag()}" / f"{viewport_key}-dpr{dpr:g}" / theme


def _regions(mask: Image.Image) -> list[dict[str, int]]:
    w, h = mask.size
    gw, gh = (w + CELL - 1) // CELL, (h + CELL - 1) // CELL
    small = mask.resize((gw, gh), Image.Resampling.BOX).point(lambda v: 255 if v > 0 else 0)
    px = small.load()
    seen = [[False] * gh for _ in range(gw)]
    out: list[dict[str, int]] = []
    for gx in range(gw):
        for gy in range(gh):
            if px[gx, gy] and not seen[gx][gy]:
                q = deque([(gx, gy)])
                seen[gx][gy] = True
                x0 = x1 = gx
                y0 = y1 = gy
                while q:
                    cx, cy = q.popleft()
                    x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < gw and 0 <= ny < gh and px[nx, ny] and not seen[nx][ny]:
                            seen[nx][ny] = True
                            q.append((nx, ny))
                out.append({"x": x0 * CELL, "y": y0 * CELL, "w": min((x1 - x0 + 1) * CELL, w - x0 * CELL), "h": min((y1 - y0 + 1) * CELL, h - y0 * CELL)})
    out.sort(key=lambda r: r["w"] * r["h"], reverse=True)
    return out[:MAX_REGIONS]


def compare_images(current: Path, baseline: Path | None, diff_out: Path) -> dict[str, Any]:
    if baseline is None or not baseline.exists():
        return {"status": "new", "ratio": None, "regions": [], "diff": None}
    cur = Image.open(current).convert("RGB")
    base = Image.open(baseline).convert("RGB")
    if cur.size != base.size:
        return {"status": "size_mismatch", "ratio": None, "regions": [], "diff": None, "size": {"current": list(cur.size), "baseline": list(base.size)}}
    gray = ImageChops.difference(cur, base).convert("L")
    mask = gray.point(lambda v: 255 if v > PIXEL_TOLERANCE else 0)
    changed = mask.histogram()[255]
    total = cur.size[0] * cur.size[1]
    ratio = changed / total
    if changed == 0:
        return {"status": "identical", "ratio": 0.0, "changed_pixels": 0, "regions": [], "diff": None}
    regions = _regions(mask)
    overlay = Image.blend(cur, Image.new("RGB", cur.size, (255, 255, 255)), 0.55)
    overlay.paste(Image.new("RGB", cur.size, (255, 40, 80)), mask=mask)
    draw = ImageDraw.Draw(overlay)
    for r in regions:
        draw.rectangle([r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"]], outline=(220, 20, 60), width=max(2, int(cur.size[0] / 600)))
    diff_out.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(diff_out)
    return {
        "status": "minor" if ratio < MINOR_RATIO else "changed",
        "ratio": round(ratio, 6),
        "changed_pixels": changed,
        "regions": regions,
        "diff": str(diff_out),
    }


def approve(run_shots: Path, selected: list[tuple[str, Path]], root: Path = BASELINE_ROOT) -> int:
    """승인: 현재 실행의 스크린샷을 기준으로 복사합니다. selected = [(기준 폴더 아래 상대경로, 원본 파일)]."""
    n = 0
    for rel, src in selected:
        dst = root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        n += 1
    return n
