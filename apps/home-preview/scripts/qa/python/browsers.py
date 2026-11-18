"""브라우저 실행: Chrome(Chromium)·WebKit 은 Playwright, 실제 Safari 는 safari_runner.py(Selenium)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from config import BROWSERS


@dataclass
class BrowserHandle:
    name: str  # chrome | chrome-stable | webkit
    engine: str  # chromium | webkit
    browser: Any
    version: str
    label: str

    def close(self) -> None:
        try:
            self.browser.close()
        except Exception:  # noqa: BLE001 - 이미 닫힌 브라우저는 무시
            pass


def launch(pw, name: str, headed: bool = False) -> BrowserHandle:
    """Playwright 브라우저를 띄웁니다. 설치되지 않았으면 안내 문구와 함께 RuntimeError."""
    if name not in BROWSERS or BROWSERS[name][0] == "safari":
        raise ValueError(f"Playwright 로 띄울 수 없는 브라우저: {name}")
    engine, label = BROWSERS[name]
    kwargs: dict[str, Any] = {"headless": not headed}
    if name == "chrome-stable":
        kwargs["channel"] = "chrome"
    try:
        browser = getattr(pw, engine).launch(**kwargs)
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(
            f"{name} 실행 실패: {str(error).splitlines()[0]}\n"
            f"  → `python -m playwright install {engine}` 를 먼저 실행해 주세요."
        ) from error
    return BrowserHandle(name, engine, browser, browser.version, label)


def describe_all() -> dict[str, str]:
    return {name: label for name, (_engine, label) in BROWSERS.items()}
