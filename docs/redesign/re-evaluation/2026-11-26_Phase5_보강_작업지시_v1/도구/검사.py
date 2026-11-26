#!/usr/bin/env python3
"""Phase 5 보강 작업 자동 검사.

사용: 자료 루트(margin-re-evaluation/)에서
  python3 -I 2026-11-26_Phase5_보강_작업지시_v1/도구/검사.py <명령> [인자]

명령: 준비 | 화면목록 | 판정 T02~T06 | 합치기 | 판정표 | 시안 T08~T14 | 비교데이터 | 비교페이지 | 전체
마지막 줄이 '통과'면 통과다.
"""
import csv
import json
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.environ.get("MARGIN_OUT") or os.path.join(ROOT, "2026-11-26_Phase5_보강_v1")

INPUTS = [
    "2026-11-26_Phase5_개선설계_v1/README.md",
    "2026-11-26_Phase1-4_정리_v1/통합_결함목록.md",
    "2026-11-26_Phase1-4_정리_v1/03-architecture-root-causes_v2.md",
    "2026-11-26_Phase1-4_정리_v1/캡처_설명_정정표.md",
    "v2-2026-11-25-corrected/01-product-map.md",
    "v2-2026-11-25-corrected/02-product-evaluation.md",
    "v2-2026-11-25-corrected/02-visual-archive-index.md",
    "08-micro-detail-audit.md",
    "2026-11-26_Phase1-4_전수검사_v1/부록/A_데스크톱캡처89장.md",
    "2026-11-26_Phase1-4_전수검사_v1/부록/B_모바일교수기타캡처.md",
    "2026-11-26_Phase5_개선설계_v1/prototypes/05-data-integrity.html",
    "2026-11-26_Phase5_개선설계_v1/prototypes/03-review-role-boundary.html",
    "prototypes/01-home-rail-assistant.html",
    "prototypes/02-trash-delete-switcher.html",
    "prototypes/04-settings-and-modals.html",
]

ZONES = {
    "공개": "PUB", "가입·온보딩": "ONB", "연구 목록": "HUB", "셸": "SHL", "알림·검색": "SRC",
    "홈": "HOM", "연구 흐름": "FLW", "할 일": "TSK", "항목 상세": "DET",
    "미팅": "MTG", "녹음": "REC", "시간 조율": "POL",
    "글·자료": "DOC", "원고": "WRT", "PDF·자료": "MAT",
    "검토": "REV", "도우미": "AST", "설정": "SET", "계정": "ACC",
}
CARD_ZONES = {
    "T02": ["공개", "가입·온보딩", "연구 목록", "셸", "알림·검색"],
    "T03": ["홈", "연구 흐름", "할 일", "항목 상세"],
    "T04": ["미팅", "녹음", "시간 조율"],
    "T05": ["글·자료", "원고", "PDF·자료"],
    "T06": ["검토", "도우미", "설정", "계정"],
}
CARD_REQUIRED_IDS = {
    "T02": ["D17", "결정:휴지통", "RC-4", "A-N10", "09-14", "B-23", "09-12", "A-N24", "P02-3", "A-N48", "08-#6", "08-#7", "A-N7", "A-N8", "A-N9"],
    "T03": ["09-4", "E-5", "09-11", "A-N4", "B-2", "09-3", "E-4", "09-21", "E-6", "09-2", "09-7", "A-N5", "RC-7", "RC-10", "결정:완료취소", "B-27", "09-20"],
    "T04": ["A-N2", "B-3", "09-5", "09-22", "09-10", "09-6", "09-8", "09-9", "P03-3", "RC-10"],
    "T05": ["09-1", "E-1", "E-2", "E-3", "09-18", "09-19", "RC-9", "A-N3", "E-8", "09-23", "09-15", "09-17", "09-16", "P09-1", "B-20"],
    "T06": ["A-N1", "09-13", "09-24", "RC-1", "결정:공유중지", "B-19", "B-11", "결정:연구정보", "RC-5", "RC-6",
            "A-N13", "E-7", "A-N33", "B-21", "결정:크레딧%", "A-N31", "결정:계정", "A-N6", "08-#1", "08-#2", "08-#3", "08-#4", "08-#5"],
}
DECISIONS = {"D17", "결정:휴지통", "결정:공유중지", "결정:크레딧%", "결정:연구정보", "결정:완료취소", "결정:계정"}
VERDICTS = {"유지", "보완", "통합", "제거", "재설계", "추가"}
KINDS = {"페이지", "탭", "모달", "시트", "팝오버", "메뉴", "사이드 창", "토스트", "배너"}
ROLES = {"비로그인", "학생", "공동연구자", "지정 교수", "겸임 교수"}
GRADES = {"재현", "코드", "사진", "불확실", "기록 없음"}
FORBIDDEN_CAPTURES = [
    "assets/isolated-local/02_docs_staging_dialog_1440.png",
    "assets/isolated-local/04_recording_ui_preview_1440.png",
    "assets/isolated-local/09_delete_trash_modal_isolated_1440.png",
    "assets/live-desktop-deep/d11_dialog_new_meeting.png",
]
FORBIDDEN_PREFIXES = ["assets/benchmarks/", "assets/live-professor-editor/p05", "assets/motion/swipe_task_90px"]
TOSS_COLORS = ["#3182f6", "#191f28", "#f04452", "#e8f3ff", "#4e5968", "#8b95a1"]

