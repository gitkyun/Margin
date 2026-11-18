# Margin 화면 자동 캡처 · UI QA (Python)

마진의 주요 화면을 Chrome·WebKit(선택: 실제 Safari)에서 자동으로 열어 캡처하고, DOM·계산된 CSS로 배치 문제를 찾고,
기준 이미지와 비교해 HTML 리포트로 보여 주는 도구입니다. **서비스 코드·CSS·라우팅은 건드리지 않습니다.**

기존 `scripts/qa/*.mjs`(Node·CDP 회귀 그물)와 `e2e/`(Playwright 테스트)는 그대로 둡니다. 이 도구는 그것을 대체하지 않고 보완합니다.
라우트 이름은 `routes.mjs`와 겹치는지 `list` 명령이 보여 주고, 화면 목록의 근거는 `src/RmsApp.tsx`의 `<Route>`입니다.

## 1. 설치 (한 번만)

```bash
cd apps/home-preview/scripts/qa/python
python3 -m venv .venv && source .venv/bin/activate     # Python 3.11 이상
pip install -r requirements.txt
python -m playwright install chromium webkit           # 약 250MB
```

## 2. 실행

기본 대상은 **서버 설정 없이 켠 미리보기 모드**입니다. 가상 데이터가 브라우저(IndexedDB)에만 있어 계정이 필요 없고,
어떤 조작을 해도 실제 서비스에 닿지 않습니다.

```bash
# 터미널 1 (apps/home-preview): 미리보기 모드 서버
VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run dev -- --port 5174

# 터미널 2 (저장소 루트)
python apps/home-preview/scripts/qa/python/capture_all.py --mode smoke      # 핵심 화면, Chrome, 데스크톱+모바일, 라이트
python apps/home-preview/scripts/qa/python/capture_all.py --mode standard   # Chrome+WebKit, 모바일·태블릿·데스크톱, 라이트·다크
python apps/home-preview/scripts/qa/python/capture_all.py --mode full       # 모든 시나리오·크기·테마 + 내부 스크롤 상·중·하
```

macOS 런처: `./run-qa.command [인자]` (더블클릭도 가능. 서버가 꺼져 있으면 미리보기 서버를 자동으로 켜고 끝나면 정리합니다).

| 목적 | 명령 |
|---|---|
| 특정 브라우저 | `--browser chrome` / `webkit` / `safari`(아래) / `chrome,webkit` |
| 특정 화면 묶음 | `--page home` (home, meetings, tasks, docs, flow, results, reviews, assistant, settings, shell, landing, auth, research, error) |
| 특정 시나리오 | `--scenario writing-toc,meeting-record` |
| 크기·테마 지정 | `--viewport phone,desktop --theme dark` (`both`) |
| 반응형 경계 | `--boundaries` (663/665·767/769·863/865·991/993·1023/1025·1199/1201px) |
| **바뀐 화면만** | `--changed` (git diff main 기준, 공용 파일만 바뀌면 smoke 전체) / `--changed origin/main` |
| 기준과 시각 비교 | `--compare baseline` · 이전 실행과 비교 `--compare 20261118-153127` |
| 기준 이미지 승인 | `approve --run latest --page home` (별도 작업, 덮어쓰기 전 확인) |
| 목록·커버리지 | `list` |
| 종료 코드 | `--fail-on never`(기본) / `failed` / `confirmed` |

크기: phone-s 360 · phone 390 · tablet-p 768 · tablet-l 1024 · desktop 1440 · desktop-xl 1920. 높이·DPR·모바일·터치는 `config.py`에 명시되어 있습니다.

## 3. 결과 보기

`qa-results/latest/index.html` 을 브라우저로 엽니다(서버 불필요, `file://` 가능). 실행마다 `qa-results/runs/<시각>/`가 만들어지고 `latest`가 가장 최근을 가리킵니다.

```
qa-results/runs/<시각>/
  index.html            요약 대시보드 · 필터 · 상세(현재/기준/차이/나란히, 문제 위치 상자)
  manifest.json         실행 조건·브라우저 버전·git·라우트 커버리지
  results.json          조합별 결과(상태, 스크린샷, 문제, 실행 오류, 재현 명령)
  issues.json           모든 문제를 한 줄씩(확인된 오류/의심/예외 + 선택자·좌표)
  screenshots/<브라우저>/<크기>/<테마>/<시나리오>[--scroll-bottom].png
  differences/…         기준 대비 차이 이미지(빨강=변경, 상자=영역)
qa-results/baselines/   승인한 기준 이미지(브라우저-OS / 크기-dpr / 테마 별 폴더)
```

문제 분류: **확인된 오류**(확실: 페이지 가로 넘침, 한 글자씩 줄바꿈, 고정 요소가 조작 요소를 가림, 대화상자 버튼이 화면 밖 …) ·
**의심 항목**(정상일 수도 있음: 잘린 글자, 가로 스크롤 영역, 불필요 스크롤 …) · **허용된 예외**(말줄임, 팝오버, PDF, 달력, 탭 가로 스크롤 …).
JS 예외·콘솔 오류·실패한 네트워크 요청·이미지 실패·`SectionBoundary` 대체 문구는 "실행 오류"로 따로 셉니다.

## 4. 안정화 원칙

