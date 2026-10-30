(function (D) {
  const messages = [{ role: 'assistant', text: '안녕하세요! 나에게 맞는 작업공간을 함께 만들어봐요.\n\n원하는 분위기나 예산을 골라보세요. 준비된 추천 예시를 책상에 적용해 드릴게요.' }];
  D.assistant = {
    mount(root) {
      root.innerHTML = `<div class="panel-heading"><div class="assistant-identity"><span class="assistant-symbol">✦</span><div><strong>AI 공간 어시스턴트</strong><small>함께 만드는 나의 공간</small></div></div><span class="pill purple">샘플</span></div><div class="assistant-messages" role="log" aria-label="추천 대화"><div class="assistant-date">새로운 공간을 위한 대화</div>${messages.map(m => `<div class="assistant-message ${m.role}">${D.escape(m.text)}</div>`).join('')}</div><div class="assistant-suggestions"><button data-prompt="미니멀하게 바꿔줘">✧ 미니멀하게 바꿔줘</button><button data-prompt="30만원 이하로 추천해줘">↘ 30만원 이하로</button><button data-prompt="따뜻한 분위기로 바꿔줘">☀ 따뜻한 분위기로</button></div><div class="assistant-input"><form><input name="message" aria-label="AI에게 보낼 메시지" placeholder="어떤 공간을 만들고 싶으세요?" maxlength="500" autocomplete="off" required><button class="primary" aria-label="메시지 보내기">${D.icon('arrow')}</button></form><small>준비된 응답을 보여주는 대화 데모입니다</small></div>`;
      root.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => this.send(button.dataset.prompt)));
      root.querySelector('form').addEventListener('submit', event => { event.preventDefault(); const input = event.currentTarget.elements.message; if (input.value.trim()) this.send(input.value.trim()); });
      const log = root.querySelector('.assistant-messages'); log.scrollTop = log.scrollHeight;
    },
    send(text) {
      messages.push({ role: 'user', text });
      let reply = '현재는 준비된 시나리오만 시연할 수 있어요. 아래의 분위기·예산 버튼을 눌러보세요. 자유로운 AI 추천은 이후 연결할 예정입니다.';
      if (/30|예산|저렴/.test(text)) { D.state.products = ['monitor','keyboard']; D.state.style = 'minimal'; reply = '모니터와 키보드를 중심으로 구성했어요.\n\n샘플 합계 248,000원으로, 30만원 이내예요. 왼쪽 책상에서도 변경된 구성을 확인해 보세요.\n\n가격은 실제 판매가가 아닌 시연 데이터입니다.'; }
      else if (/미니멀/.test(text)) { D.state.style = 'minimal'; D.state.products = ['monitor','keyboard']; reply = '필요한 것만 남겨 여백이 있는 미니멀한 공간으로 바꿨어요.\n\n마음에 든다면 ‘구성 저장’을 눌러 다른 프리셋과 비교해 보세요.'; }
      else if (/따뜻|우드/.test(text)) { D.state.style = 'warm'; D.state.products = ['monitor','lamp','keyboard']; reply = '우드톤 책상에 조명을 더한 구성을 적용했어요.\n\n샘플 합계는 297,000원이에요. 제품 둘러보기에서 각 제품의 예시 정보를 볼 수 있어요.'; }
      messages.push({ role: 'assistant', text: reply }); D.render();
    }
  };
})(window.Deskspace);
