"""Margin 화면 QA 설정: 화면 크기, 실행 모드, 경로, 안전 규칙.

시나리오 자체는 scenarios.json에 있습니다(코드와 분리). 여기는 환경·정책만 둡니다.
"""

from __future__ import annotations

import platform
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
APP_DIR = HERE.parents[2]  # apps/home-preview
REPO_DIR = APP_DIR.parents[1]
RESULTS_ROOT = REPO_DIR / "qa-results"  # .gitignore에 등록됨
BASELINE_ROOT = RESULTS_ROOT / "baselines"
SCENARIOS_FILE = HERE / "scenarios.json"
ROUTER_FILE = APP_DIR / "src" / "RmsApp.tsx"
ROUTES_MJS = APP_DIR / "scripts" / "qa" / "routes.mjs"  # 기존 회귀 그물의 라우트 목록(재사용)

DEFAULT_BASE_URL = "http://127.0.0.1:5174"
# 비교가 흔들리지 않게 시계를 고정합니다(미리보기 가상 데이터의 날짜도 이 시각 기준으로 만들어집니다).
FIXED_TIME_ISO = "2026-11-18T10:00:00+09:00"
LOCALE = "ko-KR"
TIMEZONE = "Asia/Seoul"
THEME_COOKIE = "margin-theme"
THEMES = ("light", "dark")

# 화면이 준비됐다고 볼 때까지 최대로 기다리는 시간(ms). 고정 sleep은 쓰지 않습니다.
READY_TIMEOUT_MS = 15000
STABLE_FRAMES = 4  # 레이아웃이 이만큼 연속 프레임 동안 같아야 안정으로 봅니다.


@dataclass(frozen=True)
class Viewport:
    name: str
    width: int
    height: int
    dpr: float = 1.0
    mobile: bool = False
    touch: bool = False

    @property
    def key(self) -> str:
        return f"{self.name}-{self.width}"


VIEWPORTS: dict[str, Viewport] = {
    v.name: v
    for v in (
        Viewport("phone-s", 360, 740, 2.0, True, True),
        Viewport("phone", 390, 844, 3.0, True, True),
        Viewport("tablet-p", 768, 1024, 2.0, True, True),
        Viewport("tablet-l", 1024, 768, 2.0, False, True),
        Viewport("desktop", 1440, 900, 1.0),
        Viewport("desktop-xl", 1920, 1080, 1.0),
    )
}

# 마진의 반응형 경계(CSS 구간) 전후 너비. --boundaries 로 켭니다.
BOUNDARY_WIDTHS = (663, 665, 767, 769, 863, 865, 991, 993, 1023, 1025, 1199, 1201)


def boundary_viewports() -> dict[str, Viewport]:
    return {
        f"edge-{w}": Viewport(f"edge-{w}", w, 900, 1.0, w < 768, False)
        for w in BOUNDARY_WIDTHS
    }


# 실행 모드. tier는 시나리오의 tiers 와 맞춰 고릅니다.
MODES = {
    "smoke": {
        "tier": "smoke",
        "browsers": ["chrome"],
        "viewports": ["desktop", "phone"],
        "themes": ["light"],
        "note": "주요 화면 · Chrome · 대표 크기 · 기본 상태",
    },
    "standard": {
        "tier": "standard",
        "browsers": ["chrome", "webkit"],
        "viewports": ["phone", "tablet-p", "desktop"],
        "themes": ["light", "dark"],
        "note": "주요 화면 전체 · Chrome+WebKit · 모바일·태블릿·데스크톱 · 라이트·다크 · 대표 상태",
    },
    "full": {
        "tier": "full",
        "browsers": ["chrome", "webkit"],
        "viewports": ["phone-s", "phone", "tablet-p", "tablet-l", "desktop", "desktop-xl"],
        "themes": ["light", "dark"],
        "note": "등록된 모든 시나리오 · 모든 크기·테마 · 시각 비교 · Safari 선택",
    },
}
TIER_ORDER = {"smoke": 0, "standard": 1, "full": 2}

# 브라우저 이름 → (엔진, 설명)
BROWSERS = {
    "chrome": ("chromium", "Chromium (Playwright 번들)"),
    "chrome-stable": ("chromium", "설치된 Google Chrome"),
    "webkit": ("webkit", "Playwright WebKit (Safari 렌더링 엔진 계열, 실제 Safari 아님)"),
    "safari": ("safari", "macOS 실제 Safari (Selenium + safaridriver)"),
}

# ---- 안전 규칙 -------------------------------------------------------------------------
LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1"}
ENV_ALLOW_REMOTE = "MARGIN_QA_ALLOW_REMOTE"  # 로컬이 아닌 서버에 접속하려면 "1"
ENV_ALLOW_PRODUCTION = "MARGIN_QA_ALLOW_PRODUCTION"  # 운영 서버(읽기 전용)는 "1"
ENV_CREDENTIALS = {
    "student": ("MARGIN_QA_STUDENT_EMAIL", "MARGIN_QA_STUDENT_PASSWORD"),
    "professor": ("MARGIN_QA_PROFESSOR_EMAIL", "MARGIN_QA_PROFESSOR_PASSWORD"),
}
PRODUCTION_HOSTS = ("margin-research.pages.dev",)


def classify_target(base_url: str) -> str:
    """'local'(미리보기·개발 서버), 'remote'(그 밖의 테스트 서버), 'production'."""
    host = (urlparse(base_url).hostname or "").lower()
    if host in LOCAL_HOSTS or host.endswith(".localhost") or host.endswith(".test"):
        return "local"
    if any(host == h for h in PRODUCTION_HOSTS):
        return "production"
    return "remote"


def host_os_tag() -> str:
    system = platform.system().lower()
    return {"darwin": "mac", "linux": "linux", "windows": "win"}.get(system, system)

# --changed: 바뀐 파일 경로 → 다시 볼 화면 묶음(page). 아래에 없는 공용 파일(디자인·CSS·공통 부품)은 smoke 전체를 봅니다.
PAGE_HINTS = {
    r"meeting": "meetings",
    r"task|feedback": "tasks",
    r"docs?|writing|material|editor|pdf": "docs",
    r"planning|flow|calendar|poll|roadmap": "flow",
    r"review": "reviews",
    r"result": "results",
    r"assistant|kokonut|ai-": "assistant",
    r"home|inbox": "home",
    r"public|landing|intro|marketing": "landing",
    r"login|signup|auth": "auth",
    r"onboarding|researchselect|research-select": "research",
    r"settings|account|profile": "settings",
    r"shell|command|menu|sidebar": "shell",
}
