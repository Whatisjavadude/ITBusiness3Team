(function (D) {
  const recommended = ['keyboard', 'monitor', 'shelf', 'lamp'];
  const meta = {
    keyboard: { reason: '① 매일 손이 닿는 것' },
    monitor:  { reason: '① 매일 보는 것' },
    shelf:    { reason: '② 모니터 높이의 기준' },
    lamp:     { reason: '③ 남은 예산으로', sale: '샘플 10% 할인 · 이번 주' }
  };

  let order = recommended.slice();
  let alertOn = false;

  const isMoved = () => order.join() !== recommended.join();

  D.features.roadmap = {
    title: '구매 로드맵',
    mount(root) {
      const saleItems = order.map(id => D.products.find(p => p.id === id)).filter(p => meta[p.id].sale);

      const rows = order.map((id, index) => {
        const p = D.products.find(item => item.id === id);
        const m = meta[id];
        return `
        <article class="panel roadmap-row ${m.sale ? 'is-sale' : ''}">
          <span class="roadmap-number">${index + 1}</span>
          ${D.productArt(p)}
          <div class="roadmap-info">
            <div class="roadmap-title">
              <h2>${p.name}</h2>
              ${m.sale ? `<span class="roadmap-sale">${m.sale}</span>` : ''}
            </div>
            <p>${D.money(p.price)} · 가상 가격</p>
            <span class="roadmap-reason">${m.reason}</span>
          </div>
          <div class="actions">
            <button data-move="${index}" data-delta="-1" aria-label="${p.name} 순서 올리기" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button data-move="${index}" data-delta="1" aria-label="${p.name} 순서 내리기" ${index === order.length - 1 ? 'disabled' : ''}>↓</button>
          </div>
        </article>`;
      }).join('');

      const movedNotice = isMoved() ? `
        <div class="roadmap-moved">
          <span>순서를 직접 바꿨어요. 추천 순서와 달라도 괜찮아요.</span>
          <button data-reset>추천 순서로 되돌리기</button>
        </div>` : '';

      const saleBox = saleItems.length ? `
        <div class="roadmap-sale-box">
          <b>할인 중인 제품 ${saleItems.length}개</b>
          <p>${saleItems.map(p => p.name).join(', ')} 제품이 샘플 할인 중이에요. 지금 사려면 순서를 앞으로 옮겨 보세요.</p>
          <small>가상 할인 예시이며 실제 행사와 연결되지 않아요.</small>
        </div>` : '';

      root.innerHTML = D.heading(
        'ONE STEP CLOSER',
        '좋아하는 공간을, 차근차근',
        '추천 순서를 기본으로 보여주고, 할인 중인 제품은 따로 알려줘요. 순서는 직접 바꿀 수 있어요.'
      ) + `
      <div class="roadmap-layout">
        <section class="roadmap-list" aria-label="구매 순서">
          ${rows}
          ${movedNotice}
        </section>
        <aside class="roadmap-side">
          <div class="panel roadmap-summary">
            <span class="muted">내 계획의 샘플 합계</span>
            <strong>${D.money(D.total(order))}</strong>
            <p>${order.length}개 제품 · 할인은 합계에 넣지 않았어요</p>
          </div>
          ${saleBox}
          <div class="panel roadmap-alert">
            <div>
              <b>할인 알림 받기</b>
              <p>로드맵 제품이 할인하면 알려줘요 (목업)</p>
            </div>
            <button class="roadmap-switch" data-alert aria-pressed="${alertOn}" aria-label="할인 알림 받기"><span></span></button>
          </div>
          <div class="panel roadmap-rule">
            <b>추천 순서 기준</b>
            <p>① 매일 몸에 닿는 것 → ② 다른 제품의 기준이 되는 것 → ③ 남은 예산으로 채우는 것</p>
          </div>
        </aside>
      </div>`;

      root.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
        const from = Number(b.dataset.move), to = from + Number(b.dataset.delta);
        if (to < 0 || to >= order.length) return;
        [order[from], order[to]] = [order[to], order[from]];
        D.render();
      }));

      root.querySelector('[data-reset]')?.addEventListener('click', () => {
        order = recommended.slice();
        D.render();
        D.toast('추천 순서로 되돌렸어요.');
      });

      root.querySelector('[data-alert]').addEventListener('click', () => {
        alertOn = !alertOn;
        D.render();
        D.toast(alertOn ? '할인 알림을 켰어요. (목업이라 실제 알림은 가지 않아요)' : '할인 알림을 껐어요.');
      });
    }
  };
})(window.Deskspace);