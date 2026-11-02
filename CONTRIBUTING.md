# 기여 방법

## 작업 시작

```bash
git switch main
git pull --ff-only
git switch -c feat/short-description
```

기능 작업은 `feat/`, 수정은 `fix/`, 문서는 `docs/`, 저장소 정리는 `chore/` 접두어를 권한다. 실제 변경에 맞는 짧은 이름을 사용한다.

PRD·기능명세서·유저플로우는 [제품 문서](docs/README.md)에서 확인한다. 새 기능을 구현하기 전에 관련 동작과 초기·후속 범위를 먼저 읽는다.

## 문서 변경

- 현재 기준 문서는 `docs/product/`에서 관리한다. 파일명에 날짜를 계속 붙여 중복본을 만들지 않는다.
- 요구사항을 바꾸면 문서의 변경 시점과 관련 설명을 갱신하고 PR에 이유를 기록한다.
- 사용자 확정과 작성 기준안·검증할 가설을 구분한다.
- 화면·도구의 동작을 주장할 때는 공식 자료 또는 실제 확인한 근거를 남긴다.
- 이미지 경로를 바꾸면 README와 관련 문서 링크를 함께 고친다.

## 검증

```bash
python3 scripts/check_repository.py
git diff --check
git status --short
```

저장소 검사는 로컬 문서 연결과 필수 파일을 확인한다. 외부 사이트의 가용성이나 제품 기능의 작동을 검사하지 않는다. 앱 초기화 후 빌드·기능 검사 명령을 여기에 추가한다.

## 커밋과 PR

커밋은 한 가지 목적의 변경으로 묶고 다음처럼 작성한다.

```text
docs: clarify professor review requirements
chore: organize repository documentation
```

PR에는 해결할 문제, 변경 내용, 실행한 검사와 남은 한계를 적는다. 원본 문서를 이동한 경우 내용도 바꿨는지 명시한다. 이슈를 연결할 때는 해당 요구사항 번호도 함께 적는다.