A1_HEADER = ["화면ID", "구역", "화면 이름", "경로·진입", "종류", "보는 역할", "출처"]
J_HEADER = ["화면ID", "화면 이름", "판정", "문제 ID", "쟁점", "지금(전)", "바뀐 뒤(후)", "지금 캡처", "근거 등급", "메모"]
ALL_HEADER = ["화면ID", "구역"] + J_HEADER[1:]
SCENE_HEADER = ["시안 파일", "장면 id", "보여 주는 것", "쟁점", "원본과 달라진 점"]

CARD_SCENES = {
    "T08": {"05-data-integrity_v2.html": ["05-restore", "05-conflict", "05-visibility", "05-source", "05-next", "05-undo"],
            "03-review-role-boundary_v2.html": ["03-review", "03-research-info"]},
    "T09": {"02-trash-delete-switcher_v2.html": ["02-switcher", "02-trash-move", "02-delete", "02-share-stop"]},
    "T10": {"04-settings-and-modals_v2.html": ["04-settings-nav", "04-display", "04-assistant-settings", "04-usage", "04-shortcuts", "04-research-info"]},
    "T11": {"04-settings-and-modals_v2.html": ["04-profile", "04-login-methods", "04-export", "04-delete-account"]},
    "T12": {"04-settings-and-modals_v2.html": ["04-poll-create", "04-poll-respond"]},
    "T13": {"01-home-rail-assistant_v2.html": ["01-home", "01-rail-panel", "01-panel-closed", "01-toast"]},
    "T14": {"01-home-rail-assistant_v2.html": ["01-assistant-start", "01-suggestions", "01-credit", "01-feedback"]},
}
CARD_ORDER = ["T08", "T09", "T10", "T11", "T12", "T13", "T14"]

# 2단계 시각화: 화면마다 장면 하나. 짝은 시안배정.tsv가 정한다(작업자가 고르지 않는다).
ASSIGN_PATH = os.path.join(HERE, "..", "2단계_시각화", "시안배정.tsv")
ASSIGN = []
if os.path.exists(ASSIGN_PATH):
    with open(ASSIGN_PATH, encoding="utf-8", newline="") as f:
        _r = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
    ASSIGN = [dict(zip(_r[0], [unicodedata.normalize("NFC", c) for c in x])) for x in _r[1:] if x]
    for a in ASSIGN:
        CARD_SCENES.setdefault(a["카드"], {}).setdefault(a["시안 파일"], []).append(a["장면 id"])
        if a["카드"] not in CARD_ORDER:
            CARD_ORDER.append(a["카드"])
ASSIGN_LAST = []  # 시안 파일마다 마지막 카드
for a in ASSIGN:
    ASSIGN_LAST = [c for c in ASSIGN_LAST if c not in [x["카드"] for x in ASSIGN if x["시안 파일"] == a["시안 파일"]]] + [a["카드"]]

