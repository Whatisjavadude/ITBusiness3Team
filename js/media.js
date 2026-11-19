/* 프리셋·제품·커뮤니티 이미지 슬롯.
 * 사진 파일을 정해진 이름으로 assets 폴더에 넣기만 하면 화면에 바로 나옵니다 (코드 수정 없음).
 *   제품     assets/products/<제품id>.jpg (또는 .png)   예) monitor.jpg, lamp.jpg, keyboard.jpg, shelf.jpg
 *   커뮤니티 assets/community/post-1.jpg ~ post-3.jpg (또는 .png)   팀원 책상 사진
 * 사진이 없으면 → 3D 렌더 이미지 → 그것도 없으면 기존 아이콘/SVG 순서로 대신 보여줍니다. */
(function (D) {
  const both = base => [base + '.jpg', base + '.png'];
  const M = D.media = {
    preset: style => [`assets/presets/${style}.webp`],                       // 3D 렌더 (프리셋은 렌더가 기본)
    product: id => [...both(`assets/products/${id}`), `assets/products/${id}-render.webp`],
    community: (i, style) => [...both(`assets/community/post-${i + 1}`), ...M.preset(style)]
  };
  const img = (srcs, alt) => `<img class="media-img" src="${srcs[0]}" data-next="${srcs.slice(1).join('|')}" alt="${D.escape(alt)}" loading="lazy" decoding="async" onerror="Deskspace.mediaNext(this)">`;
  D.mediaNext = el => {
    const rest = (el.dataset.next || '').split('|').filter(Boolean);
    if (rest.length) { el.dataset.next = rest.slice(1).join('|'); el.src = rest[0]; }
    else { el.parentNode.classList.remove('has-media'); el.remove(); }
  };
  const baseArt = D.productArt;
  D.productArt = p => baseArt(p).replace('class="product-art ', 'class="product-art has-media ').replace(/<\/div>$/, img(M.product(p.id), p.name) + '</div>');
  D.presetPhoto = p => `<div class="media-frame has-media">${img(M.preset(p.style), p.name + ' 구성 예시 이미지')}${D.scene(p.style, p.products)}</div>`;
  D.communityPhoto = (i, p) => `<div class="media-frame has-media">${img(M.community(i, p.style), '게시물 책상 사진')}${D.scene(p.style, p.products)}</div>`;
})(window.Deskspace);
