(function (D) {
  const liked=new Set();
  let detail=null;

  const sampleComments=[
    [{ who:'샘플 사용자 A', text:'램프 위치 좋네요. 책상 깊이가 70cm면 모니터 거리도 괜찮을까요?' },{ who:'데모 메이커 1 · 작성자', text:'네, 받침대 없이 쓰니까 여유 있었어요.' }],
    [{ who:'샘플 사용자 B', text:'작은 책상인데 답답해 보이지 않아서 좋아요.' }],
    []
  ];

  D.features.community={
    title:'커뮤니티',
    mount(root){
      const titles=['퇴근 후, 나만의 작은 서재','작은 책상도 충분하니까','아이디어가 떠오르는 오후'];
      const tags=['우드톤','미니멀','크리에이티브'];

      if(detail!==null){
        const i=detail, p=D.presets[i];
        const items=p.products.map(id=>D.products.find(x=>x.id===id));
        const comments=sampleComments[i]||[];
        root.innerHTML=`
        <div class="community-crumb"><button class="quiet" data-back>← 커뮤니티</button><span>게시물</span></div>
        <div class="community-detail">
          <section class="community-detail-main">
            <div class="panel community-detail-photo">${D.scene(p.style,p.products)}</div>
            <div class="panel community-comments">
              <h2>댓글 ${comments.length}</h2>
              ${comments.length?comments.map(c=>`<div class="community-comment"><b>${c.who}</b><p>${c.text}</p></div>`).join(''):'<p class="muted">아직 댓글이 없어요.</p>'}
              <form class="community-comment-form" data-comment><label for="community-comment-input" class="community-sr">댓글 입력</label><input id="community-comment-input" placeholder="댓글 달기 (목업)"><button>등록</button></form>
            </div>
          </section>
          <section class="community-detail-side">
            <span class="pill purple">${tags[i]}</span>
            <h1>${titles[i]}</h1>
            <span class="muted">데모 메이커 ${i+1} · 책상 ${p.width} × ${p.depth}cm · 샘플 게시물</span>
            <p>${p.description}</p>
            <div class="actions">
              <button data-like="${i}" aria-pressed="${liked.has(i)}" aria-label="${titles[i]} 좋아요">${liked.has(i)?'♥':'♡'} 좋아요 ${[24,18,32][i]+(liked.has(i)?1:0)}</button>
              <button data-save>저장</button>
            </div>
            <div class="panel community-items">
              <div class="community-items-head"><h2>이 책상에 쓰인 제품</h2><span class="muted">내 책상 ${D.state.width}cm 기준</span></div>
              ${items.map(x=>{const warn=x.width>D.state.width*.5;return `<div class="community-item">${D.productArt(x)}<div><b>${x.name}</b><small>${D.money(x.price)} · 가상 가격</small></div><strong class="${warn?'warning':''}">${warn?'확인 필요':'여유 있어요'}</strong></div>`;}).join('')}
            </div>
            <div class="community-import">
              <b>내 책상 크기로 불러오기</b>
              <p>이 세팅을 내 책상(${D.state.width} × ${D.state.depth}cm)에 맞춰 스튜디오에서 열어요.</p>
              <button class="primary" data-import>스튜디오에서 열기</button>
            </div>
          </section>
        </div>`;
        root.querySelector('[data-back]').addEventListener('click',()=>{detail=null;D.render();});
        root.querySelector('[data-save]').addEventListener('click',()=>D.toast('저장은 목업이에요. 계정 기능이 붙으면 동작해요.'));
        root.querySelector('[data-comment]').addEventListener('submit',e=>{e.preventDefault();D.toast('댓글 등록은 목업이에요.');});
        root.querySelector('[data-import]').addEventListener('click',()=>{D.state.style=p.style;D.state.products=p.products.slice();detail=null;D.go('studio');D.toast('게시물 세팅을 내 책상에 불러왔어요.');});
      } else {
        root.innerHTML=D.heading('SPACES & STORIES','다른 사람의 책상에서 찾는 영감','다양한 작업공간의 예시를 살펴보세요. 아래 게시물은 모두 샘플입니다.','<button data-write>+ 내 책상 공유하기</button>')+`<div class="community-grid">${D.presets.slice(0,3).map((p,i)=>`<article class="panel"><div class="community-photo">${D.scene(p.style,p.products)}</div><div class="community-info"><span class="pill">${tags[i]}</span><h2>${titles[i]}</h2><p>${p.description}</p><footer><span>데모 메이커 ${i+1}</span><span class="actions"><button data-open="${i}">자세히</button><button data-like="${i}" aria-pressed="${liked.has(i)}" aria-label="${titles[i]} 좋아요">${liked.has(i)?'♥':'♡'} ${[24,18,32][i]+(liked.has(i)?1:0)}</button></span></footer></div></article>`).join('')}</div><p class="notice" style="margin-top:20px">게시·댓글·계정 기능은 팀원 작업 영역입니다. 현재는 카드 배치와 좋아요 상태만 시연합니다.</p>`;
        root.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>{detail=Number(b.dataset.open);D.render();window.scrollTo({top:0});}));
        root.querySelector('[data-write]').addEventListener('click',()=>D.toast('글쓰기 화면은 목업 예정이에요.'));
      }
      root.querySelectorAll('[data-like]').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.like);liked.has(id)?liked.delete(id):liked.add(id);D.render();}));
    }
  };
})(window.Deskspace);