errors, warnings = [], []


def fail(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def p(rel):
    return os.path.join(ROOT, rel)


def o(rel):
    return os.path.join(OUT, rel)


def nfc(s):
    return unicodedata.normalize("NFC", s)


def read(path):
    with open(path, encoding="utf-8") as f:
        return nfc(f.read())


def exists_rel(rel):
    return os.path.exists(p(rel)) or os.path.exists(p(nfc(rel))) or os.path.exists(p(unicodedata.normalize("NFD", rel)))


def show(path):
    return os.path.relpath(path, os.path.dirname(OUT))


def read_tsv(path, header):
    if not os.path.exists(path):
        fail(f"파일이 없어요: {show(path)}")
        return []
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE))
    rows = [[nfc(c) for c in r] for r in rows if any(c.strip() for c in r)]
    name = show(path)
    if not rows:
        fail(f"{name}: 비어 있어요")
        return []
    if rows[0] != header:
        fail(f"{name}: 첫 줄(열 이름)이 달라요.\n    기대: {'|'.join(header)}\n    실제: {'|'.join(rows[0])}")
        return []
    out = []
    for i, r in enumerate(rows[1:], start=2):
        if len(r) != len(header):
            fail(f"{name} {i}번째 줄: 칸 수가 {len(r)}개예요(정답 {len(header)}개). 칸 안에 탭을 넣었는지 확인해 주세요")
            continue
        d = dict(zip(header, [c.strip() for c in r]))
        d["_line"] = i
        for k in header:
            if not d[k]:
                fail(f"{name} {i}번째 줄: '{k}' 칸이 비어 있어요")
        out.append(d)
    return out


def split_dot(s):
    return [t.strip() for t in s.split("·") if t.strip()]


_corpus = None


def corpus():
    global _corpus
    if _corpus is None:
        parts = []
        for rel in ["2026-11-26_Phase1-4_정리_v1/통합_결함목록.md",
                    "2026-11-26_Phase1-4_전수검사_v1/부록/A_데스크톱캡처89장.md",
                    "2026-11-26_Phase1-4_전수검사_v1/부록/B_모바일교수기타캡처.md",
                    "2026-11-26_Phase1-4_전수검사_v1/부록/C_문서주장검사.md",
                    "2026-11-26_Phase1-4_전수검사_v1/부록/D_계획대비누락.md",
                    "2026-11-26_Phase1-4_정리_v1/05-improvement-plan_v2.md",
                    "v2-2026-11-25-corrected/02-product-evaluation.md",
                    "2026-11-26_Phase1-4_정리_v1/03-architecture-root-causes_v2.md"]:
            if exists_rel(rel):
                parts.append(read(p(rel)))
        _corpus = "\n".join(parts)
    return _corpus


def id_known(t):
    if t in DECISIONS:
        return True
    m = re.fullmatch(r"08-#(\d+)", t)
    if m:
        return 1 <= int(m.group(1)) <= 17
    m = re.fullmatch(r"RC-(\d+)", t)
    if m:
        return 1 <= int(m.group(1)) <= 10
    if re.fullmatch(r"09-\d+", t):
        return 1 <= int(t[3:]) <= 24
    if re.fullmatch(r"A-N\d+", t):
        return re.search(r"\bN" + t[3:] + r"\b", corpus()) is not None
    if re.fullmatch(r"B-\d+", t):
        return re.search(r"(\bB-" + t[2:] + r"\b)|(\|\s*" + t[2:] + r"\s*\|)", corpus()) is not None
    if re.fullmatch(r"E-\d+", t):
        return re.search(r"\b" + re.escape(t) + r"\b", corpus()) is not None
    if re.fullmatch(r"P\d\d-S?\d+", t):
        return t in corpus()
    return False


