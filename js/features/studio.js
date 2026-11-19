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
  const ui = { selected: null, before: null, estimated: false, measured: null, ownChange: false, big: false, wallEdit: null, wallTool: 'line', wePos: null };
  // 카메라: target(바라보는 점) + 방향(theta·phi) + 거리(radius). target이 null이면 책상 가운데를 봅니다.
  const view = { theta: 0, phi: 0.24, radius: 0, target: null };
  const resetView = () => Object.assign(view, { theta: 0, phi: 0.24, radius: 0, target: null });
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
      if (!view.radius) { view.radius = Math.max(D.state.width, D.state.depth * 1.6) * 0.84; view.target = null; } // 처음 시점: 정면에서 살짝 내려다보며 책상이 화면을 넓게 채우도록 (책상 140cm → 거리 약 118cm) // 처음 시점: 정면에서 살짝 내려다보며 책상이 화면 가운데 아래쪽을 채우도록
      const T = view.target || v3(0, H + 24, 0), cp = Math.cos(view.phi);
      const E = add(T, mul(v3(cp * Math.sin(view.theta), Math.sin(view.phi), cp * Math.cos(view.theta)), view.radius));
      const f = norm(sub(T, E)), right = norm(cross(f, v3(0, 1, 0)));
      sim.focal = sim.h / (2 * Math.tan(0.42));
      return { E, f, right, up: cross(right, f) };
    }
    function project(P) {
      const c = sim.cam, v = sub(P, c.E), z = dot(v, c.f);
      return z < NEAR - 0.01 ? null : { x: sim.w / 2 + dot(v, c.right) * sim.focal / z, y: sim.h / 2 - dot(v, c.up) * sim.focal / z };
    }
    const ray = (sx, sy) => { const c = sim.cam; return norm(add(c.f, add(mul(c.right, (sx - sim.w / 2) / sim.focal), mul(c.up, (sim.h / 2 - sy) / sim.focal)))); };
    const hitY = (sx, sy, y) => { const d = ray(sx, sy), E = sim.cam.E; if (Math.abs(d.y) < 1e-6) return null; const t = (y - E.y) / d.y; return t > 0 ? add(E, mul(d, t)) : null; };

    // 카메라 바로 앞(NEAR)에서 면을 잘라 그립니다. 카메라가 방 안으로 들어가도 바닥·벽이 사라지지 않게.
    const NEAR = 3;
    function clipNear(pts) {
      const c = sim.cam, z = pts.map(P => dot(sub(P, c.E), c.f));
      if (z.every(v => v >= NEAR)) return pts;
      if (z.every(v => v < NEAR)) return null;
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length, A = pts[i], B = pts[j], za = z[i], zb = z[j];
        if (za >= NEAR) out.push(A);
        if ((za >= NEAR) !== (zb >= NEAR)) out.push(add(A, mul(sub(B, A), (NEAR - za) / (zb - za))));
      }
      return out.length >= 3 ? out : null;
    }
    function face(pts, fill, layer, id, stroke) {
      const cut = clipNear(pts); if (!cut) return;
      const p2 = cut.map(project); if (p2.some(p => !p)) return;
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
      const theme = themeNow();
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

    /* 조작 (유니티 Scene 뷰 방식) [구현]
     *  좌클릭 드래그(빈 곳·벽) = 카메라 위치 이동(팬)   · 좌클릭 드래그(제품) = 제품 이동
     *  우클릭 드래그          = 그 자리에서 시점 돌리기 · 우클릭 누른 채 W/A/S/D/Q/E = 날아다니기
     *  Alt + 좌클릭 드래그    = 바라보는 점 중심으로 돌기 · 가운데 버튼 드래그 = 카메라 이동
     *  휠 = 앞뒤로 이동 · F = 선택한 제품(없으면 책상) 보기 · 빈 곳 더블클릭 = 시점 처음으로
     *  벽을 클릭(끌지 않음) = 벽 도면 창 · 제품 선택 후 방향키/R = 이동/회전 */
    const pt = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const grabY = id => room().height + baseY(id, layout()) + spec(id).h / 2;
    const offset = () => { const cp = Math.cos(view.phi); return v3(cp * Math.sin(view.theta), Math.sin(view.phi), cp * Math.cos(view.theta)); };
    const target = () => view.target || v3(0, room().height + 24, 0);
    const clampPitch = v => Math.min(1.45, Math.max(-0.35, v));
    const keepAboveFloor = () => { const E = add(target(), mul(offset(), view.radius)); if (E.y < 8) view.target = v3(target().x, target().y + (8 - E.y), target().z); };
    function pan(dx, dy) { // 화면 픽셀만큼 카메라와 바라보는 점을 함께 옮깁니다
      const c = sim.cam; if (!c) return;
      const k = view.radius / sim.focal;
      view.target = add(target(), add(mul(c.right, -dx * k), mul(c.up, dy * k)));
      keepAboveFloor();
    }
    function look(theta, phi) { // 카메라 위치는 그대로, 바라보는 방향만 바꿈
      const E = add(target(), mul(offset(), view.radius));
      view.theta = theta; view.phi = clampPitch(phi);
      view.target = sub(E, mul(offset(), view.radius));
    }
    function fly(dir, dist) { // 카메라를 앞뒤·좌우·위아래로
      const c = sim.cam; if (!c) return;
      const flat = norm(v3(c.f.x, 0, c.f.z)), v = { w: flat, s: mul(flat, -1), d: c.right, a: mul(c.right, -1), e: v3(0, 1, 0), q: v3(0, -1, 0) }[dir];
      if (v) { view.target = add(target(), mul(v, dist)); keepAboveFloor(); }
    }
    function focusOn(id) {
      const L = layout();
      if (id && L[id]) { const s = spec(id), p = L[id]; view.target = v3(p.x, room().height + baseY(id, L) + s.h / 2, p.z); view.radius = Math.max(70, Math.max(s.w, s.h) * 2.4); }
      else { view.target = null; resetView(); }
      keepAboveFloor();
    }

    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      const { x, y } = pt(e);
      canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
      const base = { x, y, lx: x, ly: y, theta: view.theta, phi: view.phi, moved: false };
      if (e.button === 2) { sim.drag = Object.assign(base, { kind: 'look' }); canvas.style.cursor = 'crosshair'; return; }
      if (e.button === 1) { e.preventDefault(); sim.drag = Object.assign(base, { kind: 'pan' }); return; }
      if (e.button !== 0) return;
      if (e.altKey) { sim.drag = Object.assign(base, { kind: 'orbit' }); return; }
      const id = sim.pick(x, y);
      if (id && id.startsWith('wall:')) sim.drag = Object.assign(base, { kind: 'pan', wall: id.slice(5) });
      else if (id) {
        const p = layout()[id], hit = hitY(x, y, grabY(id));
        sim.drag = { kind: 'item', id, y: grabY(id), moved: false, off: hit ? { x: p.x - hit.x, z: p.z - hit.z } : { x: 0, z: 0 } };
        if (ui.selected !== id) { ui.selected = id; onChange('select'); }
      } else sim.drag = Object.assign(base, { kind: 'pan' });
      sim.draw();
    });
    canvas.addEventListener('pointermove', e => {
      const d = sim.drag, { x, y } = pt(e);
      if (!d) { const id = sim.pick(x, y); canvas.style.cursor = id ? (id.startsWith('wall:') ? 'pointer' : 'move') : ''; return; }
      if (d.kind !== 'item') {
        if (Math.abs(x - d.x) + Math.abs(y - d.y) > 3) d.moved = true;
        if (d.kind === 'pan') { canvas.style.cursor = 'move'; pan(x - d.lx, y - d.ly); }
        else if (d.kind === 'look') look(d.theta - (x - d.x) * 0.003, d.phi + (y - d.y) * 0.003); // 오른쪽으로 끌면 오른쪽, 위로 끌면 위를 봄
        else if (d.kind === 'orbit') { view.theta = d.theta - (x - d.x) * 0.008; view.phi = clampPitch(d.phi + (y - d.y) * 0.006); keepAboveFloor(); }
        d.lx = x; d.ly = y; sim.draw(); return;
      }
      const hit = hitY(x, y, d.y); if (!hit) return;
      const p = layout()[d.id], W = D.state.width, Dp = D.state.depth;
      p.x = Math.round(Math.min(W / 2 + 30, Math.max(-W / 2 - 30, hit.x + d.off.x)));
      p.z = Math.round(Math.min(Dp / 2 + 25, Math.max(-Dp / 2 - 25, hit.z + d.off.z)));
      d.moved = true; sim.draw(); onChange('move');
    });
    const end = () => {
      const d = sim.drag; sim.drag = null; canvas.style.cursor = ''; if (!d) return;
      if (d.kind === 'pan' && !d.moved && d.wall) { onWall(d.wall); return; }
      if (d.kind === 'pan' && !d.moved && ui.selected) { ui.selected = null; onChange('select'); sim.draw(); }
      if (d.kind === 'item' && d.moved) onChange('moved');
    };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('dblclick', e => { const { x, y } = pt(e); if (sim.pick(x, y)) return; resetView(); sim.draw(); });
    // 휠: 바라보는 방향으로 앞뒤 이동 (가까이 가면 바라보는 점도 함께 밀려나 계속 들어갈 수 있음)
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const step = Math.max(-80, Math.min(80, e.deltaY)) * view.radius * 0.0012;
      const next = view.radius + step;
      if (next < 60) { const c = sim.cam; if (c) view.target = add(target(), mul(c.f, 60 - next)); view.radius = 60; }
      else view.radius = Math.min(800, next);
      keepAboveFloor(); sim.draw();
    }, { passive: false });
    canvas.addEventListener('keydown', e => {
      const key = e.key.toLowerCase();
      if (sim.drag && sim.drag.kind === 'look' && 'wasdqe'.includes(key) && key.length === 1) { e.preventDefault(); fly(key, e.shiftKey ? 25 : 8); sim.draw(); return; }
      if (key === 'f') { e.preventDefault(); focusOn(ui.selected); sim.draw(); return; }
      const id = ui.selected; if (!id) return; const p = layout()[id], k = e.shiftKey ? 5 : 1;
      const moves = { ArrowLeft: ['x', -k], ArrowRight: ['x', k], ArrowUp: ['z', -k], ArrowDown: ['z', k] };
      if (moves[e.key]) { e.preventDefault(); p[moves[e.key][0]] += moves[e.key][1]; }
      else if (key === 'r') p.rot = ((p.rot || 0) + 90) % 360;
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
  const HINT_DRAW = `빈 곳을 클릭하면 끝점에서 선이 이어집니다. ● 점과 ◆ 곡선 손잡이는 끌어 옮길 수 있습니다. 5cm 단위로 맞춰지고, 직선은 수평·수직에 가까우면 반듯하게 붙습니다. 다른 벽과 겹치면 겹친 벽이 지워집니다.`;
  function editorHTML() {
    const key = ui.wallEdit, R = room(), path = wallPath(key), pos = ui.wePos ? `left:${ui.wePos.x}px;top:${ui.wePos.y}px;right:auto` : '';
    const hint = !path.start ? '벽이 시작할 점을 도면에서 클릭하거나, 아래 숫자 입력으로 바로 추가하세요.' : HINT_DRAW;
    // 벽 목록: 이름을 누르면 그 벽을 편집, ✕로 그 벽만 지우기, 지운 벽은 다시 세우기
    const wallsRow = Object.keys(WALLS).map(k => R[WALL_FLAG[k]]
      ? `<span class="sim-we-chip${k === key ? ' on' : ''}"><button type="button" data-wsel="${k}" aria-pressed="${k === key}">${WALLS[k]}${R.paths[k] ? ' ✎' : ''}</button><button type="button" data-wdel="${k}" aria-label="${WALLS[k]} 지우기" title="${WALLS[k]} 지우기">✕</button></span>`
      : `<button type="button" class="sim-we-add" data-wadd="${k}">+ ${WALLS[k]} 세우기</button>`).join('');
    const dirs = [['0', '→ 오른쪽'], ['90', '↓ 앞쪽'], ['180', '← 왼쪽'], ['270', '↑ 뒤쪽'], ['custom', '각도 입력']];
    return `<div class="sim-we" role="dialog" aria-label="${WALLS[key]} 도면 그리기" style="${pos}">
      <div class="sim-we-head" data-we="move"><strong>${WALLS[key]} 도면</strong>${TAG.real}<span class="muted">위에서 본 모습</span><button type="button" data-we="close" aria-label="도면 창 닫기">✕</button></div>
      <div class="sim-we-walls" role="group" aria-label="벽 목록">${wallsRow}</div>
      <div class="sim-we-tools"><span role="group" aria-label="그리기 도구"><button type="button" data-tool="line" aria-pressed="${ui.wallTool === 'line'}">╱ 직선</button><button type="button" data-tool="curve" aria-pressed="${ui.wallTool === 'curve'}">◠ 곡선</button></span><span class="sim-push"></span><button type="button" data-we="undo" title="내가 그린 마지막 선 지우기 (처음 벽은 지워지지 않음)">되돌리기</button><button type="button" data-we="clear">새로 그리기</button></div>
      <div class="sim-we-tools"><span class="muted">초기화</span><button type="button" data-we="straight" title="이 벽만 처음 직선 벽으로">이 벽</button><button type="button" data-we="resetall" title="세 벽 모두 처음 상태로 (책상·제품은 그대로)">모든 벽</button></div>
      <svg class="sim-we-svg" role="img" aria-label="${WALLS[key]} 도면 편집 영역"></svg>
      <form class="sim-we-num" aria-label="직선 벽 숫자로 추가"><strong>직선 숫자로 추가</strong>
        <label>길이 <input type="number" name="len" min="5" max="1000" step="1" value="${ui.weLen || 100}" required> cm</label>
        <label>방향 <select name="dir">${dirs.map(([v, l]) => `<option value="${v}" ${String(ui.weDir || '0') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="sim-we-ang" ${String(ui.weDir || '0') === 'custom' ? '' : 'hidden'}>각도 <input type="number" name="ang" min="-360" max="360" step="1" value="${ui.weAng || 45}"> °</label>
        <button type="submit">추가</button>
        <small class="muted">끝점에서 이어집니다 · 각도는 0° = 오른쪽, 90° = 앞쪽(책상 쪽)</small>
      </form>
      <p class="sim-we-hint">${hint}</p></div>`;
  }

  /* 벽 겹침 [구현]: 새로 그린 벽(key)이 다른 벽을 가로지르거나 같은 선 위에서 겹치면, 겹친 기존 벽을 지웁니다.
   * 끝점끼리 맞닿거나(코너) 끝점이 다른 벽에 붙는 것(T자)은 겹침으로 보지 않습니다. */
  function segOverlap(a, b, c, d) {
    const r = { x: b.x - a.x, z: b.z - a.z }, q = { x: d.x - c.x, z: d.z - c.z };
    const lr = Math.hypot(r.x, r.z), lq = Math.hypot(q.x, q.z); if (lr < 0.5 || lq < 0.5) return false;
    const cr = (u, v) => u.x * v.z - u.z * v.x, ca = { x: c.x - a.x, z: c.z - a.z }, den = cr(r, q);
    if (Math.abs(den) > 1e-9 * lr * lq) { // 가로지름: 두 선 모두의 안쪽(끝점에서 1.5cm 이상)에서 만날 때만
      const t = cr(ca, q) / den, u = cr(ca, r) / den, et = 1.5 / lr, eu = 1.5 / lq;
      return t > et && t < 1 - et && u > eu && u < 1 - eu;
    }
    if (Math.abs(cr(ca, r)) / lr > 1) return false; // 평행하지만 다른 선
    const t0 = (ca.x * r.x + ca.z * r.z) / (lr * lr), t1 = ((d.x - a.x) * r.x + (d.z - a.z) * r.z) / (lr * lr);
    return (Math.min(1, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1))) * lr > 3; // 같은 선 위에서 3cm 넘게 겹침
  }
  function overlappingWalls(key) {
    const all = walls(), me = all.find(w => w.key === key); if (!me) return [];
    return all.filter(w => w.key !== key && w.pts.some((p, i) => i && me.pts.some((m, j) => j && segOverlap(me.pts[j - 1], m, w.pts[i - 1], p)))).map(w => w.key);
  }
  function resolveOverlaps(key) {
    const gone = overlappingWalls(key), R = room(); // room()은 부를 때마다 새 객체를 만들므로 겹침 계산 뒤에 잡습니다
    gone.forEach(k => { R[WALL_FLAG[k]] = false; delete R.paths[k]; });
    if (gone.length) D.toast(`${gone.map(k => WALLS[k]).join(', ')}이 방금 그린 ${WALLS[key]}과 겹쳐서 지웠습니다.`);
    return gone.length > 0;
  }


  /* ---------- 사진 → 3D 반영 [구현] ----------
   * 외부 AI 없이 브라우저 안에서 사진의 픽셀 색만 분석합니다. (사진은 서버로 보내지 않음)
   * - 책상 사진: 아래 가운데 영역 = 책상 상판 색, 위쪽 영역 = 벽 색
   * - 스타일 사진: 대표 색 5개(k-means) → 역할(벽·상판·다리·포인트·화면) 배정,
   *   세 스타일 색표와 가장 가까운 스타일을 고릅니다 (색 기반 단순 추정)
   * 결과는 room().deskPhoto / room().stylePhoto 에 저장되고 3D 색에 바로 반영됩니다.
   * 우선순위: 스타일 사진(원하는 모습) > 책상 사진(지금 모습) > 기본 스타일 색 */
  const toHex = c => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const lum = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  function pixels(img, maxSide = 120) {
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0, w, h);
    return { w, h, data: cx.getImageData(0, 0, w, h).data };
  }
  function regionColor(px, x0, y0, x1, y1) { // 영역에서 가장 많은 색 묶음의 평균
    const bins = new Map();
    for (let y = Math.floor(y0 * px.h); y < Math.ceil(y1 * px.h); y++) for (let x = Math.floor(x0 * px.w); x < Math.ceil(x1 * px.w); x++) {
      const i = (y * px.w + x) * 4; if (px.data[i + 3] < 128) continue;
      const c = [px.data[i], px.data[i + 1], px.data[i + 2]], key = c.map(v => v >> 5).join(',');
      const bin = bins.get(key) || { n: 0, sum: [0, 0, 0] }; bin.n++; c.forEach((v, j) => { bin.sum[j] += v; }); bins.set(key, bin);
    }
    const best = [...bins.values()].sort((a, b) => b.n - a.n)[0];
    return best ? best.sum.map(v => v / best.n) : [200, 200, 200];
  }
  function palette(px, k = 5) {
    const pts = [];
    for (let i = 0; i < px.data.length; i += 4 * 2) if (px.data[i + 3] >= 128) pts.push([px.data[i], px.data[i + 1], px.data[i + 2]]);
    if (!pts.length) return [];
    let cs = Array.from({ length: k }, (_, j) => pts[Math.floor((j + 0.5) * pts.length / k)].slice());
    let groups = [];
    for (let it = 0; it < 10; it++) {
      groups = cs.map(() => ({ n: 0, sum: [0, 0, 0] }));
      pts.forEach(p => { let bi = 0, bd = Infinity; cs.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; bi = j; } }); const g = groups[bi]; g.n++; p.forEach((v, j) => { g.sum[j] += v; }); });
      cs = groups.map((g, j) => g.n ? g.sum.map(v => v / g.n) : cs[j]);
    }
    return cs.map((c, j) => ({ c, w: groups[j].n / pts.length })).filter(x => x.w > 0.01).sort((a, b) => b.w - a.w);
  }
  function analyzeDesk(img) {
    const px = pixels(img);
    return { top: toHex(regionColor(px, 0.2, 0.6, 0.8, 0.92)), wall: toHex(regionColor(px, 0.1, 0.04, 0.9, 0.32)), on: true };
  }
  const STYLE_NAME = { warm: '내추럴', minimal: '미니멀', creative: '크리에이티브' };
  function analyzeStyle(img) {
    const pal = palette(pixels(img));
    // 스타일 판정 (색 비중으로 가중한 평균값 기준)
    //   따뜻한 기운(빨강-파랑)이 있으면 내추럴, 색이 거의 없으면(무채색) 미니멀, 차갑거나 색이 진하면 크리에이티브
    const avg = f => pal.reduce((sum, p) => sum + p.w * f(p.c), 0) / (pal.reduce((sum, p) => sum + p.w, 0) || 1);
    const warmth = avg(c => (c[0] - c[2]) / 255), colorful = avg(c => (Math.max(...c) - Math.min(...c)) / 255);
    const score = [{ key: warmth > 0.06 ? 'warm' : colorful < 0.12 ? 'minimal' : 'creative' }];
    // 역할 배정: 가장 밝은 색 = 벽, 가장 어두운 색 = 다리, 나머지 중 비중 큰 색 = 상판, 남은 색 중 가장 선명한 색 = 포인트
    const byL = pal.slice().sort((a, b) => lum(b.c) - lum(a.c));
    const wall = byL[0], leg = byL[byL.length - 1];
    const top = pal.filter(p => p !== wall && p !== leg)[0] || leg;
    const chroma = c => Math.max(...c) - Math.min(...c); // 밝은 색에서 과하게 커지는 HSL 채도 대신 색의 진하기
    const vivid = pal.filter(p => p !== wall && p !== top).sort((a, b) => chroma(b.c) - chroma(a.c))[0];
    const accent = vivid && chroma(vivid.c) >= 40 ? vivid : top;
    // 사진 색이 한두 가지뿐이면 벽은 밝게, 다리는 어둡게 벌려 3D에서 구분되게 합니다.
    let wallC = wall.c, legC = leg.c;
    if (lum(wallC) - lum(legC) < 0.15) { wallC = wall.c.map(v => v + (255 - v) * 0.55); legC = leg.c.map(v => v * 0.5); }
    return { style: score[0].key, palette: pal.map(p => ({ hex: toHex(p.c), w: Math.round(p.w * 100) })),
      colors: { wall: toHex(wallC), top: toHex(top.c), leg: toHex(legC), accent: toHex(accent.c), screen: toHex(wallC.map((v, j) => v * 0.6 + hex(THEME[score[0].key].screen)[j] * 0.4)) }, on: false };
  }
  function themeNow() {
    const R = room(), t = Object.assign({}, THEME[D.state.style] || THEME.warm);
    if (R.deskPhoto && R.deskPhoto.on) Object.assign(t, { top: R.deskPhoto.top, wall: R.deskPhoto.wall });
    if (R.stylePhoto && R.stylePhoto.on) Object.assign(t, R.stylePhoto.colors);
    return t;
  }
  function photoSourceText() {
    const R = room(), a = [];
    if (R.stylePhoto && R.stylePhoto.on) a.push('스타일 사진 색');
    else if (R.deskPhoto && R.deskPhoto.on) a.push('책상 사진 색');
    return a.length ? ` · ${a[0]} 반영 중` : '';
  }
  const sw = (hexc, label) => `<span class="sim-sw"><i style="background:${hexc}"></i>${label}</span>`;
  function deskPhotoHTML() {
    const P = room().deskPhoto; if (!photos.desk || !P) return '';
    return `<div class="sim-photo-result"><div class="sim-row"><strong>사진에서 읽은 색</strong>${TAG.real}</div>
      <div class="sim-sws">${sw(P.top, '책상 상판')}${sw(P.wall, '벽')}</div>
      <label class="sim-check"><input type="checkbox" data-photo-use="desk" ${P.on ? 'checked' : ''}> 3D 책상·벽 색에 반영</label>
      <p class="muted">사진 아래 가운데를 책상, 위쪽을 벽으로 보고 가장 많은 색을 고릅니다. 책상이 사진 가운데 아래에 오게 찍으면 정확해집니다.</p></div>`;
  }
  function stylePhotoHTML() {
    const P = room().stylePhoto; if (!photos.style || !P) return '';
    return `<div class="sim-photo-result"><div class="sim-row"><strong>가까운 스타일: ${STYLE_NAME[P.style]}</strong>${TAG.real}<span class="muted">색 기반 단순 추정</span></div>
      <div class="sim-sws">${P.palette.map(p => sw(p.hex, `${p.w}%`)).join('')}</div>
      <div class="sim-sws">${sw(P.colors.wall, '벽')}${sw(P.colors.top, '상판')}${sw(P.colors.leg, '다리')}${sw(P.colors.accent, '포인트')}</div>
      <label class="sim-check"><input type="checkbox" data-photo-use="style" ${P.on ? 'checked' : ''}> 이 색으로 3D 바꾸기 (스타일 '${STYLE_NAME[P.style]}'로 전환)</label>
      <p class="muted">대표 색 5개를 뽑아 가장 밝은 색은 벽, 가장 어두운 색은 다리, 가장 선명한 색은 조명 같은 포인트에 씁니다. 사진 속 가구 종류나 배치는 읽지 않습니다.</p></div>`;
  }

  /* ---------- 책상 사진으로 치수 재기 [구현] ----------
   * 크기를 아는 기준 물건(A4 용지 등)의 양 끝과 책상 양 끝을 사진에서 클릭하면, 길이 비율로 책상 너비를 계산합니다.
   * 높이(바닥~상판)는 선택 항목입니다. 사진의 원근 때문에 오차가 생길 수 있어 '약 ○cm'로 안내합니다.
   * 자동 인식(AI)은 쓰지 않습니다. */
  const REF = { a4long: ['A4 용지 긴 변', 29.7], a4short: ['A4 용지 짧은 변', 21], card: ['신용카드 긴 변', 8.56], custom: ['직접 입력', 30] };
  const MSTEP = { ref: ['기준 물건', '#1f8a8a'], width: ['책상 너비', '#e07a2f'], height: ['책상 높이 (선택)', '#7a5cc4'] };
  let measure = null; // 사진마다 하나 (새 사진을 올리면 초기화)
  const dist2 = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
  function measureResult() {
    const m = measure; if (!m || m.ref.length < 2) return { scale: 0 };
    const refPx = dist2(m.ref[0], m.ref[1]); if (refPx < 3) return { scale: 0 };
    const scale = m.refLen / refPx, out = { scale };
    if (m.width.length === 2) out.width = dist2(m.width[0], m.width[1]) * scale;
    if (m.height.length === 2) out.height = dist2(m.height[0], m.height[1]) * scale;
    return out;
  }
  function openMeasure(onApply) {
    const img = new Image(); img.src = photos.desk;
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight, r = Math.max(W, H) / 110;
      if (!measure) measure = { ref: [], width: [], height: [], refKind: 'a4long', refLen: 29.7, step: 'ref' };
      const m = measure;
      const box = document.createElement('div'); box.className = 'sim-ms-wrap';
      box.innerHTML = `<div class="sim-ms-back"></div><div class="sim-ms" role="dialog" aria-modal="true" aria-label="책상 사진에서 치수 재기">
        <div class="sim-ms-photo"><div class="sim-ms-stage"><img src="${photos.desk}" alt="치수를 잴 책상 사진"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"></svg></div></div>
        <div class="sim-ms-side">
          <div class="sim-row"><strong>사진에서 치수 재기</strong>${TAG.real}<span class="sim-push"></span><button type="button" data-ms="close" aria-label="닫기">✕</button></div>
          <p class="muted">크기를 아는 물건과 책상 양 끝을 클릭하면 비율로 계산합니다. 점은 끌어서 고칠 수 있습니다.</p>
          <ol class="sim-ms-steps"></ol>
          <label class="sim-ms-ref">기준 물건 <select data-ms="kind">${Object.entries(REF).map(([k, [l, v]]) => `<option value="${k}" ${m.refKind === k ? 'selected' : ''}>${l}${k === 'custom' ? '' : ` (${v}cm)`}</option>`).join('')}</select>
            <input type="number" data-ms="len" min="1" max="300" step="0.1" value="${m.refLen}" ${m.refKind === 'custom' ? '' : 'disabled'} aria-label="기준 물건 길이 (cm)"> cm</label>
          <div class="sim-ms-out" aria-live="polite"></div>
          <p class="muted sim-ms-tip">정확하게 재는 법: 기준 물건을 책상 앞쪽 가장자리에 책상과 나란히 두고, 정면에서 수평으로 찍어 주세요. 비스듬히 찍으면 원근 때문에 몇 cm 차이가 날 수 있습니다.</p>
          <div class="sim-row"><button type="button" data-ms="reset">점 모두 지우기</button><span class="sim-push"></span><button type="button" class="primary" data-ms="apply" disabled>3D에 적용</button></div>
        </div></div>`;
      document.body.appendChild(box);
      document.documentElement.classList.add('sim-lock');
      const svg = box.querySelector('svg'), dlg = box.querySelector('.sim-ms');
      const lens = () => {
        const res = measureResult();
        return { ref: `${m.refLen}cm`, width: res.width ? `약 ${Math.round(res.width)}cm` : '', height: res.height ? `약 ${Math.round(res.height)}cm` : '' };
      };
      const draw = () => {
        const L = lens(); let o = '';
        Object.keys(MSTEP).forEach(k => {
          const pts = m[k], col = MSTEP[k][1];
          if (pts.length === 2) {
            o += `<line x1="${pts[0].x}" y1="${pts[0].y}" x2="${pts[1].x}" y2="${pts[1].y}" stroke="#fff" stroke-width="${r * 0.9}" stroke-linecap="round"/><line x1="${pts[0].x}" y1="${pts[0].y}" x2="${pts[1].x}" y2="${pts[1].y}" stroke="${col}" stroke-width="${r * 0.45}" stroke-linecap="round"/>`;
            const mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2 + (k === 'ref' ? r * 4.2 : -r * 1.6), t = `${MSTEP[k][0].replace(' (선택)', '')} ${L[k]}`;
            o += `<text x="${mx}" y="${my}" font-size="${r * 2.1}" text-anchor="middle" fill="${col}" stroke="#fff" stroke-width="${r * 0.6}" paint-order="stroke" font-weight="700">${t}</text>`;
          }
          pts.forEach((q, i) => { o += `<circle cx="${q.x}" cy="${q.y}" r="${r}" fill="${m.step === k ? col : '#fff'}" stroke="${col}" stroke-width="${r * 0.35}" data-pt="${k}:${i}" style="cursor:move"/>`; });
        });
        svg.innerHTML = o;
        const res = measureResult();
        box.querySelector('.sim-ms-steps').innerHTML = Object.entries(MSTEP).map(([k, [l, col]]) => {
          const n = m[k].length, done = n === 2;
          const what = k === 'ref' ? '기준 물건의 양 끝' : k === 'width' ? '책상 상판의 왼쪽 끝과 오른쪽 끝' : '바닥(책상 다리 끝)과 상판 윗면';
          return `<li ${m.step === k ? 'aria-current="step"' : ''}><button type="button" data-ms-step="${k}" style="--c:${col}"><b>${l}</b><span>${done ? `✓ ${k === 'ref' ? lens().ref : lens()[k]}` : `${what}을 클릭 (${n}/2)`}</span></button></li>`;
        }).join('');
        box.querySelector('.sim-ms-out').innerHTML = res.width
          ? `<strong>책상 너비 약 ${Math.round(res.width)}cm</strong>${res.height ? ` · 높이 약 ${Math.round(res.height)}cm` : ''}${res.width < 80 || res.width > 240 ? `<br><span class="sim-warn">입력 범위(80~240cm)를 벗어나 ${res.width < 80 ? 80 : 240}cm로 맞춰 적용됩니다</span>` : ''}${res.height && (res.height < 60 || res.height > 110) ? `<br><span class="sim-warn">높이는 60~110cm 범위로 맞춰 적용됩니다</span>` : ''}`
          : '<span class="muted">기준 물건과 책상 너비를 재면 결과가 나옵니다.</span>';
        box.querySelector('[data-ms="apply"]').disabled = !res.width;
      };
      const toImg = e => { const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; const p = q.matrixTransform(svg.getScreenCTM().inverse()); return { x: Math.max(0, Math.min(W, Math.round(p.x))), y: Math.max(0, Math.min(H, Math.round(p.y))) }; };
      const nextStep = () => { m.step = ['ref', 'width', 'height'].find(k => m[k].length < 2) || m.step; };
      let drag = null;
      const stage = box.querySelector('.sim-ms-stage');
      stage.addEventListener('pointerdown', e => {
        e.preventDefault(); stage.setPointerCapture(e.pointerId);
        const h = e.target.closest('[data-pt]');
        if (h) { const [k, i] = h.dataset.pt.split(':'); drag = { k, i: Number(i) }; m.step = k; draw(); return; }
        const q = toImg(e), pts = m[m.step];
        if (pts.length >= 2) pts.length = 0; // 다 찍힌 단계를 다시 고르면 새로 찍기
        pts.push(q); drag = { k: m.step, i: pts.length - 1 };
        draw();
      });
      stage.addEventListener('pointermove', e => { if (!drag) return; m[drag.k][drag.i] = toImg(e); draw(); });
      stage.addEventListener('pointerup', () => { if (!drag) return; drag = null; if (m[m.step].length === 2) nextStep(); draw(); });
      const close = () => { box.remove(); if (!ui.big) document.documentElement.classList.remove('sim-lock'); document.removeEventListener('keydown', onKey, true); document.querySelector('#sim-measure')?.focus(); };
      const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
      document.addEventListener('keydown', onKey, true);
      box.querySelector('.sim-ms-back').addEventListener('click', close);
      box.addEventListener('click', e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.msStep) { m.step = t.dataset.msStep; draw(); return; }
        if (t.dataset.ms === 'close') close();
        if (t.dataset.ms === 'reset') { m.ref = []; m.width = []; m.height = []; m.step = 'ref'; draw(); }
        if (t.dataset.ms === 'apply') { const res = measureResult(); close(); onApply(res); }
      });
      box.querySelector('[data-ms="kind"]').addEventListener('change', e => {
        m.refKind = e.target.value; const inp = box.querySelector('[data-ms="len"]');
        inp.disabled = m.refKind !== 'custom'; if (m.refKind !== 'custom') { m.refLen = REF[m.refKind][1]; inp.value = m.refLen; } else inp.focus();
        draw();
      });
      box.querySelector('[data-ms="len"]').addEventListener('input', e => { const v = Number(e.target.value); if (v > 0) { m.refLen = v; draw(); } });
      draw(); dlg.querySelector('[data-ms="close"]').focus();
    };
    img.onerror = () => D.toast('사진을 다시 불러오지 못했습니다. 사진을 다시 선택해 주세요.');
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
.studio-canvas .sim-viewport{position:relative;width:100%;max-width:100%;height:100%;margin-inline:auto;min-height:220px;border-radius:inherit} /* .studio-canvas(팀 CSS 높이 405px) 칸을 꽉 채움 */
.studio-canvas .sim-canvas{display:block;width:100%;height:100%;cursor:grab;touch-action:none;outline:none;border-radius:inherit}
.sim-big-btn{position:absolute;top:10px;right:10px;z-index:4;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;padding:6px 10px;border-radius:8px;border:1px solid rgba(27,42,65,.18);background:rgba(255,255,255,.92);color:#1b2a41;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.08)}
.sim-we button{min-height:28px;padding:4px 9px;font-size:11px;border-radius:7px}.sim-we .sim-we-chip button{min-height:24px;border-radius:0}.sim-we .sim-we-add{min-height:24px;border-radius:999px}
.sim-ms button{min-height:30px;padding:5px 10px;font-size:12px}
#sim-measure{min-height:30px;padding:5px 11px;font-size:11px;margin-top:10px}
.sim-big-btn{min-height:30px}
.sim-big-btn:hover{background:#fff;border-color:#e07a2f}.sim-big-btn kbd{font:inherit;font-size:11px;padding:0 5px;border-radius:4px;background:#eef0f3;border:1px solid #d6dbe1}
.sim-big-info{display:none}
.studio-canvas .studio-canvas-label{display:none}
.sim-hint{position:absolute;left:10px;top:10px;z-index:3;font-size:11px;color:#34404b;background:rgba(255,255,255,.85);padding:3px 8px;border-radius:6px;pointer-events:none}
.sim-viewport.big .sim-hint{display:none}
.sim-backdrop{display:none}
html.sim-lock,html.sim-lock body{overflow:hidden}
html.sim-lock .sim-backdrop{display:block;position:fixed;inset:0;background:rgba(27,42,65,.55);z-index:999}
.studio-canvas .sim-viewport.big{position:fixed;inset:24px;width:auto;height:auto;max-width:none;aspect-ratio:auto;z-index:1000;background:radial-gradient(ellipse at 50% 35%,#4b5565 0%,#323a47 70%,#29303b 100%);border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.35);overflow:hidden}
.sim-viewport.big .sim-big-btn{top:14px;right:14px;font-size:13.5px;padding:8px 12px;background:#fff;color:#1b2a41;border-color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.25)}
.sim-viewport.big .sim-big-info{display:flex;flex-wrap:wrap;gap:6px 14px;position:absolute;left:14px;bottom:12px;right:14px;z-index:3;font-size:12.5px;color:#34404b;pointer-events:none}
.sim-viewport.big .sim-big-info span{background:rgba(255,255,255,.88);padding:4px 9px;border-radius:8px}
.sim-viewport.big .sim-we{top:60px}
@media (max-width:640px){.studio-canvas .sim-viewport.big{inset:8px}}
.sim-ms-back{position:fixed;inset:0;background:rgba(27,42,65,.6);z-index:1100}
.sim-ms{position:fixed;inset:24px;z-index:1101;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(0,0,0,.35);display:grid;grid-template-columns:1fr 320px;overflow:hidden;font-size:13px}
.sim-ms-photo{background:#29303b;display:grid;place-items:center;padding:16px;min-height:0;overflow:auto}
.sim-ms-stage{position:relative;line-height:0;touch-action:none;cursor:crosshair;max-width:100%}
.sim-ms-stage img{max-width:100%;max-height:calc(100vh - 80px);display:block;user-select:none;-webkit-user-drag:none}
.sim-ms-stage svg{position:absolute;inset:0;width:100%;height:100%}
.sim-ms-side{padding:16px;display:grid;gap:10px;align-content:start;overflow:auto}
.sim-ms-side p{margin:0;line-height:1.5}
.sim-ms-steps{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.sim-ms-steps button{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:grid;gap:2px;padding:8px 10px;border-radius:10px;border:1px solid #e3ddd2;border-left:4px solid var(--c)}
.sim-ms-steps li[aria-current] button{background:#faf6ef;box-shadow:0 0 0 2px var(--c) inset}
.sim-ms-steps span{color:#5f6672;font-size:12px}
.sim-ms-ref{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.sim-ms-ref input{width:70px}
.sim-ms-out{background:#f3f7f6;border-radius:10px;padding:10px 12px;line-height:1.6}.sim-warn{color:#b4521c}
.sim-ms-tip{font-size:12px}
@media (max-width:760px){.sim-ms{grid-template-columns:1fr;grid-template-rows:minmax(200px,55%) 1fr;inset:8px}}
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
.sim-we-walls{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
.sim-we-chip{display:inline-flex;border:1px solid #d6cfc2;border-radius:999px;overflow:hidden}.sim-we-chip.on{border-color:#e07a2f}
.sim-we-chip button{border:0;border-radius:0;background:#fff;font-size:12px;padding:3px 8px;cursor:pointer}.sim-we-chip.on button[data-wsel]{background:#1b2a41;color:#fff}
.sim-we-chip button[data-wdel]{padding:3px 7px;color:#b4462f;border-left:1px solid #e3ddd2}.sim-we-chip button[data-wdel]:hover{background:#fdecea}
.sim-we-add{font-size:12px;border:1px dashed #b9b1a3;border-radius:999px;background:#faf8f3;padding:3px 9px;cursor:pointer}
.sim-we-num{display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;background:#faf8f3;border:1px solid #ece6db;border-radius:8px;padding:7px 9px}
.sim-we-num strong{font-size:12px;width:100%}.sim-we-num label{display:inline-flex;align-items:center;gap:4px;font-size:12px}
.sim-we-num input[type=number]{width:64px}.sim-we-num small{width:100%;font-size:11px}
.panel-heading .studio-tools{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end}
.studio-tools .btn,.studio-tools #save-layout{white-space:nowrap}
.studio-tools .btn,.studio-tools #save-layout{display:inline-flex;align-items:center;gap:5px;min-height:27px;padding:4px 9px;font-size:10px}.studio-tools svg{width:13px;height:13px;flex:none}
.sim-we-num [hidden]{display:none}
.sim-we-hint{margin:0;color:#5f6672;line-height:1.5}
.sim-photo-result{margin-top:10px;padding:10px 12px;border:1px solid rgba(0,0,0,.08);border-radius:10px;display:grid;gap:8px;font-size:13px}
.sim-photo-result p{margin:0;font-size:12px;line-height:1.5}
.sim-sws{display:flex;flex-wrap:wrap;gap:6px 12px}.sim-sw{display:inline-flex;align-items:center;gap:5px;font-size:12px}
.sim-sw i{width:18px;height:18px;border-radius:5px;border:1px solid rgba(0,0,0,.15);display:inline-block}
.sim-check{display:inline-flex;gap:6px;align-items:center;font-weight:600}
.studio-canvas .sim-canvas:active{cursor:grabbing}.studio-canvas .sim-canvas:focus-visible{box-shadow:inset 0 0 0 3px #e07a2f}
.pill.sim-real{background:#dff1ec;color:#17705f}.pill.sim-sample{background:#fdebd9;color:#a8541b}
.sim-block{margin:0;padding:14px 18px;border-top:1px solid var(--color-line,rgba(0,0,0,.08));display:grid;gap:8px;font-size:12px}
.sim-block button{min-height:30px;padding:5px 10px;font-size:11px}.sim-block .sim-chips button{font-weight:500}
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
.studio-config .sim-walls label{display:inline-flex;gap:5px;align-items:center;font-size:11px;color:var(--color-text,#20242c)}
.studio-config .sim-walls input{width:auto;padding:0;margin:0}
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
      const wallOpt = (k, l) => `<label><input type="checkbox" name="${k}" ${R[k] ? 'checked' : ''}> ${l}</label>`;

      // 기존 화면 구조 유지 · 바뀐 곳: 캔버스 내용, 라벨 문구, 크기 폼 항목 추가, 패널 아래 점검/변화 영역, 사진 영역 추정 버튼
      // 상단 제목 영역(YOUR SPACE, YOUR WAY …)은 없애고, 그 자리의 프리셋 불러오기·구성 저장 버튼은 책상 패널 제목 줄로 옮겼습니다.
      root.innerHTML = `
      <div class="studio-grid"><div class="studio-main">
        <section class="panel" aria-label="책상 배치 미리보기"><div class="panel-heading"><h2>${D.escape(state.name)}</h2><div class="studio-tools"><span class="pill purple">3D 배치</span><button id="reset-layout">초기화</button><a class="btn" href="#presets">${D.icon('grid')} 프리셋 불러오기</a><button class="primary" id="save-layout">${D.icon('save')} 구성 저장</button></div></div>
          <div class="studio-canvas"><span class="studio-canvas-label">${D.icon('cube').replace('class="icon"', 'class="icon" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px"')} 3D 미리보기 · 실측 비율 (구현) · 제품 모양 단순화 (샘플)${photoSourceText()}</span><div class="sim-viewport"><canvas class="sim-canvas" tabindex="0" aria-label="책상과 제품 3D 배치 화면. 좌클릭으로 빈 곳을 끌면 카메라가 이동하고, 우클릭으로 끌면 시점이 돌아갑니다. 휠로 앞뒤로 움직이고, F 키로 선택한 제품을 봅니다. 제품을 끌어 옮기거나, 고른 뒤 방향키로 이동하고 R 키로 회전합니다. 벽을 클릭하면 벽 도면 창이 열립니다."></canvas>${ui.wallEdit ? editorHTML() : ''}<button type="button" class="sim-big-btn" aria-pressed="false">⤢ 크게 보기</button><div class="sim-big-info"><span>책상 ${state.width} × ${state.depth} × ${R.height} cm</span><span>좌클릭 드래그: 카메라 이동</span><span>우클릭 드래그: 시점 회전 (누른 채 WASD·QE: 날기)</span><span>Alt+좌클릭: 대상 중심 회전</span><span>휠: 앞뒤 · F: 선택 제품 보기 · 더블클릭: 시점 처음으로</span><span>제품 드래그: 이동 · R: 회전</span><span>벽 클릭: 벽 도면</span></div><div class="sim-hint" aria-hidden="true">좌클릭 드래그 이동 · 우클릭 드래그 회전 · 휠 앞뒤 · 더블클릭 처음으로</div></div><div class="sim-backdrop" aria-hidden="true"></div><div class="studio-canvas-bottom"><span class="studio-dim">책상 ${state.width} × ${state.depth} × ${R.height} cm</span><div class="studio-style-switch" aria-label="스타일 선택">${[['warm', '내추럴'], ['minimal', '미니멀'], ['creative', '크리에이티브']].map(([key, label]) => `<button data-style="${key}" aria-pressed="${state.style === key}">${label}</button>`).join('')}</div></div></div>
          <form class="studio-config" id="dimensions"><label>책상 너비 (cm)<input type="number" name="width" value="${state.width}" min="80" max="240" required></label><label>책상 깊이 (cm)<input type="number" name="depth" value="${state.depth}" min="40" max="120" required></label><label>책상 높이 (cm)<input type="number" name="height" value="${R.height}" min="60" max="110" required></label><label>책상~뒷벽 (cm)<input type="number" name="backGap" value="${R.backGap}" min="0" max="80" required></label><label>책상~옆벽 (cm)<input type="number" name="sideGap" value="${R.sideGap}" min="0" max="100" required></label><label>창문<select name="window">${[['none', '없음'], ['back', '뒷벽'], ['left', '왼쪽 벽'], ['right', '오른쪽 벽']].map(([k, l]) => `<option value="${k}" ${R.window === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label><div class="sim-walls">${wallOpt('backWall', '뒷벽')}${wallOpt('leftWall', '왼쪽 벽')}${wallOpt('rightWall', '오른쪽 벽')}</div><button type="submit">조건 적용</button>${(() => { const note = [ui.measured ? `사진에서 잰 값이 들어가 있습니다 (너비 약 ${ui.measured.width}cm${ui.measured.height ? `, 높이 약 ${ui.measured.height}cm` : ''})<br>원근 때문에 오차가 있을 수 있어요. 깊이는 직접 넣어 주세요` : '', Object.keys(R.paths).length ? '도면을 그린 벽은 거리 입력값 대신 도면을 따릅니다' : ''].filter(Boolean).join('<br>'); return note ? `<span class="muted">${note}</span>` : ''; })()}</form>
          <div class="sim-block" id="sim-checks">${checksHTML()}</div>
          <div class="sim-block" id="sim-selection">${selectionHTML()}</div>
          <div class="sim-block" id="sim-compare">${compareHTML()}</div>
        </section>
        <section class="panel"><div class="panel-heading"><h2>이 공간을 채운 제품 <span class="muted">${state.products.length}</span></h2><a class="muted" href="#products">전체 보기 ↗</a></div><div class="studio-products">${state.products.map(id => { const p = D.products.find(item => item.id === id); return `<article class="studio-item">${D.productArt(p)}<div><strong>${p.name}</strong><small>${D.money(p.price)}</small><a href="#products"> 제품 살펴보기</a></div></article>`; }).join('')}</div></section>
      </div><section class="panel assistant-panel" id="assistant" aria-label="AI 공간 어시스턴트"></section></div>
      <section class="panel studio-upload"><div><label for="desk-photo">${D.icon('photo').replace('class="icon"', 'class="icon" style="display:inline;vertical-align:middle;margin-right:5px"')} 내 책상 사진<input id="desk-photo" type="file" accept="image/png,image/jpeg,image/webp" data-photo="desk"></label><p>PNG·JPG·WebP, 5MB 이하 · 이 탭에서만 미리 봅니다. (미리보기 구현)</p><div id="preview-desk">${photos.desk ? `<img class="studio-preview" src="${photos.desk}" alt="선택한 책상 사진">` : ''}</div><button type="button" id="sim-measure" ${photos.desk ? '' : 'disabled'}>📏 사진에서 책상 치수 재기 (구현)</button>${deskPhotoHTML()}</div><div><label for="style-photo">원하는 스타일 사진<input id="style-photo" type="file" accept="image/png,image/jpeg,image/webp" data-photo="style"></label><p>사진의 대표 색으로 3D 색을 바꿉니다. (색 분석 구현 · 가구 인식은 미연결)</p><div id="preview-style">${photos.style ? `<img class="studio-preview" src="${photos.style}" alt="선택한 스타일 사진">` : ''}</div>${stylePhotoHTML()}</div></section>`;

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
        const own = () => { const R = room(); if (!R.paths[key]) { const d = JSON.parse(JSON.stringify(defaultPath(key))); d.base = d.segs.length; R.paths[key] = d; } return R.paths[key]; }; // base = 처음 벽의 선 개수 (되돌리기로 지우지 않음)
        const toPt = e => { const q = svg.createSVGPoint(); q.x = e.clientX; q.y = e.clientY; const m = q.matrixTransform(svg.getScreenCTM().inverse()); return { x: snap(m.x), z: snap(m.y) }; };
        // 직선은 수평·수직에서 8° 안쪽이면 딱 맞춰 반듯한 코너를 만들기 쉽게 합니다.
        const straighten = (a, q) => { if (ui.wallTool !== 'line') return q; const dx = Math.abs(q.x - a.x), dz = Math.abs(q.z - a.z); if (dz < dx * 0.14) return { x: q.x, z: a.z }; if (dx < dz * 0.14) return { x: a.x, z: q.z }; return q; };
        const curveCtl = (a, b) => ({ x: snap((a.x + b.x) / 2 - (b.z - a.z) * 0.3), z: snap((a.z + b.z) / 2 + (b.x - a.x) * 0.3) });
        const draw = preview => { svg.setAttribute('viewBox', `${vb.x} ${vb.z} ${vb.w} ${vb.h}`); svg.innerHTML = editorSVG(key, vb, preview); };
        const hint = () => { we.querySelector('.sim-we-hint').innerHTML = !wallPath(key).start ? '벽이 시작할 점을 도면에서 클릭하거나, 아래 숫자 입력으로 바로 추가하세요.' : HINT_DRAW; };
        const changed = final => {
          // 다 그린 순간(놓았을 때) 다른 벽과 겹치면 기존 벽을 지우고 알림 → 화면을 다시 그려 체크박스·벽 목록도 맞춥니다
          if (final && resolveOverlaps(key)) { D.render(); return; }
          sim.draw(); refresh(final ? 'moved' : 'move'); if (final) { vb = editorBounds(key); } draw(); hint();
        };
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
          if (t.dataset.wsel) { ui.wallEdit = t.dataset.wsel; D.render(); return; }
          if (t.dataset.wadd) { R[WALL_FLAG[t.dataset.wadd]] = true; ui.wallEdit = t.dataset.wadd; D.render(); if (resolveOverlaps(t.dataset.wadd)) D.render(); else D.toast(`${WALLS[t.dataset.wadd]}을 세웠습니다.`); return; }
          if (t.dataset.wdel) {
            const k = t.dataset.wdel; R[WALL_FLAG[k]] = false; delete R.paths[k];
            if (k === key) ui.wallEdit = Object.keys(WALLS).find(o => R[WALL_FLAG[o]]) || null;
            D.render(); D.toast(`${WALLS[k]}을 지웠습니다. 벽 목록의 '+ ${WALLS[k]} 세우기'로 다시 세울 수 있습니다.`); return;
          }
          if (t.dataset.we === 'undo') {
            const path = R.paths[key], base = path ? (path.base || 0) : 1, n = path ? path.segs.length : 1;
            if (path && n > base) path.segs.pop();
            else if (path && base === 0 && path.start) path.start = null;
            else if (path && !path.start) { D.toast('되돌릴 선이 없습니다. 시작점을 클릭하거나 숫자로 추가하세요.'); return; }
            else { D.toast('처음부터 있던 벽은 되돌리기로 지워지지 않아요. 벽 목록의 ✕나 초기화 버튼을 쓰세요.'); return; }
          }
          if (t.dataset.we === 'clear') { R.paths[key] = { start: null, segs: [], base: 0 }; D.toast(`${WALLS[key]}을 비웠습니다. 시작점을 클릭하거나 숫자로 추가하세요.`); }
          if (t.dataset.we === 'straight') { delete R.paths[key]; D.toast(`${WALLS[key]}만 처음 직선 벽으로 되돌렸습니다.`); }
          if (t.dataset.we === 'resetall') {
            R.paths = {}; Object.assign(R, { backWall: true, leftWall: false, rightWall: true });
            if (!R[WALL_FLAG[key]]) ui.wallEdit = 'back';
            D.render(); D.toast('벽만 처음 상태로 되돌렸습니다. 책상과 제품은 그대로입니다.'); return;
          }
          changed(true);
        });
        // 직선 벽 숫자로 추가 [구현]: 길이(cm) + 방향(또는 각도). 끝점에서 이어지고, 시작점이 없으면 이 벽의 처음 시작점에서 시작
        const num = we.querySelector('.sim-we-num');
        num.addEventListener('change', e => {
          if (e.target.name === 'dir') { ui.weDir = e.target.value; num.querySelector('.sim-we-ang').hidden = e.target.value !== 'custom'; }
          if (e.target.name === 'len') ui.weLen = Number(e.target.value) || ui.weLen;
          if (e.target.name === 'ang') ui.weAng = Number(e.target.value);
        });
        num.addEventListener('submit', e => {
          e.preventDefault();
          const f = new FormData(num), len = Math.round(Number(f.get('len'))), dir = String(f.get('dir'));
          if (!(len >= 5 && len <= 1000)) { D.toast('길이는 5~1000cm 사이로 입력해 주세요.'); return; }
          const deg = dir === 'custom' ? Number(f.get('ang')) || 0 : Number(dir), rad = deg * Math.PI / 180;
          ui.weLen = len; ui.weDir = dir; if (dir === 'custom') ui.weAng = deg;
          const path = own(); if (!path.start) path.start = Object.assign({}, defaultPath(key).start);
          const a = path.segs.length ? path.segs[path.segs.length - 1].to : path.start;
          const q = { x: Math.round(a.x + len * Math.cos(rad)), z: Math.round(a.z + len * Math.sin(rad)) };
          path.segs.push({ type: 'line', to: q });
          changed(true);
          if (document.body.contains(num)) D.toast(`직선 ${len}cm를 ${dir === 'custom' ? `${deg}°` : { 0: '오른쪽', 90: '앞쪽', 180: '왼쪽', 270: '뒤쪽' }[dir]}으로 추가했습니다.`);
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
        ui.estimated = false; ui.measured = null; ui.ownChange = true; resetView();
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
        delete D.state.room; delete D.state.layout; Object.assign(ui, { selected: null, before: null, estimated: false, measured: null, wallEdit: null, wePos: null }); measure = null; resetView(); D.render();
      });
      root.querySelectorAll('[data-photo]').forEach(input => input.addEventListener('change', () => {
        const file = input.files[0]; if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { input.value = ''; D.toast('5MB 이하의 PNG, JPG, WebP 이미지를 선택해 주세요.'); return; }
        const key = input.dataset.photo, url = URL.createObjectURL(file), img = new Image();
        img.onload = () => {
          if (photos[key]) URL.revokeObjectURL(photos[key]); photos[key] = url;
          const R = room();
          if (key === 'desk') { measure = null; R.deskPhoto = analyzeDesk(img); D.render(); D.toast('책상 사진의 색을 3D 책상과 벽에 반영했습니다. \'사진에서 책상 치수 재기\'로 너비·높이도 잴 수 있습니다.'); }
          else {
            const prev = R.stylePhoto && R.stylePhoto.on ? R.stylePhoto.prevStyle : D.state.style;
            R.stylePhoto = Object.assign(analyzeStyle(img), { on: true, prevStyle: prev }); D.state.style = R.stylePhoto.style;
            D.render(); D.toast(`스타일 사진의 색으로 3D를 바꿨습니다. 가까운 스타일: ${STYLE_NAME[R.stylePhoto.style]}`);
          }
        };
        img.onerror = () => { URL.revokeObjectURL(url); input.value = ''; D.toast('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.'); };
        img.src = url;
      }));

      root.querySelectorAll('[data-photo-use]').forEach(box => box.addEventListener('change', () => {
        const R = room();
        if (box.dataset.photoUse === 'desk') R.deskPhoto.on = box.checked;
        else {
          const P = R.stylePhoto; P.on = box.checked;
          if (box.checked) { P.prevStyle = D.state.style; D.state.style = P.style; } else if (P.prevStyle) D.state.style = P.prevStyle;
        }
        D.render();
      }));
      // 스타일 버튼을 직접 누르면 스타일 사진 색 반영은 끕니다 (버튼이 우선)
      root.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => { const P = room().stylePhoto; if (P) P.on = false; }, true));

      /* 추가 동작 (이벤트 위임: 부분 갱신된 버튼도 동작) */
      $('.studio-main').addEventListener('click', e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.select) { ui.selected = t.dataset.select; refresh('select'); canvas.focus({ preventScroll: true }); return; }
        if (t.id === 'sim-rotate' && ui.selected) { const p = layout()[ui.selected]; p.rot = ((p.rot || 0) + 90) % 360; refresh('moved'); }
        if (t.id === 'sim-auto') { autoArrange(); refresh('moved'); D.toast('정해 둔 규칙으로 다시 배치했습니다. 변경 전·후에서 확인하세요.'); }
        if (t.id === 'sim-baseline') { ui.before = snapshot(); refresh('moved'); D.toast("지금 배치를 '변경 전'으로 잡았습니다."); }
      });
      $('#sim-measure').addEventListener('click', () => openMeasure(res => {
        const r = room(), w = Math.min(240, Math.max(80, Math.round(res.width)));
        D.state.width = w;
        let h = null; if (res.height) { h = Math.min(110, Math.max(60, Math.round(res.height))); r.height = h; }
        ui.measured = { width: w, height: h }; ui.ownChange = true; resetView();
        D.render();
        D.toast(`사진에서 잰 책상 너비 ${w}cm${h ? `, 높이 ${h}cm` : ''}를 3D에 반영했습니다.`);
      }));
    }
  };
})(window.Deskspace);
