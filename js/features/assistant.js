/*
 * 발표용 AI 공간 어시스턴트 - 선택형 대화 7종
 * 실제 생성형 AI 호출 없음. 기존 data.js 샘플 4개 제품 / 3개 테마에만 연결합니다.
 * 드롭다운으로 시나리오 선택 -> 질문 버튼 -> 준비된 답변 -> 3D 책상 갱신
 */
(function (D) {
  'use strict';

  const kit = {
    basic: ['monitor', 'keyboard'],                               // 248,000원
    warm: ['monitor', 'lamp', 'keyboard'],                        // 297,000원
    withShelf: ['monitor', 'keyboard', 'shelf'],                  // 287,000원
    creative: ['monitor', 'lamp', 'shelf'],                       // 277,000원
    full: ['monitor', 'lamp', 'keyboard', 'shelf']                // 336,000원
  };
  const config = (style, width, depth, products) => ({ style, width, depth, products });
  const price = products => D.money(D.total(products));

  /*
   * preset: 드롭다운에 표시되는 독립적인 시연 시나리오
   * initial: 시나리오를 고르면 바로 3D에 적용할 첫 번째 구성
   * steps: 버튼으로 순서대로 진행할 질문과 답변
   * apply: 실제 3D 구성이 변경되는 단계만 설정 (나머지는 설명만 표시)
   */
  const presets = [
    {
      id: 'wood-budget', title: '01 · 우드톤 + 예산 조정',
      subtitle: '30만원 구성 → 25만원 조정 → 추가 구매 판단',
      intro: '따뜻한 우드톤 데스크를 함께 구성해 볼게요. 예산을 바꾸면 제품 목록도 실제로 달라지는 시나리오입니다.',
      initial: config('warm', 140, 70, kit.warm),
      steps: [
        {
          question: '30만원으로 우드톤 데스크를 추천해 줘.',
          reply: () => `우드톤 140×70cm 책상에 모니터·키보드·조명을 구성했어요. 샘플 합계는 ${price(kit.warm)}으로 30만원 이내예요. 왼쪽 3D 배치에서 확인해 보세요.`,
          apply: config('warm', 140, 70, kit.warm)
        },
        {
          question: '예산을 25만원 이내로 줄여 줘.',
          reply: () => `우드톤은 유지하고 조명만 제외했어요. 모니터와 키보드 합계는 ${price(kit.basic)}입니다. 25만원 이하 조건에 맞춰 3D 구성도 갱신했어요.`,
          apply: config('warm', 140, 70, kit.basic)
        },
        {
          question: '여기에 모니터 받침대도 추가할 수 있어?',
          reply: () => `받침대를 추가하면 합계가 ${price(kit.withShelf)}이 되어 25만원을 넘어요. 현재 예산을 유지하기 위해 받침대는 적용하지 않았습니다. 필요하면 나중에 추가해 보세요.`
        },
        {
          question: '그럼 30만원으로 다시 조명을 추가해 줘.',
          reply: () => `예산을 30만원으로 되돌리고 조명을 추가했어요. 우드톤 구성은 다시 ${price(kit.warm)}입니다. 조명이 3D 책상에 표시됩니다.`,
          apply: config('warm', 140, 70, kit.warm)
        }
      ]
    },
    {
      id: 'small-desk', title: '02 · 좁은 책상 활용',
      subtitle: '120×60cm · 간결한 구성 · 수납 추가',
      intro: '120×60cm 책상처럼 작은 공간에 필요한 제품을 골라 배치하는 시나리오입니다.',
      initial: config('minimal', 120, 60, kit.basic),
      steps: [
        {
          question: '120×60cm 책상을 깔끔하게 꾸며 줘.',
          reply: () => `공간을 덜 차지하는 미니멀 스타일로 모니터와 키보드부터 배치했어요. 샘플 합계는 ${price(kit.basic)}입니다.`,
          apply: config('minimal', 120, 60, kit.basic)
        },
        {
          question: '모니터 받침대를 추가해 수납 공간을 늘려 줘.',
          reply: () => `우드 모니터 받침대를 추가했어요. 총 ${price(kit.withShelf)}이고, 받침대 위에 모니터를 놓는 구성을 시도합니다. 실제 설치 전에는 치수와 배치 점검 결과를 확인해야 해요.`,
          apply: config('minimal', 120, 60, kit.withShelf)
        },
        {
          question: '25만원 이내라면 어떤 구성이 좋아?',
          reply: () => `받침대를 제외하면 ${price(kit.basic)}으로 25만원 이내예요. 필수 제품 두 가지만 남겨 작은 책상에 여유 공간을 확보했습니다.`,
          apply: config('minimal', 120, 60, kit.basic)
        },
        {
          question: '배치할 때 무엇을 확인해야 할까?',
          reply: () => '모니터가 책상 밖으로 나오지 않는지, 키보드 앞쪽 공간이 충분한지, 벽과 제품이 겹치지 않는지 확인하세요. 왼쪽 화면 아래의 ‘배치 점검’에서 시연용 치수 기준 결과를 볼 수 있어요.'
        }
      ]
    },
    {
      id: 'work-study', title: '03 · 공부·재택근무',
      subtitle: '집중할 수 있는 구성 · 수납 · 30만원 조정',
      intro: '공부와 재택근무에 필요한 제품을 고르고 수납과 예산을 조정해 보는 시나리오입니다.',
      initial: config('warm', 140, 70, kit.warm),
      steps: [
        {
          question: '공부와 재택근무에 어울리는 책상을 추천해 줘.',
          reply: () => `모니터·키보드·데스크 램프를 기본 구성으로 추천해요. 140×70cm 책상에 적용했고, 샘플 합계는 ${price(kit.warm)}입니다.`,
          apply: config('warm', 140, 70, kit.warm)
        },
        {
          question: '모니터 받침대까지 추가해서 정돈해 줘.',
          reply: () => `모니터 받침대를 추가했어요. 네 가지 제품 총액은 ${price(kit.full)}입니다. 받침대와 모니터의 겹침은 시뮬레이터에서 검토해 주세요.`,
          apply: config('warm', 140, 70, kit.full)
        },
        {
          question: '총액을 30만원 이하로 다시 맞춰 줘.',
          reply: () => `조명은 추후 구매로 미루고 모니터·키보드·받침대를 남겼어요. 샘플 합계 ${price(kit.withShelf)}으로 30만원 이내입니다.`,
          apply: config('warm', 140, 70, kit.withShelf)
        },
        {
          question: '제품은 어떤 순서로 구매하면 좋을까?',
          reply: () => '기본 작업을 위한 모니터와 키보드를 먼저 고려하고, 모니터 받침대는 책상 공간과 높이가 맞는지 확인한 뒤 추가해 보세요. 조명은 이후 예산에 여유가 생겼을 때 선택할 수 있어요.'
        }
      ]
    },
    {
      id: 'gaming', title: '04 · 게이밍 데스크',
      subtitle: '기본 구성 → 분위기 변화 → 예산 절감',
      intro: '게임용 모니터·키보드를 중심으로 구성하고, 스타일과 조명을 바꿔보는 시나리오입니다.',
      initial: config('minimal', 160, 80, kit.basic),
      steps: [
        {
          question: '게임용으로 넓은 책상을 구성해 줘.',
          reply: () => `160×80cm 책상에 모니터와 키보드를 먼저 배치했어요. 기본 구성 합계는 ${price(kit.basic)}입니다. 게임용 마우스나 RGB 기기는 현재 샘플 상품에 없어 포함하지 않았어요.`,
          apply: config('minimal', 160, 80, kit.basic)
        },
        {
          question: '조명을 추가하고 분위기를 바꿔 줘.',
          reply: () => `데스크 램프를 추가하고 크리에이티브 색상 테마로 변경했어요. 샘플 합계는 ${price(kit.warm)}입니다. RGB 조명 연동이 아닌 일반 램프·테마 변경 시연입니다.`,
          apply: config('creative', 160, 80, kit.warm)
        },
        {
          question: '조명은 유지하고 더 미니멀하게 바꿔 줘.',
          reply: () => `제품 구성은 유지한 채 밝고 단정한 미니멀 테마로 변경했어요. 합계는 그대로 ${price(kit.warm)}입니다.`,
          apply: config('minimal', 160, 80, kit.warm)
        },
        {
          question: '25만원 이하로도 꾸밀 수 있을까?',
          reply: () => `조명을 제외한 모니터·키보드 구성으로 바꾸면 ${price(kit.basic)}입니다. 예산 이내이며 3D 배치에도 바로 반영했습니다.`,
          apply: config('minimal', 160, 80, kit.basic)
        }
      ]
    },
    {
      id: 'creative', title: '05 · 감성 크리에이티브',
      subtitle: '라벤더 톤 → 키보드 추가 → 예산 맞춤',
      intro: '색감과 장식 분위기를 중시하는 구성에서 필요한 작업용 제품을 추가하는 시나리오입니다.',
      initial: config('creative', 160, 80, kit.creative),
      steps: [
        {
          question: '라벤더 느낌의 감성 데스크를 추천해 줘.',
          reply: () => `크리에이티브 테마에 모니터·조명·우드 받침대를 배치했어요. 샘플 합계는 ${price(kit.creative)}입니다.`,
          apply: config('creative', 160, 80, kit.creative)
        },
        {
          question: '작업할 때 사용할 키보드도 추가해 줘.',
          reply: () => `컴팩트 키보드까지 추가했어요. 전체 네 가지 제품의 합계는 ${price(kit.full)}입니다. 화면에서도 키보드를 확인할 수 있어요.`,
          apply: config('creative', 160, 80, kit.full)
        },
        {
          question: '예산 30만원 이내로 정리해 줘.',
          reply: () => `감성적인 테마와 조명은 유지하고 받침대만 제외했어요. 모니터·조명·키보드 합계는 ${price(kit.warm)}으로 30만원 이하입니다.`,
          apply: config('creative', 160, 80, kit.warm)
        },
        {
          question: '현재 구성의 특징을 요약해 줘.',
          reply: () => `160×80cm 책상에 크리에이티브 테마, 모니터·램프·키보드를 구성했어요. 샘플 합계는 ${price(kit.warm)}이고, 실제 판매 가격은 아닙니다.`
        }
      ]
    },
    {
      id: 'purchase-roadmap', title: '06 · 단계별 구매 계획',
      subtitle: '전체 구성 → 예산 축소 → 1차·2차 구매',
      intro: '한 번에 모두 사기 어려울 때 구매 우선순위를 정하고 단계적으로 추가하는 시나리오입니다.',
      initial: config('warm', 140, 70, kit.full),
      steps: [
        {
          question: '마음에 드는 데스크 구성을 한 번에 보여 줘.',
          reply: () => `우드톤 책상에 모니터·키보드·조명·받침대를 모두 구성했어요. 샘플 합계는 ${price(kit.full)}입니다.`,
          apply: config('warm', 140, 70, kit.full)
        },
        {
          question: '일단 30만원 이하로 조정해 줘.',
          reply: () => `받침대를 나중에 구매하는 것으로 조정했어요. 모니터·키보드·조명의 현재 구성 합계는 ${price(kit.warm)}입니다.`,
          apply: config('warm', 140, 70, kit.warm)
        },
        {
          question: '먼저 살 필수 제품만 배치해 줘.',
          reply: () => `1차 구매 대상으로 모니터와 키보드만 남겼어요. 샘플 합계는 ${price(kit.basic)}이고 조명은 다음 단계로 미뤘습니다.`,
          apply: config('warm', 140, 70, kit.basic)
        },
        {
          question: '2차 구매로 조명을 추가해 줘.',
          reply: () => `조명 ${price(['lamp'])}을 추가해 총 ${price(kit.warm)} 구성으로 확장했어요. 받침대는 추후 구매 후보로 남겨 둘 수 있습니다.`,
          apply: config('warm', 140, 70, kit.warm)
        }
      ]
    },
    {
      id: 'buy-or-rent', title: '07 · 구매 vs 렌탈',
      subtitle: '구매 총액 확인 · 렌탈 조건 · 최종 구성',
      intro: '구매·렌탈을 선택할 때 어떤 비용과 계약 조건을 따져봐야 하는지 보여주는 시나리오입니다.',
      initial: config('minimal', 140, 70, kit.basic),
      steps: [
        {
          question: '현재 데스크 제품을 구매하면 얼마야?',
          reply: () => `샘플 상품 기준으로 모니터·키보드 구매 합계는 ${price(kit.basic)}입니다. 이는 시연용 상품 가격이며 실제 쇼핑몰 최저가가 아닙니다.`,
          apply: config('minimal', 140, 70, kit.basic)
        },
        {
          question: '모니터를 렌탈하면 월 얼마야?',
          reply: () => '현재 프로젝트에는 실제 렌탈 상품·월 요금·약정기간 데이터가 연결되어 있지 않아요. 정확한 월 요금은 제휴 렌탈 정보를 연동한 후에 안내할 수 있습니다.'
        },
        {
          question: '구매와 렌탈을 비교할 때 무엇이 중요해?',
          reply: () => '제품 구매가뿐 아니라 렌탈 기간, 총 납부액, 보증금, 배송·설치·반납 비용, 중도해지 조건을 함께 비교해야 해요. 실제 요금이 없으므로 현재는 비교 기준만 안내합니다.'
        },
        {
          question: '구매 기준으로 30만원 이하 구성에 조명도 넣어 줘.',
          reply: () => `렌탈 요금은 포함하지 않고 구매 기준 모니터·키보드·조명으로 바꿨어요. 샘플 합계는 ${price(kit.warm)}으로 30만원 이하입니다.`,
          apply: config('minimal', 140, 70, kit.warm)
        }
      ]
    }
  ];

  // AI 공간 어시스턴트의 보라색 샘플 버튼에만 적용되는 7개 시연 프리셋 메뉴입니다.
  function sampleMenuMarkup() {
    return `<details class="assistant-sample-dropdown">
      <summary class="pill purple assistant-sample-trigger" aria-label="샘플: 7가지 대화 프리셋 선택" title="눌러서 7가지 시연 프리셋 선택">샘플</summary>
      <div class="assistant-sample-options" role="group" aria-label="시연 대화 프리셋 7가지">
        <strong class="assistant-sample-title">시연 대화 프리셋</strong>
        ${presets.map(p => `<button type="button" data-assistant-preset="${p.id}" aria-current="${p.id === activeId ? 'true' : 'false'}"><span>${D.escape(p.title)}</span>${p.id === activeId ? '<b aria-hidden="true">✓</b>' : ''}</button>`).join('')}
        <small>발표용으로 준비된 질문·답변입니다. 실제 AI는 추후 연동됩니다.</small>
      </div>
    </details>`;
  }

  // 화면 바깥을 누르거나 Esc를 누르면 펼친 메뉴를 접습니다.
  document.addEventListener('click', event => {
    document.querySelectorAll('.assistant-sample-dropdown[open]').forEach(menu => {
      if (!menu.contains(event.target)) menu.open = false;
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.assistant-sample-dropdown[open]').forEach(menu => {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      });
    }
  });

  let activeId = presets[0].id;
  let index = 0;
  let messages = [];
  const active = () => presets.find(preset => preset.id === activeId) || presets[0];

  function initialMessages(preset) {
    return [{ role: 'assistant', text: `${preset.intro}\n\n아래 질문을 눌러 대화를 진행해 주세요.` }];
  }
  messages = initialMessages(active());

  function applySetup(values) {
    if (!values) return;
    Object.assign(D.state, {
      name: active().title.replace(/^\d+\s*·\s*/, '') + ' 데스크',
      style: values.style,
      width: values.width,
      depth: values.depth,
      products: [...values.products]
    });
    // 프리셋을 선택할 때는 이전 시나리오의 위치 데이터를 남기지 않고 다시 배치합니다.
    delete D.state.layout;
  }

  D.assistant = {
    sampleMenuMarkup,
    bindPresetMenus(root) {
      root.querySelectorAll('[data-assistant-preset]').forEach(button => {
        button.addEventListener('click', () => this.choosePreset(button.dataset.assistantPreset));
      });
      // 어시스턴트 내부 시연 프리셋 메뉴에만 이벤트를 연결합니다.
      root.querySelectorAll('.assistant-sample-dropdown').forEach(menu => {
        menu.addEventListener('toggle', () => {
          if (menu.open) root.querySelectorAll('.assistant-sample-dropdown').forEach(other => {
            if (other !== menu) other.open = false;
          });
        });
      });
    },
    mount(root) {
      const scenario = active();
      const finished = index >= scenario.steps.length;
      root.innerHTML = `
        <div class="panel-heading">
          <div class="assistant-identity"><span class="assistant-symbol">✦</span>
            <div><strong>AI 공간 어시스턴트</strong><small>선택형 대화 · 발표용 프로토타입</small></div>
          </div>
          ${sampleMenuMarkup()}
        </div>
        <div class="assistant-current-scenario">
          <strong>${D.escape(scenario.title)}</strong>
          <p>${D.escape(scenario.subtitle)}</p>
        </div>
        <div class="assistant-messages" role="log" aria-live="polite" aria-label="공간 어시스턴트 시연 대화">
          <div class="assistant-date">${D.escape(scenario.title)} · 대화 시연</div>
          ${messages.map(m => `<div class="assistant-message ${m.role}">${D.escape(m.text)}</div>`).join('')}
        </div>
        <div class="assistant-progress" aria-live="polite">
          <span>${finished ? '시나리오 완료' : `질문 ${index + 1} / ${scenario.steps.length}`}</span>
          <span>예시 제품 합계 ${D.escape(price(D.state.products))}</span>
        </div>
        <div class="assistant-suggestions">
          ${finished
            ? '<p class="assistant-finished">시연을 마쳤습니다. 다른 프리셋을 선택하거나 이 대화를 다시 시작할 수 있습니다.</p>'
            : `<button type="button" class="assistant-next-question" data-next-step>${D.escape(scenario.steps[index].question)}<span aria-hidden="true">↗</span></button>`}
        </div>
        <div class="assistant-demo-note">
          <small>사전에 작성된 질문·답변과 샘플 제품 데이터로 동작합니다. 실제 생성형 AI와 쇼핑몰·렌탈 API는 추후 연동 예정입니다.</small>
          <button type="button" data-restart>이 프리셋 처음부터</button>
        </div>`;

      const next = root.querySelector('[data-next-step]');
      if (next) next.addEventListener('click', () => this.nextStep());
      root.querySelector('[data-restart]').addEventListener('click', () => this.choosePreset(activeId));
      this.bindPresetMenus(root);

      const log = root.querySelector('.assistant-messages');
      log.scrollTop = log.scrollHeight;
    },
    choosePreset(id) {
      if (!presets.some(p => p.id === id)) return;
      activeId = id;
      index = 0;
      messages = initialMessages(active());
      applySetup(active().initial);
      D.render();
    },
    nextStep() {
      const scenario = active();
      const step = scenario.steps[index];
      if (!step) return;
      messages.push({ role: 'user', text: step.question });
      if (step.apply) applySetup(step.apply);
      messages.push({ role: 'assistant', text: typeof step.reply === 'function' ? step.reply() : step.reply });
      index++;
      D.render();
    }
  };
})(window.Deskspace);
