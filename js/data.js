/* 모든 가격·제품·사용자·추천 결과는 가상 샘플입니다. 외부 API를 호출하지 않습니다. */
window.Deskspace = {
  features: {},
  state: { name: '나의 첫 번째 데스크', style: 'warm', width: 140, depth: 70, products: ['monitor', 'lamp', 'keyboard'], screen: 'ready' },
  products: [
    { id: 'monitor', name: '슬림 모니터 27', category: '디스플레이', price: 189000, width: 61, icon: 'monitor', tone: 'sand', description: '시야를 넓혀주는 가벼운 디자인' },
    { id: 'lamp', name: '아치 데스크 램프', category: '조명', price: 49000, width: 18, icon: 'lamp', tone: 'rose', description: '작업에 집중하는 은은한 빛' },
    { id: 'keyboard', name: '컴팩트 키보드', category: '주변기기', price: 59000, width: 32, icon: 'keyboard', tone: 'lilac', description: '공간을 여유롭게 만드는 작은 변화' },
    { id: 'shelf', name: '우드 모니터 받침대', category: '수납', price: 39000, width: 80, icon: 'shelf', tone: 'sage', description: '책상 위 공간을 한 층 더' }
  ],
  presets: [
    { id: 'warm', name: '따뜻한 몰입', style: 'warm', label: 'WARM & NATURAL', description: '우드와 따뜻한 빛이 만나는 공간', products: ['monitor', 'lamp', 'keyboard'], width: 140, depth: 70 },
    { id: 'minimal', name: '가벼운 시작', style: 'minimal', label: 'CLEAN & SIMPLE', description: '꼭 필요한 것들로 채운 책상', products: ['monitor', 'keyboard'], width: 120, depth: 60 },
    { id: 'creative', name: '아이디어가 자라는 곳', style: 'creative', label: 'SOFT & CREATIVE', description: '차분한 색감에 작은 영감을 더해', products: ['monitor', 'lamp', 'shelf'], width: 160, depth: 80 }
  ]
};
