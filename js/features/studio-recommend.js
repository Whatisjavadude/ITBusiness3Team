/*
 * 내 데스크 스튜디오 · 상단 버튼 2개 (조건별 추천 3안 / 국내 판매처 가격 비교)
 *
 * studio.js는 수정하지 않습니다. 스튜디오 화면이 그려진 뒤(mount 후) 아래 기능을 덧붙입니다.
 *   1) 제목 옆 버튼 2개 추가
 *   2) 버튼을 누르면 4장면 모션으로 화면이 3열로 바뀝니다 (팀 와이어프레임 기준).
 *        [국내 가격 비교 리스트] | [조건별 추천 3안 / 3D 시뮬레이션] | [AI 채팅]
 *      - AI 채팅 패널은 움직이지 않습니다.
 *      - 3D 시뮬레이션은 오른쪽 아래 꼭짓점을 고정한 채 줄어듭니다.
 *      - 가격 비교(왼쪽 열)·추천 3안(가운데 위)은 왼쪽 가장자리에서 밀려 들어옵니다.
 *   3) '닫기', 작아진 시뮬레이션 클릭, Esc 로 같은 경로를 거꾸로 돌아갑니다.
 *
 * [샘플] 제품명·가격·판매처(쇼핑몰 A·B·C)는 모두 가상 값입니다. 외부 API를 호출하지 않습니다.
 * [구현] 책상 너비·깊이는 스튜디오의 D.state 값을 그대로 씁니다. 나머지 조건은 이 화면에서 고릅니다.
 * 상태는 메모리에만 있어 새로고침하면 초기화됩니다.
 */
