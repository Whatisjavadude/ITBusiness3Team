(function (D) {
  const photos = { desk: '', style: '' };
  D.features.studio = {
    title: '내 데스크 스튜디오',
    mount(root) {
      const state = D.state;
      root.innerHTML = D.heading('YOUR SPACE, YOUR WAY', '나다운 공간을 만들어보세요', '책상을 꾸미고, 대화로 다듬고, 나에게 맞는 구성을 찾아보세요.', `<a class="btn" href="#presets">${D.icon('grid')} 프리셋 불러오기</a><button class="primary" id="save-layout">${D.icon('save')} 구성 저장</button>`) + `
      <div class="studio-grid"><div class="studio-main">
        <section class="panel" aria-label="책상 배치 미리보기"><div class="panel-heading"><h2>${D.escape(state.name)}</h2><div class="studio-tools"><span class="pill purple">배치 미리보기</span><button id="reset-layout">초기화</button></div></div>
          <div class="studio-canvas"><span class="studio-canvas-label">${D.icon('cube').replace('class="icon"','class="icon" style="width:12px;height:12px;display:inline;vertical-align:middle;margin-right:4px"')} 공간 미리보기 · 샘플</span>${D.scene(state.style, state.products)}<div class="studio-canvas-bottom"><span class="studio-dim">책상 ${state.width} × ${state.depth} cm</span><div class="studio-style-switch" aria-label="스타일 선택">${[['warm','내추럴'],['minimal','미니멀'],['creative','크리에이티브']].map(([key,label]) => `<button data-style="${key}" aria-pressed="${state.style === key}">${label}</button>`).join('')}</div></div></div>
          <form class="studio-config" id="dimensions"><label>책상 너비 (cm)<input type="number" name="width" value="${state.width}" min="80" max="240" required></label><label>책상 깊이 (cm)<input type="number" name="depth" value="${state.depth}" min="40" max="120" required></label><button type="submit">크기 적용</button><span class="muted">입력값 표시 데모<br>배치 이미지는 실측 비율이 아닙니다</span></form>
        </section>
        <section class="panel"><div class="panel-heading"><h2>이 공간을 채운 제품 <span class="muted">${state.products.length}</span></h2><a class="muted" href="#products">전체 보기 ↗</a></div><div class="studio-products">${state.products.map(id => { const p = D.products.find(item => item.id === id); return `<article class="studio-item">${D.productArt(p)}<div><strong>${p.name}</strong><small>${D.money(p.price)}</small><a href="#products"> 제품 살펴보기</a></div></article>`; }).join('')}</div></section>
      </div><section class="panel assistant-panel" id="assistant" aria-label="AI 공간 어시스턴트"></section></div>
      <section class="panel studio-upload"><div><label for="desk-photo">${D.icon('photo').replace('class="icon"','class="icon" style="display:inline;vertical-align:middle;margin-right:5px"')} 내 책상 사진<input id="desk-photo" type="file" accept="image/png,image/jpeg,image/webp" data-photo="desk"></label><p>PNG·JPG·WebP, 5MB 이하 · 이 탭에서만 미리 봅니다.</p><div id="preview-desk">${photos.desk ? `<img class="studio-preview" src="${photos.desk}" alt="선택한 책상 사진">` : ''}</div></div><div><label for="style-photo">원하는 스타일 사진<input id="style-photo" type="file" accept="image/png,image/jpeg,image/webp" data-photo="style"></label><p>사진 분석·3D 변환은 이후 담당자가 연결할 영역입니다.</p><div id="preview-style">${photos.style ? `<img class="studio-preview" src="${photos.style}" alt="선택한 스타일 사진">` : ''}</div></div></section>`;
      D.assistant.mount(root.querySelector('#assistant'));
      root.querySelectorAll('[data-style]').forEach(button => button.addEventListener('click', () => { D.state.style = button.dataset.style; D.render(); }));
      root.querySelector('#dimensions').addEventListener('submit', event => { event.preventDefault(); const form = new FormData(event.currentTarget); D.state.width = Number(form.get('width')); D.state.depth = Number(form.get('depth')); D.render(); D.toast('책상 크기를 반영했습니다. 배치 이미지는 샘플입니다.'); });
      root.querySelector('#save-layout').addEventListener('click', () => {
        const saved = { id: `saved-${Date.now()}`, name: `저장한 구성 ${D.presets.filter(p=>p.id.startsWith('saved')).length+1}`, style: D.state.style, width: D.state.width, depth: D.state.depth, products: [...D.state.products], label: 'MY PRESET', description: '현재 브라우저 탭에서 저장한 구성' };
        D.presets.push(saved); D.toast('프리셋에 저장했습니다. 새로고침하면 초기화됩니다.');
      });
      root.querySelector('#reset-layout').addEventListener('click', () => { Object.assign(D.state, { name: '나의 첫 번째 데스크', style: 'warm', width: 140, depth: 70, products: ['monitor','lamp','keyboard'] }); D.render(); });
      root.querySelectorAll('[data-photo]').forEach(input => input.addEventListener('change', () => {
        const file = input.files[0]; if (!file) return;
        if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { input.value = ''; D.toast('5MB 이하의 PNG, JPG, WebP 이미지를 선택해 주세요.'); return; }
        const key = input.dataset.photo; const url = URL.createObjectURL(file); const img = new Image(); img.alt = key === 'desk' ? '선택한 책상 사진' : '선택한 스타일 사진'; img.className = 'studio-preview';
        img.onload = () => { if (photos[key]) URL.revokeObjectURL(photos[key]); photos[key] = url; root.querySelector(`#preview-${key}`).replaceChildren(img); };
        img.onerror = () => { URL.revokeObjectURL(url); input.value = ''; D.toast('이미지를 읽을 수 없습니다. 다른 파일을 선택해 주세요.'); };
        img.src = url;
      }));
    }
  };
})(window.Deskspace);
