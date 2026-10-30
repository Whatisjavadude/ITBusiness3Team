(function (D) {
  const order=['monitor','keyboard','lamp','shelf'];
  D.features.roadmap={title:'구매 로드맵',mount(root){
    root.innerHTML=D.heading('ONE STEP CLOSER','좋아하는 공간을, 차근차근','필요한 순서대로 구매 계획을 정리해보세요. 화살표로 순서를 바꿀 수 있어요.')+`<div class="roadmap-layout"><div class="roadmap-list">${order.map((id,index)=>{const p=D.products.find(p=>p.id===id);return `<article class="panel roadmap-row"><span class="roadmap-number">${index+1}</span>${D.productArt(p)}<div><h2>${p.name}</h2><p>${D.money(p.price)} · 가상 가격</p></div><div class="actions"><button data-move="${index}" data-delta="-1" aria-label="${p.name} 우선순위 올리기" ${index===0?'disabled':''}>↑</button><button data-move="${index}" data-delta="1" aria-label="${p.name} 우선순위 내리기" ${index===order.length-1?'disabled':''}>↓</button></div></article>`;}).join('')}</div><aside class="panel roadmap-summary"><span class="muted">내 계획의 샘플 합계</span><strong>${D.money(D.total(order))}</strong><p>${order.length}개의 제품으로 완성하는<br>나만의 작업공간</p><div class="notice">할인 정보 예시<br><b>아치 데스크 램프 · 샘플 10% 할인</b><br>가상 할인 예시이며 실제 행사·알림과 연결되지 않습니다. 합계에는 반영하지 않습니다.</div></aside></div>`;
    root.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>{const from=Number(b.dataset.move),to=from+Number(b.dataset.delta);if(to<0||to>=order.length)return;[order[from],order[to]]=[order[to],order[from]];D.render();}));
  }};
})(window.Deskspace);