(function (D) {
  'use strict';
  if (!D.features.studio) return;

  /* ---------- 가상 카탈로그 ---------- */
  const CAT_LABEL = { pc: 'PC', monitor: '모니터', arm: '모니터암·받침대', keyboard: '키보드', mouse: '마우스', lamp: '조명', mat: '데스크매트', cable: '선 정리', decor: '소품' };
  const CAT_ORDER = ['pc', 'monitor', 'arm', 'keyboard', 'mouse', 'lamp', 'mat', 'cable', 'decor'];
  const P = (id, cat, name, price, q, purpose, style, w, extra = {}) => ({ id, cat, name, price, q, purpose, style, w, ...extra });
  const CATALOG = [
    P('pc1', 'pc', '미니PC N100 (사무용)', 290000, 1, ['office'], ['minimal', 'white', 'black', 'wood'], 12),
    P('pc2', 'pc', '미니PC 라이젠5 (개발용)', 590000, 2, ['dev', 'office'], ['minimal', 'black'], 13),
    P('pc3', 'pc', '데스크탑 i5 · RTX 4060', 1190000, 3, ['gaming', 'design', 'dev'], ['black', 'rgb'], 22),
    P('pc4', 'pc', '데스크탑 i7 · RTX 4070 (화이트)', 1590000, 3, ['design', 'gaming'], ['white', 'rgb'], 22),
    P('mo1', 'monitor', '24인치 FHD 모니터', 129000, 1, ['office'], ['black', 'minimal'], 54),
    P('mo2', 'monitor', '27인치 QHD 모니터', 259000, 2, ['office', 'dev', 'design'], ['black', 'minimal'], 61),
    P('mo3', 'monitor', '27인치 QHD 모니터 화이트', 269000, 2, ['office', 'dev', 'design'], ['white', 'minimal'], 61),
    P('mo4', 'monitor', '27인치 4K 모니터', 399000, 3, ['design', 'dev'], ['black', 'white', 'minimal'], 61),
    P('mo5', 'monitor', '27인치 165Hz 게이밍 모니터', 329000, 3, ['gaming'], ['black', 'rgb'], 61),
    P('mo6', 'monitor', '34인치 울트라와이드', 549000, 3, ['dev', 'gaming', 'design'], ['black'], 81, { wide: true }),
    P('ar1', 'arm', '원목 모니터 받침대', 39000, 1, ['office', 'dev', 'design'], ['wood', 'minimal'], 55, { dual: true }),
    P('ar2', 'arm', '싱글 모니터암', 59000, 2, ['office', 'dev', 'design', 'gaming'], ['black', 'minimal'], 10),
    P('ar3', 'arm', '싱글 모니터암 화이트', 69000, 2, ['office', 'dev', 'design'], ['white', 'minimal'], 10),
    P('ar4', 'arm', '듀얼 모니터암', 99000, 3, ['dev', 'design', 'gaming'], ['black'], 10, { dual: true, dualOnly: true }),
    P('kb1', 'keyboard', '무선 키보드 기본형', 29000, 1, ['office'], ['white', 'black', 'minimal'], 44),
    P('kb2', 'keyboard', '저소음 기계식 텐키리스', 89000, 2, ['dev', 'office'], ['black', 'white', 'minimal'], 36),
    P('kb3', 'keyboard', '게이밍 기계식 RGB', 129000, 3, ['gaming'], ['rgb', 'black'], 44),
    P('kb4', 'keyboard', '무선 로우프로파일 키보드', 149000, 3, ['design', 'dev', 'office'], ['minimal', 'white', 'wood'], 36),
    P('ms1', 'mouse', '무선 마우스 기본형', 19000, 1, ['office'], ['white', 'black', 'minimal'], 6),
    P('ms2', 'mouse', '무선 인체공학 마우스', 59000, 2, ['office', 'dev', 'design'], ['black', 'minimal'], 8),
    P('ms3', 'mouse', '경량 게이밍 마우스', 89000, 3, ['gaming'], ['black', 'rgb', 'white'], 6),
    P('ms4', 'mouse', '프리미엄 무선 마우스', 119000, 3, ['design', 'dev'], ['minimal', 'white', 'black'], 8),
    P('la1', 'lamp', '원목 데스크 스탠드', 35000, 1, ['office', 'dev', 'design'], ['wood', 'minimal'], 15),
    P('la2', 'lamp', '모니터 스크린바', 49000, 2, ['office', 'dev', 'design', 'gaming'], ['black', 'minimal', 'white'], 45),
    P('la3', 'lamp', 'RGB 스크린바', 79000, 2, ['gaming'], ['rgb', 'black'], 45),
    P('la4', 'lamp', '프리미엄 스크린바', 129000, 3, ['design', 'dev'], ['minimal', 'black', 'white'], 50),
    P('mt1', 'mat', '펠트 데스크매트', 25000, 1, ['office', 'dev', 'design'], ['minimal', 'white', 'wood'], 80),
    P('mt2', 'mat', '가죽 데스크매트', 39000, 2, ['office', 'dev', 'design'], ['black', 'minimal'], 80),
    P('mt3', 'mat', '대형 RGB 장패드', 49000, 2, ['gaming'], ['rgb', 'black'], 90),
    P('cb1', 'cable', '멀티탭 정리함', 19000, 1, ['office', 'dev', 'design', 'gaming'], ['white', 'black', 'minimal'], 0),
    P('cb2', 'cable', '책상 하부 케이블 트레이', 29000, 2, ['office', 'dev', 'design', 'gaming'], ['black', 'white', 'minimal'], 0),
    P('dc1', 'decor', '미니 화분', 15000, 1, ['office', 'dev', 'design'], ['wood', 'minimal', 'white'], 10),
    P('dc2', 'decor', '원목 미니 선반', 45000, 2, ['office', 'dev', 'design'], ['wood', 'minimal'], 30)
  ];
  const BY_ID = Object.fromEntries(CATALOG.map(p => [p.id, p]));
  const SHOPS = ['쇼핑몰 A', '쇼핑몰 B', '쇼핑몰 C'];
  const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  // 가상 판매처 가격: 기준가에서 ±6% 차이, 일부 미판매
  const shopPrices = p => { const h = hash(p.id); return SHOPS.map((_, i) => { if (i === 2 && h % 5 === 0) return null; const f = 1 + (((h >> (i * 4)) % 13) - 6) / 100; return Math.round(p.price * f / 100) * 100; }); };
  const lowest = p => { const ps = shopPrices(p), m = Math.min(...ps.filter(x => x != null)); return { price: m, shop: SHOPS[ps.indexOf(m)] }; };
  const man = n => (n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만 원';

  /* ---------- 조건 ---------- */
  const PURPOSE = { office: '사무', dev: '개발', design: '디자인·영상', gaming: '게이밍' };
  const STYLE = { minimal: '미니멀', white: '화이트', black: '블랙', wood: '원목', rgb: 'RGB' };
  const FROM_STUDIO_STYLE = { warm: 'wood', minimal: 'minimal', creative: 'white' };
  const TIERS = [{ key: 'budget', name: '가성비', ratio: .72 }, { key: 'balanced', name: '균형', ratio: .9 }, { key: 'premium', name: '프리미엄', ratio: 1 }];
  const S = { budget: 1200000, purpose: 'dev', style: null, monitors: 1, needs_pc: true, sel: 1, plans: [] };
  const cond = () => ({ budget: S.budget, purpose: S.purpose, style: S.style || FROM_STUDIO_STYLE[D.state.style] || 'minimal', monitors: S.monitors, needs_pc: S.needs_pc, desk_w: D.state.width, desk_d: D.state.depth });

  /* ---------- 추천 엔진 ---------- */
  const WEIGHT = { pc: 3, monitor: 3, arm: 1, keyboard: 1.5, mouse: 1, lamp: 1, mat: .6, cable: .5, decor: .5 };
  function valid(p, c) {
    if (p.cat === 'monitor') { if (c.monitors === 2 && (p.wide || p.w * 2 > c.desk_w - 6)) return false; if (p.w > c.desk_w - 6) return false; }
    if (p.cat === 'arm' && c.monitors === 2 && !p.dual) return false;
    if (p.dualOnly && c.monitors !== 2) return false;
    if (p.cat === 'mat' && p.w > c.desk_w) return false;
    if (p.cat === 'decor' && p.w > c.desk_w / 3) return false;
    return true;
  }
  const qty = (p, c) => p.cat === 'monitor' ? c.monitors : 1;
  const score = (p, c) => p.q * 10 + (p.purpose.includes(c.purpose) ? 8 : 0) + (p.style.includes(c.style) ? 6 : 0);
  const cost = (items, c) => Object.values(items).reduce((s, id) => s + BY_ID[id].price * qty(BY_ID[id], c), 0);
  function buildPlan(c, ratio) {
    const target = c.budget * ratio, items = {};
    for (const k of CAT_ORDER.filter(k => k !== 'decor' && (k !== 'pc' || c.needs_pc))) {
      const o = CATALOG.filter(p => p.cat === k && valid(p, c)).sort((a, b) => a.price - b.price || score(b, c) - score(a, c));
      if (o.length) items[k] = o[0].id;
    }
    // 핵심 제품(PC → 모니터)은 먼저 용도에 맞는 제품으로 맞춘다
    for (const k of ['pc', 'monitor']) {
      if (!items[k] || BY_ID[items[k]].purpose.includes(c.purpose)) continue;
      const cur = BY_ID[items[k]], cand = CATALOG.filter(p => p.cat === k && valid(p, c) && p.purpose.includes(c.purpose)).sort((x, y) => x.price - y.price)[0];
      if (cand && cost(items, c) + (cand.price - cur.price) * qty(cand, c) <= target) items[k] = cand.id;
    }
    // 예산 안에서 (중요도 × 점수 상승)이 가장 큰 교체를 반복
    for (let g = 0; g < 60; g++) {
      let best = null; const now = cost(items, c);
      for (const k of Object.keys(items)) {
        const cur = BY_ID[items[k]];
        for (const p of CATALOG) {
          if (p.cat !== k || p.id === cur.id || !valid(p, c)) continue;
          const ds = score(p, c) - score(cur, c), dc = (p.price - cur.price) * qty(p, c);
          if (ds <= 0 || now + dc > target) continue;
          const v = ds * WEIGHT[k] * 1e7 - dc; if (!best || v > best.v) best = { k, id: p.id, v };
        }
      }
      if (!best) break; items[best.k] = best.id;
    }
    const d = CATALOG.filter(p => p.cat === 'decor' && valid(p, c) && p.style.includes(c.style)).sort((a, b) => a.price - b.price)[0];
    if (ratio > .8 && d && cost(items, c) + d.price <= target) items.decor = d.id;
    return items;
  }
  function recommend() { const c = cond(); S.plans = TIERS.map(t => ({ tier: t, items: buildPlan(c, t.ratio) })); }
  const planTotal = pl => Object.values(pl.items).reduce((s, id) => s + lowest(BY_ID[id]).price * qty(BY_ID[id], cond()), 0);

  /* ---------- 패널 내용 ---------- */
  const opt = (map, cur) => Object.entries(map).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('');
  function recHTML() {
    const c = cond();
    return `<div class="srec-phead"><h2>${D.icon('grid')} 조건별 추천 3안</h2><button type="button" class="srec-close">닫기 <kbd>Esc</kbd></button></div>
      <form class="srec-cond" aria-label="추천 조건">
        <label>예산<select name="budget">${[600000, 800000, 1000000, 1200000, 1500000, 2000000, 2500000].map(v => `<option value="${v}" ${v === c.budget ? 'selected' : ''}>${man(v)}</option>`).join('')}</select></label>
        <label>용도<select name="purpose">${opt(PURPOSE, c.purpose)}</select></label>
        <label>스타일<select name="style">${opt(STYLE, c.style)}</select></label>
        <label>모니터<select name="monitors"><option value="1" ${c.monitors === 1 ? 'selected' : ''}>1대</option><option value="2" ${c.monitors === 2 ? 'selected' : ''}>2대</option></select></label>
        <label class="srec-check"><input type="checkbox" name="needs_pc" ${c.needs_pc ? 'checked' : ''}> PC 포함</label>
        <span class="pill">책상 <b>${c.desk_w}×${c.desk_d}cm</b></span>
      </form>
      <div class="srec-plans">${S.plans.map((pl, i) => {
        const t = planTotal(pl), pct = Math.round(t / c.budget * 100), mon = pl.items.monitor && BY_ID[pl.items.monitor], pc = pl.items.pc && BY_ID[pl.items.pc];
        return `<button type="button" class="srec-plan" data-plan="${i}" aria-pressed="${i === S.sel}"><span class="srec-tier">${pl.tier.name}</span><strong>${D.money(t)}</strong><span class="srec-bar"><i class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></i></span><small>예산의 ${pct}%${pct > 100 ? ' · 예산 초과' : ''}</small><small>${mon ? D.escape(mon.name) + (c.monitors > 1 ? ' ×2' : '') : ''}${pc ? ' · ' + D.escape(pc.name) : ''}</small></button>`;
      }).join('')}</div>`;
  }
  function priceHTML() {
    const c = cond(), pl = S.plans[S.sel], tot = [0, 0, 0], miss = [false, false, false]; let low = 0;
    const rows = CAT_ORDER.filter(k => pl.items[k]).map(k => {
      const p = BY_ID[pl.items[k]], n = qty(p, c), ps = shopPrices(p).map(x => x == null ? null : x * n), m = Math.min(...ps.filter(x => x != null)), si = ps.indexOf(m); low += m;
      ps.forEach((x, i) => { if (x == null) miss[i] = true; else tot[i] += x; });
      return `<li><div><small>${CAT_LABEL[k]}</small><strong>${D.escape(p.name)}${n > 1 ? ' ×' + n : ''}</strong></div><div class="srec-low"><b>${D.money(m)}</b><em>${SHOPS[si]} 최저</em></div><div class="srec-shops">${ps.map((x, i) => `<span class="${x === m ? 'is-low' : ''}">${SHOPS[i].replace('쇼핑몰 ', '')} ${x == null ? '미판매' : x.toLocaleString('ko-KR')}</span>`).join('')}</div></li>`;
    }).join('');
    const full = tot.map((x, i) => miss[i] ? Infinity : x), bi = full.indexOf(Math.min(...full));
    return `<div class="srec-phead"><h2>${D.icon('bag')} 국내 판매처 가격 비교</h2></div>
      <p class="srec-sub">${S.plans[S.sel].tier.name} 안 · 판매처 A·B·C 비교</p>
      <ul class="srec-list">${rows}</ul>
      <div class="srec-total"><small>최저가 조합 총액</small><strong>${D.money(low)}</strong>${isFinite(full[bi]) ? `<span>한 곳에서 다 사면 ${SHOPS[bi]} ${D.money(full[bi])}</span>` : ''}</div>
      <p class="srec-sub">가상 데이터 · 실제 가격 연동은 이후 작업</p>`;
  }

  /* ---------- 4장면 모션 (와이어프레임 좌표, 시뮬레이션 영역 기준 %) ----------
   * 각 값: [x, y, w, h]. 시뮬레이션의 오른쪽 아래 꼭짓점은 항상 (100%, 100%). */
  const K = {
    sim:   [[0, 0, 100, 100], [14, 16, 86, 84], [26, 36, 74, 64], [33, 50, 67, 50]],
    rec:   [[-22, 0, 20, 12], [0, 0, 20, 12], [11, 0, 52, 26], [33, 0, 67, 47]],
    price: [[-10, 22, 8, 60], [0, 22, 8, 60], [-1, 6, 24, 88], [0, 0, 30, 100]]
  };
  const STOPS = [0, .3, .65, 1], OPEN_MS = 1000, CLOSE_MS = 800;
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function frame(p) {
    const g = ease(Math.min(1, Math.max(0, p))); let i = 0; while (i < 2 && g > STOPS[i + 1]) i++;
    const u = (g - STOPS[i]) / (STOPS[i + 1] - STOPS[i]), out = {};
    for (const k in K) out[k] = K[k][i].map((v, j) => v + (K[k][i + 1][j] - v) * u);
    return out;
  }

  let open = false, progress = 0, raf = 0, root = null, focus = null;
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = () => innerWidth >= 1100;
  const parts = () => { const m = root && root.querySelector('.studio-main'); return m && { main: m, sim: m.querySelector('.srec-sim'), inner: m.querySelector('.srec-sim-inner'), rec: m.querySelector('.srec-rec'), price: m.querySelector('.srec-price') }; };

  function apply(p) {
    const q = parts(); if (!q || !q.rec) return;
    progress = p;
    const W = q.main.clientWidth, H = q.main.clientHeight, f = frame(p), px = ([x, y, w, h]) => [x * W / 100, y * H / 100, w * W / 100, h * H / 100];
    const [sx, sy, sw, sh] = px(f.sim);
    Object.assign(q.sim.style, { left: sx + 'px', top: sy + 'px', width: sw + 'px', height: sh + 'px' });
    q.inner.style.width = W + 'px'; q.inner.style.transform = `scale(${sw / W})`;
    for (const k of ['rec', 'price']) {
      const [x, y, w, h] = px(f[k]), el = q[k];
      Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      const fit = el.firstElementChild, fw = K[k][3][2] * W / 100, fh = K[k][3][3] * H / 100;
      fit.style.width = fw + 'px'; fit.style.height = fh + 'px';
      fit.style.opacity = Math.max(0, Math.min(1, (ease(p) - .62) / .3));
    }
    q.main.classList.toggle('is-min', p > .98);
  }
  function animate(to, done) {
    cancelAnimationFrame(raf);
    if (reduce()) { apply(to); done && done(); return; }
    const from = progress, dur = (to > from ? OPEN_MS : CLOSE_MS) * Math.abs(to - from), t0 = performance.now();
    const step = now => { const k = dur ? Math.min(1, (now - t0) / dur) : 1; apply(from + (to - from) * k); if (k < 1) raf = requestAnimationFrame(step); else done && done(); };
    raf = requestAnimationFrame(step);
  }

  function fill() {
    const q = parts(); if (!q || !q.rec) return;
    q.rec.firstElementChild.innerHTML = recHTML();
    q.price.firstElementChild.innerHTML = priceHTML();
  }
  function buildBoard() {
    const q = parts(); if (!q || q.rec) return;
    q.main.insertAdjacentHTML('beforeend', `<section class="panel srec-rec" aria-label="조건별 추천 3안"><div class="srec-fit"></div></section><section class="panel srec-price" aria-label="국내 판매처 가격 비교"><div class="srec-fit"></div></section>`);
    fill();
  }
  function markFocus() {
    root.querySelectorAll('[data-srec]').forEach(b => b.setAttribute('aria-pressed', open && b.dataset.srec === focus));
    const q = parts(); if (!q || !q.rec) return;
    q.rec.classList.toggle('is-focus', focus === 'recommend'); q.price.classList.toggle('is-focus', focus === 'price');
  }
  function openBoard(which, animated) {
    focus = which;
    if (!S.plans.length) recommend();
    if (open) { markFocus(); return; }
    open = true;
    const q = parts(); if (!q) return;
    if (animated) window.scrollTo({ top: 0 });
    const top = q.main.getBoundingClientRect().top;
    q.main.style.height = Math.max(520, innerHeight - top - 24) + 'px';
    root.classList.add('srec-on'); if (!wide()) root.classList.add('srec-narrow');
    buildBoard(); markFocus();
    if (!wide()) return;
    apply(0); if (animated) animate(1); else apply(1);
  }
  function closeBoard() {
    if (!open) return;
    const finish = () => {
      open = false; progress = 0; const q = parts();
      if (q) { q.rec && q.rec.remove(); q.price && q.price.remove(); q.main.style.height = ''; q.main.classList.remove('is-min'); q.sim.removeAttribute('style'); q.inner.removeAttribute('style'); }
      root.classList.remove('srec-on', 'srec-narrow'); markFocus();
    };
    if (!wide()) return finish();
    animate(0, finish);
  }

  /* ---------- 스튜디오 화면에 덧붙이기 ---------- */
  const base = D.features.studio.mount;
  D.features.studio.mount = function (node) {
    base.call(this, node);
    root = node;
    const head = node.querySelector('.page-heading'), main = node.querySelector('.studio-main');
    if (!head || !main) return;
    // 시뮬레이션 영역(기존 내용 전체)을 하나로 감싸 크기를 바꿀 수 있게 합니다 (내용·이벤트는 그대로)
    const sim = document.createElement('div'); sim.className = 'srec-sim';
    const inner = document.createElement('div'); inner.className = 'srec-sim-inner'; sim.append(inner);
    while (main.firstChild) inner.append(main.firstChild);
    main.append(sim);
    head.querySelector('.actions').insertAdjacentHTML('afterbegin', `<button type="button" class="srec-open" data-srec="recommend" aria-pressed="false">${D.icon('grid')} 조건별 추천 3안</button><button type="button" class="srec-open" data-srec="price" aria-pressed="false">${D.icon('bag')} 국내 판매처 가격 비교</button>`);
    head.querySelectorAll('[data-srec]').forEach(b => b.addEventListener('click', () => { if (open && focus === b.dataset.srec) closeBoard(); else openBoard(b.dataset.srec, true); }));
    sim.addEventListener('click', e => { if (open && wide()) { e.preventDefault(); e.stopPropagation(); closeBoard(); } }, true);
    main.addEventListener('click', e => {
      if (!open) return;
      const t = e.target.closest('button'); if (!t) return;
      if (t.classList.contains('srec-close')) { closeBoard(); return; }
      if (t.dataset.plan) { S.sel = +t.dataset.plan; fill(); }
    });
    main.addEventListener('change', e => {
      const f = e.target.form; if (!f || !f.classList.contains('srec-cond')) return;
      S.budget = +f.budget.value; S.purpose = f.purpose.value; S.style = f.style.value; S.monitors = +f.monitors.value; S.needs_pc = f.needs_pc.checked;
      recommend(); fill();
    });
    // 스튜디오가 다시 그려져도(스타일 변경 등) 열려 있던 화면은 모션 없이 그대로 복원
    if (open) { open = false; openBoard(focus, false); }
  };
  window.addEventListener('resize', () => { if (open && wide() && progress === 1) { const q = parts(); q.main.style.height = Math.max(520, innerHeight - q.main.getBoundingClientRect().top - 24) + 'px'; apply(1); } });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && open && D.current() === 'studio') closeBoard(); });
  window.addEventListener('hashchange', () => { open = false; progress = 0; cancelAnimationFrame(raf); });
})(window.Deskspace);
