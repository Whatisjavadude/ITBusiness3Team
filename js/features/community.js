(function (D) {
  const liked=new Set();
  D.features.community={
    title:'커뮤니티',
    mount(root){
      const titles=['퇴근 후, 나만의 작은 서재','작은 책상도 충분하니까','아이디어가 떠오르는 오후'];
      root.innerHTML=D.heading('SPACES & STORIES','다른 사람의 책상에서 찾는 영감','다양한 작업공간의 예시를 살펴보세요. 아래 게시물은 모두 샘플입니다.')+`<div class="community-grid">${D.presets.slice(0,3).map((p,i)=>`<article class="panel"><div class="community-photo">${D.scene(p.style,p.products)}</div><div class="community-info"><span class="pill">${['우드톤','미니멀','크리에이티브'][i]}</span><h2>${titles[i]}</h2><p>${p.description}</p><footer><span>데모 메이커 ${i+1}</span><button data-like="${i}" aria-pressed="${liked.has(i)}" aria-label="${titles[i]} 좋아요">${liked.has(i)?'♥':'♡'} ${[24,18,32][i]+(liked.has(i)?1:0)}</button></footer></div></article>`).join('')}</div><p class="notice" style="margin-top:20px">게시·댓글·계정 기능은 팀원 작업 영역입니다. 현재는 카드 배치와 좋아요 상태만 시연합니다.</p>`;
      root.querySelectorAll('[data-like]').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.like);liked.has(id)?liked.delete(id):liked.add(id);D.render();}));
    }
  };
})(window.Deskspace);
