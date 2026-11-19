/* 프리셋·커뮤니티 게시물의 '실제 구성품' 데이터와 도우미 (가상 제품명·가상 가격).
 * D.presets[i].products(4종 샘플)는 3D 스튜디오용으로 그대로 두고, 비교·상세 화면은 여기 구성품 목록을 씁니다.
 * at: 책상 윗면 위치 [가로 중심 x, 앞뒤 중심 z, 폭, 깊이, 'c'=원형] (cm, 책상 가운데 기준, +z = 앞쪽). 여러 개면 배열의 배열.
 * 위치는 assets/presets/*.webp 3D 렌더와 같은 좌표입니다. */
(function (D) {
  const SETUPS = {
    warm: [
      { cat: '책상', name: '원목 데스크 1400 (오크)', price: 219000 },
      { cat: '의자', name: '패브릭 사무용 의자 (브라운)', price: 159000 },
      { cat: '모니터', name: '27인치 QHD 모니터', price: 259000, at: [0, -14, 62, 18] },
      { cat: '키보드', name: '저소음 기계식 텐키리스', price: 89000, at: [-4, 12, 32, 12] },
      { cat: '마우스', name: '무선 마우스 기본형', price: 19000, at: [23, 13, 6, 11, 'c'] },
      { cat: '조명', name: '아치 데스크 램프 (브론즈)', price: 49000, at: [48, -18, 16, 16, 'c'] },
      { cat: '데스크 매트', name: '펠트 데스크 매트 80cm', price: 22000, at: [0, 8, 82, 34] },
      { cat: '소품', name: '헤드폰 · 펜꽂이 · 머그 · 노트 · 화분', price: 68000, at: [[56, 4, 17, 9], [-38, -6, 7, 7, 'c'], [-38, 12, 8, 8, 'c'], [44, 14, 15, 21], [-52, -16, 10, 10, 'c']] }
    ],
    minimal: [
      { cat: '책상', name: '화이트 데스크 1200', price: 129000 },
      { cat: '의자', name: '메쉬 의자 (라이트 그레이)', price: 119000 },
      { cat: '모니터', name: '24인치 FHD 모니터 (화이트)', price: 159000, at: [0, -10, 53, 18] },
      { cat: '키보드', name: '슬림 무선 키보드', price: 49000, at: [-3, 12, 32, 12] },
      { cat: '마우스', name: '무소음 무선 마우스 (화이트)', price: 25000, at: [21, 13, 6, 11, 'c'] },
      { cat: '데스크 매트', name: '라이트 그레이 데스크 매트', price: 15000, at: [0, 10, 70, 30] },
      { cat: '스피커', name: '미니 북쉘프 스피커', price: 69000, at: [42, -14, 10, 12] },
      { cat: '소품', name: '머그 · 노트 · 화분', price: 33000, at: [[40, 12, 8, 8, 'c'], [-38, 12, 15, 21], [-46, -14, 9, 9, 'c']] }
    ],
    creative: [
      { cat: '책상', name: '라이트 우드 데스크 1600', price: 289000 },
      { cat: '의자', name: '라벤더 패브릭 의자', price: 179000 },
      { cat: '모니터', name: '27인치 QHD 모니터', price: 259000, at: [0, -20, 62, 16] },
      { cat: '모니터 받침대', name: '우드 모니터 받침대', price: 39000, at: [0, -18, 64, 22] },
      { cat: '키보드', name: '파스텔 기계식 키보드', price: 99000, at: [-4, 14, 32, 12] },
      { cat: '마우스', name: '무선 마우스 (화이트)', price: 25000, at: [25, 15, 6, 11, 'c'] },
      { cat: '조명', name: '아치 데스크 램프 (라벤더)', price: 49000, at: [58, -22, 16, 16, 'c'] },
      { cat: '데스크 매트', name: '라벤더 데스크 매트 90cm', price: 25000, at: [0, 10, 90, 38] },
      { cat: '벽 선반', name: '원목 벽 선반 70cm', price: 35000 },
      { cat: '소품', name: '책 · 펜꽂이 · 헤드폰 · 머그 · 노트', price: 62000, at: [[-54, -14, 21, 15], [66, 8, 7, 7, 'c'], [-28, -26, 17, 9], [-42, 16, 8, 8, 'c'], [48, 16, 15, 21]] }
    ]
  };
  const CAT_ORDER = ['책상', '의자', '모니터', '모니터 받침대', '키보드', '마우스', '조명', '데스크 매트', '스피커', '벽 선반', '소품'];
  const FILL = { '모니터': '#5b6472', '모니터 받침대': '#c9a77f', '키보드': '#d8d2c8', '마우스': '#8a8f98', '조명': '#d4a373', '데스크 매트': '#e7e0d4', '스피커': '#9aa0a8', '소품': '#a7c4a0' };

  D.setupParts = id => SETUPS[id] || [];
  D.setupTotal = id => D.setupParts(id).reduce((s, x) => s + x.price, 0);
  D.setupCats = ids => CAT_ORDER.filter(c => ids.some(id => D.setupParts(id).some(x => x.cat === c)));

  D.setupLegend = p => `<ul class="setup-legend">${D.setupParts(p.id).filter(x => x.at).map(x => `<li><i style="background:${FILL[x.cat] || '#bbb'}"></i>${x.cat}${x.cat === '소품' ? ` <span>(${D.escape(x.name)})</span>` : ''}</li>`).join('')}</ul>`;

  // 위에서 내려다본 책상 배치도 (SVG)
  D.setupPlan = p => {
    const W = p.width, Dp = p.depth, pad = 8, shapes = [];
    D.setupParts(p.id).filter(x => x.at).forEach(x => (Array.isArray(x.at[0]) ? x.at : [x.at]).forEach(a => shapes.push({ x, a })));
    shapes.sort((s, t) => t.a[2] * t.a[3] - s.a[2] * s.a[3]);
    const body = shapes.map(({ x, a: [cx, cz, w, d, k] }) => {
      const X = cx + W / 2 + pad, Y = cz + Dp / 2 + pad, f = FILL[x.cat] || '#bbb';
      return k === 'c' ? `<ellipse cx="${X}" cy="${Y}" rx="${w / 2}" ry="${d / 2}" fill="${f}" stroke="#00000022" stroke-width=".4"><title>${x.cat} · ${x.name}</title></ellipse>`
        : `<rect x="${X - w / 2}" y="${Y - d / 2}" width="${w}" height="${d}" rx="1.5" fill="${f}" stroke="#00000022" stroke-width=".4"><title>${x.cat} · ${x.name}</title></rect>`;
    }).join('');
    const labels = D.setupParts(p.id).filter(x => x.at && !Array.isArray(x.at[0]) && x.cat !== '데스크 매트').map(x => {
      const [cx, cz, , d] = x.at, X = cx + W / 2 + pad, Y = cz + Dp / 2 + pad + (x.cat === '모니터 받침대' ? d / 2 + 3.6 : 1.3);
      return `<text x="${X}" y="${Y}" text-anchor="middle" font-size="3.4" fill="#2b2f36" font-weight="600">${x.cat}</text>`;
    }).join('');
    return `<svg class="setup-plan" viewBox="0 0 ${W + pad * 2} ${Dp + pad * 2 + 8}" role="img" aria-label="${D.escape(p.name)} 책상 배치도, 책상 ${W}×${Dp}cm">
      <rect x="${pad}" y="${pad}" width="${W}" height="${Dp}" rx="2" fill="#f3ebe0" stroke="#c8b8a2" stroke-width=".6"/>${body}${labels}
      <text x="${pad + W / 2}" y="${Dp + pad * 2 + 5}" text-anchor="middle" font-size="3.6" fill="#7b8190">앞쪽 · 책상 ${W} × ${Dp} cm</text></svg>`;
  };
})(window.Deskspace);
