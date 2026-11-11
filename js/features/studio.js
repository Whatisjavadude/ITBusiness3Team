/*
 * 내 데스크 스튜디오 · 3D 배치 시뮬레이터
 *
 * 기존 화면 구조(제목·스튜디오 캔버스·크기 입력·제품 목록·AI 어시스턴트·사진 업로드)는 그대로 두고,
 * ui.js의 D.scene() 샘플 SVG 자리에 실측 비율 3D 배치 화면을 넣었습니다.
 *
 * 흐름: ① 사진 입력(아래 업로드 영역) → ② 벽면·책상 조건(크기 입력 폼) → ③ 배치 변화(3D에서 이동 + 변경 전·후)
 *
 * [구현] 입력값으로 실제 계산·반영되는 부분
 * [샘플] 시연용 가정값이거나 아직 연결되지 않은 부분
 *
 * 공유 상태에 추가하는 값
 *   D.state.room   : 책상 높이, 벽 켜기/끄기, 책상~벽 거리, 창문 위치
 *   D.state.layout : 제품별 위치 { x, z, rot } (cm, 책상 가운데 기준, x 오른쪽+, z 앞쪽+)
 * 외부 라이브러리 없이 Canvas 2D로 그립니다 (1 단위 = 1 cm).
 */
(function (D) {
  'use strict';

  /* ---------- 로컬 상태 (이 탭에서만 유지) ---------- */
  const photos = { desk: '', style: '' };
  const ui = { selected: null, before: null, estimated: false, ownChange: false, big: false, wallEdit: null, wallTool: 'line', wePos: null };
  const view = { theta: -0.6, phi: 0.5, radius: 0 };
  let observer = null;

  /* ---------- 제품 치수 ----------
   * 너비(w)는 data.js 값을 씁니다 [구현].
   * 깊이(d)·높이(h)는 data.js에 없어 아래 가정값을 씁니다 [샘플]. */
  const SAMPLE_DIMS = {
    monitor:  { d: 20, h: 46, type: 'monitor' },
    lamp:     { d: 18, h: 42, type: 'lamp' },
    keyboard: { d: 12, h: 3,  type: 'keyboard' },
    shelf:    { d: 24, h: 10, type: 'riser' }, // 우드 모니터 받침대
  };
  const THEME = { // ui.js D.scene()의 스타일 색과 맞춤
    warm:     { top: '#d5b28a', leg: '#8a6a4a', wall: '#e7e0d4', screen: '#bec9ba', accent: '#717d77' },
    minimal:  { top: '#f5f5f0', leg: '#c8cdce', wall: '#e3e7eb', screen: '#d6dce2', accent: '#7a8895' },
    creative: { top: '#cbc4dc', leg: '#8d7ba4', wall: '#e6e0ed', screen: '#c8bdd7', accent: '#8d7ba4' },
  };
  const PRIORITY = { riser: 0, monitor: 1, keyboard: 2, lamp: 3, box: 4 };

  function product(id) { return D.products.find(p => p.id === id) || { id, name: id, width: 30 }; }
  function spec(id) {
    const p = product(id), s = SAMPLE_DIMS[id] || {};
    return { id, name: p.name, w: p.width || 30, d: p.depth || s.d || 20, h: p.height || s.h || 15, type: s.type || 'box' };
  }

  /* ---------- 상태 보강 ---------- */
  function room() {
    D.state.room = Object.assign({ height: 73, backWall: true, leftWall: false, rightWall: true, backGap: 5, sideGap: 20, window: 'left', paths: {} }, D.state.room || {});
    return D.state.room;
  }
  function layout() {
    const L = D.state.layout = D.state.layout || {};
    const size = `${D.state.width}x${D.state.depth}`;
    // 프리셋 적용 등 다른 화면에서 책상 크기가 바뀌면 새 크기에 맞게 다시 놓습니다.
    // (이 화면의 크기 입력으로 바뀐 경우는 그대로 두고 배치 점검에서 문제를 보여줍니다.)
    if (L.__size && L.__size !== size && !ui.ownChange) Object.keys(L).forEach(k => delete L[k]);
    // 구성에서 빠진 제품의 예전 위치는 지웁니다. 다시 추가하면 빈 자리에 새로 놓입니다.
    Object.keys(L).forEach(k => { if (k !== '__size' && !D.state.products.includes(k)) delete L[k]; });
    L.__size = size; ui.ownChange = false;
    const missing = D.state.products.filter(id => !L[id]);
    if (missing.length) autoPlace(missing);
    return L;
  }
  function copyLayout() { const L = D.state.layout || {}, out = {}; D.state.products.forEach(id => { if (L[id]) out[id] = Object.assign({}, L[id]); }); return out; }
  function snapshot() { return { width: D.state.width, depth: D.state.depth, products: [...D.state.products], layout: copyLayout(), walls: JSON.stringify(room().paths) }; }

  /* ---------- 배치 계산 [구현] ---------- */
  function footprint(id, p) {
    const s = spec(id), turned = (p.rot || 0) % 180 !== 0;
    const w = turned ? s.d : s.w, d = turned ? s.w : s.d;
    return { x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - d / 2, z1: p.z + d / 2 };
  }
  const overlaps = (a, b, m = 0) => a.x0 < b.x1 - m && b.x0 < a.x1 - m && a.z0 < b.z1 - m && b.z0 < a.z1 - m;
  const contains = (o, i) => i.x0 >= o.x0 - 0.5 && i.x1 <= o.x1 + 0.5 && i.z0 >= o.z0 - 0.5 && i.z1 <= o.z1 + 0.5;
  const insideDesk = f => f.x0 >= -D.state.width / 2 - 0.01 && f.x1 <= D.state.width / 2 + 0.01 && f.z0 >= -D.state.depth / 2 - 0.01 && f.z1 <= D.state.depth / 2 + 0.01;

  // 모니터가 받침대 위에 완전히 올라가 있으면 겹침이 아니라 '올려 둔 것'으로 봅니다.
  function stackedOn(id, L) {
    if (spec(id).type !== 'monitor') return null;
    const f = footprint(id, L[id]);
    return D.state.products.find(o => o !== id && spec(o).type === 'riser' && L[o] && contains(footprint(o, L[o]), f)) || null;
  }
  function baseY(id, L) { const r = stackedOn(id, L); return r ? spec(r).h : 0; }

  function autoPlace(ids) {
    const W = D.state.width, Dp = D.state.depth, L = D.state.layout;
    const taken = D.state.products.filter(id => !ids.includes(id) && L[id]).map(id => ({ id, f: footprint(id, L[id]) }));
    ids.slice().sort((a, b) => PRIORITY[spec(a).type] - PRIORITY[spec(b).type]).forEach(id => {
      const s = spec(id), m = 4;
      const back = -Dp / 2 + s.d / 2 + m, front = Dp / 2 - s.d / 2 - 6, left = -W / 2 + s.w / 2 + m, right = W / 2 - s.w / 2 - m;
      const cands = [];
      if (s.type === 'monitor') {
        const riser = taken.find(t => spec(t.id).type === 'riser');
        if (riser) cands.push({ x: (riser.f.x0 + riser.f.x1) / 2, z: (riser.f.z0 + riser.f.z1) / 2, onRiser: true });
        cands.push({ x: 0, z: back });
      } else if (s.type === 'riser') cands.push({ x: 0, z: back });
      else if (s.type === 'keyboard') cands.push({ x: 0, z: front });
      else if (s.type === 'lamp') cands.push({ x: left, z: back }, { x: right, z: back });
      else cands.push({ x: right, z: back }, { x: left, z: back }, { x: right, z: front }, { x: left, z: front });
      for (let z = -Dp / 2 + s.d / 2 + 2; z <= Dp / 2 - s.d / 2 - 2; z += 5)
        for (let x = W / 2 - s.w / 2 - 2; x >= -W / 2 + s.w / 2 + 2; x -= 5) cands.push({ x, z });
      const ok = c => {
        const f = footprint(id, { x: c.x, z: c.z, rot: 0 });
        if (!insideDesk(f)) return false;
        return !taken.some(t => overlaps(f, t.f, 0.5) && !(c.onRiser && spec(t.id).type === 'riser' && contains(t.f, f)));
      };
      const pick = cands.find(ok) || cands[0];
      L[id] = { x: Math.round(pick.x), z: Math.round(pick.z), rot: 0 };
      taken.push({ id, f: footprint(id, L[id]) });
    });
  }
  function autoArrange() { const L = layout(); D.state.products.forEach(id => delete L[id]); autoPlace([...D.state.products]); }

  /* ---------- 벽 도면 [구현] ----------
   * room().paths[벽] = { start: {x, z}, segs: [{ type: 'line', to } | { type: 'curve', c, to }] }
   * 위에서 본 좌표(cm, 책상 가운데 기준). 도면이 없는 벽은 책상 크기·거리 입력값으로 만든 직선 벽입니다. */
  const WALLS = { back: '뒷벽', left: '왼쪽 벽', right: '오른쪽 벽' };
  const WALL_FLAG = { back: 'backWall', left: 'leftWall', right: 'rightWall' };
  function defaultPath(key) {
    const R = room(), W = D.state.width, Dp = D.state.depth;
    const wz = -Dp / 2 - R.backGap, lx = -W / 2 - R.sideGap, rx = W / 2 + R.sideGap, zMax = Dp / 2 + 140;
    const xMin = R.leftWall ? lx : -W / 2 - 110, xMax = R.rightWall ? rx : W / 2 + 110;
    if (key === 'back') return { start: { x: xMin, z: wz }, segs: [{ type: 'line', to: { x: xMax, z: wz } }] };
    const x = key === 'left' ? lx : rx;
    return { start: { x, z: wz }, segs: [{ type: 'line', to: { x, z: zMax } }] };
  }
  const wallPath = key => room().paths[key] || defaultPath(key);
  function tessellate(path) { // 곡선은 12조각 직선으로 나눕니다
    if (!path || !path.start) return [];
    const pts = [path.start]; let a = path.start;
    path.segs.forEach(sg => {
      if (sg.type === 'curve') for (let i = 1; i <= 12; i++) { const t = i / 12, u = 1 - t; pts.push({ x: u * u * a.x + 2 * u * t * sg.c.x + t * t * sg.to.x, z: u * u * a.z + 2 * u * t * sg.c.z + t * t * sg.to.z }); }
      else pts.push(sg.to);
      a = sg.to;
    });
    return pts;
  }
  function walls() {
    const R = room();
    return Object.keys(WALLS).filter(k => R[WALL_FLAG[k]]).map(k => ({ key: k, custom: !!R.paths[k], pts: tessellate(wallPath(k)) })).filter(w => w.pts.length > 1);
  }
  function segHitsRect(a, b, r) {
    const inside = q => q.x > r.x0 && q.x < r.x1 && q.z > r.z0 && q.z < r.z1;
    if (inside(a) || inside(b)) return true;
    const cross2 = (p, q, s2, t) => {
      const d = (q.x - p.x) * (t.z - s2.z) - (q.z - p.z) * (t.x - s2.x); if (Math.abs(d) < 1e-9) return false;
      const u = ((s2.x - p.x) * (t.z - s2.z) - (s2.z - p.z) * (t.x - s2.x)) / d, v = ((s2.x - p.x) * (q.z - p.z) - (s2.z - p.z) * (q.x - p.x)) / d;
      return u > 0 && u < 1 && v > 0 && v < 1;
    };
    const c = [{ x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 }, { x: r.x0, z: r.z1 }];
    return c.some((q, i) => cross2(a, b, q, c[(i + 1) % 4]));
  }
  const wallHits = rect => walls().filter(w => w.pts.some((q, i) => i && segHitsRect(w.pts[i - 1], q, rect))).map(w => w.key);

  function checks() {
    const W = D.state.width, Dp = D.state.depth, R = room(), L = layout();
    const list = [], bad = new Set(), warn = new Set();
    const items = D.state.products.filter(id => L[id]).map(id => ({ id, s: spec(id), p: L[id], f: footprint(id, L[id]) }));
    items.forEach(i => {
      const out = { left: -W / 2 - i.f.x0, right: i.f.x1 - W / 2, back: -Dp / 2 - i.f.z0, front: i.f.z1 - Dp / 2 };
      const over = Math.max(out.left, out.right, out.back, out.front);
      if (over > 0.5) {
        bad.add(i.id);
        let text = `${i.s.name}: 책상 밖으로 ${Math.round(over)}cm 나감`;
        if (out.back > 0.5 && R.backWall && !R.paths.back && out.back > R.backGap) text = `${i.s.name}: 책상 뒤로 ${Math.round(out.back)}cm 나가 벽에 닿음 (벽까지 ${R.backGap}cm)`;
        if (out.left > 0.5 && R.leftWall && !R.paths.left && out.left > R.sideGap) text = `${i.s.name}: 왼쪽 벽에 닿음`;
        if (out.right > 0.5 && R.rightWall && !R.paths.right && out.right > R.sideGap) text = `${i.s.name}: 오른쪽 벽에 닿음`;
        list.push({ level: 'bad', id: i.id, text });
      }
    });
    // 도면으로 그린 벽이 책상이나 제품을 지나가는지
    wallHits({ x0: -W / 2, x1: W / 2, z0: -Dp / 2, z1: Dp / 2 }).filter(k => R.paths[k]).forEach(k => list.push({ level: 'bad', id: '', text: `책상이 ${WALLS[k]} 도면과 겹침` }));
    items.forEach(i => wallHits(i.f).filter(k => R.paths[k]).forEach(k => { bad.add(i.id); list.push({ level: 'bad', id: i.id, text: `${i.s.name}: ${WALLS[k]}에 닿음` }); }));
    for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
      const A = items[a], B = items[b];
      if (!overlaps(A.f, B.f, 0.5)) continue;
      if (stackedOn(A.id, L) === B.id || stackedOn(B.id, L) === A.id) continue;
      bad.add(A.id); bad.add(B.id);
      list.push({ level: 'bad', id: A.id, text: `${A.s.name}와(과) ${B.s.name}이(가) 겹침` });
    }
    // 창문 위치에 따른 참고 안내 (일반적인 배치 원칙, 정밀 계산 아님)
    const monitor = items.find(i => i.s.type === 'monitor');
    if (monitor && R.window === 'back' && R.backWall) { warn.add(monitor.id); list.push({ level: 'warn', id: monitor.id, text: `${monitor.s.name}: 뒤에 창문이 있어 화면이 눈부실 수 있음 (참고)` }); }
    const lamp = items.find(i => i.s.type === 'lamp');
    if (lamp && R.window === 'left' && R.leftWall && lamp.p.x < 0) list.push({ level: 'info', id: lamp.id, text: `${lamp.s.name}: 창문과 같은 왼쪽이라 빛이 한쪽으로 몰림 (참고)` });
    if (lamp && R.window === 'right' && R.rightWall && lamp.p.x > 0) list.push({ level: 'info', id: lamp.id, text: `${lamp.s.name}: 창문과 같은 오른쪽이라 빛이 한쪽으로 몰림 (참고)` });

    const area = items.filter(i => !stackedOn(i.id, L)).reduce((sum, i) => {
      const w = Math.max(0, Math.min(i.f.x1, W / 2) - Math.max(i.f.x0, -W / 2)), d = Math.max(0, Math.min(i.f.z1, Dp / 2) - Math.max(i.f.z0, -Dp / 2));
      return sum + w * d;
    }, 0);
    return { list, bad, warn, free: Math.max(0, Math.round(100 - area / (W * Dp) * 100)) };
  }

  /* ---------- 3D 렌더러 (Canvas 2D) [구현] ---------- */
  const v3 = (x, y, z) => ({ x, y, z });
  const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
  const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
  const mul = (a, k) => v3(a.x * k, a.y * k, a.z * k);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const norm = a => { const l = Math.hypot(a.x, a.y, a.z) || 1; return v3(a.x / l, a.y / l, a.z / l); };
  const LIGHT = norm(v3(0.45, 1, 0.65));
  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function rgb(c, k, tint) {
    let [r, g, b] = hex(c);
    if (tint) { const t = hex(tint); r = r * 0.55 + t[0] * 0.45; g = g * 0.55 + t[1] * 0.45; b = b * 0.55 + t[2] * 0.45; }
    return `rgb(${Math.min(255, r * k) | 0},${Math.min(255, g * k) | 0},${Math.min(255, b * k) | 0})`;
  }

  function createSim(canvas, onChange, onWall) {
    const ctx = canvas.getContext('2d');
    const sim = { faces: [], cam: null, w: 0, h: 0, focal: 1, labels: [], drag: null };

    sim.resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      sim.w = r.width; sim.h = r.height;
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); sim.draw();
    };
    function camera() {
      const H = room().height;
      if (!view.radius) view.radius = Math.max(D.state.width, D.state.depth * 1.6) * 1.5 + 60;
      const T = v3(0, H - 6, 0), cp = Math.cos(view.phi);
      const E = add(T, mul(v3(cp * Math.sin(view.theta), Math.sin(view.phi), cp * Math.cos(view.theta)), view.radius));
      const f = norm(sub(T, E)), right = norm(cross(f, v3(0, 1, 0)));
      sim.focal = sim.h / (2 * Math.tan(0.42));
      return { E, f, right, up: cross(right, f) };
    }
    function project(P) {
      const c = sim.cam, v = sub(P, c.E), z = dot(v, c.f);
      return z < 2 ? null : { x: sim.w / 2 + dot(v, c.right) * sim.focal / z, y: sim.h / 2 - dot(v, c.up) * sim.focal / z };
    }
    const ray = (sx, sy) => { const c = sim.cam; return norm(add(c.f, add(mul(c.right, (sx - sim.w / 2) / sim.focal), mul(c.up, (sim.h / 2 - sy) / sim.focal)))); };
    const hitY = (sx, sy, y) => { const d = ray(sx, sy), E = sim.cam.E; if (Math.abs(d.y) < 1e-6) return null; const t = (y - E.y) / d.y; return t > 0 ? add(E, mul(d, t)) : null; };

    function face(pts, fill, layer, id, stroke) {
      const p2 = pts.map(project); if (p2.some(p => !p)) return;
      const c = mul(pts.reduce(add, v3(0, 0, 0)), 1 / pts.length);
      sim.faces.push({ p2, depth: dot(sub(c, sim.cam.E), sim.cam.f), fill, layer, id, stroke });
    }
    function box(o) { // 중심 x·z, 바닥 y, 크기 w·h·d, 회전 rot(rad)
      const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
      const P = (dx, dy, dz) => v3(o.x + dx * c + dz * s, o.y + dy, o.z - dx * s + dz * c);
      const hw = o.w / 2, hd = o.d / 2;
      const v = [P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), P(-hw, o.h, -hd), P(hw, o.h, -hd), P(hw, o.h, hd), P(-hw, o.h, hd)];
      const center = v3(o.x, o.y + o.h / 2, o.z);
      [[4, 5, 6, 7], [0, 1, 2, 3], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]].forEach(idx => {
        const pts = idx.map(i => v[i]), fc = mul(pts.reduce(add, v3(0, 0, 0)), 0.25), n = norm(sub(fc, center));
        if (dot(n, sub(sim.cam.E, fc)) <= 0) return;
        face(pts, rgb(o.color, 0.66 + 0.4 * Math.max(0, dot(n, LIGHT)), o.tint), o.layer, o.id, o.stroke);
      });
    }
    function part(base, rot, dx, dy, dz, w, h, d, color, extra) {
      const c = Math.cos(rot), s = Math.sin(rot);
      box(Object.assign({ x: base.x + dx * c + dz * s, y: base.y + dy, z: base.z - dx * s + dz * c, w, h, d, rot, color }, extra));
    }

    function drawItem(id, p, st, L, theme) {
      const s = spec(id), H = room().height, rot = (p.rot || 0) * Math.PI / 180, y0 = H + baseY(id, L);
      const extra = { layer: 6, id, tint: st.bad ? '#e0483e' : null, stroke: st.selected ? '#e07a2f' : st.warn ? '#e8a23a' : null };
      const f = footprint(id, p);
      face([v3(f.x0 - 1.5, y0 + 0.05, f.z0 - 1.5), v3(f.x1 + 1.5, y0 + 0.05, f.z0 - 1.5), v3(f.x1 + 1.5, y0 + 0.05, f.z1 + 1.5), v3(f.x0 - 1.5, y0 + 0.05, f.z1 + 1.5)], 'rgba(0,0,0,0.13)', 5);
      const base = v3(p.x, y0, p.z);
      if (s.type === 'monitor') {
        part(base, rot, 0, 0, 2, 24, 1.5, s.d - 4, '#797e80', extra);
        part(base, rot, 0, 1.5, -2, 4, 12, 3, '#65696c', extra);
        part(base, rot, 0, 11, -2.5, s.w, s.h - 11, 2.5, '#42484d', extra);
        part(base, rot, 0, 12.5, -1.1, s.w - 3, s.h - 14, 0.3, theme.screen, extra);
      } else if (s.type === 'keyboard') {
        part(base, rot, 0, 0, 0, s.w, 2, s.d, '#c7c4bf', extra);
        part(base, rot, 0, 2, 0.5, s.w - 3, 0.7, s.d - 3, '#f1ede5', extra);
      } else if (s.type === 'lamp') {
        part(base, rot, 0, 0, 0, s.w - 4, 2, s.d - 4, theme.accent, extra);
        part(base, rot, -2, 2, 0, 2, s.h - 8, 2, theme.accent, extra);
        part(base, rot, 3, s.h - 8, 0, 12, 2, 2, theme.accent, extra);
        part(base, rot, 7, s.h - 12, 0, 9, 6, 9, '#fff3cc', extra);
      } else if (s.type === 'riser') {
        part(base, rot, 0, s.h - 2.5, 0, s.w, 2.5, s.d, '#d2b898', extra);
        [-1, 1].forEach(k => part(base, rot, k * (s.w / 2 - 2), 0, 0, 3, s.h - 2.5, s.d, '#a78a69', extra));
      } else part(base, rot, 0, 0, 0, s.w, s.h, s.d, '#8fa4ba', extra);
      sim.labels.push({ id, at: v3(p.x, y0 + s.h + 4, p.z) });
    }

    sim.draw = () => {
      if (!sim.w || !sim.h) return;
      const W = D.state.width, Dp = D.state.depth, R = room(), H = R.height, L = layout(), chk = checks();
      const theme = THEME[D.state.style] || THEME.warm;
      sim.cam = camera(); sim.faces = []; sim.labels = [];
      const wallH = 230, E = sim.cam.E, WL = walls();
      // 바닥: 벽 도면과 책상을 모두 덮는 사각형
      let xMin = -W / 2 - 110, xMax = W / 2 + 110, zMin = -Dp / 2 - 80, zMax = Dp / 2 + 140;
      const all = WL.flatMap(w => w.pts);
      if (all.length) {
        if (R.leftWall) xMin = Math.min(...all.map(q => q.x)); if (R.rightWall) xMax = Math.max(...all.map(q => q.x));
        if (R.backWall) zMin = Math.min(...all.map(q => q.z)); zMax = Math.max(zMax, ...all.map(q => q.z));
      }
      xMin = Math.min(xMin, -W / 2 - 10); xMax = Math.max(xMax, W / 2 + 10); zMin = Math.min(zMin, -Dp / 2 - 6);
      face([v3(xMin, 0, zMin), v3(xMax, 0, zMin), v3(xMax, 0, zMax), v3(xMin, 0, zMax)], '#ece6dc', 0);
      face([v3(-W / 2 - 6, 0.1, -Dp / 2 - 4), v3(W / 2 + 6, 0.1, -Dp / 2 - 4), v3(W / 2 + 6, 0.1, Dp / 2 + 8), v3(-W / 2 - 6, 0.1, Dp / 2 + 8)], 'rgba(52,64,75,0.08)', 0);
      // 벽: 도면 조각마다 세운 면. 방 바깥쪽에서 보는 면은 숨겨 방 안이 보이게 합니다.
      const inward = (a, b) => { const len = Math.hypot(b.x - a.x, b.z - a.z) || 1, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2; let n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len }; if (n.x * -mx + n.z * -mz < 0) n = { x: -n.x, z: -n.z }; return { n, mx, mz, len }; };
      const L2 = norm(v3(0.6, 0, 0.8));
      WL.forEach(w => {
        for (let i = 1; i < w.pts.length; i++) {
          const a = w.pts[i - 1], b = w.pts[i], { n, mx, mz } = inward(a, b);
          if ((E.x - mx) * n.x + (E.z - mz) * n.z <= 0) continue;
          const fill = rgb(theme.wall, 0.86 + 0.14 * Math.abs(n.x * L2.x + n.z * L2.z));
          face([v3(a.x, 0, a.z), v3(b.x, 0, b.z), v3(b.x, wallH, b.z), v3(a.x, wallH, a.z)], fill, 1, 'wall:' + w.key, ui.wallEdit === w.key ? '#e07a2f' : fill);
        }
      });
      // 창문: 고른 벽에서 가장 긴 곧은 부분(100cm 이상)에 책상 쪽으로 맞춰 둡니다.
      const win = pts => { face(pts(0), '#9a9ea3', 2); face(pts(4), '#cfe1ee', 2); };
      const ww = WL.find(w => w.key === R.window);
      if (ww) {
        let best = null;
        for (let i = 1; i < ww.pts.length; i++) { const a = ww.pts[i - 1], b = ww.pts[i], len = Math.hypot(b.x - a.x, b.z - a.z); if (len >= 100 && (!best || len > best.len)) best = { a, b, len }; }
        if (best) {
          const { a, b, len } = best, ux = (b.x - a.x) / len, uz = (b.z - a.z) / len, { n, mx, mz } = inward(a, b);
          if ((E.x - mx) * n.x + (E.z - mz) * n.z > 0) {
            const t = Math.min(len - 45, Math.max(45, -a.x * ux - a.z * uz)), cx = a.x + ux * t + n.x * 0.4, cz = a.z + uz * t + n.z * 0.4;
            const P = (u, y) => v3(cx + ux * u, y, cz + uz * u);
            win(i => [P(-45 + i, 95 + i), P(45 - i, 95 + i), P(45 - i, 205 - i), P(-45 + i, 205 - i)]);
          }
        }
      }

      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([kx, kz]) => box({ x: kx * (W / 2 - 4), y: 0, z: kz * (Dp / 2 - 4), w: 4, h: H - 3, d: 4, color: theme.leg, layer: 3 }));
      box({ x: 0, y: H - 3, z: 0, w: W, h: 3, d: Dp, color: theme.top, layer: 4 });
      // 받침대를 먼저 그려 모니터가 위에 보이게 합니다.
      const order = D.state.products.filter(id => L[id]).sort((a, b) => baseY(a, L) - baseY(b, L));
      order.forEach(id => drawItem(id, L[id], { bad: chk.bad.has(id), warn: chk.warn.has(id), selected: ui.selected === id }, L, theme));

      ctx.clearRect(0, 0, sim.w, sim.h);
      sim.faces.sort((a, b) => a.layer - b.layer || b.depth - a.depth);
      sim.faces.forEach(fc => {
        ctx.beginPath(); fc.p2.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
        ctx.fillStyle = fc.fill; ctx.fill();
        ctx.lineWidth = fc.stroke ? 1.6 : 0.6; ctx.strokeStyle = fc.stroke || 'rgba(0,0,0,0.12)'; ctx.stroke();
      });
      const dim = (a, b, text) => {
        const p = project(a), q = project(b); if (!p || !q) return;
        ctx.strokeStyle = '#4a5363'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        ctx.font = '600 12px system-ui, sans-serif'; const tw = ctx.measureText(text).width, mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(mx - tw / 2 - 5, my - 9, tw + 10, 18);
        ctx.fillStyle = '#1b2a41'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, mx, my);
      };
      dim(v3(-W / 2, H, Dp / 2 + 10), v3(W / 2, H, Dp / 2 + 10), `${W} cm`);
      dim(v3(W / 2 + 10, H, -Dp / 2), v3(W / 2 + 10, H, Dp / 2), `${Dp} cm`);
      sim.labels.filter(l => l.id === ui.selected).forEach(l => {
        const p = project(l.at); if (!p) return;
        const text = spec(l.id).name; ctx.font = '700 12px system-ui, sans-serif'; const tw = ctx.measureText(text).width;
        ctx.fillStyle = '#e07a2f'; ctx.fillRect(p.x - tw / 2 - 7, p.y - 24, tw + 14, 20);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, p.x, p.y - 14);
      });
    };

    sim.pick = (sx, sy) => {
      for (let i = sim.faces.length - 1; i >= 0; i--) {
        const fc = sim.faces[i]; if (!fc.id) continue;
        let hit = false; const p = fc.p2;
        for (let a = 0, b = p.length - 1; a < p.length; b = a++)
          if ((p[a].y > sy) !== (p[b].y > sy) && sx < (p[b].x - p[a].x) * (sy - p[a].y) / (p[b].y - p[a].y) + p[a].x) hit = !hit;
        if (hit) return fc.id;
      }
      return null;
    };

    // 조작: 빈 곳 드래그 = 시점 회전 · 제품 드래그 = 이동 · 휠 = 확대 · 방향키/R = 이동/회전
    const pt = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const grabY = id => room().height + baseY(id, layout()) + spec(id).h / 2;
    canvas.addEventListener('pointerdown', e => {
      const { x, y } = pt(e), id = sim.pick(x, y);
      canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
      if (id && id.startsWith('wall:')) sim.drag = { kind: 'orbit', x, y, theta: view.theta, phi: view.phi, moved: false, wall: id.slice(5) };
      else if (id) {
        const p = layout()[id], hit = hitY(x, y, grabY(id));
        sim.drag = { kind: 'item', id, y: grabY(id), moved: false, off: hit ? { x: p.x - hit.x, z: p.z - hit.z } : { x: 0, z: 0 } };
        if (ui.selected !== id) { ui.selected = id; onChange('select'); }
      } else sim.drag = { kind: 'orbit', x, y, theta: view.theta, phi: view.phi, moved: false };
      sim.draw();
    });
    canvas.addEventListener('pointermove', e => {
      const d = sim.drag, { x, y } = pt(e);
      if (!d) { const id = sim.pick(x, y); canvas.style.cursor = id ? (id.startsWith('wall:') ? 'pointer' : 'move') : ''; return; }
      if (d.kind === 'orbit') {
        if (Math.abs(x - d.x) + Math.abs(y - d.y) > 3) d.moved = true;
        view.theta = d.theta - (x - d.x) * 0.008; view.phi = Math.min(1.35, Math.max(0.12, d.phi + (y - d.y) * 0.006));
        sim.draw(); return;
      }
      const hit = hitY(x, y, d.y); if (!hit) return;
      const p = layout()[d.id], W = D.state.width, Dp = D.state.depth;
      p.x = Math.round(Math.min(W / 2 + 30, Math.max(-W / 2 - 30, hit.x + d.off.x)));
      p.z = Math.round(Math.min(Dp / 2 + 25, Math.max(-Dp / 2 - 25, hit.z + d.off.z)));
      d.moved = true; sim.draw(); onChange('move');
    });
    const end = () => {
      const d = sim.drag; sim.drag = null; if (!d) return;
      if (d.kind === 'orbit' && !d.moved && d.wall) { onWall(d.wall); return; }
      if (d.kind === 'orbit' && !d.moved && ui.selected) { ui.selected = null; onChange('select'); sim.draw(); }
      if (d.kind === 'item' && d.moved) onChange('moved');
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); view.radius = Math.min(560, Math.max(110, view.radius * Math.exp(e.deltaY * 0.001))); sim.draw(); }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const id = ui.selected; if (!id) return; const p = layout()[id], k = e.shiftKey ? 5 : 1;
      const moves = { ArrowLeft: ['x', -k], ArrowRight: ['x', k], ArrowUp: ['z', -k], ArrowDown: ['z', k] };
      if (moves[e.key]) { e.preventDefault(); p[moves[e.key][0]] += moves[e.key][1]; }
      else if (e.key === 'r' || e.key === 'R') p.rot = ((p.rot || 0) + 90) % 360;
      else if (e.key === 'Escape') { if (ui.big) return; ui.selected = null; onChange('select'); sim.draw(); return; }
      else return;
      sim.draw(); onChange('moved');
    });
    return sim;
  }

  /* ---------- 추가 표시 조각 ---------- */
  const TAG = { real: '<span class="pill sim-real">구현</span>', sample: '<span class="pill sim-sample">샘플</span>' };

  function checksHTML() {
    const c = checks();
    const rows = c.list.length
      ? c.list.map(i => `<li class="${i.level}">${i.id ? `<button type="button" data-select="${i.id}">${D.escape(i.text)}</button>` : D.escape(i.text)}</li>`).join('')
      : '<li class="ok">겹치거나 벗어난 제품이 없습니다</li>';
    return `<div class="sim-row"><strong>배치 점검</strong>${TAG.real}<span class="muted sim-push">남은 책상 면적 ${c.free}%</span></div><ul class="sim-list">${rows}</ul>`;
  }
  function selectionHTML() {
    const id = ui.selected;
    const chips = D.state.products.map(pid => `<button type="button" data-select="${pid}" aria-pressed="${ui.selected === pid}">${D.escape(product(pid).name)}</button>`).join('');
    const info = id && D.state.layout[id]
      ? (() => { const s = spec(id), p = D.state.layout[id], on = stackedOn(id, D.state.layout); return `<span class="muted">${s.w}×${s.d}×${s.h}cm (깊이·높이 ${TAG.sample}) · 위치 ${p.x}, ${p.z}cm · ${p.rot || 0}°${on ? ` · ${D.escape(product(on).name)} 위` : ''}</span>`; })()
      : '<span class="muted">3D 화면에서 제품을 끌어 옮기거나 위에서 고르세요. 선택 후 R 키로 회전합니다. 벽을 클릭하면 벽 도면 창이 열립니다.</span>';
    return `<div class="sim-row"><strong>배치 변화</strong>${TAG.real}<span class="sim-push"></span><button type="button" id="sim-rotate" ${id ? '' : 'disabled'}>90° 회전</button><button type="button" id="sim-auto">책상에 맞게 자동 배치</button></div>
      <div class="sim-chips" aria-label="제품 선택">${chips}</div>${info}`;
  }
  function compareHTML() {
    const b = ui.before; if (!b) return '';
    const now = snapshot(), W = Math.max(b.width, now.width), Dp = Math.max(b.depth, now.depth), pad = 10;
    const rect = (f, cls) => `<rect class="${cls}" x="${f.x0}" y="${f.z0}" width="${f.x1 - f.x0}" height="${f.z1 - f.z0}" rx="1.5"/>`;
    const desk = (w, d, cls) => `<rect class="${cls}" x="${-w / 2}" y="${-d / 2}" width="${w}" height="${d}" rx="2"/>`;
    let svg = desk(b.width, b.depth, 'desk-before') + desk(now.width, now.depth, 'desk-after');
    const changes = [], bad = checks().bad;
    if (b.width !== now.width || b.depth !== now.depth) changes.push(`책상 ${b.width}×${b.depth} → ${now.width}×${now.depth}cm`);
    const bw = JSON.parse(b.walls || '{}'), nw = JSON.parse(now.walls || '{}');
    Object.keys(WALLS).forEach(k => { if (JSON.stringify(bw[k] || null) !== JSON.stringify(nw[k] || null)) changes.push(`${WALLS[k]}: ${nw[k] ? '도면 변경' : '직선 벽으로 되돌림'}`); });
    [...new Set([...b.products, ...now.products])].forEach(id => {
      const name = product(id).name, was = b.layout[id], is = now.products.includes(id) ? now.layout[id] : null;
      if (was && b.products.includes(id)) svg += rect(footprint(id, was), 'item-before');
      if (is) svg += rect(footprint(id, is), 'item-after' + (bad.has(id) ? ' bad' : ''));
      if (was && is && b.products.includes(id)) {
        const dx = is.x - was.x, dz = is.z - was.z, dr = (is.rot || 0) !== (was.rot || 0), parts = [];
        if (Math.abs(dx) + Math.abs(dz) >= 1) svg += `<line class="move" x1="${was.x}" y1="${was.z}" x2="${is.x}" y2="${is.z}"/>`;
        if (dx) parts.push(`${dx > 0 ? '오른쪽' : '왼쪽'} ${Math.abs(dx)}cm`);
        if (dz) parts.push(`${dz > 0 ? '앞으로' : '뒤로'} ${Math.abs(dz)}cm`);
        if (dr) parts.push(`${is.rot || 0}° 회전`);
        if (parts.length) changes.push(`${name}: ${parts.join(', ')}`);
      } else if (is) changes.push(`${name}: 새로 추가`);
      else if (b.products.includes(id)) changes.push(`${name}: 구성에서 빠짐`);
    });
    return `<div class="sim-row"><strong>변경 전 · 후</strong>${TAG.real}<span class="sim-push"></span><button type="button" id="sim-baseline">지금 배치를 '변경 전'으로</button></div>
      <div class="sim-compare"><svg viewBox="${-W / 2 - pad} ${-Dp / 2 - pad} ${W + pad * 2} ${Dp + pad * 2}" role="img" aria-label="위에서 본 배치 변경 전후 비교">${svg}</svg>
      <ul class="sim-list plain">${changes.length ? changes.map(t => `<li>${D.escape(t)}</li>`).join('') : '<li class="muted">아직 바뀐 점이 없습니다</li>'}</ul></div>`;
  }

  /* ---------- 벽 도면 창 [구현] ---------- */
  const snap = v => Math.round(v / 5) * 5;
  function editorBounds(key) {
    const W = D.state.width, Dp = D.state.depth;
    const pts = [{ x: -W / 2, z: -Dp / 2 }, { x: W / 2, z: Dp / 2 }, ...Object.keys(WALLS).flatMap(k => tessellate(wallPath(k)))];
    let x0 = Math.min(...pts.map(q => q.x)) - 30, x1 = Math.max(...pts.map(q => q.x)) + 30, z0 = Math.min(...pts.map(q => q.z)) - 30, z1 = Math.max(...pts.map(q => q.z)) + 30;
    if (x1 - x0 < 240) { const m = (x0 + x1) / 2; x0 = m - 120; x1 = m + 120; }
    if (z1 - z0 < 180) { const m = (z0 + z1) / 2; z0 = m - 90; z1 = m + 90; }
    // 도면 칸(4:3)에 꽉 차도록 비율을 맞춥니다.
    let w = x1 - x0, h = z1 - z0;
    if (w / h < 4 / 3) { const nw = h * 4 / 3; x0 -= (nw - w) / 2; w = nw; } else { const nh = w * 3 / 4; z0 -= (nh - h) / 2; h = nh; }
    return { x: x0, z: z0, w, h };
  }
  function pathD(path) {
    if (!path || !path.start) return '';
    return `M${path.start.x} ${path.start.z}` + path.segs.map(sg => sg.type === 'curve' ? ` Q${sg.c.x} ${sg.c.z} ${sg.to.x} ${sg.to.z}` : ` L${sg.to.x} ${sg.to.z}`).join('');
  }
  function editorSVG(key, vb, preview) {
    const R = room(), W = D.state.width, Dp = D.state.depth, path = wallPath(key), r = vb.w / 70, fs = vb.w / 30;
    let g = '';
    for (let x = Math.ceil(vb.x / 10) * 10; x <= vb.x + vb.w; x += 10) g += `<line x1="${x}" y1="${vb.z}" x2="${x}" y2="${vb.z + vb.h}" class="${x % 50 ? 'g1' : 'g2'}"/>`;
    for (let z = Math.ceil(vb.z / 10) * 10; z <= vb.z + vb.h; z += 10) g += `<line x1="${vb.x}" y1="${z}" x2="${vb.x + vb.w}" y2="${z}" class="${z % 50 ? 'g1' : 'g2'}"/>`;
    let o = `<rect x="${vb.x}" y="${vb.z}" width="${vb.w}" height="${vb.h}" class="bg"/>${g}`;
    o += `<rect x="${-W / 2}" y="${-Dp / 2}" width="${W}" height="${Dp}" class="desk"/><text x="0" y="0" class="desk-t" font-size="${fs}">책상</text>`;
    Object.keys(WALLS).filter(k => k !== key && R[WALL_FLAG[k]]).forEach(k => { o += `<path d="${pathD(wallPath(k))}" class="other"/>`; });
    o += `<path d="${pathD(path)}" class="cur"/>`;
    if (path.start) {
      let a = path.start;
      path.segs.forEach((sg, i) => {
        if (sg.type === 'line') { const len = Math.round(Math.hypot(sg.to.x - a.x, sg.to.z - a.z)); if (len >= 20) o += `<text x="${(a.x + sg.to.x) / 2}" y="${(a.z + sg.to.z) / 2}" class="len" font-size="${fs * 0.85}">${len}</text>`; }
        else o += `<path d="M${a.x} ${a.z} L${sg.c.x} ${sg.c.z} L${sg.to.x} ${sg.to.z}" class="arm"/><rect x="${sg.c.x - r}" y="${sg.c.z - r}" width="${r * 2}" height="${r * 2}" transform="rotate(45 ${sg.c.x} ${sg.c.z})" class="ctl" data-h="c:${i}"/>`;
        a = sg.to;
      });
      [path.start, ...path.segs.map(sg => sg.to)].forEach((q, i) => { o += `<circle cx="${q.x}" cy="${q.z}" r="${r}" class="${i ? 'pt' : 'pt start'}" data-h="p:${i}"/>`; });
    }
    if (preview) o += `<path d="${preview}" class="pre"/>`;
    return o;
  }
  function editorHTML() {
    const key = ui.wallEdit, path = wallPath(key), pos = ui.wePos ? `left:${ui.wePos.x}px;top:${ui.wePos.y}px;right:auto` : '';
    const hint = !path.start ? '벽이 시작할 점을 도면에서 클릭하세요.'
      : `클릭하면 끝점에서 <b>${ui.wallTool === 'line' ? '직선' : '곡선'}</b>이 이어집니다. ● 점과 ◆ 곡선 손잡이는 끌어 옮길 수 있습니다. 5cm 단위로 맞춰지고, 직선은 수평·수직에 가까우면 반듯하게 붙습니다.`;
    return `<div class="sim-we" role="dialog" aria-label="${WALLS[key]} 도면 그리기" style="${pos}">
      <div class="sim-we-head" data-we="move"><strong>${WALLS[key]} 도면</strong>${TAG.real}<span class="muted">위에서 본 모습</span><button type="button" data-we="close" aria-label="도면 창 닫기">✕</button></div>
      <div class="sim-we-tools"><span role="group" aria-label="그리기 도구"><button type="button" data-tool="line" aria-pressed="${ui.wallTool === 'line'}">╱ 직선</button><button type="button" data-tool="curve" aria-pressed="${ui.wallTool === 'curve'}">◠ 곡선</button></span><span class="sim-push"></span><button type="button" data-we="undo">되돌리기</button><button type="button" data-we="clear">새로 그리기</button><button type="button" data-we="straight">기본 직선 벽</button></div>
      <svg class="sim-we-svg" role="img" aria-label="${WALLS[key]} 도면 편집 영역"></svg>
      <p class="sim-we-hint">${hint}</p></div>`;
  }

  /* ---------- 크게 보기 [구현] ----------
   * 3D 화면만 브라우저 창 크기로 띄웁니다. '원래 화면으로' 버튼, Esc, 바깥 어두운 곳 클릭으로 돌아옵니다.
   * 같은 캔버스를 그대로 키우므로 시점·선택·벽 도면 창이 유지됩니다. */
  let bigHooked = false;
  function setBig(on) {
    const vp = document.querySelector('.sim-viewport'); if (!vp) { ui.big = false; document.documentElement.classList.remove('sim-lock'); return; }
    ui.big = on;
    vp.classList.toggle('big', on);
    document.documentElement.classList.toggle('sim-lock', on);
    if (on) { vp.setAttribute('role', 'dialog'); vp.setAttribute('aria-modal', 'true'); vp.setAttribute('aria-label', '3D 배치 크게 보기'); }
    else { vp.removeAttribute('role'); vp.removeAttribute('aria-modal'); vp.removeAttribute('aria-label'); }
    const btn = vp.querySelector('.sim-big-btn');
    if (btn) { btn.innerHTML = on ? '↙ 원래 화면으로 <kbd>Esc</kbd>' : '⤢ 크게 보기'; btn.setAttribute('aria-pressed', on); }
    vp.querySelector(on ? '.sim-canvas' : '.sim-big-btn')?.focus({ preventScroll: true });
  }
  function hookBig() {
    if (bigHooked) return; bigHooked = true;
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !ui.big) return;
      if (e.target.closest && e.target.closest('.sim-we')) return; // 벽 도면 창 안에서는 창부터 닫습니다
      e.preventDefault(); e.stopPropagation(); setBig(false);
    }, true);
    // 다른 메뉴로 이동하면 크게 보기를 끕니다
    window.addEventListener('hashchange', () => { ui.big = false; document.documentElement.classList.remove('sim-lock'); });
  }

  function injectStyle() {
    if (document.getElementById('sim-style')) return;
    const el = document.createElement('style'); el.id = 'sim-style';
    el.textContent = `
.studio-canvas .sim-viewport{position:relative;width:100%;max-width:100%;margin-inline:auto;aspect-ratio:700/490;min-height:220px;border-radius:inherit}
.studio-canvas .sim-canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none;outline:none;border-radius:inherit}
.sim-big-btn{position:absolute;top:10px;right:10px;z-index:4;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;padding:6px 10px;border-radius:8px;border:1px solid rgba(27,42,65,.18);background:rgba(255,255,255,.92);color:#1b2a41;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.sim-big-btn:hover{background:#fff;border-color:#e07a2f}.sim-big-btn kbd{font:inherit;font-size:11px;padding:0 5px;border-radius:4px;background:#eef0f3;border:1px solid #d6dbe1}
.sim-big-info{display:none}
.sim-backdrop{display:none}
html.sim-lock,html.sim-lock body{overflow:hidden}
html.sim-lock .sim-backdrop{display:block;position:fixed;inset:0;background:rgba(27,42,65,.55);z-index:999}
.studio-canvas .sim-viewport.big{position:fixed;inset:24px;width:auto;height:auto;max-width:none;aspect-ratio:auto;z-index:1000;background:radial-gradient(ellipse at 50% 35%,#4b5565 0%,#323a47 70%,#29303b 100%);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden}
.sim-viewport.big .sim-big-btn{top:14px;right:14px;font-size:13.5px;padding:8px 12px;background:#fff;color:#1b2a41;border-color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.sim-viewport.big .sim-big-info{display:flex;flex-wrap:wrap;gap:6px 14px;position:absolute;left:14px;bottom:12px;right:14px;z-index:3;font-size:12.5px;color:#34404b;pointer-events:none}
.sim-viewport.big .sim-big-info span{background:rgba(255,255,255,.88);padding:4px 9px;border-radius:8px}
.sim-viewport.big .sim-we{top:60px}
@media (max-width:640px){.studio-canvas .sim-viewport.big{inset:8px}}
.sim-we{position:absolute;top:40px;right:14px;z-index:5;width:min(360px,calc(100% - 28px));max-height:calc(100% - 54px);overflow:auto;background:#fff;border-radius:12px;box-shadow:0 8px 28px rgba(27,42,65,.22);padding:10px 12px;font-size:12.5px;display:grid;gap:8px}
.sim-we-head{display:flex;align-items:center;gap:6px;cursor:move;user-select:none}.sim-we-head button{margin-left:auto;cursor:pointer}
.sim-we-tools{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.sim-we-tools button{font-size:12px}
.sim-we-tools [aria-pressed="true"]{background:#1b2a41;color:#fff;border-color:#1b2a41}
.sim-we-svg{width:100%;aspect-ratio:4/3;display:block;border-radius:8px;touch-action:none;cursor:crosshair}
.sim-we-svg .bg{fill:#fbfaf6}.sim-we-svg .g1{stroke:#efe9de;stroke-width:1;vector-effect:non-scaling-stroke}.sim-we-svg .g2{stroke:#ddd5c6;stroke-width:1;vector-effect:non-scaling-stroke}
.sim-we-svg .desk{fill:rgba(213,178,138,.25);stroke:#af8b65;stroke-dasharray:4 3;stroke-width:1;vector-effect:non-scaling-stroke}
.sim-we-svg .desk-t{fill:#8a6a4a;text-anchor:middle;dominant-baseline:middle}
.sim-we-svg .other{fill:none;stroke:#9aa0a8;stroke-width:3;vector-effect:non-scaling-stroke;stroke-linejoin:round}
.sim-we-svg .cur{fill:none;stroke:#e07a2f;stroke-width:4;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.sim-we-svg .pre{fill:none;stroke:#e07a2f;stroke-width:2;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;opacity:.8}
.sim-we-svg .arm{fill:none;stroke:#e07a2f;stroke-width:1;stroke-dasharray:3 3;vector-effect:non-scaling-stroke;opacity:.6}
.sim-we-svg .pt{fill:#fff;stroke:#e07a2f;stroke-width:2;vector-effect:non-scaling-stroke;cursor:move}.sim-we-svg .pt.start{fill:#1b2a41;stroke:#1b2a41}
.sim-we-svg .ctl{fill:#e07a2f;cursor:move}
.sim-we-svg .len{fill:#4a5363;text-anchor:middle;dominant-baseline:middle;paint-order:stroke;stroke:#fbfaf6;stroke-width:3px;vector-effect:non-scaling-stroke}
.sim-we-hint{margin:0;color:#5f6672;line-height:1.5}
.studio-canvas .sim-canvas:active{cursor:grabbing}.studio-canvas .sim-canvas:focus-visible{box-shadow:inset 0 0 0 3px #e07a2f}
.pill.sim-real{background:#dff1ec;color:#17705f}.pill.sim-sample{background:#fdebd9;color:#a8541b}
.sim-flow{display:flex;flex-wrap:wrap;gap:6px;align-items:center;box-sizing: border-box;font-size:12.5px;margin:4px 0 12px;padding:6px 18px 0;}
.sim-flow span[aria-current]{font-weight:700}
.sim-block{margin-top:12px;padding:12px 18px;border-top:1px solid rgba(0,0,0,.08);display:grid;gap:8px;font-size:13px}
.sim-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}.sim-push{margin-left:auto}
.sim-list{list-style:none;margin:0;padding:0;display:grid;gap:4px}
.sim-list li button{all:unset;cursor:pointer}.sim-list:not(.plain) li::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:middle}
.sim-list li.bad::before{background:#e0483e}.sim-list li.warn::before{background:#e8a23a}.sim-list li.info::before{background:#8b95a3}.sim-list li.ok::before{background:#2a9d7f}
.sim-chips{display:flex;flex-wrap:wrap;gap:6px}
.sim-compare{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:12px;align-items:start}
.sim-compare svg{width:100%;background:rgba(0,0,0,.025);border-radius:8px}
.sim-compare .desk-before{fill:none;stroke:#9aa0a8;stroke-width:.8;stroke-dasharray:3 2}.sim-compare .desk-after{fill:rgba(213,178,138,.2);stroke:#af8b65;stroke-width:.8}
.sim-compare .item-before{fill:rgba(154,160,168,.15);stroke:#9aa0a8;stroke-width:.6;stroke-dasharray:2 1.5}
.sim-compare .item-after{fill:rgba(31,138,138,.5);stroke:#1f8a8a;stroke-width:.6}.sim-compare .item-after.bad{fill:rgba(224,72,62,.5);stroke:#e0483e}
.sim-compare .move{stroke:#e07a2f;stroke-width:.8;stroke-dasharray:2 1.2}
.studio-config .sim-walls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.studio-config .sim-walls label{display:inline-flex;gap:4px;align-items:center;font-size:13px}
@media (max-width:640px){.sim-compare{grid-template-columns:1fr}}`;
    document.head.appendChild(el);
  }

  /* ---------- 화면 ---------- */
  D.features.studio = {
    title: '내 데스크 스튜디오',
    mount(root) {
      injectStyle();
      const state = D.state, R = room(); layout();
      if (!ui.before) ui.before = snapshot();
      if (ui.selected && !state.products.includes(ui.selected)) ui.selected = null;
      const step = photos.desk ? (JSON.stringify(snapshot().layout) !== JSON.stringify(ui.before.layout) || state.width !== ui.before.width || state.depth !== ui.before.depth ? 3 : 2) : 1;
      const flow = ['사진 입력', '벽면·책상 조건', '배치 변화'].map((n, i) => `<span ${step === i + 1 ? 'aria-current="step"' : ''}>${i + 1}. ${n}</span>`).join('<span class="muted">→</span>');
      const wallOpt = (k, l) => `<label><input type="checkbox" name="${k}" ${R[k] ? 'checked' : ''}> ${l}</label>`;

      // 기존 화면 구조 유지 · 바뀐 곳: 캔버스 내용, 라벨 문구, 크기 폼 항목 추가, 패널 아래 점검/변화 영역, 사진 영역 추정 버튼
      root.innerHTML = D.heading('YOUR SPACE, YOUR WAY', '나다운 공간을 만들어보세요', '책상을 꾸미고, 대화로 다듬고, 나에게 맞는 구성을 찾아보세요.', `<a class="btn" href="#presets">${D.icon('grid')} 프리셋 불러오기</a><button class="primary" id="save-layout">${D.icon('save')} 구성 저장</button>`) + `
      <div class="studio-grid"><div class="studio-main">
        <section class="panel" aria-label="책상 배치 미리보기"><div class="panel-heading"><h2>${D.escape(state.name)}</h2><div class="studio-tools"><span class="pill purple">3D 배치</span><button id="reset-layout">초기화</button></div></div>
          <div class="sim-flow" aria-label="진행 단계">${flow}<span class="sim-push">${TAG.real} 실제 계산 ${TAG.sample} 시연용 가정</span></div>
          <div class="studio-canvas"><span class="studio-canvas-label">${D.icon('cube').replace('class="icon"', 'class="icon" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px"')} 3D 미리보기 · 실측 비율 (구현) · 제품 모양 단순화 (샘플)</span><div class="sim-viewport"><canvas class="sim-canvas" tabindex="0" aria-label="책상과 제품 3D 배치 화면. 제품을 끌어 옮기고 빈 곳을 끌어 시점을 돌립니다. 제품을 고른 뒤 방향키로 이동, R 키로 회전합니다. 벽을 클릭하면 벽 도면 창이 열립니다."></canvas>${ui.wallEdit ? editorHTML() : ''}<button type="button" class="sim-big-btn" aria-pressed="false">⤢ 크게 보기</button><div class="sim-big-info"><span>책상 ${state.width} × ${state.depth} × ${R.height} cm</span><span>빈 곳 드래그: 시점 회전 · 휠: 확대</span><span>제품 드래그: 이동 · R: 회전</span><span>벽 클릭: 벽 도면</span></div></div><div class="sim-backdrop" aria-hidden="true"></div><div class="studio-canvas-bottom"><span class="studio-dim">책상 ${state.width} × ${state.depth} × ${R.height} cm</span><div class="studio-style-switch" aria-label="스타일 선택">${[['warm', '내추럴'], ['minimal', '미니멀'], ['creative', '크리에이티브']].map(([key, label]) => `<button data-style="${key}" aria-pressed="${state.style === key}">${label}</button>`).join('')}</div></div></div>
          <form class="studio-config" id="dimensions"><label>책상 너비 (cm)<input type="number" name="width" value="${state.width}" min="80" max="240" required></label><label>책상 깊이 (cm)<input type="number" name="depth" value="${state.depth}" min="40" max="120" required></label><label>책상 높이 (cm)<input type="number" name="height" value="${R.height}" min="60" max="110" required></label><label>책상~뒷벽 (cm)<input type="number" name="backGap" value="${R.backGap}" min="0" max="80" required></label><label>책상~옆벽 (cm)<input type="number" name="sideGap" value="${R.sideGap}" min="0" max="100" required></label><label>창문<select name="window">${[['none', '없음'], ['back', '뒷벽'], ['left', '왼쪽 벽'], ['right', '오른쪽 벽']].map(([k, l]) => `<option value="${k}" ${R.window === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="sim-walls">${wallOpt('backWall', '뒷벽')}${wallOpt('leftWall', '왼쪽 벽')}${wallOpt('rightWall', '오른쪽 벽')}</div><button type="submit">조건 적용</button><span class="muted">${ui.estimated ? '사진 추정 예시값이 들어가 있습니다 (샘플)<br>실제로 잰 값으로 고쳐 주세요' : '입력값이 3D에 실측 비율로 반영됩니다 (구현)<br>제품 깊이·높이는 가정값 (샘플)'}${Object.keys(R.paths).length ? '<br>도면을 그린 벽은 거리 입력값 대신 도면을 따릅니다' : ''}</span></form>
          <div class="sim-block" id="sim-checks">${checksHTML()}</div>
          <div class="sim-block" id="sim-selection">${selectionHTML()}</div>
          <div class="sim-block" id="sim-compare">${compareHTML()}</div>
        </section>
        <section class="panel"><div class="panel-heading"><h2>이 공간을 채운 제품 <span class="muted">${state.products.length}</span></h2><a class="muted" href="#products">전체 보기 ↗</a></div><div class="studio-products">${state.products.map(id => { const p = D.products.find(item => item.id === id); return `<article class="studio-item">${D.productArt(p)}<div><strong>${p.name}</strong><small>${D.money(p.price)}</small><a href="#products"> 제품 살펴보기</a></div></article>`; }).join('')}</div></section>
      </div><section class="panel assistant-panel" id="assistant" aria-label="AI 공간 어시스턴트"></section></div>
      <section class="panel studio-upload"><div><label for="desk-photo">${D.icon('photo').replace('class="icon"', 'class="icon" style="display:inline;vertical-align:middle;margin-right:5px"')} 내 책상 사진<input id="desk-photo" type="file" accept="image/png,image/jpeg,image/webp" data-photo="desk"></label><p>PNG·JPG·WebP, 5MB 이하 · 이 탭에서만 미리 봅니다. (미리보기 구현)</p><div id="preview-desk">${photos.desk ? `<img class="studio-preview" src="${photos.desk}" alt="선택한 책상 사진">` : ''}</div><button type="button" id="sim-estimate" ${photos.desk ? '' : 'disabled'}>사진으로 책상 크기 추정 (샘플)</button></div><div><label for="style-photo">원하는 스타일 사진<input id="style-photo" type="file" accept="image/png,image/jpeg,image/webp" data-photo="style"></label><p>사진 분석·3D 변환은 이후 담당자가 연결할 영역입니다.</p><div id="preview-style">${photos.style ? `<img class="studio-preview" src="${photos.style}" alt="선택한 스타일 사진">` : ''}</div></div></section>`;

      D.assistant.mount(root.querySelector('#assistant'));

      /* 3D 화면 · 부분 갱신 (드래그 중 화면 전체를 다시 그리지 않음) */
      const $ = sel => root.querySelector(sel);
      const refresh = reason => {
        sim.draw();
        $('#sim-checks').innerHTML = checksHTML();
        if (reason !== 'move') $('#sim-compare').innerHTML = compareHTML();
        if (reason !== 'move') $('#sim-selection').innerHTML = selectionHTML();
      };
      const canvas = $('.sim-canvas');
      const sim = createSim(canvas, refresh, key => { ui.wallEdit = key; D.render(); });
      if (observer) observer.disconnect();
      observer = new ResizeObserver(() => sim.resize()); observer.observe(canvas);
      sim.resize();

      /* 크게 보기 버튼 [구현] */
      const vp = $('.sim-viewport');
      hookBig();
      vp.querySelector('.sim-big-btn').addEventListener('click', () => setBig(!ui.big));
      $('.sim-backdrop').addEventListener('click', () => setBig(false));
      if (ui.big) setBig(true); // 벽 도면 창을 열고 닫으며 화면을 다시 그려도 큰 창 유지
      else document.documentElement.classList.remove('sim-lock');

      /* 벽 도면 창: 벽을 클릭하면 열림. 직선·곡선으로 벽 코너를 만듭니다 [구현] */
      const we = $('.sim-we');
      if (we) {
        const key = ui.wallEdit, svg = we.querySelector('.sim-we-svg');
        let vb = editorBounds(key), drag = null, down = null;
        const own = () => { const R = room(); if (!R.paths[key]) R.paths[key] = JSON.parse(JSON.stringify(defaultPath(key))); return R.paths[key]; };
        const toPt = e => { const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; const m = q.matrixTransform(svg.getScreenCTM().inverse()); return { x: snap(m.x), z: snap(m.y) }; };
        // 직선은 수평·수직에서 8° 안쪽이면 딱 맞춰 반듯한 코너를 만들기 쉽게 합니다.
        const straighten = (a, q) => { if (ui.wallTool !== 'line') return q; const dx = Math.abs(q.x - a.x), dz = Math.abs(q.z - a.z); if (dz < dx * 0.14) return { x: q.x, z: a.z }; if (dx < dz * 0.14) return { x: a.x, z: q.z }; return q; };
        const curveCtl = (a, b) => ({ x: snap((a.x + b.x) / 2 - (b.z - a.z) * 0.3), z: snap((a.z + b.z) / 2 + (b.x - a.x) * 0.3) });
        const draw = preview => { svg.setAttribute('viewBox', `${vb.x} ${vb.z} ${vb.w} ${vb.h}`); svg.innerHTML = editorSVG(key, vb, preview); };
        const hint = () => { we.querySelector('.sim-we-hint').innerHTML = !wallPath(key).start ? '벽이 시작할 점을 도면에서 클릭하세요.' : `클릭하면 끝점에서 <b>${ui.wallTool === 'line' ? '직선' : '곡선'}</b>이 이어집니다. ● 점과 ◆ 곡선 손잡이는 끌어 옮길 수 있습니다. 5cm 단위로 맞춰지고, 직선은 수평·수직에 가까우면 반듯하게 붙습니다.`; };
        const changed = final => { sim.draw(); refresh(final ? 'moved' : 'move'); if (final) { vb = editorBounds(key); } draw(); hint(); };
        draw();
        svg.addEventListener('pointerdown', e => {
          svg.setPointerCapture(e.pointerId);
          const h = e.target.closest('[data-h]');
          if (h) { const [kind, i] = h.dataset.h.split(':'); drag = { kind, i: Number(i) }; own(); }
          else down = { x: e.clientX, y: e.clientY };
        });
        svg.addEventListener('pointermove', e => {
          const q = toPt(e);
          if (drag) {
            const path = own();
            if (drag.kind === 'c') path.segs[drag.i].c = q;
            else if (drag.i === 0) path.start = q; else path.segs[drag.i - 1].to = q;
            changed(false); return;
          }
          const path = wallPath(key); if (!path.start) return;
          const a = path.segs.length ? path.segs[path.segs.length - 1].to : path.start;
          const q2 = straighten(a, q); q.x = q2.x; q.z = q2.z;
          if (q.x === a.x && q.z === a.z) { draw(); return; }
          const c = curveCtl(a, q);
          draw(ui.wallTool === 'line' ? `M${a.x} ${a.z} L${q.x} ${q.z}` : `M${a.x} ${a.z} Q${c.x} ${c.z} ${q.x} ${q.z}`);
        });
        svg.addEventListener('pointerleave', () => { if (!drag) draw(); });
        svg.addEventListener('pointerup', e => {
          if (drag) { drag = null; changed(true); return; }
          if (!down || Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5) { down = null; return; }
          down = null;
          const q = toPt(e), path = own();
          if (!path.start) path.start = q;
          else {
            const a = path.segs.length ? path.segs[path.segs.length - 1].to : path.start;
            const q2 = straighten(a, q); q.x = q2.x; q.z = q2.z;
            if (q.x === a.x && q.z === a.z) return;
            path.segs.push(ui.wallTool === 'line' ? { type: 'line', to: q } : { type: 'curve', c: curveCtl(a, q), to: q });
          }
          changed(true);
        });
        we.addEventListener('click', e => {
          const t = e.target.closest('button'); if (!t) return;
          if (t.dataset.tool) { ui.wallTool = t.dataset.tool; we.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', b === t)); hint(); return; }
          const R = room();
          if (t.dataset.we === 'close') { ui.wallEdit = null; D.render(); return; }
          if (t.dataset.we === 'undo') { const path = own(); if (path.segs.length) path.segs.pop(); else path.start = null; }
          if (t.dataset.we === 'clear') { R.paths[key] = { start: null, segs: [] }; D.toast(`${WALLS[key]}을 지웠습니다. 시작점을 클릭해 새로 그리세요.`); }
          if (t.dataset.we === 'straight') { delete R.paths[key]; D.toast(`${WALLS[key]}을 기본 직선 벽으로 되돌렸습니다.`); }
          changed(true);
        });
        we.addEventListener('keydown', e => { if (e.key === 'Escape') { ui.wallEdit = null; D.render(); } });
        // 제목줄을 끌어 창 옮기기
        const head = we.querySelector('.sim-we-head');
        head.addEventListener('pointerdown', e => {
          if (e.target.closest('button')) return;
          head.setPointerCapture(e.pointerId);
          const vr = vp.getBoundingClientRect(), wr = we.getBoundingClientRect(), off = { x: e.clientX - wr.left, y: e.clientY - wr.top };
          const move = ev => { ui.wePos = { x: Math.round(Math.min(vr.width - 60, Math.max(-wr.width + 60, ev.clientX - vr.left - off.x))), y: Math.round(Math.min(vr.height - 30, Math.max(0, ev.clientY - vr.top - off.y))) }; Object.assign(we.style, { left: `${ui.wePos.x}px`, top: `${ui.wePos.y}px`, right: 'auto' }); };
          const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); };
          head.addEventListener('pointermove', move); head.addEventListener('pointerup', up);
        });
      }

      /* 기존 동작 */
      root.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => { D.state.style = button.dataset.style; D.render(); }));
      $('#dimensions').addEventListener('submit', event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget), r = room(), num = (k, min, max) => Math.min(max, Math.max(min, Math.round(Number(form.get(k)))));
        D.state.width = num('width', 80, 240); D.state.depth = num('depth', 40, 120);
        r.height = num('height', 60, 110); r.backGap = num('backGap', 0, 80); r.sideGap = num('sideGap', 0, 100);
        r.window = form.get('window'); r.backWall = form.has('backWall'); r.leftWall = form.has('leftWall'); r.rightWall = form.has('rightWall');
        ui.estimated = false; ui.ownChange = true; view.radius = 0;
        D.render();
        const n = checks().bad.size;
        D.toast(n ? `조건을 반영했습니다. 맞지 않는 제품 ${n}개를 확인하세요.` : '조건을 반영했습니다. 모든 제품이 책상 안에 있습니다.');
      });
      $('#save-layout').addEventListener('click', () => {
        const saved = { id: `saved-${Date.now()}`, name: `저장한 구성 ${D.presets.filter(p => p.id.startsWith('saved')).length + 1}`, style: D.state.style, width: D.state.width, depth: D.state.depth, products: [...D.state.products], room: JSON.parse(JSON.stringify(room())), layout: copyLayout(), label: 'MY PRESET', description: '현재 브라우저 탭에서 저장한 구성' };
        D.presets.push(saved); D.toast('프리셋에 저장했습니다. 새로고침하면 초기화됩니다.');
      });
      $('#reset-layout').addEventListener('click', () => {
        Object.assign(D.state, { name: '나의 첫 번째 데스크', style: 'warm', width: 140, depth: 70, products: ['monitor', 'lamp', 'keyboard'] });
        delete D.state.room; delete D.state.layout; Object.assign(ui, { selected: null, before: null, estimated: false, wallEdit: null, wePos: null }); view.radius = 0; D.render();
      });
      root.querySelectorAll('[data-photo]').forEach(input => input.addEventListener('change', () => {
        const file = input.files[0]; if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { input.value = ''; D.toast('5MB 이하의 PNG, JPG, WebP 이미지를 선택해 주세요.'); return; }
        const key = input.dataset.photo, url = URL.createObjectURL(file), img = new Image();
        img.onload = () => { if (photos[key]) URL.revokeObjectURL(photos[key]); photos[key] = url; D.render(); if (key === 'desk') D.toast('사진을 불러왔습니다. 위 크기 입력에 실제 책상 치수를 넣어 주세요.'); };
        img.onerror = () => { URL.revokeObjectURL(url); input.value = ''; D.toast('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.'); };
        img.src = url;
      }));

      /* 추가 동작 (이벤트 위임: 부분 갱신된 버튼도 동작) */
      $('.studio-main').addEventListener('click', e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.select) { ui.selected = t.dataset.select; refresh('select'); canvas.focus({ preventScroll: true }); return; }
        if (t.id === 'sim-rotate' && ui.selected) { const p = layout()[ui.selected]; p.rot = ((p.rot || 0) + 90) % 360; refresh('moved'); }
        if (t.id === 'sim-auto') { autoArrange(); refresh('moved'); D.toast('정해 둔 규칙으로 다시 배치했습니다. 변경 전·후에서 확인하세요.'); }
        if (t.id === 'sim-baseline') { ui.before = snapshot(); refresh('moved'); D.toast("지금 배치를 '변경 전'으로 잡았습니다."); }
      });
      $('#sim-estimate').addEventListener('click', () => {
        D.state.width = 120; D.state.depth = 60; ui.estimated = true; ui.ownChange = true; view.radius = 0;
        D.render(); D.toast('예시 값(120×60cm)을 넣었습니다. 실제 사진 분석은 연결되지 않았습니다.');
      });
    }
  };
})(window.Deskspace);
