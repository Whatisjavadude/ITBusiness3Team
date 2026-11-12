(function (D) {
  const paths = {
    cube: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9M8 5.3l8 4.5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bag: '<path d="M4 7h16l1 14H3L4 7Zm4 0V6a4 4 0 0 1 8 0v1"/>',
    people: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5"/>',
    route: '<circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h8"/>',
    save: '<path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h10V3M7 21v-8h10v8"/>',
    arrow: '<path d="M12 19V5m-6 6 6-6 6 6"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M12 17v4m-5 0h10"/>',
    lamp: '<path d="M7 21h10M12 21V10m-6 0h12L15 3H9l-3 7Z"/>',
    keyboard: '<rect x="1" y="6" width="22" height="12" rx="2"/><path d="M4 10h2m3 0h2m3 0h2m3 0h1M5 14h2m3 0h9"/>',
    shelf: '<path d="M2 8h20v4H2zM5 12v8m14-8v8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="2"/><path d="m3 17 6-6 4 4 3-3 5 5"/>'
  };
  D.icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
  D.escape = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  D.money = (value) => `${value.toLocaleString('ko-KR')}원`;
  D.total = (ids) => ids.reduce((sum, id) => sum + (D.products.find(p => p.id === id)?.price || 0), 0);
  D.toast = (message) => { const node = document.querySelector('#toast'); node.textContent = message; node.classList.add('show'); clearTimeout(D.toastTimer); D.toastTimer = setTimeout(() => node.classList.remove('show'), 3500); };
  D.heading = (eyebrow, title, text, actions = '') => `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${text}</p></div><div class="actions">${actions}</div></div>`;
  D.productArt = (p) => `<div class="product-art ${p.tone}">${D.icon(p.icon)}</div>`;
  // 실제 3D가 아닌 교체 가능한 SVG 샘플. 시뮬레이터 담당자는 이 경계에서 구현을 교체합니다.
  D.scene = (style = 'warm', ids = ['monitor', 'lamp', 'keyboard']) => {
    const themes = { warm: ['#e7e0d4','#d5b28a','#af8b65','#bec9ba','#717d77'], minimal: ['#e3e7eb','#f5f5f0','#c8cdce','#d6dce2','#7a8895'], creative: ['#e6e0ed','#cbc4dc','#aaa1bf','#c8bdd7','#8d7ba4'] };
    const [wall, top, edge, screen, accent] = themes[style] || themes.warm;
    return `<svg viewBox="0 0 700 490" class="desk-scene" role="img" aria-label="${style === 'warm' ? '우드' : style === 'minimal' ? '미니멀' : '라벤더'} 스타일 책상 배치 샘플. 실제 3D 모델이 아닙니다.">
      <ellipse cx="365" cy="424" rx="230" ry="31" fill="#34404b" opacity=".06"/>
      <path d="M118 275V103l260-55 207 102v178l-259 85Z" fill="${wall}"/>
      <path d="M378 48v222L118 325V103Z" fill="#fff" opacity=".18"/>
      <path d="m118 275 260-55 207 108-259 85Z" fill="#fff" opacity=".48"/>
      <path d="m148 292 218-45 183 89-218 48Z" fill="#39404e" opacity=".08"/>
      <path d="M173 302v110l14 6V306m294 16v85l13-3v-89M350 358v84l14-3v-85" fill="#6b6d69"/>
      <path d="m159 272 224-47 147 74-224 49Z" fill="${top}"/>
      <path d="m159 272 147 76 224-49v14l-224 49-147-76Z" fill="${edge}"/>
      <path d="m173 275 210-44 131 66-209 45Z" fill="#fff" opacity=".08"/>
      ${ids.includes('shelf') ? '<path d="m255 253 130-28 65 32-130 29Z" fill="#d2b898"/><path d="m255 253 65 33 130-29v10l-130 30-65-33Z" fill="#a78a69"/>' : ''}
      ${ids.includes('monitor') ? `<path d="m306 277 47-10 28 14-47 10Z" fill="#797e80"/><path d="m339 236 12-2v44l-12 2Z" fill="#65696c"/><path d="m263 160 141-30 0 113-141 30Z" fill="#42484d"/><path d="m269 166 129-27v96l-129 28Z" fill="${screen}"/><path d="m269 220 56-50 73 42v23l-129 28Z" fill="${accent}" opacity=".46"/><path d="m269 241 87-52 42 29v17l-129 28Z" fill="#fff" opacity=".24"/><path d="m404 130 7 4v113l-148 31v-5l141-30Z" fill="#343b3e"/>` : ''}
      ${ids.includes('keyboard') ? '<path d="m281 298 83-18 43 22-84 18Z" fill="#f1ede5"/><path d="m281 298 42 22 84-18v5l-84 18-42-22Z" fill="#c7c4bf"/><path d="m291 298 69-14m-61 19 69-14m-60 19 67-14" stroke="#c4c1bc" stroke-width="3"/><ellipse cx="429" cy="296" rx="11" ry="7" fill="#ecebe5" transform="rotate(22 429 296)"/>' : ''}
      ${ids.includes('lamp') ? `<ellipse cx="467" cy="274" rx="20" ry="8" fill="${accent}"/><path d="M467 271v-82l-27-14" fill="none" stroke="${accent}" stroke-width="6"/><path d="m421 171 25-8 17 22-38 10Z" fill="${accent}"/><ellipse cx="444" cy="190" rx="20" ry="7" fill="#fff3cc" transform="rotate(-10 444 190)"/>` : ''}
      <path d="m198 270 17 7 16-4 2-27-38-6Z" fill="#d3c5b4"/><ellipse cx="215" cy="243" rx="19" ry="7" fill="#b6a590"/>
      <path d="M215 243v-43m0 22c-25-4-21-28-21-28 21 1 21 28 21 28Zm0-10c23-5 23-28 23-28-20 2-23 28-23 28Z" fill="#7f987e" stroke="#7f987e" stroke-width="3"/>
      <path d="m277 412 24-48q10-13 28-9l48 23q8 7 3 18l-12 20Z" fill="${accent}"/><path d="m281 411 41 21 48-11-43-22Z" fill="${screen}"/><path d="m322 431-2 25m-24-2 24-3 26 7" fill="none" stroke="#747a7a" stroke-width="5"/>
    </svg>`;
  };
})(window.Deskspace);