def check_capture(cap, where):
    if cap == "없음":
        return
    if cap.startswith("/"):
        fail(f"{where}: 캡처 경로는 자료 루트 기준 상대 경로로 써 주세요: {cap}")
        return
    if cap in FORBIDDEN_CAPTURES or any(cap.startswith(x) for x in FORBIDDEN_PREFIXES):
        fail(f"{where}: 쓰면 안 되는 캡처예요(공통지침 4절 5·6번): {cap}")
    if not exists_rel(cap):
        fail(f"{where}: 캡처 파일이 없어요: {cap}")


def load_a1():
    return read_tsv(o("판정표/A1_화면목록.tsv"), A1_HEADER)


# ---------- 명령 ----------

def cmd_prepare():
    for rel in INPUTS:
        if not exists_rel(rel):
            fail(f"입력 파일이 없어요: {rel}")
    for d in ["판정표", "prototypes", "비교", "보고"]:
        if not os.path.isdir(o(d)):
            fail(f"결과 폴더가 없어요: {show(o(d))}")
    if not os.path.exists(o("README.md")):
        fail("결과 폴더 README.md가 없어요")


def cmd_a1():
    rows = load_a1()
    seen = set()
    counts = {}
    for r in rows:
        w = f"A1 {r['_line']}번째 줄"
        zid = r["화면ID"]
        if r["구역"] not in ZONES:
            fail(f"{w}: 구역 '{r['구역']}'은 구역표에 없어요")
        elif not re.fullmatch(ZONES[r["구역"]] + r"-\d\d", zid):
            fail(f"{w}: 화면ID '{zid}'가 구역 코드 {ZONES[r['구역']]}-두자리 형식이 아니에요")
        if zid in seen:
            fail(f"{w}: 화면ID '{zid}'가 겹쳐요")
        seen.add(zid)
        if r["종류"] not in KINDS:
            fail(f"{w}: 종류 '{r['종류']}'는 허용 값이 아니에요({', '.join(sorted(KINDS))})")
        for role in split_dot(r["보는 역할"]):
            if role not in ROLES:
                fail(f"{w}: 보는 역할 '{role}'은 허용 값이 아니에요")
        counts[r["구역"]] = counts.get(r["구역"], 0) + 1
    for z in ZONES:
        if z not in counts:
            fail(f"구역 '{z}'에 줄이 하나도 없어요")
    if rows:
        print("구역별 줄 수: " + " · ".join(f"{z} {counts.get(z, 0)}" for z in ZONES))
    return rows


def validate_judgment_rows(rows, name, a1_by_id):
    found = set()
    for r in rows:
        w = f"{name} {r['_line']}번째 줄({r['화면ID']})"
        if r["화면ID"] not in a1_by_id:
            fail(f"{w}: A1 목록에 없는 화면ID예요")
        elif r["화면 이름"] != a1_by_id[r["화면ID"]]["화면 이름"]:
            fail(f"{w}: 화면 이름이 A1 목록과 달라요('{a1_by_id[r['화면ID']]['화면 이름']}')")
        vs = [v.strip() for v in r["판정"].split("+")]
        if len(vs) > 2 or any(v not in VERDICTS for v in vs):
            fail(f"{w}: 판정 '{r['판정']}'이 6기준 하나 또는 'A + B' 형식이 아니에요")
        if r["문제 ID"] == "기록된 문제 없음":
            if vs != ["유지"]:
                fail(f"{w}: 문제 ID가 없는데 판정이 '유지'가 아니에요")
        else:
            for t in split_dot(r["문제 ID"]):
                if not id_known(t):
                    fail(f"{w}: 문제 ID '{t}'를 원 문서에서 찾을 수 없어요(형식이나 번호 확인)")
                found.add(t)
        if r["쟁점"] != "—":
            for t in split_dot(r["쟁점"]):
                if not re.fullmatch(r"[1-8]", t):
                    fail(f"{w}: 쟁점 '{t}'는 1~8이나 '—'여야 해요")
        if vs == ["유지"] and r["바뀐 뒤(후)"] != "그대로":
            fail(f"{w}: 판정이 '유지'면 바뀐 뒤는 '그대로'예요")
        if vs != ["유지"] and r["바뀐 뒤(후)"] == "그대로":
            fail(f"{w}: 판정이 '유지'가 아닌데 바뀐 뒤가 '그대로'예요")
        if re.search(r"6초|호버|마우스를 올리", r["바뀐 뒤(후)"]) and not r["바뀐 뒤(후)"].startswith("제안:"):
            warn(f"{w}: 바뀐 뒤에 결정되지 않은 내용(6초·호버)이 있어요. '제안:'을 붙였는지 확인해 주세요")
        if r["근거 등급"] not in GRADES:
            fail(f"{w}: 근거 등급 '{r['근거 등급']}'은 허용 값이 아니에요({', '.join(sorted(GRADES))})")
        check_capture(r["지금 캡처"], w)
    return found


