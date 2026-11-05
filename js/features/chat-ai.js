/* 대화형 AI (2D) — 조건별 자동 추천 · 대화형 재조정 · 대화로 배치 변경 · 국내 가격 비교 목업
   - 실제 AI·가격 API를 호출하지 않습니다. 문장은 규칙(키워드)으로 해석합니다.
   - 제품명·가격·판매처(쇼핑몰 A·B·C)는 모두 가상 샘플입니다.
   - 상태는 메모리에만 있으며 새로고침하면 초기화됩니다. */
(function (D) {
  /* ---------- 가상 카탈로그 ---------- */
  const CAT_LABEL = { pc: 'PC', monitor: '모니터', arm: '모니터암·받침대', keyboard: '키보드', mouse: '마우스', lamp: '조명', mat: '데스크매트', cable: '선 정리', decor: '소품' };
  const CAT_ORDER = ['pc', 'monitor', 'arm', 'keyboard', 'mouse', 'lamp', 'mat', 'cable', 'decor'];
  const P = (id, cat, name, price, q, purpose, style, w, d, extra = {}) => ({ id, cat, name, price, q, purpose, style, w, d, ...extra });
  const CATALOG = [
    P('pc1', 'pc', '미니PC N100 (사무용)', 290000, 1, ['office'], ['minimal', 'white', 'black', 'wood'], 12, 12),
    P('pc2', 'pc', '미니PC 라이젠5 (개발용)', 590000, 2, ['dev', 'office'], ['minimal', 'black'], 13, 13),
    P('pc3', 'pc', '데스크탑 i5 · RTX 4060', 1190000, 3, ['gaming', 'design', 'dev'], ['black', 'rgb'], 22, 45, { floor: true }),
    P('pc4', 'pc', '데스크탑 i7 · RTX 4070 (화이트)', 1590000, 3, ['design', 'gaming'], ['white', 'rgb'], 22, 45, { floor: true }),
    P('mo1', 'monitor', '24인치 FHD 모니터', 129000, 1, ['office'], ['black', 'minimal'], 54, 18),
    P('mo2', 'monitor', '27인치 QHD 모니터', 259000, 2, ['office', 'dev', 'design'], ['black', 'minimal'], 61, 20),
    P('mo3', 'monitor', '27인치 QHD 모니터 화이트', 269000, 2, ['office', 'dev', 'design'], ['white', 'minimal'], 61, 20),
    P('mo4', 'monitor', '27인치 4K 모니터', 399000, 3, ['design', 'dev'], ['black', 'white', 'minimal'], 61, 21),
    P('mo5', 'monitor', '27인치 165Hz 게이밍 모니터', 329000, 3, ['gaming'], ['black', 'rgb'], 61, 22),
    P('mo6', 'monitor', '34인치 울트라와이드', 549000, 3, ['dev', 'gaming', 'design'], ['black'], 81, 23, { wide: true }),
    P('ar1', 'arm', '원목 모니터 받침대', 39000, 1, ['office', 'dev', 'design'], ['wood', 'minimal'], 55, 22, { dual: true }),
    P('ar2', 'arm', '싱글 모니터암', 59000, 2, ['office', 'dev', 'design', 'gaming'], ['black', 'minimal'], 10, 8),
    P('ar3', 'arm', '싱글 모니터암 화이트', 69000, 2, ['office', 'dev', 'design'], ['white', 'minimal'], 10, 8),
    P('ar4', 'arm', '듀얼 모니터암', 99000, 3, ['dev', 'design', 'gaming'], ['black'], 10, 8, { dual: true, dualOnly: true }),
    P('kb1', 'keyboard', '무선 키보드 기본형', 29000, 1, ['office'], ['white', 'black', 'minimal'], 44, 13),
    P('kb2', 'keyboard', '저소음 기계식 텐키리스', 89000, 2, ['dev', 'office'], ['black', 'white', 'minimal'], 36, 13),
    P('kb3', 'keyboard', '게이밍 기계식 RGB', 129000, 3, ['gaming'], ['rgb', 'black'], 44, 14),
    P('kb4', 'keyboard', '무선 로우프로파일 키보드', 149000, 3, ['design', 'dev', 'office'], ['minimal', 'white', 'wood'], 36, 12),
    P('ms1', 'mouse', '무선 마우스 기본형', 19000, 1, ['office'], ['white', 'black', 'minimal'], 6, 11),
    P('ms2', 'mouse', '무선 인체공학 마우스', 59000, 2, ['office', 'dev', 'design'], ['black', 'minimal'], 8, 12),
    P('ms3', 'mouse', '경량 게이밍 마우스', 89000, 3, ['gaming'], ['black', 'rgb', 'white'], 6, 12),
    P('ms4', 'mouse', '프리미엄 무선 마우스', 119000, 3, ['design', 'dev'], ['minimal', 'white', 'black'], 8, 12),
    P('la1', 'lamp', '원목 데스크 스탠드', 35000, 1, ['office', 'dev', 'design'], ['wood', 'minimal'], 15, 15),
    P('la2', 'lamp', '모니터 스크린바', 49000, 2, ['office', 'dev', 'design', 'gaming'], ['black', 'minimal', 'white'], 45, 4, { onMonitor: true }),
    P('la3', 'lamp', 'RGB 스크린바', 79000, 2, ['gaming'], ['rgb', 'black'], 45, 4, { onMonitor: true }),
    P('la4', 'lamp', '프리미엄 스크린바', 129000, 3, ['design', 'dev'], ['minimal', 'black', 'white'], 50, 4, { onMonitor: true }),
    P('mt1', 'mat', '펠트 데스크매트', 25000, 1, ['office', 'dev', 'design'], ['minimal', 'white', 'wood'], 80, 30),
    P('mt2', 'mat', '가죽 데스크매트', 39000, 2, ['office', 'dev', 'design'], ['black', 'minimal'], 80, 40),
    P('mt3', 'mat', '대형 RGB 장패드', 49000, 2, ['gaming'], ['rgb', 'black'], 90, 40),
    P('cb1', 'cable', '멀티탭 정리함', 19000, 1, ['office', 'dev', 'design', 'gaming'], ['white', 'black', 'minimal'], 0, 0, { under: true }),
    P('cb2', 'cable', '책상 하부 케이블 트레이', 29000, 2, ['office', 'dev', 'design', 'gaming'], ['black', 'white', 'minimal'], 0, 0, { under: true }),
    P('dc1', 'decor', '미니 화분', 15000, 1, ['office', 'dev', 'design'], ['wood', 'minimal', 'white'], 10, 10),
    P('dc2', 'decor', '원목 미니 선반', 45000, 2, ['office', 'dev', 'design'], ['wood', 'minimal'], 30, 15)
  ];
  const BY_ID = Object.fromEntries(CATALOG.map(p => [p.id, p]));
  const SHOPS = ['쇼핑몰 A', '쇼핑몰 B', '쇼핑몰 C'];
  const hash = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
  // 가상 판매처 가격: 기준가에서 ±6% 차이, 일부 미판매
  const shopPrices = p => { const h = hash(p.id); return SHOPS.map((_, i) => { if (i === 2 && h % 5 === 0) return null; const f = 1 + (((h >> (i * 4)) % 13) - 6) / 100; return Math.round(p.price * f / 100) * 100; }); };
  const man = n => (n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 }) + '만 원';

  /* ---------- 상태 ---------- */
  const PURPOSE = { office: '사무', dev: '개발', design: '디자인·영상', gaming: '게이밍' };
  const STYLE = { minimal: '미니멀', white: '화이트', black: '블랙', wood: '원목', rgb: 'RGB' };
  const TIERS = [{ key: 'budget', name: '가성비', ratio: .72 }, { key: 'balanced', name: '균형', ratio: .9 }, { key: 'premium', name: '프리미엄', ratio: 1 }];
  const S = { cond: { budget: 1200000, desk_w: 120, desk_d: 60, purpose: 'dev', style: 'minimal', monitors: 1, needs_pc: true }, plans: [], sel: 1, layout: {}, highlight: new Set() };
  const messages = [
    { role: 'user', text: '예산 120만 원, 책상 120x60, 개발용으로 미니멀하게 꾸미고 싶어', example: true },
    { role: 'assistant', text: '예시 대화예요. 조건에 맞춰 가성비·균형·프리미엄 3안을 만들었어요. 아래 버튼을 누르거나 직접 말해서 바꿔 보세요.', acts: ['예산 120만 원', '책상 120×60cm', '용도 개발', '스타일 미니멀'], example: true }
  ];
  let root = null;

  /* ---------- 추천 엔진 ---------- */
  const WEIGHT = { pc: 3, monitor: 3, arm: 1, keyboard: 1.5, mouse: 1, lamp: 1, mat: .6, cable: .5, decor: .5 };
  const required = c => CAT_ORDER.filter(k => k !== 'decor' && (k !== 'pc' || c.needs_pc));
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
  function buildPlan(c, ratio, cats) {
    const target = Math.max(c.budget * ratio, 0), items = {};
    for (const k of cats) { const o = CATALOG.filter(p => p.cat === k && valid(p, c)).sort((a, b) => a.price - b.price || score(b, c) - score(a, c)); if (o.length) items[k] = o[0].id; }
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
    return items;
  }
  function recommend() {
    const c = S.cond, cats = required(c);
    S.plans = TIERS.map(t => {
      const items = buildPlan(c, t.ratio, cats);
      if (t.key !== 'budget') { const d = CATALOG.filter(p => p.cat === 'decor' && valid(p, c) && p.style.includes(c.style)).sort((a, b) => a.price - b.price)[0]; if (d && cost(items, c) + d.price <= c.budget * t.ratio) items.decor = d.id; }
      return { tier: t, items, edited: false };
    });
  }

  /* ---------- 배치 계산 (cm, 책상 왼쪽-뒤 기준) ---------- */
  function rects() {
    const c = S.cond, it = S.plans[S.sel].items, L = S.layout, W = c.desk_w, D2 = c.desk_d, out = [];
    const ax = (k, w, def) => { const a = (L[k] && L[k].x) || def; return a === 'left' ? 4 : a === 'right' ? W - 4 - w : (W - w) / 2; };
    const row = (k, def) => (L[k] && L[k].y) || def;
    const mon = it.monitor && BY_ID[it.monitor]; let monBox = null;
    if (mon) {
      const n = c.monitors, gw = mon.w * n + (n - 1), x0 = ax('monitor', gw, 'center'), y0 = row('monitor', 'back') === 'front' ? D2 - mon.d - 4 : 5;
      for (let i = 0; i < n; i++) out.push({ k: 'monitor', x: x0 + i * (mon.w + 1), y: y0, w: mon.w, h: mon.d * .45, label: n > 1 ? `모니터 ${i + 1}` : '모니터' });
      monBox = { x: x0, y: y0, w: gw, h: mon.d * .45 };
      const arm = it.arm && BY_ID[it.arm];
      if (arm) { if (arm.w > 20) out.unshift({ k: 'arm', x: x0 + (gw - Math.min(arm.w, gw + 4)) / 2, y: y0 - 1.5, w: Math.min(arm.w, gw + 4), h: mon.d * .45 + 5, label: '', under: true }); else out.push({ k: 'arm', x: Math.max(1, x0 + gw / 2 - 4), y: .6, w: 8, h: 3.5, label: '' }); }
    }
    const backFree = side => !monBox ? 99 : side === 'left' ? monBox.x - 5 : W - (monBox.x + monBox.w) - 5;
    const lamp = it.lamp && BY_ID[it.lamp];
    if (lamp) {
      if (lamp.onMonitor && monBox && !(L.lamp && L.lamp.x)) out.push({ k: 'lamp', x: monBox.x + (monBox.w - Math.min(lamp.w, monBox.w)) / 2, y: monBox.y - .2, w: Math.min(lamp.w, monBox.w), h: 2.2, label: '스크린바', thin: true });
      else { const w = lamp.onMonitor ? 30 : lamp.w, h = lamp.onMonitor ? 4 : lamp.d, ls = (L.lamp && L.lamp.x) || 'left'; out.push({ k: 'lamp', x: ax('lamp', w, 'left'), y: row('lamp', backFree(ls) >= w ? 'back' : 'front') === 'front' ? D2 - h - 4 : 4, w, h, label: '조명' }); }
    }
    const kb = it.keyboard && BY_ID[it.keyboard], ms = it.mouse && BY_ID[it.mouse];
    if (kb) {
      const yk = row('keyboard', 'front') === 'back' ? D2 / 2 - kb.d / 2 : D2 - kb.d - 8, side = (L.mouse && L.mouse.x) === 'left' ? 'left' : 'right';
      let x = ax('keyboard', kb.w, 'center'); if (!(L.keyboard && L.keyboard.x)) x = (W - kb.w) / 2 - (side === 'right' ? 5 : -5);
      out.push({ k: 'keyboard', x, y: yk, w: kb.w, h: kb.d, label: '키보드' });
      if (ms) out.push({ k: 'mouse', x: side === 'right' ? x + kb.w + 5 : x - 5 - ms.w, y: yk + 1, w: ms.w, h: ms.d, label: '마우스' });
    } else if (ms) out.push({ k: 'mouse', x: ax('mouse', ms.w, 'right'), y: D2 - ms.d - 8, w: ms.w, h: ms.d, label: '마우스' });
    const mat = it.mat && BY_ID[it.mat];
    if (mat) { const mw = Math.min(mat.w, W - 2), mh = Math.min(mat.d, D2 - 2); out.unshift({ k: 'mat', x: ax('mat', mw, 'center'), y: D2 - mh - 3, w: mw, h: mh, label: '', under: true }); }
    const pc = it.pc && BY_ID[it.pc];
    if (pc) {
      if (pc.floor) out.push({ k: 'pc', x: (L.pc && L.pc.x) === 'left' ? -pc.w - 4 : W + 4, y: D2 - pc.d > 0 ? D2 - pc.d : 2, w: pc.w, h: Math.min(pc.d, D2), label: '본체(바닥)', floor: true });
      else { const ps = (L.pc && L.pc.x) || 'right'; out.push({ k: 'pc', x: ax('pc', pc.w, 'right'), y: row('pc', backFree(ps) >= pc.w ? 'back' : 'front') === 'front' ? D2 - pc.d - 4 : 5, w: pc.w, h: pc.d, label: '미니PC' }); }
    }
    const dc = it.decor && BY_ID[it.decor];
    if (dc) {
      const lampLeft = !lamp || (lamp.onMonitor && !(L.lamp && L.lamp.x)) ? false : ((L.lamp && L.lamp.x) || 'left') === 'left';
      const side = (L.decor && L.decor.x) || (lampLeft ? 'right' : 'left'), pcSide = pc && !pc.floor ? ((L.pc && L.pc.x) || 'right') : null;
      const defRow = (pcSide === side || backFree(side) < dc.w) ? 'front' : 'back';
      out.push({ k: 'decor', x: ax('decor', dc.w, side), y: row('decor', defRow) === 'front' ? D2 - dc.d - 4 : 4, w: dc.w, h: dc.d, label: dc.id === 'dc2' ? '선반' : '화분' });
    }
    if (it.cable) out.push({ k: 'cable', x: 6, y: D2 + 2, w: W - 12, h: 3, label: '책상 아래 선 정리', floor: true });
    return out;
  }
  function checkLayout(rs) {
    const c = S.cond, warns = [], bad = new Set(), solid = rs.filter(r => !r.under && !r.floor && !r.thin);
    for (const r of solid) if (r.x < -.5 || r.y < -.5 || r.x + r.w > c.desk_w + .5 || r.y + r.h > c.desk_d + .5) { warns.push(`${CAT_LABEL[r.k]}: 책상 밖으로 나가요`); bad.add(r); }
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i], b = solid[j]; if (a.k === b.k) continue;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) { warns.push(`${CAT_LABEL[a.k]} · ${CAT_LABEL[b.k]} 위치가 겹쳐요`); bad.add(a); bad.add(b); }
    }
    if (S.plans[S.sel].items.monitor && c.desk_d < 55) warns.push(`책상 깊이 ${c.desk_d}cm는 모니터와의 거리가 가까울 수 있어요 (60cm 이상 권장)`);
    return { warns: [...new Set(warns)], bad };
  }

  /* ---------- 대화 → 동작 (규칙 기반) ---------- */
  const findCat = s => CAT_ORDER.includes(s) ? s : null;
  function apply(actions) {
    const done = []; let recalc = false; S.highlight.clear(); const pl = () => S.plans[S.sel];
    for (const a of actions || []) {
      const c = S.cond;
      switch (a.type) {
        case 'set_conditions': {
          if (+a.budget > 0) { c.budget = Math.round(+a.budget); done.push('예산 ' + man(c.budget)); }
          if (+a.desk_w >= 60 && +a.desk_w <= 240) { c.desk_w = Math.round(+a.desk_w); done.push(`책상 가로 ${c.desk_w}cm`); }
          if (+a.desk_d >= 40 && +a.desk_d <= 100) { c.desk_d = Math.round(+a.desk_d); done.push(`책상 깊이 ${c.desk_d}cm`); }
          if (PURPOSE[a.purpose]) { c.purpose = a.purpose; done.push('용도 ' + PURPOSE[a.purpose]); }
          if (STYLE[a.style]) { c.style = a.style; done.push('스타일 ' + STYLE[a.style]); }
          if (a.monitors === 1 || a.monitors === 2) { c.monitors = a.monitors; done.push(`모니터 ${c.monitors}대`); S.highlight.add('monitor'); }
          if (typeof a.needs_pc === 'boolean') { c.needs_pc = a.needs_pc; done.push(a.needs_pc ? 'PC 포함' : 'PC 제외'); }
          recalc = true; break;
        }
        case 'change_budget': { c.budget = Math.max(100000, c.budget + a.delta); done.push(`예산 ${a.delta > 0 ? '+' : ''}${man(a.delta)} → ${man(c.budget)}`); recalc = true; break; }
        case 'select_plan': { const i = TIERS.findIndex(t => t.key === a.plan); if (i >= 0) { if (recalc) { recommend(); recalc = false; } S.sel = i; done.push(TIERS[i].name + ' 안 선택'); } break; }
        case 'swap_item': {
          if (recalc) { recommend(); recalc = false; }
          const k = findCat(a.category), cur = k && pl().items[k] && BY_ID[pl().items[k]]; if (!cur) break;
          const o = CATALOG.filter(x => x.cat === k && valid(x, c) && x.id !== cur.id);
          const p = a.direction === 'better' ? o.filter(x => score(x, c) > score(cur, c)).sort((x, y) => x.price - y.price)[0] : o.filter(x => x.price < cur.price).sort((x, y) => score(y, c) - score(x, c))[0];
          if (p) { pl().items[k] = p.id; pl().edited = true; S.highlight.add(k); done.push(`${CAT_LABEL[k]} → ${p.name}`); }
          break;
        }
        case 'remove_item': { if (recalc) { recommend(); recalc = false; } const k = findCat(a.category); if (k && pl().items[k]) { delete pl().items[k]; pl().edited = true; done.push(CAT_LABEL[k] + ' 빼기'); } break; }
        case 'add_item': {
          if (recalc) { recommend(); recalc = false; } const k = findCat(a.category);
          if (k && !pl().items[k]) { const p = CATALOG.filter(x => x.cat === k && valid(x, c)).sort((x, y) => (score(y, c) - score(x, c)) || (x.price - y.price))[0]; if (p) { pl().items[k] = p.id; pl().edited = true; S.highlight.add(k); done.push(CAT_LABEL[k] + ' 추가: ' + p.name); } }
          break;
        }
        case 'move_item': {
          const k = findCat(a.category), to = a.to;
          if (k) { S.layout[k] = S.layout[k] || {}; if (to === 'front' || to === 'back') S.layout[k].y = to; else S.layout[k].x = to; S.highlight.add(k); done.push(`${CAT_LABEL[k]} ${{ left: '왼쪽', right: '오른쪽', center: '가운데', front: '앞쪽', back: '뒤쪽' }[to]}으로`); }
          break;
        }
      }
    }
    if (recalc) recommend();
    return [...new Set(done)];
  }
  const CAT_WORDS = [['arm', /모니터\s*암|받침대|거치대/], ['monitor', /모니터/], ['keyboard', /키보드/], ['mouse', /마우스/], ['lamp', /조명|스탠드|스크린바|램프/], ['mat', /매트|장패드/], ['cable', /케이블|전선|선\s*정리|멀티탭/], ['decor', /화분|식물|소품|선반/], ['pc', /\bpc\b|PC|컴퓨터|본체/i]];
  function catsIn(t) { let s = t; const out = []; for (const [k, re] of CAT_WORDS) if (re.test(s)) { out.push(k); s = s.replace(re, ' '); } return out; }
  function parse(t) {
    const a = [], cond = {}, nm = t.match(/(\d+(?:\.\d+)?)\s*만/);
    if (nm) { const v = Math.round(parseFloat(nm[1]) * 10000); if (/줄|낮|빼|깎|덜/.test(t)) a.push({ type: 'change_budget', delta: -v }); else if (/늘|올|더\s*쓸|추가/.test(t) && !/예산\s*\d/.test(t)) a.push({ type: 'change_budget', delta: v }); else cond.budget = v; }
    const ds = t.match(/(\d{2,3})\s*[x×*X]\s*(\d{2,3})/);
    if (ds) { cond.desk_w = +ds[1]; cond.desk_d = +ds[2]; } else { const dw = t.match(/(?:책상|가로)[^\d]{0,6}(\d{2,3})\s*(?:cm|센티)?/); if (dw && !nm) cond.desk_w = +dw[1]; }
    if (/게임|게이밍/.test(t)) cond.purpose = 'gaming'; else if (/디자인|영상|편집/.test(t)) cond.purpose = 'design'; else if (/개발|코딩|프로그래밍/.test(t)) cond.purpose = 'dev'; else if (/사무|문서|업무/.test(t)) cond.purpose = 'office';
    if (/rgb|화려/i.test(t)) cond.style = 'rgb'; else if (/화이트|흰/.test(t)) cond.style = 'white'; else if (/블랙|검은|검정/.test(t)) cond.style = 'black'; else if (/원목|우드|나무/.test(t)) cond.style = 'wood'; else if (/미니멀|깔끔/.test(t)) cond.style = 'minimal';
    if (/듀얼|(2|두)\s*(대|개)/.test(t)) cond.monitors = 2; else if (/싱글|(1|한)\s*(대|개)/.test(t)) cond.monitors = 1;
    if (/노트북/.test(t) && /있|쓸|사용|써/.test(t)) cond.needs_pc = false;
    const cats = catsIn(t), dir = /왼쪽|좌측/.test(t) ? 'left' : /오른쪽|우측/.test(t) ? 'right' : /가운데|중앙/.test(t) ? 'center' : /앞쪽|앞으로/.test(t) ? 'front' : /뒤쪽|뒤로|안쪽/.test(t) ? 'back' : null;
    if (Object.keys(cond).length) a.unshift({ type: 'set_conditions', ...cond });
    for (const k of cats) {
      if (k === 'monitor' && cond.monitors) continue;
      if (dir && /옮|이동|놓|배치|두|으로|로/.test(t)) a.push({ type: 'move_item', category: k, to: dir });
      else if (/빼|없애|제거|필요\s*없/.test(t)) a.push(k === 'pc' ? { type: 'set_conditions', needs_pc: false } : { type: 'remove_item', category: k });
      else if (/추가|넣어|필요해|있으면/.test(t)) a.push(k === 'pc' ? { type: 'set_conditions', needs_pc: true } : { type: 'add_item', category: k });
      else if (/좋은|업그레이드|고급|성능/.test(t)) a.push({ type: 'swap_item', category: k, direction: 'better' });
      else if (/싼|저렴|싸게/.test(t)) a.push({ type: 'swap_item', category: k, direction: 'cheaper' });
    }
    const pm = t.match(/가성비|균형|프리미엄/); if (pm && /안|보여|선택|으로|로/.test(t)) a.push({ type: 'select_plan', plan: { 가성비: 'budget', 균형: 'balanced', 프리미엄: 'premium' }[pm[0]] });
    if (!a.length && /추천|다시/.test(t)) a.push({ type: 'set_conditions' });
    return a;
  }

  /* ---------- 화면 ---------- */
  const planTotal = pl => Object.values(pl.items).reduce((s, id) => { const p = BY_ID[id]; return s + Math.min(...shopPrices(p).filter(x => x != null)) * qty(p, S.cond); }, 0);
  const SUGS = ['20만 원 줄여줘', '모니터 2대로 바꿔줘', '조명은 왼쪽으로 옮겨줘', '화이트 톤으로 다시 추천해줘', '노트북 있어서 PC는 빼줘', '키보드 더 좋은 걸로', '프리미엄 안 보여줘'];

  function msgNode(m) {
    const d = document.createElement('div'); d.className = `aichat-msg ${m.role}${m.example ? ' is-example' : ''}`; d.textContent = m.text;
    if (m.acts && m.acts.length) { const w = document.createElement('div'); w.className = 'aichat-acts'; for (const s of m.acts) { const sp = document.createElement('span'); sp.textContent = s; w.append(sp); } d.append(w); }
    return d;
  }
  function renderLog() { const log = root.querySelector('.aichat-log'); log.replaceChildren(...messages.map(msgNode)); log.scrollTop = log.scrollHeight; }
  function renderConds() {
    const c = S.cond;
    root.querySelector('.aichat-conds').innerHTML = [['예산', man(c.budget)], ['책상', `${c.desk_w}×${c.desk_d}cm`], ['용도', PURPOSE[c.purpose]], ['스타일', STYLE[c.style]], ['모니터', `${c.monitors}대`], ['PC', c.needs_pc ? '포함' : '제외']].map(([k, v]) => `<span class="pill">${k} <b>${v}</b></span>`).join('');
  }
  function renderPlans() {
    const c = S.cond;
    root.querySelector('.aichat-plans').innerHTML = S.plans.map((pl, i) => {
      const t = planTotal(pl), pct = Math.round(t / c.budget * 100), mon = pl.items.monitor && BY_ID[pl.items.monitor], pc = pl.items.pc && BY_ID[pl.items.pc];
      const same = i > 0 && JSON.stringify(pl.items) === JSON.stringify(S.plans[i - 1].items);
      return `<button type="button" class="aichat-plan" data-plan="${i}" aria-pressed="${i === S.sel}"><span class="aichat-tier">${pl.tier.name}${pl.edited ? ' <em>· 대화로 수정됨</em>' : ''}</span><strong>${D.money(t)}</strong><span class="aichat-bar"><i class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></i></span><small>예산의 ${pct}%${pct > 100 ? ' · 예산 초과' : ''}</small><small>${mon ? mon.name + (c.monitors > 1 ? ' ×2' : '') : ''}${pc ? ' · ' + pc.name : ''}</small>${same ? '<small>앞 안과 같음 · 더 올릴 제품이 없어요</small>' : ''}</button>`;
    }).join('');
    root.querySelectorAll('[data-plan]').forEach(b => b.addEventListener('click', () => { S.sel = +b.dataset.plan; S.highlight.clear(); update(); }));
    const pl = S.plans[S.sel];
  }
  function renderDesk() {
    const c = S.cond, rs = rects(), chk = checkLayout(rs), pad = 10;
    const minX = Math.min(0, ...rs.map(r => r.x)) - pad, maxX = Math.max(c.desk_w, ...rs.map(r => r.x + r.w)) + pad;
    let g = `<rect class="aichat-desk-top" x="0" y="0" width="${c.desk_w}" height="${c.desk_d}" rx="1.2"/><text class="aichat-dim" x="${c.desk_w / 2}" y="-3" text-anchor="middle">${c.desk_w} cm</text><text class="aichat-dim" x="${c.desk_w + 2}" y="${c.desk_d / 2}">${c.desk_d} cm</text>`;
    for (const r of rs) {
      if (r.under && r.k === 'arm') { g += `<rect class="aichat-riser" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="1"/>`; continue; }
      const cls = r.floor ? 'aichat-ghost' : `aichat-obj${r.k === 'mat' ? ' is-mat' : ''}${S.highlight.has(r.k) ? ' is-changed' : ''}${chk.bad.has(r) ? ' is-bad' : ''}`;
      g += `<rect class="${cls}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.k === 'decor' && r.label === '화분' ? r.w / 2 : .8}"/>`;
      const fits = r.label && r.h >= 3.5 && r.label.length * 3.4 <= r.w;
      if (fits) g += `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 1.1}" text-anchor="middle">${r.label}</text>`;
      else if (r.label) g += `<text class="aichat-dim" x="${r.x + r.w / 2}" y="${r.thin ? r.y - 1 : r.y + r.h + 3.2}" text-anchor="middle">${r.label}</text>`;
    }
    const svg = root.querySelector('.aichat-desk');
    svg.setAttribute('viewBox', `${minX} ${-pad} ${maxX - minX} ${c.desk_d + 12 + pad}`); svg.innerHTML = g;
    root.querySelector('.aichat-desk-title').textContent = `${S.plans[S.sel].tier.name} 안 · ${c.desk_w}×${c.desk_d}cm`;
    root.querySelector('.aichat-warns').innerHTML = chk.warns.length ? chk.warns.map(w => `<p class="is-warn">${w}</p>`).join('') : '<p class="is-ok">모든 제품이 책상에 들어가고 겹치지 않아요</p>';
  }
  function renderPrices() {
    const c = S.cond, pl = S.plans[S.sel], ids = CAT_ORDER.filter(k => pl.items[k]);
    const tot = [0, 0, 0], miss = [false, false, false]; let low = 0;
    const rows = ids.map(k => {
      const p = BY_ID[pl.items[k]], hl = S.highlight.has(k), n = qty(p, c), ps = shopPrices(p).map(x => x == null ? null : x * n), m = Math.min(...ps.filter(x => x != null)); low += m;
      ps.forEach((x, i) => { if (x == null) miss[i] = true; else tot[i] += x; });
      return `<tr${hl ? ' class="is-changed"' : ''}><td><small>${CAT_LABEL[k]}${hl ? ' · 방금 바뀜' : ''}</small>${D.escape(p.name)}${n > 1 ? ' ×' + n : ''}</td>${ps.map(x => x == null ? '<td class="is-na">미판매</td>' : `<td class="${x === m ? 'is-low' : ''}">${x.toLocaleString('ko-KR')}${x === m ? ' <small>최저</small>' : ''}</td>`).join('')}</tr>`;
    }).join('');
    root.querySelector('.aichat-table').innerHTML = `<thead><tr><th>제품</th>${SHOPS.map(s => `<th>${s}</th>`).join('')}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td>판매처별 합계</td>${tot.map((x, i) => miss[i] ? '<td class="is-na">일부 미판매</td>' : `<td>${x.toLocaleString('ko-KR')}</td>`).join('')}</tr></tfoot>`;
    root.querySelector('.aichat-sum').textContent = D.money(low);
    const full = tot.map((x, i) => miss[i] ? Infinity : x), bi = full.indexOf(Math.min(...full));
    root.querySelector('.aichat-shop').textContent = isFinite(full[bi]) ? `한 곳에서 모두 산다면 ${SHOPS[bi]}가 가장 싸요 (${D.money(full[bi])}). 최저가 조합은 그보다 ${D.money(full[bi] - low)} 저렴해요.` : '';
  }
  function update() { renderConds(); renderPlans(); renderDesk(); renderPrices(); }
  function send(text) {
    messages.push({ role: 'user', text });
    const done = apply(parse(text));
    messages.push({ role: 'assistant', text: done.length ? '말씀하신 대로 반영했어요.' : '아직 이해하지 못했어요. 예산·책상 크기·용도·스타일을 말하거나, "모니터 2대로", "조명 왼쪽으로", "20만 원 줄여줘"처럼 말해 보세요.', acts: done });
    renderLog(); update();
  }

  recommend();
  D.features.ai = {
    title: '대화형 AI',
    mount(node) {
      root = node;
      root.innerHTML = D.heading('AI CONVERSATION', '대화형 AI', '조건을 말하면 3안을 추천하고, 대화로 재조정·배치 변경·가격 비교까지 이어갑니다.', '<span class="pill purple">규칙 기반 데모</span>') +
        `<div class="aichat-conds" aria-label="현재 조건"></div>
        <div class="aichat-grid">
          <section class="panel aichat-chat" aria-label="대화">
            <div class="panel-heading"><h2>대화</h2><span class="muted">조건·재조정·배치를 말로</span></div>
            <div class="aichat-log" role="log" aria-live="polite"></div>
            <div class="aichat-sugs">${SUGS.map(s => `<button type="button" data-say="${s}">${s}</button>`).join('')}</div>
            <form class="aichat-form"><label class="aichat-sr" for="aichat-input">메시지</label><input id="aichat-input" name="message" placeholder="예: 예산 100만 원, 책상 140x70, 디자인용, 화이트 톤" maxlength="300" autocomplete="off" required><button class="primary" aria-label="메시지 보내기">${D.icon('arrow')}</button></form>
            <small class="aichat-note">준비된 규칙으로 문장을 해석하는 데모입니다. 실제 AI 연결은 이후 작업입니다.</small>
          </section>
          <div class="aichat-main">
            <section class="panel aichat-plans-panel"><div class="panel-heading"><h2>조건별 추천 3안</h2><span class="muted">카드를 눌러 선택</span></div><div class="aichat-plans"></div></section>
            <section class="panel aichat-desk-panel"><div class="panel-heading"><h2>책상 배치 미리보기</h2><span class="muted aichat-desk-title"></span></div><div class="aichat-desk-wrap"><svg class="aichat-desk" role="img" aria-label="책상 위 배치 평면도. 시연용 2D 그림입니다."></svg></div><p class="aichat-legend">위에서 내려다본 평면도 · 점선 = 책상 밖(바닥·책상 아래) · 보라 테두리 = 방금 바뀐 제품</p><div class="aichat-warns"></div></section>
          </div>
          <div class="aichat-side">
            <section class="panel aichat-price-panel"><div class="panel-heading"><h2>국내 판매처 가격 비교</h2><span class="muted">가상 데이터 · 단위 원</span></div><div class="aichat-table-wrap"><table class="aichat-table"></table></div><div class="aichat-total"><span>최저가 조합 총액</span><strong class="aichat-sum"></strong></div><p class="aichat-shop"></p></section>
            <p class="notice aichat-notice">제품명·가격·판매처(쇼핑몰 A·B·C)는 시연용 가상 값입니다. 새로고침하면 초기화됩니다.</p>
          </div>
        </div>`;
      root.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', () => send(b.dataset.say)));
      root.querySelector('.aichat-form').addEventListener('submit', e => { e.preventDefault(); const input = e.currentTarget.elements.message, v = input.value.trim(); if (!v) return; input.value = ''; send(v); input.focus(); });
      renderLog(); update();
    }
  };
})(window.Deskspace);
