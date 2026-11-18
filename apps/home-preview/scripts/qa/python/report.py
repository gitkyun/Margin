"""HTML 리포트 생성: 외부 서버 없이 file:// 로 열 수 있는 단일 index.html (이미지는 상대 경로)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

TEMPLATE = Path(__file__).with_name("report_template.html")


def build(out_dir: Path, manifest: dict[str, Any], records: list[dict[str, Any]]) -> Path:
    payload = json.dumps({"manifest": manifest, "records": records}, ensure_ascii=False)
    payload = payload.replace("</", "<\\/")  # <script> 안에서 닫는 태그로 오해되지 않게
    html = TEMPLATE.read_text(encoding="utf-8").replace("__DATA__", payload)
    path = out_dir / "index.html"
    path.write_text(html, encoding="utf-8")
    return path