def cmd_judgment(card):
    if card not in CARD_ZONES:
        fail("판정 뒤에 T02~T06 중 하나를 써 주세요")
        return
    a1 = load_a1()
    a1_by_id = {r["화면ID"]: r for r in a1}
    mine = {r["화면ID"] for r in a1 if r["구역"] in CARD_ZONES[card]}
    name = f"판정_{card}.tsv"
    rows = read_tsv(o(f"판정표/{name}"), J_HEADER)
    if not rows:
        return
    ids = [r["화면ID"] for r in rows]
    for zid in sorted(mine - set(ids)):
        fail(f"{name}: 내 구역 화면ID '{zid}' 줄이 없어요")
    for zid in sorted(set(ids) - mine):
        fail(f"{name}: '{zid}'는 이 카드 구역이 아니에요")
    for zid in {x for x in ids if ids.count(x) > 1}:
        fail(f"{name}: 화면ID '{zid}'가 두 번 나와요")
    found = validate_judgment_rows(rows, name, a1_by_id)
    for t in CARD_REQUIRED_IDS[card]:
        if t not in found:
            fail(f"{name}: 카드의 '이 구역에서 찾을 ID' 중 '{t}'가 어느 줄에도 없어요")
    vc = {}
    for r in rows:
        for v in r["판정"].split("+"):
            vc[v.strip()] = vc.get(v.strip(), 0) + 1
    print("판정별 줄 수: " + " · ".join(f"{k} {v}" for k, v in vc.items()))


