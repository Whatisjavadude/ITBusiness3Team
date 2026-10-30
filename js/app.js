(function (D) {
  const root=document.querySelector('#page');
  D.current=()=>Object.hasOwn(D.features,location.hash.slice(1))?location.hash.slice(1):'studio';
  D.go=page=>{if(D.current()===page)D.render();else location.hash=page;};
  D.render=()=>{
    const key=D.current(),feature=D.features[key];
    document.querySelector('#breadcrumb-title').textContent=feature.title;
    document.title=`${feature.title} · Deskspace`;
    document.querySelectorAll('nav [data-page]').forEach(a=>{if(a.dataset.page===key)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(D.state.screen==='ready')feature.mount(root);
    else if(D.state.screen==='loading')root.innerHTML=D.heading('PREVIEW STATE',feature.title,'불러오는 중 화면 예시입니다. 하단 화면 상태에서 기본으로 돌아갈 수 있습니다.')+'<div role="status" aria-label="불러오는 중" class="skeleton"></div>';
    else {
      const empty=D.state.screen==='empty';
      root.innerHTML=D.heading('PREVIEW STATE',feature.title,'화면 상태 예시')+`<section class="panel empty-state"><div class="large-symbol">${empty?'◇':'↻'}</div><h2>${empty?'아직 담긴 내용이 없어요':'화면을 불러오지 못했어요'}</h2><p>${empty?'샘플 구성을 불러와 첫 작업공간을 만들어보세요.':'잠시 후 다시 시도해 주세요. 현재는 오류 화면 시연입니다.'}</p><button class="primary" id="restore-screen">${empty?'샘플 불러오기':'다시 시도'}</button></section>`;
      root.querySelector('#restore-screen').addEventListener('click',()=>{D.state.screen='ready';document.querySelector('#screen-state').value='ready';D.render();});
    }
  };
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=D.icon(el.dataset.icon));
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();root.focus();});
  document.querySelector('#screen-state').addEventListener('change',event=>{D.state.screen=event.target.value;D.render();});
  window.addEventListener('hashchange',()=>{D.state.screen='ready';document.querySelector('#screen-state').value='ready';D.render();root.focus({preventScroll:true});window.scrollTo({top:0});});
  D.render();
})(window.Deskspace);
