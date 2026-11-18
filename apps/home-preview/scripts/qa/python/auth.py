"""접속 대상 안전 검사와 로그인.

- 기본 대상은 로컬 미리보기 서버(서버 설정 없이 켠 모드): 가상 데이터가 브라우저 IndexedDB에만 있어 계정이 필요 없고,
  어떤 변경을 해도 실제 서비스에 닿지 않습니다.
- 서버 연결(connected) 모드는 환경변수 계정으로 로그인합니다. 비밀번호는 코드·로그·결과에 남기지 않습니다.
- 운영 서버는 MARGIN_QA_ALLOW_PRODUCTION=1 일 때만 허용하고 읽기 전용(쓰기 동작 시나리오 제외)으로만 돕니다.
"""

from __future__ import annotations

import os
from pathlib import Path

from config import (
    ENV_ALLOW_PRODUCTION,
    ENV_ALLOW_REMOTE,
    ENV_CREDENTIALS,
    classify_target,
)


class TargetNotAllowed(Exception):
    pass


def check_target(base_url: str, target: str) -> str:
    """접속해도 되는 대상인지 확인하고 분류('local'|'remote'|'production')를 돌려줍니다."""
    kind = classify_target(base_url)
    if kind == "local":
        return kind
    if os.environ.get(ENV_ALLOW_REMOTE) != "1":
        raise TargetNotAllowed(
            f"{base_url} 은 로컬이 아닙니다. 격리된 테스트 서버라면 {ENV_ALLOW_REMOTE}=1 을 지정하세요."
        )
    if kind == "production" and os.environ.get(ENV_ALLOW_PRODUCTION) != "1":
        raise TargetNotAllowed(
            f"{base_url} 은 운영 서버로 보입니다. 읽기 전용 캡처만 하려면 {ENV_ALLOW_PRODUCTION}=1 을 함께 지정하세요."
        )
    if target == "preview":
        raise TargetNotAllowed("원격 서버는 --target connected 로만 접속할 수 있습니다(미리보기 모드는 로컬 서버용).")
    return kind


def credentials(role: str) -> tuple[str, str] | None:
    names = ENV_CREDENTIALS.get(role)
    if not names:
        return None
    email, password = os.environ.get(names[0]), os.environ.get(names[1])
    return (email, password) if email and password else None


def login_state(browser, base_url: str, role: str, state_path: Path, context_kwargs: dict) -> str | None:
    """connected 모드: 로그인해 저장 상태(storage_state)를 만듭니다. 실패 이유를 문자열로, 성공은 None.

    주의: 서버 연결 모드는 이 저장소의 테스트 계정이 있는 환경에서만 실행해 검증해야 합니다.
    (이번 구현은 미리보기 모드로만 실제 실행 검증했습니다 — README '한계' 참고)
    """
    cred = credentials(role)
    if not cred:
        names = ENV_CREDENTIALS.get(role, ("?", "?"))
        return f"환경변수 {names[0]}/{names[1]} 가 없어 로그인하지 못했어요."
    ctx = browser.new_context(**context_kwargs)
    try:
        page = ctx.new_page()
        page.goto(f"{base_url}/login", wait_until="domcontentloaded")
        page.get_by_label("이메일").first.fill(cred[0])
        page.get_by_label("비밀번호").first.fill(cred[1])
        page.get_by_role("button", name="로그인", exact=True).first.click()
        page.wait_for_url(lambda url: "/login" not in url, timeout=20000)
        state_path.parent.mkdir(parents=True, exist_ok=True)
        ctx.storage_state(path=str(state_path))
        os.chmod(state_path, 0o600)  # 토큰이 들어 있어 소유자만 읽게 합니다(.gitignore 대상 폴더)
        return None
    except Exception as error:  # noqa: BLE001
        return f"로그인 실패: {str(error).splitlines()[0]}"
    finally:
        ctx.close()
