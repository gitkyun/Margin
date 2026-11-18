/*
 * 실제 DOM과 계산된 CSS로 배치 문제를 찾습니다. 페이지에서 실행되며 읽기만 합니다(DOM을 바꾸지 않음).
 * 호출: (opts) => { issues, counts, metrics }. opts = { allowSelectors: string[] }
 * 각 항목: { kind, classification: "confirmed"|"suspect"|"allowed", severity, selector, rect, detail, text, reason? }
 *
 * 원칙: 겹침·넘침이 모두 오류는 아닙니다. 확실한 것만 confirmed, 정상일 수 있는 것은 suspect,
 * 알려진 정상 예외(팝오버·말줄임·PDF·가로 스크롤 표 등)는 allowed 로 분리합니다.
 */
(opts) => {
  const d = document;
  const de = d.documentElement;
  const W = innerWidth;
  const H = innerHeight;
  const issues = [];
  const counts = {};
  const MAX_PER_KIND = 12;

  const allowSel = (opts.allowSelectors || []).join(",");
  const cs = (el) => getComputedStyle(el);
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const cssPath = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 5 && n !== d.body; i++, n = n.parentElement) {
      if (n.id && !/^[:\d]|radix|«/.test(n.id)) {
        parts.unshift("#" + CSS.escape(n.id));
        break;
      }
      const slot = n.getAttribute("data-slot") || n.getAttribute("data-testid");
      const cls = typeof n.className === "string" ? n.className.trim().split(/\s+/).filter((c) => c && !/^(css-|_)/.test(c)).slice(0, 2) : [];
      let s = n.tagName.toLowerCase();
      if (slot) s += `[data-slot=${slot}]`;
      else if (cls.length) s += "." + cls.map((c) => CSS.escape(c)).join(".");
      const label = n.getAttribute("aria-label");
      if (label && !slot) s += `[aria-label="${label.slice(0, 20)}"]`;
      parts.unshift(s);
    }
    return parts.join(" > ");
  };
  const visible = (el) => {
    const s = cs(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    if (el.closest("[aria-hidden=true],[hidden],.sr-only,[inert]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const ownText = (el) => {
    let t = "";
    for (const c of el.childNodes) if (c.nodeType === 3) t += c.textContent;
    return t.replace(/\s+/g, " ").trim();
  };
  const isAllowed = (el) => (allowSel ? !!el.closest(allowSel) : false);
  const clipAncestor = (el, axis) => {
    let p = el.parentElement;
    while (p && p !== de) {
      const s = cs(p);
      const o = axis === "x" ? s.overflowX : s.overflowY;
      if (/hidden|clip|auto|scroll/.test(o)) return p;
      p = p.parentElement;
    }
    return null;
  };
  const push = (kind, el, classification, severity, detail, extra = {}) => {
    counts[kind] = (counts[kind] || 0) + 1;
    if (counts[kind] > MAX_PER_KIND) return;
    let cls = classification;
    let reason;
    if (el && isAllowed(el) && cls !== "allowed") {
      cls = "allowed";
      reason = "알려진 정상 예외 영역";
    }
    issues.push({
      kind,
      classification: cls,
      severity,
      selector: el ? cssPath(el) : "(문서)",
      rect: el ? rectOf(el) : null,
      detail,
      text: el ? (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40) : "",
      reason,
      ...extra,
    });
  };

  const all = [...d.body.querySelectorAll("*")].filter((el) => !/^(SCRIPT|STYLE|NOSCRIPT|LINK|META)$/.test(el.tagName));
  const vis = all.filter(visible);

  // A. 페이지 전체 가로 넘침
  const hscroll = Math.max(de.scrollWidth, d.body.scrollWidth) - W;
  if (hscroll > 1 && !/hidden|clip/.test(cs(de).overflowX)) {
    const culprits = vis.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.right > W + 1 && cs(el).position !== "fixed" && !clipAncestor(el, "x");
    });
    // 가장 바깥 원인만: 부모도 같이 넘치면 부모를 대표로.
    const roots = culprits.filter((el) => !culprits.includes(el.parentElement));
    for (const el of roots.slice(0, 6)) push("page-hscroll", el, "confirmed", "high", `페이지가 ${hscroll}px 가로로 넘침 — 이 요소가 오른쪽 끝 ${Math.round(el.getBoundingClientRect().right - W)}px 밖`);
    if (!roots.length) push("page-hscroll", null, "confirmed", "high", `문서 너비가 화면보다 ${hscroll}px 큼(원인 요소 특정 못 함)`);
  }

  // B. 부모 영역을 벗어난 카드·버튼·이미지
  const boxy = vis.filter((el) => el.matches("button,a[data-slot=button],input,select,textarea,img,[class*=card],[data-slot=card],[role=tab]"));
  for (const el of boxy) {
    const p = el.parentElement;
    if (!p || cs(el).position === "absolute" || cs(el).position === "fixed") continue;
    if (/hidden|clip|auto|scroll/.test(cs(p).overflowX)) continue;
    const r = el.getBoundingClientRect();
    const pr = p.getBoundingClientRect();
    if (pr.width < 1) continue;
    const over = Math.max(r.right - pr.right, pr.left - r.left);
    if (over > 2 && r.right <= W + 1) push("escapes-parent", el, "suspect", "medium", `부모 영역보다 ${Math.round(over)}px 밖으로 나감`);
  }

  // C. 텍스트 잘림·넘침·한 글자 줄바꿈
  const lineRects = (el) => {
    const tw = d.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rs = [];
    let n;
    while ((n = tw.nextNode())) {
      if (!n.textContent.trim()) continue;
      const rg = d.createRange();
      rg.selectNodeContents(n);
      for (const x of rg.getClientRects()) if (x.width > 1 && x.height > 1) rs.push(x);
    }
    return rs;
  };
  const countLines = (rs) => {
    const s = [...rs].sort((a, b) => a.top - b.top);
    let lines = 0, top = -1e9, h = 0;
    for (const x of s) {
      if (x.top - top > Math.max(h, x.height) / 2) { lines++; top = x.top; h = x.height; } else h = Math.max(h, x.height);
    }
    return lines;
  };
  for (const el of vis) {
    const s = cs(el);
    const t = ownText(el);
    if (!t) continue;
    const ellipsis = s.textOverflow === "ellipsis" || (s.webkitLineClamp && s.webkitLineClamp !== "none");
    const hOver = el.scrollWidth - el.clientWidth;
    const vOver = el.scrollHeight - el.clientHeight;
    if (ellipsis && (hOver > 1 || vOver > 1)) {
      push("truncated-ellipsis", el, "allowed", "low", "말줄임으로 일부 글자가 숨음(의도된 처리)", { reason: "말줄임(ellipsis/line-clamp)" });
      continue;
    }
    if (/hidden|clip/.test(s.overflowX) && hOver > 2 && el.clientWidth > 6) {
      push("text-clipped", el, "suspect", el.matches("button,a,[role=tab]") ? "high" : "medium", `글자가 가로로 ${hOver}px 잘림(말줄임 없음)`);
    } else if (/hidden|clip/.test(s.overflowY) && vOver > 2 && el.clientHeight > 0 && s.display !== "inline") {
      push("text-clipped", el, "suspect", "medium", `글자가 세로로 ${vOver}px 잘림(말줄임 없음)`);
    }
    // 글자가 컨테이너 오른쪽 밖으로 삐져나옴
    if (s.overflowX === "visible" && !el.closest("svg,canvas")) {
      const rs = lineRects(el);
      const er = el.getBoundingClientRect();
      const maxRight = rs.reduce((m, x) => Math.max(m, x.right), 0);
      if (rs.length && er.width > 0 && maxRight > er.right + 2 && s.whiteSpace !== "nowrap" && maxRight <= W + 1) {
        push("text-spill", el, "suspect", "medium", `글자가 요소 오른쪽 밖으로 ${Math.round(maxRight - er.right)}px 나감`);
      }
    }
    // 한국어가 한 글자씩 줄바꿈
    const hangul = (t.match(/[가-힣]/g) || []).length;
    if (hangul >= 4) {
      const rs = lineRects(el);
      const lines = countLines(rs);
      if ((lines >= 3 && t.length / lines <= 1.7) || (lines >= 5 && t.length / lines <= 4.5)) {
        push("char-per-line", el, "confirmed", "high", `${t.length}글자가 ${lines}줄로 나뉨(줄당 ${(t.length / lines).toFixed(1)}글자) — 컨테이너가 너무 좁음`);
      } else if (el.matches("button,[role=tab],a[data-slot=button],[role=radio]") && lines > 1) {
        push("control-label-wraps", el, "suspect", "low", `버튼·탭 글자가 ${lines}줄로 나뉨`);
      }
    }
  }

  // D. 겹침: 다른 요소가 조작 요소를 가림
  const controls = vis.filter((el) => el.matches("button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=checkbox],[role=menuitem],[role=switch]"));
  const hasModal = !!d.querySelector("[role=dialog][aria-modal=true],[role=alertdialog],dialog[open]");
  const hasPopup = [...d.querySelectorAll("[role=menu],[role=listbox],[data-radix-popper-content-wrapper]")].some(visible);
  // 스크롤 영역·잘리는 영역 밖으로 밀려난 조작 요소는 '가려진' 것이 아니라 스크롤로 닿는 것입니다.
  const clippedOut = (el, cx, cy) => {
    for (let p = el.parentElement; p && p !== de; p = p.parentElement) {
      if (!/hidden|clip|auto|scroll/.test(cs(p).overflowY + cs(p).overflowX)) continue;
      const pr = p.getBoundingClientRect();
      if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom) return true;
    }
    return false;
  };
  // 위/아래 가장자리에 붙은 얇은 고정 바 아래로 스크롤 콘텐츠가 지나가는 것은 정상. 더 스크롤해도 바 밑에서 못 빠져나올 때만 문제.
  const edgeBarOk = (el, bar, cy) => {
    const br = bar.getBoundingClientRect();
    const isBottom = br.bottom >= H - 2 && br.top > H * 0.5, isTop = br.top <= 2 && br.bottom < H * 0.5;
    if (!(isBottom || isTop) || br.height > H * 0.3) return false;
    let sc = el.parentElement;
    while (sc && sc !== de && !(/auto|scroll/.test(cs(sc).overflowY) && sc.scrollHeight > sc.clientHeight + 2)) sc = sc.parentElement;
    const node = !sc || sc === de ? d.scrollingElement : sc;
    const room = isBottom ? node.scrollHeight - node.clientHeight - node.scrollTop : node.scrollTop;
    const depth = isBottom ? cy - br.top : br.bottom - cy;
    return room > depth + 4;
  };
  for (const el of controls.slice(0, 400)) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > W || cy > H) continue;
    if (clippedOut(el, cx, cy)) continue;
    const top = d.elementFromPoint(cx, cy);
    if (!top || el.contains(top) || top.contains(el)) continue;
    if (el.closest("label") && el.closest("label").contains(top)) continue;
    const topStyle = cs(top);
    const topFixed = (() => { let n = top; while (n && n !== de) { const p = cs(n).position; if (p === "fixed" || p === "sticky") return n; n = n.parentElement; } return null; })();
    const inOverlay = !!top.closest("[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[data-radix-popper-content-wrapper],[role=tooltip],dialog,[data-overlay],#margin-panel,.margin-panel");
    if (inOverlay) continue; // 모달·메뉴가 뒤 화면을 덮는 것은 정상
    if (topFixed && (hasModal || hasPopup)) continue; // 열린 팝업의 배경막
    if (topFixed) { const tr = topFixed.getBoundingClientRect(); if (tr.width >= W * 0.9 && tr.height >= H * 0.9) continue; } // 화면 전체를 덮는 배경막(옆 창·서랍이 열린 상태)
    if (topFixed && topStyle.pointerEvents !== "none") {
      if (cs(el).position !== "fixed" && edgeBarOk(el, topFixed, cy)) continue;
      push("control-covered", el, "confirmed", "high", `고정 요소(${cssPath(topFixed).split(" > ").pop()})가 이 조작 요소 가운데를 덮고, 스크롤해도 빠져나올 수 없음`);
    } else {
      push("control-covered", el, "suspect", "medium", `다른 요소(${cssPath(top).split(" > ").pop()})가 이 조작 요소 가운데를 덮음`);
    }
  }

  // E. 고정·고착 패널이 본문 글자를 침범
  const fixedBig = vis.filter((el) => /fixed|sticky/.test(cs(el).position) && !el.matches("[role=dialog],[role=alertdialog],[role=tooltip],[role=menu],[role=listbox],[data-radix-popper-content-wrapper],dialog,#margin-panel,.margin-panel-backdrop") && el.getBoundingClientRect().width * el.getBoundingClientRect().height > W * H * 0.04);
  if (fixedBig.length && !hasModal) {
    const texts = vis.filter((el) => /^(H1|H2|H3|P|LI|LABEL)$/.test(el.tagName) && ownText(el).length > 2).slice(0, 300);
    for (const t of texts) {
      const r = t.getBoundingClientRect();
      const cx = r.left + Math.min(r.width / 2, 40), cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > W || cy > H) continue;
      const top = d.elementFromPoint(cx, cy);
      const f = fixedBig.find((b) => top && b.contains(top));
      if (f && !f.contains(t) && !t.contains(f) && !edgeBarOk(t, f, r.top + r.height / 2)) {
        push("fixed-covers-text", t, "suspect", "medium", `고정 요소(${cssPath(f).split(" > ").pop()})가 본문 글자를 덮음`);
      }
    }
  }

  // F. 모달: 아래쪽 버튼이 안 보임
  for (const dlg of d.querySelectorAll("[role=dialog],[role=alertdialog],dialog[open]")) {
    if (!visible(dlg)) continue;
    const r = dlg.getBoundingClientRect();
    const scroller = [dlg, ...dlg.querySelectorAll("*")].find((n) => /auto|scroll/.test(cs(n).overflowY) && n.scrollHeight > n.clientHeight + 2);
    if (r.bottom > H + 1 || r.top < -1) {
      push("dialog-out-of-viewport", dlg, scroller ? "suspect" : "confirmed", "high", `대화상자가 화면 ${r.bottom > H + 1 ? "아래로 " + Math.round(r.bottom - H) : "위로 " + Math.round(-r.top)}px 넘침${scroller ? "(안쪽 스크롤 있음)" : ""}`);
    }
    for (const b of dlg.querySelectorAll("button,a[href],[role=button]")) {
      if (!visible(b)) continue;
      const br = b.getBoundingClientRect();
      const hiddenByViewport = br.bottom > H + 1 || br.top < -1 || br.right > W + 1 || br.left < -1;
      const sc = (() => { let n = b.parentElement; while (n && n !== dlg.parentElement) { if (/auto|scroll/.test(cs(n).overflowY) && n.scrollHeight > n.clientHeight + 2) return n; n = n.parentElement; } return null; })();
      if (hiddenByViewport && !sc) push("dialog-button-unreachable", b, "confirmed", "high", "대화상자 버튼이 화면 밖에 있고 스크롤로도 닿지 않음");
    }
  }

  // G. 스크롤 문제
  const scrollables = vis.filter((el) => /auto|scroll/.test(cs(el).overflowY) || /auto|scroll/.test(cs(el).overflowX));
  for (const el of scrollables) {
    const s = cs(el);
    const vo = el.scrollHeight - el.clientHeight;
    const ho = el.scrollWidth - el.clientWidth;
    if (s.overflowY === "scroll" && vo <= 0 && el.clientHeight > 40 && el.offsetWidth - el.clientWidth > 0) {
      push("needless-scrollbar", el, "suspect", "low", "내용이 다 들어가는데 세로 스크롤바가 항상 보임(overflow-y: scroll)");
    } else if (/auto|scroll/.test(s.overflowY) && vo > 0 && vo <= 3 && el.clientHeight > 40) {
      push("tiny-overflow", el, "suspect", "low", `${vo}px 차이로 불필요한 스크롤이 생김(반올림·여백 확인)`);
    }
    if (/auto|scroll/.test(s.overflowX) && ho > 1 && !el.matches("table,[role=tablist],.fc,[data-allow-hscroll]") && !isAllowed(el)) {
      push("hscroll-region", el, "suspect", "low", `가로 스크롤 영역(내용이 ${ho}px 더 넓음) — 의도된 것인지 확인`);
    }
    // 중첩 스크롤
    if (vo > 3) {
      const inner = [...el.querySelectorAll("*")].find((n) => visible(n) && /auto|scroll/.test(cs(n).overflowY) && n.scrollHeight > n.clientHeight + 3);
      if (inner && el !== de && el !== d.body) push("nested-scroll", inner, "suspect", "low", "세로 스크롤 안에 또 세로 스크롤이 있음(조작이 어려울 수 있음)");
    }
  }
  // 숨겨졌는데 스크롤도 안 되는 조작 요소
  for (const el of vis.filter((e) => /hidden|clip/.test(cs(e).overflowY) && e.clientHeight > 20 && e.scrollHeight > e.clientHeight + 4)) {
    if (cs(el).textOverflow === "ellipsis" || (cs(el).webkitLineClamp && cs(el).webkitLineClamp !== "none")) continue;
    const er = el.getBoundingClientRect();
    const hidden = [...el.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter((c) => {
      const cr = c.getBoundingClientRect();
      return cr.width > 0 && cr.top >= er.bottom - 1 && cs(c).display !== "none" && cs(c).visibility !== "hidden";
    });
    if (hidden.length) push("hidden-control", hidden[0], "confirmed", "high", `스크롤할 수 없는 영역 안에서 조작 요소 ${hidden.length}개가 잘려 닿지 않음`);
  }

  // H. 반응형: 데스크톱 고정 너비
  if (W <= 480) {
    for (const el of vis) {
      const s = cs(el);
      const mw = parseFloat(s.minWidth);
      if (s.minWidth.endsWith("px") && mw > W - 8 && el.getBoundingClientRect().width > W - 8 && !clipAncestor(el, "x")) {
        push("fixed-min-width", el, "suspect", "medium", `min-width ${mw}px 가 이 화면(${W}px)에 비해 큼`);
      }
    }
  }
  const main = d.querySelector("main,[role=main],#main");
  const metrics = { viewport: [W, H], hscroll: Math.max(0, hscroll), mainWidth: main ? Math.round(main.getBoundingClientRect().width) : null };
  if (main && W >= 768 && metrics.mainWidth < 240) {
    push("narrow-main", main, "suspect", "high", `본문 폭이 ${metrics.mainWidth}px 로 너무 좁음(패널이 본문을 눌렀는지 확인)`);
  }

  // I. 이미지 로드 실패
  for (const img of d.images) {
    if (img.complete && img.naturalWidth === 0 && img.currentSrc && !img.closest("[aria-hidden=true]")) {
      push("image-broken", img, "confirmed", "high", `이미지를 불러오지 못함: ${img.currentSrc.slice(0, 80)}`);
    }
  }

  return { issues, counts, metrics };
}
