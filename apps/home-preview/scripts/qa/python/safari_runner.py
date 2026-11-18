"""macOS 실제 Safari 검사(선택). Selenium + safaridriver.

Playwright WebKit 은 Safari 와 같은 브라우저가 아닙니다. 실제 Safari 는 한 번만 설정하면 됩니다:
    sudo safaridriver --enable        (관리자 암호 필요)
    Safari ▸ 설정 ▸ 고급 ▸ '웹 개발자용 기능 보기', 개발자 ▸ '원격 자동화 허용'
    pip install selenium
준비가 안 됐으면 이 모듈은 이유만 돌려주고 나머지 검사는 그대로 진행됩니다.
Safari 는 화면 크기·테마 쿠키·IndexedDB 격리 제어가 제한적이라 대표 화면의 캡처와 배치 검사만 합니다.
"""

from __future__ import annotations

import base64
import re
import sys
from pathlib import Path
from typing import Any

from layout_checks import _JS_SOURCE, GLOBAL_ALLOW_SELECTORS


def availability() -> tuple[bool, str]:
    if sys.platform != "darwin":
        return False, "macOS 에서만 실행할 수 있어요."
    try:
        import selenium  # noqa: F401
    except ImportError:
        return False, "selenium 이 설치되지 않았어요(pip install selenium)."
    return True, "ok"


def run(base_url: str, scenarios: list[dict[str, Any]], viewports: list, themes: list[str], out_dir: Path) -> dict[str, Any]:
    """대표 화면을 실제 Safari 로 캡처합니다. {records, status, reason} 를 돌려줍니다."""
    ok, why = availability()
    if not ok:
        return {"status": "unavailable", "reason": why, "records": []}
    from selenium import webdriver
    from selenium.webdriver.safari.options import Options

    try:
        driver = webdriver.Safari(options=Options())
    except Exception as error:  # noqa: BLE001
        msg = str(error).splitlines()[0][:200]
        return {"status": "unavailable", "reason": f"Safari 를 자동 조종할 수 없어요: {msg} (safaridriver --enable 과 '원격 자동화 허용' 확인)", "records": []}
    records: list[dict[str, Any]] = []
    try:
        driver.get(f"{base_url}/r")
        driver.implicitly_wait(5)
        href = driver.execute_script(
            "return [...document.querySelectorAll('a')].map(a=>a.getAttribute('href')).find(h=>/^\\/r\\/[0-9a-f-]{36}$/.test(h||''))"
        )
        research = href or ""
        for vp in viewports:
            driver.set_window_size(vp.width, vp.height + 120)
            for scenario in scenarios:
                route = scenario.get("route")
                if not route or scenario.get("steps") or scenario.get("detail") or scenario.get("unavailable"):
                    continue
                url = base_url + route.replace("{research}", research)
                rec: dict[str, Any] = {"scenario": scenario["id"], "viewport": vp.name, "status": "passed", "issues": []}
                try:
                    driver.get(url)
                    driver.execute_script("return document.fonts.ready.then(()=>true)")
                    result = driver.execute_script(f"return ({_JS_SOURCE})(arguments[0])", {"allowSelectors": GLOBAL_ALLOW_SELECTORS})
                    rec["issues"] = result["issues"]
                    shot = out_dir / "safari" / vp.key / "light" / f"{scenario['id']}.png"
                    shot.parent.mkdir(parents=True, exist_ok=True)
                    shot.write_bytes(base64.b64decode(driver.get_screenshot_as_base64()))
                    rec["shot"] = str(shot.relative_to(out_dir.parent if out_dir.name == "screenshots" else out_dir))
                except Exception as error:  # noqa: BLE001
                    rec["status"] = "failed"
                    rec["reason"] = re.sub(r"\s+", " ", str(error))[:200]
                records.append(rec)
    finally:
        driver.quit()
    return {"status": "ran", "reason": "", "records": records}