시계 고정(`2026-11-18 10:00 KST`, 가상 데이터 날짜도 이 기준) · 애니메이션/전환 정지 CSS · 동작 줄이기 · 화면 준비 신호 대기 ·
글꼴·이미지 로딩 · 레이아웃이 연속 4프레임 같을 때까지 대기. 고정 sleep과 `networkidle` 단독 판단은 쓰지 않습니다.
시나리오마다 새 브라우저 컨텍스트(같은 시드 데이터)에서 돌아 서로 영향이 없고, 한 시나리오가 실패해도 다음으로 넘어갑니다.
같은 코드를 두 번 찍으면 픽셀이 같습니다(검증함: 9화면 identical).

## 5. 시나리오 추가 (IA v2 새 화면)

`scenarios.json`의 `scenarios` 배열에 항목을 추가하면 끝입니다. 코드 수정은 필요 없습니다.

```json
{"id":"home-panel-x","page":"home","title":"연구 홈 · X 패널","route":"{research}","role":"student","tiers":"standard",
 "min_width":768,
 "steps":[{"click":{"role":"button","name":"X","exact":true}}],
 "ready":".x-panel","capture":{"mode":"viewport"},
 "mask":["[data-qa-mask]"],"ignore":[{"kind":"text-clipped","selector":".foo","reason":"의도된 말줄임"}]}
```

- `route`: `{research}` 자리에 시드 데이터의 첫 연구 주소. 상세 화면은 `detail: {of, pattern}`(목록에서 정규식에 맞는 첫 링크).
- `tiers`: 이 모드부터 실행(smoke ⊂ standard ⊂ full). `needs: connected`·`unavailable`이면 **미검사**로 리포트에 사유가 남습니다.
- `steps`: `click|hover|press|fill|wait`, 선택은 `{role,name,exact}`/`{css}`/`{label}`/`{text}`. `optional:true`면 없을 때 건너뜀.
- `ready`: 상호작용 **뒤** 화면 준비 신호(없으면 본문·제목이 보이고 레이아웃이 안정되면 준비로 봄).
- `capture`: `viewport` | `full` | `element`(+selector) | `scroll`(+selector, positions). full 모드는 내부 스크롤 영역이 있으면 상·중·하를 자동 추가(합성하지 않고 구간별 이미지 유지).
- 새 라우트는 `list` 의 "라우트 커버리지"에서 `uncovered`로 보입니다. 시나리오를 추가하면 `covered`로 바뀝니다.

## 6. 계정·안전 규칙

- 기본(미리보기) 모드에는 로그인이 없습니다. 비밀번호가 필요 없습니다.
- 서버 연결 모드: `--target connected` + 환경변수 `MARGIN_QA_STUDENT_EMAIL/PASSWORD`, `MARGIN_QA_PROFESSOR_EMAIL/PASSWORD`. 비밀번호는 로그·결과·Git에 남기지 않습니다.
- 로컬이 아닌 주소는 `MARGIN_QA_ALLOW_REMOTE=1` 없이는 접속하지 않고, 운영 주소(`margin-research.pages.dev`)는 `MARGIN_QA_ALLOW_PRODUCTION=1`을 더해야 하며 읽기 전용으로만 돕니다.
- 기준 이미지는 자동으로 덮어쓰지 않습니다. 갱신은 `approve` 로만 합니다.
- 마이크·녹음·AI 호출·메일/초대 발송 시나리오는 없습니다(AGENTS.md).

## 7. 실제 Safari (선택, macOS)

Playwright WebKit은 Safari와 같은 브라우저가 아닙니다. 실제 Safari는 한 번 설정하면 됩니다.

```bash
sudo safaridriver --enable
# Safari ▸ 설정 ▸ 고급 ▸ '웹 개발자용 기능 보기' → 개발자 ▸ '원격 자동화 허용'
pip install selenium
python apps/home-preview/scripts/qa/python/capture_all.py --mode smoke --browser safari
```

준비가 안 되면 리포트에 "실제 Safari: 실행하지 못함 — 이유"가 남고 나머지 검사는 그대로 진행됩니다. Safari 모듈은 창 크기·테마 쿠키·데이터 격리 제어가 제한적이라 대표 화면(상호작용 없는 시나리오)의 캡처와 배치 검사만 합니다.

## 8. CI 권장안

기존 `repository-checks.yml`을 바꾸지 않았습니다. 안정화 뒤 별도 워크플로로 추가하세요.
PR → `--mode smoke`(실패 기준 없음, 리포트 아티팩트만) · main 병합 → `--mode standard` · 수동 → `--mode full` · 실제 Safari → macOS 수동 실행.
결과 폴더는 용량이 커서 아티팩트 보존 7일 권장. 처음에는 `--fail-on never`로 시작하고 확실한 항목(`confirmed`)부터 실패 기준으로 올립니다.

## 파일

| 파일 | 역할 |
|---|---|
| `capture_all.py` | 실행기(run/approve/list) |
| `scenarios.json` / `scenarios.py` | 시나리오 레지스트리 · 선택 · 주소 확정 · 라우트 커버리지 |
| `capture.py` | 컨텍스트 생성 · 안정화 · 상호작용 · 캡처 · 실행 오류 수집 |
| `layout_check.js` / `layout_checks.py` | DOM·CSS 배치 검사와 분류 |
| `visual_diff.py` | 기준 비교 · 차이 이미지 · 승인 |
| `report.py` / `report_template.html` | 단일 파일 HTML 리포트 |
| `browsers.py` / `auth.py` / `safari_runner.py` | 브라우저 · 접속 안전·로그인 · 실제 Safari |
| `config.py` | 크기·모드·경로·안전 정책 |
