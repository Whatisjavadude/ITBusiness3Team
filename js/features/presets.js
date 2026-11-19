(function (D) {
  let selected = ['warm','minimal','creative'];
  const MAX = 3;
  // 나란히 비교: 구성품 이름·가격을 항목별로 맞춰 보여주고, 같은 항목에서 가장 싼 쪽을 표시합니다
  function compareHTML() {
    const ps = D.presets.filter(p => selected.includes(p.id)), ids = ps.map(p => p.id);
    if (!ps.length) return '<section class="panel presets-comparison"><div class="panel-heading"><h2>나란히 비교하기</h2></div><p class="muted" style="padding:18px">비교할 프리셋을 선택해 주세요.</p></section>';
    const totals = ids.map(D.setupTotal), minTotal = Math.min(...totals);
    const rows = D.setupCats(ids).map(cat => {
      const cells = ids.map(id => D.setupParts(id).find(x => x.cat === cat)), prices = cells.filter(Boolean).map(x => x.price);
      const low = prices.length > 1 && new Set(prices).size > 1 ? Math.min(...prices) : null;
      return `<tr><th scope="row">${cat}</th>${cells.map(x => x ? `<td><span class="pc-name">${D.escape(x.name)}</span><span class="pc-price ${x.price === low ? 'is-low' : ''}">${D.money(x.price)}${x.price === low ? ' <em>최저</em>' : ''}</span></td>` : '<td class="pc-none">— 없음</td>').join('')}</tr>`;
    }).join('');
    return `<section class="panel presets-comparison"><div class="panel-heading"><h2>나란히 비교하기</h2><span class="muted">최대 ${MAX}개 선택 · 가상 제품·가상 가격</span></div>
      <div class="pc-wrap"><table class="pc-table" style="--pc-cols:${ps.length}">
        <thead><tr><th></th>${ps.map(p => `<th scope="col"><div class="pc-head">${D.presetPhoto(p)}</div><b>${D.escape(p.name)}</b><small>${p.label}</small></th>`).join('')}</tr></thead>
        <tbody>
          <tr class="pc-meta"><th scope="row">책상 크기</th>${ps.map(p => `<td>${p.width} × ${p.depth} cm</td>`).join('')}</tr>
          <tr class="pc-meta"><th scope="row">구성품</th>${ids.map(id => `<td>${D.setupParts(id).length}개</td>`).join('')}</tr>
          ${rows}
        </tbody>
        <tfoot><tr><th scope="row">합계</th>${totals.map(t => `<td><strong class="${ps.length > 1 && t === minTotal ? 'is-low' : ''}">${D.money(t)}</strong>${ps.length > 1 && t !== minTotal ? `<small>+${D.money(t - minTotal)}</small>` : ps.length > 1 ? '<small>가장 저렴</small>' : ''}</td>`).join('')}</tr>
          <tr><th></th>${ps.map(p => `<td><button class="primary" data-apply="${p.id}">내 책상에 적용</button></td>`).join('')}</tr></tfoot>
      </table></div></section>`;
  }
  D.features.presets = {
    title: '프리셋 · 비교',
    mount(root) {
      root.innerHTML = D.heading('A LITTLE INSPIRATION', '내 공간의 다음 가능성', '마음에 드는 구성으로 시작하거나, 두 가지 선택을 나란히 비교해 보세요.') + `<div class="presets-grid">${D.presets.map(p => `<article class="panel"><div class="presets-art">${D.presetPhoto(p)}</div><div class="presets-info"><div class="eyebrow">${p.label}</div><h2>${D.escape(p.name)}</h2><p>${p.description}</p><div class="presets-meta"><span>${p.width} × ${p.depth} cm</span><span>구성 ${D.setupParts(p.id).length}개 · ${D.money(D.setupTotal(p.id))}</span></div><div class="actions"><button class="primary" data-apply="${p.id}">내 책상에 적용</button><button data-compare="${p.id}" aria-pressed="${selected.includes(p.id)}">${selected.includes(p.id) ? '✓ 비교 선택됨' : '비교 선택'}</button></div></div></article>`).join('')}</div>${compareHTML()}<p class="notice" style="margin-top:16px">저장한 구성과 변경 사항은 현재 탭에서만 유지됩니다. 새로고침하면 기본 샘플로 돌아갑니다.</p>`;
      root.querySelectorAll('[data-apply]').forEach(button => button.addEventListener('click', () => {const p=D.presets.find(item=>item.id===button.dataset.apply); Object.assign(D.state,{name:p.name,style:p.style,width:p.width,depth:p.depth,products:[...p.products]}); D.go('studio'); D.toast('프리셋을 내 데스크에 적용했습니다.');}));
      root.querySelectorAll('[data-compare]').forEach(button => button.addEventListener('click', () => {const id=button.dataset.compare;if(selected.includes(id)) selected=selected.filter(item=>item!==id); else if(selected.length<MAX) selected.push(id); else {D.toast('선택된 프리셋 하나를 해제한 후 추가해 주세요.');return;} D.render();}));
    }
  };
})(window.Deskspace);
