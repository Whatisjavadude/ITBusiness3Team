(function (D) {
  let category = '전체';
  D.features.products = {
    title: '제품 둘러보기',
    mount(root) {
      const items=D.products.filter(p=>category==='전체'||p.category===category);
      root.innerHTML=D.heading('DETAILS MAKE THE DIFFERENCE','공간에 어울리는 작은 선택','샘플 제품의 크기와 가격을 확인하고, 내 책상 구성에 더해보세요.')+`<div class="products-filter" aria-label="제품 종류">${['전체',...new Set(D.products.map(p=>p.category))].map(c=>`<button data-category="${c}" aria-pressed="${category===c}">${c}</button>`).join('')}</div><div class="products-grid">${items.map(p=>`<article class="panel">${D.productArt(p)}<div class="products-info"><span class="muted">${p.category}</span><h2>${p.name}</h2><p>${p.description}</p><div class="products-price">${D.money(p.price)}<small>가상 가격</small></div><div class="products-fit ${p.width>D.state.width*.5?'warning':''}">↔ 제품 너비 ${p.width}cm · ${p.width>D.state.width*.5?'여유 공간 확인 필요':'단일 너비 기준 범위 내'}</div><div class="actions"><button data-product="${p.id}" class="${D.state.products.includes(p.id)?'':'primary'}">${D.state.products.includes(p.id)?'구성에서 빼기':'내 책상에 추가'}</button></div></div></article>`).join('')}</div><p class="notice" style="margin-top:20px">적합도는 너비만 비교하는 예시입니다. 제품 간 간섭·깊이·하중은 계산하지 않습니다. 국내 가격 비교와 판매처 API는 담당자가 후속 연결할 목업 영역입니다.</p>`;
      root.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;D.render();}));
      root.querySelectorAll('[data-product]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.product;D.state.products=D.state.products.includes(id)?D.state.products.filter(item=>item!==id):[...D.state.products,id];D.render();D.toast('책상 구성에 반영했습니다.');}));
    }
  };
})(window.Deskspace);
