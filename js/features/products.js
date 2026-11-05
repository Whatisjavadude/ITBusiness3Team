(function (D) {
  let category = '전체';
  let detailId = null; // 추가: 선택한 제품 상세 화면

  const sampleDepth = { monitor: 20, lamp: 18, keyboard: 13, shelf: 24 };

  const judge = (ratio) => ratio <= 0.5 ? { label: '여유 있어요', tone: 'ok' } : ratio <= 0.75 ? { label: '적당해요', tone: 'ok' } : { label: '확인 필요', tone: 'warning' };

  const fitRows = (p) => {
    const W = D.state.width, Dp = D.state.depth;
    const depth = sampleDepth[p.id] || 0;
    const ids = D.state.products.includes(p.id) ? D.state.products : [...D.state.products, p.id];
    const sumWidth = ids.reduce((s, id) => s + (D.products.find(x => x.id === id)?.width || 0), 0);
    return [
      { name: '책상 너비', ratio: p.width / W, note: `${p.width}cm / ${W}cm` },
      { name: '책상 깊이', ratio: depth / Dp, note: `${depth}cm / ${Dp}cm · 샘플 치수` },
      { name: '현재 구성과 함께', ratio: sumWidth / W, note: `구성 너비 합 ${sumWidth}cm · 겹쳐 놓는 경우는 계산하지 않아요` }
    ].map(r => ({ ...r, ...judge(r.ratio), bar: Math.min(100, Math.round(r.ratio * 100)) }));
  };

  const detailView = (p) => {
    const added = D.state.products.includes(p.id);
    const others = D.products.filter(x => x.id !== p.id).slice(0, 3);
    return `
    <div class="products-crumb"><button class="quiet" data-back>← 제품 목록</button><span>${p.category}</span></div>
    <div class="products-detail">
      <section class="panel products-detail-art">
        ${D.productArt(p)}
        <div class="products-spec">
          <div><span>너비</span><b>${p.width}cm</b></div>
          <div><span>깊이</span><b>${sampleDepth[p.id] || '-'}cm</b></div>
          <div><span>분류</span><b>${p.category}</b></div>
        </div>
      </section>
      <section class="products-detail-info">
        <span class="pill purple">${p.category}</span>
        <h1>${p.name}</h1>
        <p>${p.description}</p>
        <div class="panel products-fitcard">
          <div class="products-fitcard-head"><h2>내 책상에 맞을까?</h2><span class="pill">${D.state.name} · ${D.state.width} × ${D.state.depth}cm</span></div>
          ${fitRows(p).map(r => `
            <div class="products-fitrow ${r.tone}">
              <div><b>${r.name}</b><strong>${r.label}</strong></div>
              <div class="products-bar"><span style="width:${r.bar}%"></span></div>
              <small>${r.note}</small>
            </div>`).join('')}
          <p class="notice">샘플 판정이에요. 실제 서비스에서는 제품 치수 데이터와 책상 크기로 계산해요.</p>
        </div>
        <div class="actions">
          <button data-product="${p.id}" class="${added ? '' : 'primary'}">${added ? '구성에서 빼기' : '내 책상에 추가'}</button>
          <button data-studio>스튜디오에서 놓아보기</button>
        </div>
        <div class="panel products-buy">
          <div><span class="muted">가격 (가상 가격)</span><b>${D.money(p.price)}</b></div>
          <button data-seller>판매처 보기 · 목업</button>
        </div>
      </section>
    </div>
    <h2 class="products-pair-title">이 제품과 함께 쓰는 구성</h2>
    <div class="products-pairs">${others.map(o => `<button class="panel products-pair" data-detail="${o.id}">${D.productArt(o)}<span><b>${o.name}</b><small>${D.money(o.price)} · 가상 가격</small></span></button>`).join('')}</div>`;
  };

  D.features.products = {
    title: '제품 둘러보기',
    mount(root) {
      const detail = detailId && D.products.find(p => p.id === detailId);
      if (detail) {
        root.innerHTML = detailView(detail);
      } else {
        const items=D.products.filter(p=>category==='전체'||p.category===category);
        root.innerHTML=D.heading('DETAILS MAKE THE DIFFERENCE','공간에 어울리는 작은 선택','샘플 제품의 크기와 가격을 확인하고, 내 책상 구성에 더해보세요.')+`<div class="products-filter" aria-label="제품 종류">${['전체',...new Set(D.products.map(p=>p.category))].map(c=>`<button data-category="${c}" aria-pressed="${category===c}">${c}</button>`).join('')}</div><div class="products-grid">${items.map(p=>`<article class="panel">${D.productArt(p)}<div class="products-info"><span class="muted">${p.category}</span><h2>${p.name}</h2><p>${p.description}</p><div class="products-price">${D.money(p.price)}<small>가상 가격</small></div><div class="products-fit ${p.width>D.state.width*.5?'warning':''}">↔ 제품 너비 ${p.width}cm · ${p.width>D.state.width*.5?'여유 공간 확인 필요':'단일 너비 기준 범위 내'}</div><div class="actions"><button data-product="${p.id}" class="${D.state.products.includes(p.id)?'':'primary'}">${D.state.products.includes(p.id)?'구성에서 빼기':'내 책상에 추가'}</button><button data-detail="${p.id}">자세히 보기</button></div></div></article>`).join('')}</div><p class="notice" style="margin-top:20px">적합도는 너비만 비교하는 예시입니다. 제품 간 간섭·깊이·하중은 계산하지 않습니다. 국내 가격 비교와 판매처 API는 담당자가 후속 연결할 목업 영역입니다.</p>`;
        root.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;D.render();}));
      }
      root.querySelectorAll('[data-product]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.product;D.state.products=D.state.products.includes(id)?D.state.products.filter(item=>item!==id):[...D.state.products,id];D.render();D.toast('책상 구성에 반영했습니다.');}));
      // 추가: 상세 화면 이동·버튼
      root.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',()=>{detailId=b.dataset.detail;D.render();window.scrollTo({top:0});}));
      root.querySelector('[data-back]')?.addEventListener('click',()=>{detailId=null;D.render();});
      root.querySelector('[data-studio]')?.addEventListener('click',()=>{if(!D.state.products.includes(detailId))D.state.products=[...D.state.products,detailId];detailId=null;D.go('studio');D.toast('스튜디오 구성에 넣었어요.');});
      root.querySelector('[data-seller]')?.addEventListener('click',()=>D.toast('판매처 연결은 목업이에요. 실제 서비스에서는 제휴·공식 API로 연결해요.'));
    }
  };
})(window.Deskspace);