def cmd_merge():
    a1 = load_a1()
    if errors:
        return
    by_id = {}
    for card in CARD_ZONES:
        for r in read_tsv(o(f"판정표/판정_{card}.tsv"), J_HEADER):
            by_id[r["화면ID"]] = r
    if errors:
        return
    lines = ["\t".join(ALL_HEADER)]
    md = ["# 전체 판정표", "", "도구로 만든 파일이에요. 고칠 때는 `판정_Txx.tsv`를 고치고 다시 합쳐 주세요.", "",
          "| " + " | ".join(ALL_HEADER) + " |", "|" + "---|" * len(ALL_HEADER)]
    for a in a1:
        r = by_id.get(a["화면ID"])
        if not r:
            fail(f"화면ID '{a['화면ID']}'의 판정 줄이 어느 판정 파일에도 없어요")
            continue
        vals = [a["화면ID"], a["구역"]] + [r[k] for k in J_HEADER[1:]]
        lines.append("\t".join(vals))
        md.append("| " + " | ".join(v.replace("|", "\\|") for v in vals) + " |")
    if errors:
        return
    with open(o("판정표/전체_판정표.tsv"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(o("판정표/전체_판정표.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")
    print(f"합쳤어요: {len(lines) - 1}줄")


def defect_ids():
    rel = "2026-11-26_Phase1-4_정리_v1/통합_결함목록.md"
    text = read(p(rel))
    text = text.split("## 5.")[0]  # 철회·정정 절 제외
    ids = set()
    for line in text.splitlines():
        if line.startswith("| ") and not line.startswith("| 통합 ID") and not line.startswith("|---"):
            first = line.split("|")[1]
            for t in re.findall(r"09-\d+|A-N\d+|B-\d+|E-\d+", first):
                ids.add(t)
    return ids


def cmd_table():
    a1 = load_a1()
    a1_by_id = {r["화면ID"]: r for r in a1}
    rows = read_tsv(o("판정표/전체_판정표.tsv"), ALL_HEADER)
    if not rows:
        return
    if len(rows) != len(a1):
        fail(f"전체 판정표 줄 수({len(rows)})가 A1 목록({len(a1)})과 달라요. '합치기'를 다시 돌려 주세요")
    jrows = [{k: r[k] for k in J_HEADER} | {"_line": r["_line"]} for r in rows]
    found = validate_judgment_rows(jrows, "전체_판정표.tsv", a1_by_id)
    for t in sorted(defect_ids() - found):
        fail(f"통합 결함목록의 '{t}'가 판정표 어디에도 없어요")
    print(f"화면 {len(rows)}개 검사")


def scenes_in(html):
    out = []
    for tag in re.findall(r"<section\b[^>]*>", html):
        cls = re.search(r'class="([^"]*)"', tag)
        sid = re.search(r'\bid="([^"]*)"', tag)
        if cls and re.search(r"\bscene\b", cls.group(1)) and sid:
            out.append(sid.group(1))
    return out


def check_html_common(path, name):
    html = read(path)
    low = html.lower()
    for c in TOSS_COLORS:
        if c in low:
            fail(f"{name}: 이전 토스 색 {c}이 남아 있어요")
    for m in re.findall(r'(?:src|href)\s*=\s*"(https?:[^"]+)"', html):
        fail(f"{name}: 외부 자원을 불러와요: {m}")
    if "@import" in low and "http" in low:
        fail(f"{name}: 외부 CSS를 불러오는 것 같아요(@import)")
    if "--brand: #0066ff" not in low:
        fail(f"{name}: 공통지침 7-1 색 블록이 없어요(--brand: #0066ff)")
    if "prefers-color-scheme: dark" not in low:
        fail(f"{name}: 다크 모드 블록이 없어요")
    levels = [int(x) for x in re.findall(r"<h([1-6])\b", low)]
    if not levels or levels[0] != 1:
        fail(f"{name}: 첫 제목이 h1이 아니에요")
    for a, b in zip(levels, levels[1:]):
        if b > a + 1:
            fail(f"{name}: 제목 단계를 건너뛰었어요(h{a} 다음 h{b})")
            break
    return html


def cmd_proto(card):
    if card not in CARD_SCENES:
        fail("시안 뒤에 카드 번호(T08~T14, T20~T32)를 써 주세요")
        return
    upto = CARD_ORDER[: CARD_ORDER.index(card) + 1]
    files = {}
    for c in upto:
        for fn, sc in CARD_SCENES[c].items():
            if fn in CARD_SCENES[card]:
                files.setdefault(fn, []).extend(sc)
    scene_rows = read_tsv(o("prototypes/장면목록.tsv"), SCENE_HEADER)
    listed = {(r["시안 파일"], r["장면 id"]) for r in scene_rows}
    for fn, needed in files.items():
        path = o("prototypes/" + fn)
        if not os.path.exists(path):
            fail(f"시안 파일이 없어요: prototypes/{fn}")
            continue
        html = check_html_common(path, fn)
        if "제품 코드와 연결되지 않아요" not in html:
            fail(f"{fn}: 공통지침 7-2 머리 문구가 없어요")
        if "hashchange" not in html:
            fail(f"{fn}: 공통지침 7-3 장면 주소 스크립트가 없어요(hashchange)")
        have = scenes_in(html)
        num = fn[:2]
        for s in have:
            if not re.fullmatch(num + r"-[a-z0-9-]+", s):
                fail(f"{fn}: 장면 id '{s}'가 '{num}-영어소문자' 형식이 아니에요")
        for s in needed:
            if s not in have:
                fail(f"{fn}: 장면 '{s}'가 없어요(section class=\"scene\" id=\"{s}\")")
            if (fn, s) not in listed:
                fail(f"장면목록.tsv: '{fn}' '{s}' 줄이 없어요")
        for s in have:
            if s not in needed:
                warn(f"{fn}: 이 카드까지의 장면 목록에 없는 장면 '{s}'가 있어요. 지우지 말고 왜 있는지 보고서에 적어 주세요")
        btn = set(re.findall(r'data-scene="([^"]+)"', html))
        if btn and not set(needed) <= btn:
            warn(f"{fn}: data-scene 버튼이 없는 장면: {', '.join(sorted(set(needed) - btn))}")


def load_items():
    path = o("비교/compare-items.js")
    if not os.path.exists(path):
        fail("비교/compare-items.js가 없어요")
        return None
    text = read(path).strip()
    if not text.startswith("window.COMPARE_ITEMS"):
        fail("compare-items.js가 'window.COMPARE_ITEMS = ['로 시작하지 않아요")
        return None
    body = text.split("=", 1)[1].strip().rstrip(";").strip()
    try:
        return json.loads(body)
    except json.JSONDecodeError as e:
        fail(f"compare-items.js의 배열이 JSON 형식이 아니에요(큰따옴표, 끝 쉼표 확인): {e}")
        return None


def cmd_items():
    items = load_items()
    if items is None:
        return
    table = read_tsv(o("판정표/전체_판정표.tsv"), ALL_HEADER)
    changing = {r["화면ID"]: r for r in table if r["판정"] != "유지"}
    keys = ["id", "screenId", "title", "area", "issue", "verdict", "problemIds", "beforeImage", "beforeText",
            "afterProto", "afterText", "status"]
    seen = set()
    for n, it in enumerate(items, start=1):
        w = f"항목 {n}({it.get('id', '?')})"
        if set(it.keys()) != set(keys):
            fail(f"{w}: 필드가 달라요. 필요한 필드: {', '.join(keys)}")
            continue
        if it["id"] != f"CMP-{n:03d}":
            fail(f"{w}: id는 CMP-{n:03d}여야 해요(순서대로)")
        sid = it["screenId"]
        if sid in seen:
            fail(f"{w}: screenId '{sid}'가 두 번 나와요")
        seen.add(sid)
        r = changing.get(sid)
        if not r:
            fail(f"{w}: '{sid}'는 판정표에 없거나 '유지'예요")
        else:
            if it["title"] != r["화면 이름"] or it["area"] != r["구역"] or it["verdict"] != r["판정"]:
                fail(f"{w}: title/area/verdict가 판정표와 달라요")
            after = r["바뀐 뒤(후)"]
            want_status = "제안" if after.startswith("제안:") else ("확정+제안" if "제안:" in after else "확정")
            if it["status"] != want_status:
                fail(f"{w}: status 값이 판정표와 맞지 않아요. '{want_status}'로 써 주세요")
            if it["afterText"] != re.sub(r"^제안:\s*", "", after) or it["beforeText"] != r["지금(전)"]:
                fail(f"{w}: beforeText/afterText가 판정표 문장과 달라요")
            want_img = None if r["지금 캡처"] == "없음" else r["지금 캡처"]
            if it["beforeImage"] != want_img:
                fail(f"{w}: beforeImage가 판정표 '지금 캡처'와 달라요")
        if not isinstance(it["issue"], list) or any(not isinstance(x, int) or not 1 <= x <= 8 for x in it["issue"]):
            fail(f"{w}: issue는 1~8 숫자 배열이어야 해요")
        if it["beforeImage"] is not None:
            check_capture(it["beforeImage"], w)
        ap = it["afterProto"]
        if ap is not None:
            if "#" not in ap:
                fail(f"{w}: afterProto는 '파일#장면id' 형식이어야 해요")
            else:
                fn, sc = ap.split("#", 1)
                path = o("prototypes/" + fn)
                if not os.path.exists(path):
                    fail(f"{w}: 시안 파일이 없어요: {fn}")
                elif sc not in scenes_in(read(path)):
                    fail(f"{w}: {fn}에 장면 '{sc}'가 없어요")
    by_sid = {it.get("screenId"): it for it in items if isinstance(it, dict)}
    for a in ASSIGN:
        want = a["시안 파일"] + "#" + a["장면 id"]
        it = by_sid.get(a["화면ID"])
        if it and it.get("afterProto") != want:
            fail(f"{a['화면ID']}: afterProto가 시안배정.tsv와 달라요(기대 {want}). '시안연결'을 돌려 주세요")
    for sid in sorted(set(changing) - seen):
        fail(f"판정표에서 바뀌는 화면 '{sid}'가 비교 데이터에 없어요")
    print(f"항목 {len(items)}개 · 시안 연결 {sum(1 for i in items if i.get('afterProto'))}개 · 제안 {sum(1 for i in items if i.get('status') == '제안')}개")


def cmd_link():
    """시안배정.tsv대로 compare-items.js의 afterProto를 채운다(장면이 실제로 있을 때만)."""
    items = load_items()
    if items is None:
        return
    by_sid = {it["screenId"]: it for it in items}
    n = 0
    for a in ASSIGN:
        path = o("prototypes/" + a["시안 파일"])
        if not os.path.exists(path) or a["장면 id"] not in scenes_in(read(path)):
            fail(f"{a['화면ID']}: 장면 {a['시안 파일']}#{a['장면 id']}가 아직 없어요")
            continue
        it = by_sid.get(a["화면ID"])
        if not it:
            fail(f"{a['화면ID']}: compare-items.js에 항목이 없어요")
            continue
        it["afterProto"] = a["시안 파일"] + "#" + a["장면 id"]
        n += 1
    if errors:
        return
    with open(o("비교/compare-items.js"), "w", encoding="utf-8") as f:
        f.write("window.COMPARE_ITEMS = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n")
    print(f"연결했어요: {n}개")


def cmd_page():
    path = o("비교/compare.html")
    if not os.path.exists(path):
        fail("비교/compare.html이 없어요")
        return
    html = read(path)
    if 'src="compare-items.js"' not in html:
        fail("compare.html: <script src=\"compare-items.js\">가 없어요")
    if "fetch(" in html:
        fail("compare.html: fetch()를 쓰면 file://에서 안 열려요")
    for need, why in [("../../", "캡처 경로 앞 '../../'"), ("../prototypes/", "시안 경로 앞 '../prototypes/'"),
                      ("<iframe", "iframe"), ("<select", "좁은 화면 항목 선택 select"), ("aria-current", "목록의 aria-current"),
                      ("location.hash", "주소 #CMP-… 처리"), ("replaceState", "주소 바꾸기"), ("ArrowRight", "방향키 → 처리"),
                      ("조건에 맞는 항목이 없어요", "필터 결과 0개 문구"), ("지금 화면 캡처가 없어요", "캡처 없음 문구"),
                      ("이 항목은 시안 없이 설명만 있어요", "시안 없음 문구"), ("--brand: #0066ff", "공통 색 블록"),
                      ("prefers-color-scheme: dark", "다크 모드")]:
        if need not in html:
            fail(f"compare.html: {why}이(가) 없어요")
    for m in re.findall(r'(?:src|href)\s*=\s*"(https?:[^"]+)"', html):
        fail(f"compare.html: 외부 자원을 불러와요: {m}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    cmd = sys.argv[1]
    arg = sys.argv[2] if len(sys.argv) > 2 else ""
    if cmd == "준비":
        cmd_prepare()
    elif cmd == "화면목록":
        cmd_a1()
    elif cmd == "판정":
        cmd_judgment(arg)
    elif cmd == "합치기":
        cmd_merge()
    elif cmd == "판정표":
        cmd_table()
    elif cmd == "시안":
        cmd_proto(arg)
    elif cmd == "비교데이터":
        cmd_items()
    elif cmd == "비교페이지":
        cmd_page()
    elif cmd == "시안연결":
        cmd_link()
    elif cmd == "전체":
        cmd_prepare()
        cmd_a1()
        cmd_table()
        for c in ["T08", "T09", "T12", "T14"] + [c for c in ASSIGN_LAST if os.path.exists(o("prototypes/" + next(a["시안 파일"] for a in ASSIGN if a["카드"] == c)))]:
            cmd_proto(c)
        cmd_items()
        cmd_page()
    else:
        print(__doc__)
        sys.exit(2)
    for w in warnings:
        print("경고: " + w)
    for e in errors:
        print("실패: " + e)
    print("통과" if not errors else f"실패 {len(errors)}건")
    sys.exit(0 if not errors else 1)


if __name__ == "__main__":
    main()
