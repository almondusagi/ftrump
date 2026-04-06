// ===== コンテキストメニュー全体無効化 =====
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });

// トランプのスートと記号
const suits = [
  { name: 'spade', symbol: '♠' },
  { name: 'heart', symbol: '♥' },
  { name: 'diamond', symbol: '♦' },
  { name: 'club', symbol: '♣' }
];

// トランプのランク
const ranks = [
  'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'
];

const container = document.getElementById('card-container');

// 裏面画像
const backHtml = `
  <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;">
    <img src='picture/trump_back.png' alt='back' draggable="false"
      style='width:130%;height:130%;object-fit:cover;object-position:center;border-radius:6px;border:2px solid #fff;display:block;user-drag:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;'>
  </div>
`;

// カードをランダム配置
function randomPosition(card) {
  card.style.position = 'absolute';
  card.style.left = (Math.random() * (window.innerWidth - 80)) + "px";
  card.style.top = (Math.random() * (window.innerHeight - 120)) + "px";
}

// ドラッグ・選択用変数
let dragTarget = null;
let dragStartX = 0, dragStartY = 0;
let cardStartLeft = 0, cardStartTop = 0;
let longPressTimer = null, rightPressTimer = null, rightPressHandled = false;
let currentMaxZIndex = 2000;
let dragSelectedCards = null, dragSelectedCardsStart = null, dragSelectedCardsZIndex = null;

// 整列モード用：カードのグリッドインデックス管理
let alignGridOrder = null;

// カードにドラッグ・裏返し機能を付与
function enableCardDrag(card) {
  // 既にイベントリスナーが設定されている場合はスキップ
  if (card.dataset.dragEnabled === 'true') {
    return;
  }
  // 神経衰弱モードまたはネクストモードではドラッグ無効
  if (document.body.classList.contains('shinkeisuijaku-mode') || document.body.classList.contains('next-mode')) {
    card.onmousedown = null;
    card.onmouseup = null;
    card.onmouseleave = null;
    card.oncontextmenu = null;
    card.style.cursor = 'pointer';
    // クリックでめくるイベントだけ付与
    card.addEventListener('click', function(e) {
      if (e.button !== 0) return;
      flipCard(card);
    });
    card.dataset.dragEnabled = 'true';
    return;
  }
  
  // イベントリスナーをクリア
  card.onmousedown = null;
  card.onmouseup = null;
  card.onmouseleave = null;
  card.oncontextmenu = null;
  card.addEventListener('mousedown', (e) => {
    // 神経衰弱モードまたはネクストモードでは左クリック以外は無効
    if ((document.body.classList.contains('shinkeisuijaku-mode') || document.body.classList.contains('next-mode')) && e.button !== 0) {
      return;
    }
    
    // 他のカードが選択されていたら選択解除し、クリックしたカードだけ選択状態に
    if (e.button === 0) {
      // 神経衰弱モードまたはネクストモードでは選択・ドラッグ機能を無効化
      if (document.body.classList.contains('shinkeisuijaku-mode') || document.body.classList.contains('next-mode')) {
        return;
      }
      
      const selected = document.querySelectorAll('.card.selected');
      // 選択されていないカードをクリックした場合のみ、選択解除
      if (!card.classList.contains('selected')) {
        selected.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
      }
      if (!isFreeMode && alignGridOrder) {
        // 整列モード：グリッドインデックスを記録
        dragGridIndex = alignGridOrder.indexOf(card);
        dragGridOrigin = { left: parseFloat(card.style.left), top: parseFloat(card.style.top) };
      }
      const selectedCards = document.querySelectorAll('.card.selected');
      if (selectedCards.length > 1) {
        dragSelectedCards = Array.from(selectedCards);
        dragSelectedCardsStart = dragSelectedCards.map(c => ({
          left: parseFloat(c.style.left) || c.getBoundingClientRect().left,
          top: parseFloat(c.style.top) || c.getBoundingClientRect().top
        }));
        dragSelectedCardsZIndex = dragSelectedCards.map(c => parseInt(c.style.zIndex) || 0);
        const maxZ = Math.max(...dragSelectedCardsZIndex);
        const allZ = Array.from(document.querySelectorAll('.card')).map(c => parseInt(c.style.zIndex) || 0);
        const baseZ = Math.max(...allZ, currentMaxZIndex) + 1;
        dragSelectedCards.forEach((c, i) => {
          c.style.zIndex = baseZ + (dragSelectedCardsZIndex[i] - maxZ);
          c.classList.add('dragging');
        });
        currentMaxZIndex = baseZ + (Math.max(...dragSelectedCardsZIndex) - maxZ);
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        // ドラッグ開始SE（神経衰弱モードまたはネクストモード時は鳴らさない）
        if (!document.body.classList.contains('shinkeisuijaku-mode') && !document.body.classList.contains('next-mode')) {
          window.playSE('SE/drag.mp3');
        }
      } else {
        dragTarget = card;
        currentMaxZIndex++;
        dragTarget.style.zIndex = currentMaxZIndex;
        dragTarget.classList.add('dragging');
        const rect = dragTarget.getBoundingClientRect();
        cardStartLeft = parseFloat(dragTarget.style.left) || rect.left;
        cardStartTop = parseFloat(dragTarget.style.top) || rect.top;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        // ドラッグ開始SE（神経衰弱モードまたはネクストモード時は鳴らさない）
        if (!document.body.classList.contains('shinkeisuijaku-mode') && !document.body.classList.contains('next-mode')) {
          window.playSE('SE/drag.mp3');
        }
      }
    }
    // 右クリック長押しで裏返し（神経衰弱モードでは無効）
    if (e.button === 2 && !document.body.classList.contains('shinkeisuijaku-mode')) {
      rightPressHandled = false;
      rightPressTimer = setTimeout(() => {
        if (!rightPressHandled) {
          const selected = document.querySelectorAll('.card.selected');
          if (card.classList.contains('selected') && selected.length > 1) {
            selected.forEach(c => flipCard(c));
          } else {
            flipCard(card);
          }
          rightPressHandled = true;
        }
      }, 0);
    }
  });
  card.addEventListener('mouseup', (e) => {
    clearTimeout(longPressTimer);
    clearTimeout(rightPressTimer);
    rightPressHandled = false;
  });
  card.addEventListener('mouseleave', () => {
    clearTimeout(longPressTimer);
    clearTimeout(rightPressTimer);
    rightPressHandled = false;
  });
  card.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // イベントリスナー設定完了をマーク
  card.dataset.dragEnabled = 'true';
}

function onDragMove(e) {
  if (dragSelectedCards) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    dragSelectedCards.forEach((c, i) => {
      c.style.left = (dragSelectedCardsStart[i].left + dx) + 'px';
      c.style.top = (dragSelectedCardsStart[i].top + dy) + 'px';
    });
  } else if (dragTarget) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    dragTarget.style.left = (cardStartLeft + dx) + 'px';
    dragTarget.style.top = (cardStartTop + dy) + 'px';
  }
}

function onDragEnd() {
  // 複数選択時は必ず元の位置に戻し、入れ替え判定をスキップ
  if (!isFreeMode && dragSelectedCards && dragSelectedCardsStart) {
    dragSelectedCards.forEach((c, i) => {
      c.style.transition = 'left 0.3s, top 0.3s';
      c.style.left = dragSelectedCardsStart[i].left + 'px';
      c.style.top = dragSelectedCardsStart[i].top + 'px';
      setTimeout(() => { c.style.transition = ''; }, 400);
    });
    dragTarget = null;
    dragSelectedCards = null;
    dragSelectedCardsStart = null;
    dragSelectedCardsZIndex = null;
    document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    return;
  }
  if (!isFreeMode && dragGridIndex !== null && alignGridOrder) {
    // ドロップ位置の中心座標を取得
    const card = alignGridOrder[dragGridIndex];
    const cardRect = card.getBoundingClientRect();
    const dropX = cardRect.left + cardRect.width / 2;
    const dropY = cardRect.top + cardRect.height / 2;
    // どのグリッドに重なっているか判定
    let targetIndex = null;
    alignGridOrder.forEach((c, i) => {
      if (i === dragGridIndex) return;
      const r = c.getBoundingClientRect();
      if (dropX >= r.left && dropX <= r.right && dropY >= r.top && dropY <= r.bottom) {
        targetIndex = i;
      }
    });
    if (targetIndex !== null) {
      // 入れ替え
      const newOrder = alignGridOrder.slice();
      const tmp = newOrder[dragGridIndex];
      newOrder[dragGridIndex] = newOrder[targetIndex];
      newOrder[targetIndex] = tmp;
      alignAllCardsGrid(newOrder);
    } else {
      // 元の位置に戻す
      card.style.transition = 'left 0.3s, top 0.3s';
      card.style.left = dragGridOrigin.left + 'px';
      card.style.top = dragGridOrigin.top + 'px';
      setTimeout(() => { card.style.transition = ''; }, 400);
    }
    dragGridIndex = null;
    dragGridOrigin = null;
    dragTarget = null;
    dragSelectedCards = null;
    dragSelectedCardsStart = null;
    dragSelectedCardsZIndex = null;
    document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    return;
  }
  // 単一カードドラッグ時は.selectedを外す
  if (dragTarget && dragTarget.classList.contains('selected')) {
    dragTarget.classList.remove('selected');
  }
  // draggingクラスを全部解除
  document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));
  // フリーモード用：ドラッグ状態を必ず解除
  dragTarget = null;
  dragSelectedCards = null;
  dragSelectedCardsStart = null;
  dragSelectedCardsZIndex = null;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

function flipCard(card) {
  const wasFlipped = card.classList.contains('flipped');
  const animClass = wasFlipped ? 'flip-anim-tofront' : 'flip-anim-toback';

  // アニメーションクラスをリセットして付与
  card.classList.remove('flip-anim-toback', 'flip-anim-tofront');
  void card.offsetWidth; // reflowトリガー
  card.classList.add(animClass);

  // アニメーション中間（150ms）で内容を切り替え
  setTimeout(() => {
    if (wasFlipped) {
      card.classList.remove('flipped');
      card.style.padding = '';
      // 神経衰弱モードでは画像を表示
      if (document.body.classList.contains('shinkeisuijaku-mode') && card.dataset.cardImage) {
        card.innerHTML = `<img src='${card.dataset.cardImage}' alt='card' draggable=\"false\" style='position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;'>`;
      } else {
        if (card.dataset.frontHtml) card.innerHTML = card.dataset.frontHtml;
      }
    } else {
      card.classList.add('flipped');
      card.style.padding = '';
      card.innerHTML = backHtml;
    }
  }, 150);

  // アニメーション終了後にクラスを解除
  card.addEventListener('animationend', function handler() {
    card.classList.remove('flip-anim-toback', 'flip-anim-tofront');
    card.removeEventListener('animationend', handler);
  });

  if (card.dataset.dragEnabled !== 'true') {
    enableCardDrag(card);
  }

  card.classList.remove('selected','card-hovered','player1-glow','player2-glow');
  if (typeof card.onmouseleave === 'function') card.onmouseleave();
  window.playSE('SE/flip.mp3');
}

// カード生成
for (let suit of suits) {
  for (let i = 0; i < ranks.length; i++) {
    const rank = ranks[i];
    const card = document.createElement('div');
    card.classList.add('card', suit.name);
    const cardHtml = `
      <div style="font-size:14px;">${suit.symbol} ${rank}</div>
      <div style="align-self: flex-end; font-size:14px;">${rank} ${suit.symbol}</div>
    `;
    card.innerHTML = cardHtml;
    card.dataset.frontHtml = cardHtml;
    // 神経衰弱モード用の画像パスを保存
    card.dataset.cardImage = `picture/${suit.name}_${rank}.png`;
    card.dataset.rankValue = (i + 1).toString(); // A=1, 2=2, ..., K=13
    card.dataset.dragEnabled = 'false'; // イベントリスナー設定フラグを初期化
    randomPosition(card);
    enableCardDrag(card);
    container.appendChild(card);
  }
}
// ジョーカー
for (let i = 0; i < 2; i++) {
  const joker = document.createElement('div');
  joker.classList.add('card', 'joker');
  const jokerHtml = `<div style="font-size:10px;font-weight:bold;line-height:1.1;">JOKER</div><div style="font-size:20px;align-self:flex-end;">${i === 0 ? '\uD83C\uDCCF' : '\uD83C\uDCDF'}</div>`;
  joker.innerHTML = jokerHtml;
  joker.dataset.frontHtml = jokerHtml;
  // 神経衰弱モード用の画像パスを保存
  joker.dataset.cardImage = `picture/joker${i + 1}.png`;
  joker.dataset.rankValue = '14'; // JOKER=14
  joker.dataset.dragEnabled = 'false'; // イベントリスナー設定フラグを初期化
  randomPosition(joker);
  enableCardDrag(joker);
  container.appendChild(joker);
}

// 選択カード取得（なければ全カード）
function getTargetCards() {
  const selected = Array.from(document.querySelectorAll('.card.selected'));
  return selected.length > 0 ? selected : Array.from(document.querySelectorAll('.card'));
}

// 整列・フリーのトグルボタン状態管理
const alignBtn = document.getElementById('align-btn');
const freeBtn = document.getElementById('free-btn');
let isFreeMode = true; // デフォルトはフリー

function alignAllCardsGrid(cardsArr) {
  const allCards = cardsArr || Array.from(document.querySelectorAll('.card'));
  if (allCards.length === 0) return;
  const containerRect = container.getBoundingClientRect();
  
  // transformの影響を受けない実サイズを取得
  const cardW = allCards[0].offsetWidth || 60;
  const cardH = allCards[0].offsetHeight || 90;
  
  const isMobile = window.innerWidth <= 900;
  let cols = 6; // 横6列固定
  let rows = Math.ceil(allCards.length / cols); // 縦9行
  let gapX, gapY, startX, startY;

  if (!isMobile) {
    gapX = (containerRect.width - cols * cardW) / (cols + 1);
    gapY = (containerRect.height - rows * cardH) / (rows + 1);
    startX = gapX;
    startY = gapY;
  } else {
    gapX = (containerRect.width - cols * cardW) / (cols + 1);
    gapY = 4;
    startX = gapX;
    const totalH = rows * cardH + (rows - 1) * gapY;
    startY = Math.max(gapY, (containerRect.height - totalH) / 2);
  }

  // グリッド順序を保存
  if (!cardsArr) {
    alignGridOrder = allCards.slice();
  } else {
    alignGridOrder = cardsArr.slice();
  }
  
  allCards.forEach((card, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = startX + col * (cardW + gapX);
    const top = startY + row * (cardH + gapY);
    card.style.transition = 'left 0.5s cubic-bezier(.4,2,.6,1), top 0.5s cubic-bezier(.4,2,.6,1)';
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.zIndex = 1000 + i;
    setTimeout(() => { card.style.transition = ''; }, 600);
  });
}

function updateModeButtons() {
  if (isFreeMode) {
    freeBtn.style.background = '#ccc';
    alignBtn.style.background = '#fff';
  } else {
    alignBtn.style.background = '#ccc';
    freeBtn.style.background = '#fff';
    alignAllCardsGrid();
  }
}

alignBtn.addEventListener('click', () => {
  const allCards = Array.from(document.querySelectorAll('.card'));
  const before = allCards.map(card => card.style.left + ',' + card.style.top);
  if (isFreeMode) {
    isFreeMode = false;
    updateModeButtons();
  }
  const after = allCards.map(card => card.style.left + ',' + card.style.top);
  if (before.some((v, i) => v !== after[i])) {
    window.playSE('SE/shuffle.mp3', 0.6);
  } else {
    window.playSE('SE/click.mp3');
  }
});
freeBtn.addEventListener('click', () => {
  window.playSE('SE/click.mp3');
  if (!isFreeMode) {
    isFreeMode = true;
    updateModeButtons();
  }
  setGameBackground(false);
});
updateModeButtons();

// ===== 山ボタン =====
const stackBtn = document.getElementById('stack-btn');
stackBtn.addEventListener('click', () => {
  const allCards = getTargetCards();
  const before = allCards.map(card => card.style.left + ',' + card.style.top);
  if (!isFreeMode) setFreeMode();
  const containerRect = container.getBoundingClientRect();
  const centerX = (containerRect.width - 60) / 2;
  const centerY = (containerRect.height - 90) / 2;
  // 距離が近い順にソート
  const cardsWithDist = allCards.map(card => {
    const rect = card.getBoundingClientRect();
    const cardCenterX = rect.left + rect.width / 2 - containerRect.left;
    const cardCenterY = rect.top + rect.height / 2 - containerRect.top;
    const dist = Math.hypot(cardCenterX - (centerX + 30), cardCenterY - (centerY + 45));
    return { card, dist };
  });
  cardsWithDist.sort((a, b) => a.dist - b.dist);

  cardsWithDist.forEach(({ card }, i) => {
    card.style.transition = 'left 0.5s cubic-bezier(.4,2,.6,1), top 0.5s cubic-bezier(.4,2,.6,1)';
    card.style.left = (centerX + i * 0.5) + 'px';
    card.style.top = (centerY + i * 0.5) + 'px';
    card.style.zIndex = 1000 + i;
    setTimeout(() => { card.style.transition = ''; }, 600);
  });
  const after = allCards.map(card => card.style.left + ',' + card.style.top);
  if (before.some((v, i) => v !== after[i])) {
    window.playSE('SE/shuffle.mp3', 0.6);
  } else {
    window.playSE('SE/click.mp3');
  }
});

// ===== バラバラボタン =====
const scatterBtn = document.getElementById('scatter-btn');
scatterBtn.addEventListener('click', () => {
  const allCards = getTargetCards();
  const before = allCards.map(card => card.style.left + ',' + card.style.top);
  if (!isFreeMode) setFreeMode();
  const containerRect = container.getBoundingClientRect();
  allCards.forEach(card => {
    card.style.transition = 'left 0.5s cubic-bezier(.4,2,.6,1), top 0.5s cubic-bezier(.4,2,.6,1)';
    card.style.left = (Math.random() * (containerRect.width - 80)) + "px";
    card.style.top = (Math.random() * (containerRect.height - 120)) + "px";
    setTimeout(() => { card.style.transition = ''; }, 600);
  });
  const after = allCards.map(card => card.style.left + ',' + card.style.top);
  if (before.some((v, i) => v !== after[i])) {
    window.playSE('SE/shuffle.mp3', 0.6);
  } else {
    window.playSE('SE/click.mp3');
  }
});

// ===== 全ウラボタン =====
const allBackBtn = document.getElementById('all-back-btn');
allBackBtn.addEventListener('click', () => {
  const allCards = getTargetCards();
  let changed = false;
  allCards.forEach(card => {
    if (!card.classList.contains('flipped')) changed = true;
    card.classList.add('flipped');
    // 裏面表示時は元のスタイルに戻す
    card.style.padding = '';
    card.innerHTML = backHtml;
    enableCardDrag(card);
  });
  if (changed) window.playSE('SE/flip.mp3');
});

// ===== 全オモテボタン =====
const allFrontBtn = document.getElementById('all-front-btn');
allFrontBtn.addEventListener('click', () => {
  const allCards = getTargetCards();
  let changed = false;
  allCards.forEach(card => {
    if (card.classList.contains('flipped')) changed = true;
    card.classList.remove('flipped');
    // 神経衰弱モード時は画像を表示、それ以外は通常のHTMLを表示
    if (document.body.classList.contains('shinkeisuijaku-mode') && card.dataset.cardImage) {
      // 画像をカード全体に表示するため、paddingを0にして絶対配置
      // positionとdisplayは元のまま維持（サイズを変えないため）
      const imageHtml = `
        <img src='${card.dataset.cardImage}' alt='card' draggable="false"
          style='position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:8px;display:block;user-drag:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;z-index:1;'
          onerror="this.onerror=null; this.parentElement.style.padding='8px'; this.parentElement.innerHTML='${card.dataset.frontHtml.replace(/'/g, "\\'")}';">
      `;
      card.innerHTML = imageHtml;
    } else {
      // 通常モード時は元のスタイルに戻す
      card.style.padding = '';
      if (card.dataset.frontHtml) card.innerHTML = card.dataset.frontHtml;
    }
    enableCardDrag(card);
  });
  if (changed) window.playSE('SE/flip.mp3');
});

// ===== シャッフルボタン =====
const shuffleBtn = document.getElementById('shuffle-btn');
shuffleBtn.addEventListener('click', () => {
  const allCards = isFreeMode ? getTargetCards() : Array.from(document.querySelectorAll('.card'));
  const before = allCards.map(card => card.style.left + ',' + card.style.top);
  if (isFreeMode) {
    for (let i = allCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }
    const containerRect = container.getBoundingClientRect();
    const centerX = (containerRect.width - 60) / 2;
    const centerY = (containerRect.height - 90) / 2;
    allCards.forEach((card, i) => {
      card.style.transition = 'left 0.5s cubic-bezier(.4,2,.6,1), top 0.5s cubic-bezier(.4,2,.6,1)';
      card.style.left = (centerX + i * 0.5) + 'px';
      card.style.top = (centerY + i * 0.5) + 'px';
      card.style.zIndex = 1000 + i;
      setTimeout(() => { card.style.transition = ''; }, 600);
    });
  } else {
    // 整列モード：グリッド上でシャッフル
    for (let i = allCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }
    alignAllCardsGrid(allCards);
  }
  const after = allCards.map(card => card.style.left + ',' + card.style.top);
  if (before.some((v, i) => v !== after[i])) {
    window.playSE('SE/shuffle.mp3', 0.6);
  } else {
    window.playSE('SE/click.mp3');
  }
});

// ===== 色分けボタン =====
const colorSplitBtn = document.getElementById('color-split-btn');
colorSplitBtn.addEventListener('click', () => {
  const allCards = getTargetCards();
  const before = allCards.map(card => card.style.left + ',' + card.style.top);
  if (!isFreeMode) setFreeMode();
  const containerRect = container.getBoundingClientRect();
  const leftX = containerRect.width * 0.18;
  const rightX = containerRect.width * 0.62;
  const centerY = (containerRect.height - 90) / 2;
  let leftIndex = 0, rightIndex = 0;
  allCards.forEach(card => {
    card.style.transition = 'left 0.5s cubic-bezier(.4,2,.6,1), top 0.5s cubic-bezier(.4,2,.6,1)';
    if (card.classList.contains('spade') || card.classList.contains('club')) {
      card.style.left = (leftX + leftIndex * 0.7) + 'px';
      card.style.top = (centerY + leftIndex * 0.7) + 'px';
      card.style.zIndex = 1000 + leftIndex;
      leftIndex++;
    } else if (card.classList.contains('heart') || card.classList.contains('diamond')) {
      card.style.left = (rightX + rightIndex * 0.7) + 'px';
      card.style.top = (centerY + rightIndex * 0.7) + 'px';
      card.style.zIndex = 2000 + rightIndex;
      rightIndex++;
    } else if (card.classList.contains('joker')) {
      card.style.left = (containerRect.width / 2 - 30 + rightIndex * 10) + 'px';
      card.style.top = (containerRect.height / 2 - 45 + rightIndex * 10) + 'px';
      card.style.zIndex = 3000 + rightIndex;
      rightIndex++;
    }
    setTimeout(() => { card.style.transition = ''; }, 600);
  });
  const after = allCards.map(card => card.style.left + ',' + card.style.top);
  if (before.some((v, i) => v !== after[i])) {
    window.playSE('SE/shuffle.mp3');
  } else {
    window.playSE('SE/click.mp3');
  }
});

// ===== 順番ボタン =====
const orderBtn = document.getElementById('order-btn');
orderBtn.addEventListener('click', () => {
  const allCards = getTargetCards();
  const before = allCards.map(card => card.style.left + ',' + card.style.top);
  const rankOrder = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  function getCardOrder(card) {
    if (card.classList.contains('joker')) return 100; // ジョーカーは最後
    for (let i = 0; i < rankOrder.length; i++) {
      if (card.innerText.includes(rankOrder[i])) return i;
    }
    return 99;
  }

  if (isFreeMode) {
    // フリーモード：山に集めて昇順/降順
    const containerRect = container.getBoundingClientRect();
    const centerX = (containerRect.width - 60) / 2;
    const centerY = (containerRect.height - 90) / 2;
    // 現在の山の中心に近い順にカードを取得
    const cardsWithDist = allCards.map(card => {
      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2 - containerRect.left;
      const cardCenterY = rect.top + rect.height / 2 - containerRect.top;
      const dist = Math.hypot(cardCenterX - (centerX + 30), cardCenterY - (centerY + 45));
      return { card, dist };
    });
    cardsWithDist.sort((a, b) => a.dist - b.dist);
    const currentOrder = cardsWithDist.map(({ card }) => getCardOrder(card));
    // 昇順・降順判定
    const isAsc = currentOrder.every((v, i, arr) => i === 0 || v >= arr[i - 1]);
    // 並べる順を決定
    let sorted;
    if (isAsc) {
      sorted = allCards.slice().sort((a, b) => getCardOrder(b) - getCardOrder(a));
    } else {
      sorted = allCards.slice().sort((a, b) => getCardOrder(a) - getCardOrder(b));
    }
    sorted.forEach((card, i) => {
      card.style.transition = 'left 0.5s cubic-bezier(.4,2,.6,1), top 0.5s cubic-bezier(.4,2,.6,1)';
      card.style.left = (centerX + i * 0.5) + 'px';
      card.style.top = (centerY + i * 0.5) + 'px';
      card.style.zIndex = 1000 + i;
      setTimeout(() => { card.style.transition = ''; }, 600);
    });
  } else {
    // 整列モード：グリッド上で昇順/降順
    const gridOrder = alignGridOrder ? alignGridOrder.slice() : Array.from(document.querySelectorAll('.card'));
    const currentOrder = gridOrder.map(card => getCardOrder(card));
    const isAsc = currentOrder.every((v, i, arr) => i === 0 || v >= arr[i - 1]);
    let sorted;
    if (isAsc) {
      sorted = gridOrder.slice().sort((a, b) => getCardOrder(b) - getCardOrder(a));
    } else {
      sorted = gridOrder.slice().sort((a, b) => getCardOrder(a) - getCardOrder(b));
    }
    alignAllCardsGrid(sorted);
  }
  const after = allCards.map(card => card.style.left + ',' + card.style.top);
  if (before.some((v, i) => v !== after[i])) {
    window.playSE('SE/shuffle.mp3', 0.6);
  } else {
    window.playSE('SE/click.mp3');
  }
});

// ===== 範囲選択用 =====
let selectionBox = null, selectionStart = null, isSelecting = false, sentakuSEPlayed = false;
let selectionLongPressTimer = null, selectionMoved = false;

function setUtilityButtonsPointerEvents(enabled) {
  const toggle = (el) => {
    if (!el) return;
    el.style.pointerEvents = enabled ? 'auto' : 'none';
    el.classList.toggle('disabled', !enabled);
    if (!enabled) el.setAttribute('disabled', 'disabled');
    else el.removeAttribute('disabled');
  };
  toggle(document.getElementById('counter-btn'));
  toggle(document.getElementById('stopwatch-btn'));
  toggle(document.getElementById('align-btn'));
  toggle(document.getElementById('free-btn'));
  toggle(document.getElementById('tab-btn'));
  toggle(document.getElementById('game-btn'));
  toggle(document.getElementById('bgm-toggle-btn'));
  toggle(document.getElementById('se-toggle-btn'));
  document.querySelectorAll('#tab-menu .menu-btn').forEach(btn => {
    btn.style.pointerEvents = enabled ? 'auto' : 'none';
    btn.classList.toggle('disabled', !enabled);
    if (!enabled) btn.setAttribute('disabled', 'disabled');
    else btn.removeAttribute('disabled');
  });
}

container.addEventListener('mousedown', (e) => {
  // 神経衰弱モードまたはネクストモード中は範囲選択を無効化
  if (document.body.classList.contains('shinkeisuijaku-mode') || document.body.classList.contains('next-mode')) return;
  if (e.target !== container || e.button !== 0) return;
  isSelecting = true;
  sentakuSEPlayed = false;
  selectionMoved = false;
  setUtilityButtonsPointerEvents(false);
  const containerRect = container.getBoundingClientRect();
  selectionStart = {
    x: e.clientX - containerRect.left,
    y: e.clientY - containerRect.top
  };
  document.querySelectorAll('.card.selected').forEach(card => {
    card.classList.remove('selected');
  });
  // 長押しタイマー
  selectionLongPressTimer = setTimeout(() => {
    if (isSelecting && !selectionMoved && !selectionBox) {
      // 500ms経過で動いていなければ範囲選択開始
      selectionBox = document.createElement('div');
      selectionBox.style.position = 'absolute';
      selectionBox.style.border = '2px dashed #e53935';
      selectionBox.style.background = 'rgba(229,57,53,0.08)';
      selectionBox.style.pointerEvents = 'none';
      selectionBox.style.zIndex = 3000;
      container.appendChild(selectionBox);
      if (!sentakuSEPlayed) {
        window.playSE('SE/sentaku.mp3');
        sentakuSEPlayed = true;
      }
    }
  }, 500);
  document.addEventListener('mousemove', onSelectionMove);
  document.addEventListener('mouseup', onSelectionUp);
});

function onSelectionMove(e) {
  if (!isSelecting) return;
  const containerRect = container.getBoundingClientRect();
  const x2 = e.clientX - containerRect.left;
  const y2 = e.clientY - containerRect.top;
  const left = Math.min(selectionStart.x, x2);
  const top = Math.min(selectionStart.y, y2);
  const width = Math.abs(x2 - selectionStart.x);
  const height = Math.abs(y2 - selectionStart.y);
  if (!selectionBox && (width > 2 || height > 2)) {
    // マウスが動いたら即範囲選択
    selectionMoved = true;
    clearTimeout(selectionLongPressTimer);
    selectionBox = document.createElement('div');
    selectionBox.style.position = 'absolute';
    selectionBox.style.border = '2px dashed #e53935';
    selectionBox.style.background = 'rgba(229,57,53,0.08)';
    selectionBox.style.pointerEvents = 'none';
    selectionBox.style.zIndex = 3000;
    container.appendChild(selectionBox);
    if (!sentakuSEPlayed) {
      window.playSE('SE/sentaku.mp3');
      sentakuSEPlayed = true;
    }
  }
  if (selectionBox) {
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
  }
}

function onSelectionUp(e) {
  if (!isSelecting) return;
  isSelecting = false;
  clearTimeout(selectionLongPressTimer);
  selectionMoved = false;
  if (selectionBox) {
    const boxRect = selectionBox.getBoundingClientRect();
    document.querySelectorAll('.card').forEach(card => {
      const cardRect = card.getBoundingClientRect();
      if (
        cardRect.right > boxRect.left &&
        cardRect.left < boxRect.right &&
        cardRect.bottom > boxRect.top &&
        cardRect.top < boxRect.bottom
      ) {
        card.classList.add('selected');
      }
    });
    selectionBox.remove();
    selectionBox = null;
  }
  setUtilityButtonsPointerEvents(true);
  document.removeEventListener('mousemove', onSelectionMove);
  document.removeEventListener('mouseup', onSelectionUp);
}

function setFreeMode() {
  if (!isFreeMode) {
    isFreeMode = true;
    updateModeButtons();
  }
}

// ドラッグ用変数追加
let dragGridIndex = null;
let dragGridOrigin = null;

// ===== サイドタブメニュー制御 =====
const tabBtn = document.getElementById('tab-btn');
const tabMenu = document.getElementById('tab-menu');
tabBtn.addEventListener('click', () => {
  window.playSE('SE/click.mp3');
  tabMenu.classList.toggle('open');
});

// メニューボタン健打後にメニューを自動クローズ
document.querySelectorAll('#tab-menu .menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTimeout(() => tabMenu.classList.remove('open'), 200);
  });
});

// メニュー外クリックでクローズ
document.addEventListener('click', (e) => {
  if (!tabMenu.classList.contains('open')) return;
  const sideTab = document.getElementById('side-tab');
  if (!sideTab.contains(e.target)) {
    tabMenu.classList.remove('open');
  }
});

// ===== カウンターボタン =====
const counterBtn = document.getElementById('counter-btn');
const counterAreaLeft = document.getElementById('counter-area-left');
const counterAreaRight = document.getElementById('counter-area-right');

// カウンターUI生成関数
function createCornerCounter(idPrefix) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button class="counter-btn" id="${idPrefix}-minus">－</button>
    <span class="counter-value" id="${idPrefix}-value">0</span>
    <button class="counter-btn" id="${idPrefix}-plus">＋</button>
    <button class="counter-btn" id="${idPrefix}-reset">↺</button>
  `;
  return wrapper;
}

// 左右カウンターの状態
let counterLeft = 0;
let counterRight = 0;

function updateCornerCounter(idPrefix, value) {
  document.getElementById(`${idPrefix}-value`).textContent = value;
}

// 初期UIセット
counterAreaLeft.appendChild(createCornerCounter('corner-left'));
counterAreaRight.appendChild(createCornerCounter('corner-right'));

// イベント設定
function setupCornerCounterEvents(idPrefix, getter, setter) {
  let longPressTimer = null;
  let repeatTimer = null;
  let isLongPress = false;

  const minusBtn = document.getElementById(`${idPrefix}-minus`);
  const plusBtn = document.getElementById(`${idPrefix}-plus`);
  const resetBtn = document.getElementById(`${idPrefix}-reset`);

  function clearTimers() {
    clearTimeout(longPressTimer);
    clearInterval(repeatTimer);
    longPressTimer = null;
    repeatTimer = null;
    isLongPress = false;
  }

  // マイナスボタン
  minusBtn.addEventListener('mousedown', (e) => {
    window.playSE('SE/counter.mp3');
    e.stopPropagation();
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      if (getter() > -100) setter(Math.max(getter() - 5, -100));
      updateCornerCounter(idPrefix, getter());
      repeatTimer = setInterval(() => {
        if (getter() > -100) setter(Math.max(getter() - 5, -100));
        updateCornerCounter(idPrefix, getter());
      }, 400);
    }, 500);
  });
  minusBtn.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    if (!isLongPress) {
      if (getter() > -100) setter(getter() - 1);
      updateCornerCounter(idPrefix, getter());
    }
    clearTimers();
  });
  minusBtn.addEventListener('mouseleave', clearTimers);

  // プラスボタン
  plusBtn.addEventListener('mousedown', (e) => {
    window.playSE('SE/counter.mp3');
    e.stopPropagation();
    isLongPress = false;
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      if (getter() < 100) setter(Math.min(getter() + 5, 100));
      updateCornerCounter(idPrefix, getter());
      repeatTimer = setInterval(() => {
        if (getter() < 100) setter(Math.min(getter() + 5, 100));
        updateCornerCounter(idPrefix, getter());
      }, 400);
    }, 500);
  });
  plusBtn.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    if (!isLongPress) {
      if (getter() < 100) setter(getter() + 1);
      updateCornerCounter(idPrefix, getter());
    }
    clearTimers();
  });
  plusBtn.addEventListener('mouseleave', clearTimers);

  // リセットボタン
  resetBtn.onclick = (e) => {
    window.playSE('SE/counter.mp3');
    e.stopPropagation();
    setter(0);
    updateCornerCounter(idPrefix, getter());
  };
}
setupCornerCounterEvents('corner-left', () => counterLeft, v => { counterLeft = v; });
setupCornerCounterEvents('corner-right', () => counterRight, v => { counterRight = v; });

// カウンターボタンで表示/非表示トグル
let counterVisible = false;
counterBtn.addEventListener('click', () => {
  window.playSE('SE/click.mp3');
  counterVisible = !counterVisible;
  counterAreaLeft.style.display = counterVisible ? 'flex' : 'none';
  counterAreaRight.style.display = counterVisible ? 'flex' : 'none';
  counterBtn.classList.toggle('active', counterVisible);
});

// ===== カウンター移動用 =====
function enableCounterDrag(counterElem) {
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let elemStartLeft = 0, elemStartTop = 0;

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  counterElem.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    // カードと同様の座標取得方法
    const rect = counterElem.getBoundingClientRect();
    elemStartLeft = rect.left;
    elemStartTop = rect.top;
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    e.preventDefault();
  });

  function onDragMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    counterElem.style.left = (elemStartLeft + dx) + 'px';
    counterElem.style.top = (elemStartTop + dy) + 'px';
    counterElem.style.right = '';
    counterElem.style.bottom = '';
  }
  function onDragEnd() {
    stopDrag();
  }

  // プラス・マイナス・リセットボタンでドラッグ解除
  ['minus','plus','reset'].forEach(type => {
    counterElem.addEventListener('click', function(e) {
      if (e.target && e.target.id && e.target.id.includes(type)) {
        stopDrag();
      }
    }, true);
  });
}

// カウンターUI生成後にドラッグ機能を付与
setTimeout(() => {
  enableCounterDrag(counterAreaLeft);
  enableCounterDrag(counterAreaRight);
}, 0);

// ===== ゲームモード・ポップアップ =====
const gameBtn = document.getElementById('game-btn');
const gamePopup = document.getElementById('game-popup');
const gamePopupBg = gamePopup.querySelector('.game-popup-bg');
const gamePopupClose = gamePopup.querySelector('.game-popup-close');
const gameTitleBtns = gamePopup.querySelectorAll('.game-title-btn');
const whiteFadeOverlay = document.getElementById('white-fade-overlay');

// ゲームボタン押下でポップアップ表示
if (gameBtn) {
  gameBtn.addEventListener('click', () => {
    window.playSE('SE/click.mp3');
    gamePopup.classList.add('active');
    alignBtn.style.background = '#fff';
    freeBtn.style.background = '#fff';
    gameBtn.style.background = '#ccc';
  });
}
// バツボタン・背景クリックでポップアップ非表示＋フリーモード
function closeGamePopup() {
  gamePopup.classList.remove('active');
  isFreeMode = true;
  updateModeButtons();
  gameBtn.style.background = '#fff';
}
gamePopupClose.addEventListener('click', () => {
  window.playSE('SE/click.mp3');
  closeGamePopup();
});
gamePopupBg.addEventListener('click', () => {
  window.playSE('SE/click.mp3');
  closeGamePopup();
});
// ===== ゲームタイトルボタン（演出のみ） =====
gameTitleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    window.playSE('SE/click.mp3');
    // kirakira.mp3を再生（SE音設定に従う）
    window.playSE('SE/kirakira.mp3');
    // kirakira音量フェードアウト用intervalをセット
    window._kirakiraFadeInterval = null;
    closeGamePopup();
    // 白フェードアウト演出（1.2秒で白くなり、0.1秒後に自動で戻る）
    if (whiteFadeOverlay) {
      alignBtn.style.background = '#fff';
      freeBtn.style.background = '#fff';
      gameBtn.style.background = '#ccc'; // フェード中のみゲームモード
      whiteFadeOverlay.classList.remove('fadeout');
      whiteFadeOverlay.style.transition = 'opacity 1.2s cubic-bezier(.4,2,.6,1)';
      whiteFadeOverlay.style.opacity = '0';
      whiteFadeOverlay.style.display = 'block';
      whiteFadeOverlay.style.pointerEvents = 'auto'; // 入力遮断

      // ===== ここで各UIを非表示にする =====
      const modeToggle = document.getElementById('mode-toggle');
      const sideTab = document.getElementById('side-tab');
      const utilityButtons = document.getElementById('utility-buttons');
      const counterAreaLeft = document.getElementById('counter-area-left');
      const counterAreaRight = document.getElementById('counter-area-right');
      if (modeToggle) modeToggle.style.display = 'none';
      if (sideTab) sideTab.style.display = 'none';
      if (utilityButtons) utilityButtons.style.display = 'none';
      if (counterAreaLeft) counterAreaLeft.style.display = 'none';
      if (counterAreaRight) counterAreaRight.style.display = 'none';
      // =====================================

      setTimeout(() => {
        whiteFadeOverlay.style.opacity = '1';
        // 完全に白くなったタイミングで盤面切り替え
        setTimeout(() => {
          // === ここで盤面を切り替える ===
          const title = btn.textContent.trim();
          if (title === 'ネクスト') {
            setupGameNext();
          } else if (title === '神経衰弱') {
            setupGameShinkeisuijaku();
            window.playSE('SE/shuffle.mp3');
          } else if (title === 'セブンブリッジ') {
            setupGameSevenBridge();
          }
          // kirakira.mp3の停止処理は不要（window.playSEで自動管理）
          // === ここまで盤面切り替え ===
          // 0.1秒後に自動で戻す
          setTimeout(() => {
            fadeWhiteOutBack(() => {
              // フェード終了後にゲームモード解除
              gameBtn.style.background = '#fff';
              // ※UIの再表示は行わない（指示により保留）
            });
          }, 100);
        }, 1200); // 1.2sで白100%
      }, 10);
    }
  });
});

// ===== 白フェードを戻す関数 =====
function fadeWhiteOutBack(callback) {
  if (!whiteFadeOverlay) return;
  whiteFadeOverlay.classList.add('fadeout');
  whiteFadeOverlay.style.opacity = '0';
  setTimeout(() => {
    whiteFadeOverlay.style.display = 'none';
    whiteFadeOverlay.classList.remove('fadeout');
    whiteFadeOverlay.style.pointerEvents = 'none'; // 入力遮断解除
    if (typeof callback === 'function') callback();
  }, 600); // 0.6s
}

// ===== ゲームごとの盤面設定関数 =====
function setGameBackground(isGame) {
  const cardContainer = document.getElementById('card-container');
  if (cardContainer) {
    cardContainer.style.background = isGame ? '#b3e5fc' : '#2e7d32';
    // body背景も変える場合
    document.body.style.background = isGame ? '#b3e5fc' : '#184d1a';
  }
}
function setupGameBabanuki() {
  // ババ抜き：グリッド整列・シャッフル・全裏・ゲームモード
  setGameBackground(true);
  gameBtn.style.background = '#ccc';
  const allCards = Array.from(document.querySelectorAll('.card'));
  for (let i = allCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
  }
  allCards.forEach(card => {
    card.classList.add('flipped');
    // 裏面表示時は元のスタイルに戻す
    card.style.padding = '';
    card.innerHTML = backHtml;
    enableCardDrag(card);
  });
  alignAllCardsGrid(allCards);
}

function setupGameNext() {
  // すべてのカードを再表示（取ったペアも復活）
  document.querySelectorAll('.card').forEach(card => {
    card.style.visibility = 'visible';
    card.style.display = '';
  });
  document.querySelectorAll('.card.selected').forEach(card => card.classList.remove('selected'));
  setGameBackground(true);
  gameBtn.style.background = '#ccc';
  const allCards = Array.from(document.querySelectorAll('.card'));
  for (let i = allCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
  }
  allCards.forEach(card => {
    // 裏面表示時は元のスタイルに戻す
    card.style.padding = '';
    card.innerHTML = backHtml;
    enableCardDrag(card); // ← 通常状態と同じ
    card.style.opacity = '';
    card.style.visibility = 'visible';
  });
  alignAllCardsGrid(allCards);
  showNextButtons();
  currentPlayer = 1;
  showPlayerIndicator();

  // ===== ネクスト用状態管理 =====
  const COLS = 9, ROWS = 6;
  let nextState = {
    grid: [], // 2次元配列でカードを管理
    cardMap: new Map(), // DOM→座標
    playerScore: [0, 0],
    currentPath: [], // 今ターンでめくったカード
    currentPos: null, // {row, col}
    turnActive: false,
    jokerMode: false,
    finished: false
  };
  // グリッド初期化
  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    nextState.grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      const card = allCards[idx];
      if (card) {
        nextState.grid[r][c] = card;
        nextState.cardMap.set(card, { row: r, col: c });
      }
      idx++;
    }
  }
  // 盤面から消えたカードはnullになる

  // UIスコア表示
  function updateNextScoreUI() {
    let scoreElem = document.getElementById('next-score');
    if (!scoreElem) {
      scoreElem = document.createElement('div');
      scoreElem.id = 'next-score';
      scoreElem.style.position = 'fixed';
      scoreElem.style.top = '56px';
      scoreElem.style.left = '50%';
      scoreElem.style.transform = 'translateX(-50%)';
      scoreElem.style.zIndex = '4201';
      scoreElem.style.background = 'rgba(255,255,255,0.92)';
      scoreElem.style.borderRadius = '10px';
      scoreElem.style.padding = '6px 32px';
      scoreElem.style.fontSize = '18px';
      scoreElem.style.fontWeight = 'bold';
      scoreElem.style.boxShadow = '0 2px 12px rgba(0,0,0,0.10)';
      document.body.appendChild(scoreElem);
    }
    scoreElem.innerHTML = `<span style='color:#e53935;'>P1: ${nextState.playerScore[0]}</span> - <span style='color:#1565c0;'>P2: ${nextState.playerScore[1]}</span>`;
    scoreElem.style.display = 'block';
  }
  updateNextScoreUI();

  // 進行方向（蛇行）で次の座標を返す
  function getNextPos(row, col, step) {
    let pos = { row, col };
    for (let s = 0; s < step; s++) {
      if (pos.row % 2 === 0) {
        // 偶数行は右へ
        if (pos.col < COLS - 1) {
          pos.col++;
        } else {
          // 端なら下の行へ
          pos.row = (pos.row + 1) % ROWS;
          pos.col = COLS - 1;
        }
      } else {
        // 奇数行は左へ
        if (pos.col > 0) {
          pos.col--;
        } else {
          pos.row = (pos.row + 1) % ROWS;
          pos.col = 0;
        }
      }
      // 右下端→左上ループ
      if (pos.row === 0 && pos.col === 0 && s !== step - 1) {
        // ループ時は何もしない（自然に回る）
      }
    }
    return pos;
  }

  // すべてのカードのイベントを初期化
  allCards.forEach(card => {
    const newCard = card.cloneNode(true);
    // すべてのイベント・プロパティをリセット
    newCard.onmousedown = null;
    newCard.onmouseup = null;
    newCard.onmouseleave = null;
    newCard.oncontextmenu = null;
    newCard.onclick = null;
    newCard.ondragstart = null;
    newCard.ondrag = null;
    newCard.ondragend = null;
    newCard.ondragover = null;
    newCard.ondrop = null;
    newCard.style.cursor = 'pointer';
    // 左クリックでめくるイベントのみ付与
    newCard.addEventListener('click', function(e) {
      if (!nextState.turnActive) return;
      if (e.button !== 0) return;
      let pos = nextState.cardMap.get(newCard);
      if (!pos) return;
      proceedFrom(pos.row, pos.col);
    });
    newCard.onmouseenter = function(){};
    newCard.onmouseleave = function(){ newCard.classList.remove('card-hovered','player1-glow','player2-glow'); };
    card.parentNode.replaceChild(newCard, card);
  });
  // freshCardsを再取得
  const freshCards = Array.from(document.querySelectorAll('.card'));

  // ゲーム進行
  function startTurn() {
    nextState.currentPath = [];
    nextState.currentPos = null;
    nextState.turnActive = true;
    nextState.jokerMode = false;
    // 盤面の未めくりカードのみクリック可能
    freshCards.forEach(card => {
      if (card.style.display === 'none') return;
      card.classList.remove('selected');
      card.onclick = function() {
        if (!nextState.turnActive) return;
        if (card.classList.contains('flipped') === false) return;
        // 最初の1枚 or ジョーカーでの再選択
        let pos = nextState.cardMap.get(card);
        if (!pos) return;
        proceedFrom(pos.row, pos.col);
      };
    });
  }

  // 進行本体
  function proceedFrom(row, col) {
    let card = nextState.grid[row][col];
    if (!card || card.style.display === 'none') return;
    // 既にめくったカードに止まったらターン終了
    if (card.classList.contains('selected')) {
      endTurn();
      return;
    }
    // めくる
    flipCard(card);
    card.classList.add('selected');
    nextState.currentPath.push(card);
    nextState.currentPos = { row, col };
    // ジョーカー処理
    if (card.classList.contains('joker')) {
      nextState.jokerMode = true;
      // ジョーカーは再選択可能
      startTurn();
      return;
    }
    // 数字取得
    let value = parseInt(card.dataset.rankValue, 10);
    if (!value) value = 1;
    // 次の座標
    let nextPos = getNextPos(row, col, value);
    let nextCard = nextState.grid[nextPos.row][nextPos.col];
    // 進んだ先が既に消えている or めくり済みならターン終了
    if (!nextCard || nextCard.style.display === 'none' || nextCard.classList.contains('selected')) {
      endTurn();
      return;
    }
    // 進行を続ける
    setTimeout(() => {
      proceedFrom(nextPos.row, nextPos.col);
    }, 500);
  }

  // ターン終了処理
  function endTurn() {
    nextState.turnActive = false;
    // スコア加算
    nextState.playerScore[currentPlayer-1] += nextState.currentPath.length;
    updateNextScoreUI();
    // 盤面から消去
    nextState.currentPath.forEach(card => {
      card.style.transition = 'opacity 0.5s';
      card.style.opacity = '0';
      setTimeout(() => {
        card.style.display = 'none';
        card.classList.remove('selected');
      }, 500);
    });
    // 全カード消えたら勝敗判定
    setTimeout(() => {
      const remain = freshCards.filter(card => card.style.display !== 'none');
      if (remain.length === 0) {
        let msg = '';
        if (nextState.playerScore[0] > nextState.playerScore[1]) msg = 'プレイヤー1の勝ち！';
        else if (nextState.playerScore[0] < nextState.playerScore[1]) msg = 'プレイヤー2の勝ち！';
        else msg = '引き分け！';
        let resultElem = document.getElementById('next-result');
        if (!resultElem) {
          resultElem = document.createElement('div');
          resultElem.id = 'next-result';
          resultElem.style.cssText = 'position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:4300;background:rgba(255,255,255,0.98);border-radius:16px;padding:24px 48px;font-size:28px;font-weight:bold;box-shadow:0 2px 24px rgba(0,0,0,0.18);';
          document.body.appendChild(resultElem);
        }
        window.playSE('SE/hakusyu.mp3');
        resultElem.innerHTML = `<div>${msg}</div><div style='font-size:20px;margin-top:12px;'>P1: ${nextState.playerScore[0]} pt　P2: ${nextState.playerScore[1]} pt</div>`;
        resultElem.style.display = 'block';
        nextState.finished = true;
        return;
      }
      // プレイヤー交代
      currentPlayer = currentPlayer === 1 ? 2 : 1;
      updatePlayerIndicator();
      setTimeout(() => { startTurn(); }, 600);
    }, 600);
  }

  // ゲーム開始
  startTurn();
  if (typeof createBgmAudio === 'function') createBgmAudio();
  if (typeof isBgmOn !== 'undefined') {
    isBgmOn = true;
    if (typeof updateBgmBtn === 'function') updateBgmBtn();
  }
  if (bgmAudio) {
    bgmAudio.src = 'BGM/dongri.mp3';
    bgmAudio.currentTime = 0;
    bgmAudio.play();
  }
}
function setupGameShinkeisuijaku() {
  // すべてのカードを再表示（取ったペアも復活）
  document.querySelectorAll('.card').forEach(card => {
    card.style.visibility = 'visible';
    card.style.display = '';
  });
  // 選択状態や他のゲーム状態をリセット
  document.querySelectorAll('.card.selected').forEach(card => card.classList.remove('selected'));

  // 神経衰弱：グリッド整列・シャッフル・全裏・ゲームモード
  setGameBackground(true);
  gameBtn.style.background = '#ccc';
  const allCards = Array.from(document.querySelectorAll('.card'));
  for (let i = allCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
  }
  allCards.forEach(card => {
    card.classList.add('flipped');
    card.style.padding = '';
    card.innerHTML = backHtml;
    enableCardDrag(card);
  });
  alignAllCardsGrid(allCards);
  showShinkeisuijakuButtons();
  currentPlayer = 1;
  showPlayerIndicator();
  resetShinkeisuijakuState();
  updateShinkeisuijakuScore();
  hideShinkeisuijakuResult();
  // ===== 神経衰弱用ホバー演出＋クリックイベント付与 =====
  allCards.forEach(card => {
    // hover演出
    card.onmouseenter = function() {
      // 神経衰弱ゲーム状態ではhover演出を無効化
    };
    card.onmouseleave = function() {
      card.classList.remove('card-hovered','player1-glow','player2-glow');
    };
    // 左クリックのみ有効：カードをめくる
    card.addEventListener('click', card._shinkeisuijakuClick = function(e) {
      if (!document.body.classList.contains('shinkeisuijaku-mode')) return;
      if (e.button !== 0) return; // 左クリックのみ
      if (shinkeisuijakuState.lock) return;
      // 既にめくれているカードは無視
      if (card.classList.contains('flipped') === false) return;
      // 2枚まで
      if (shinkeisuijakuState.flipped.length >= 2) return;
      flipCard(card);
      shinkeisuijakuState.flipped.push(card);
      if (shinkeisuijakuState.flipped.length === 2) {
        shinkeisuijakuState.lock = true;
        setTimeout(() => {
          const [c1, c2] = shinkeisuijakuState.flipped;
          // ジョーカーは無効（両方JOKERならOK）
          const v1 = c1.dataset.rankValue;
          const v2 = c2.dataset.rankValue;
          if (v1 === v2) {
            // ペア成立
            setTimeout(() => {
              c1.classList.remove('card-hovered','player1-glow','player2-glow');
              c2.classList.remove('card-hovered','player1-glow','player2-glow');
              // --- 面白い演出: 拡大・回転・フェードアウト ---
              [c1, c2].forEach(card => {
                card.style.transition = 'transform 0.7s cubic-bezier(.4,2,.6,1), opacity 0.7s cubic-bezier(.4,2,.6,1)';
                card.style.transform = 'scale(1.4) rotate(1turn)';
                card.style.opacity = '0';
              });
              // maru.mp3のSE音を同時に流す
              window.playSE('SE/maru.mp3');
              setTimeout(() => {
                c1.style.visibility = 'hidden';
                c2.style.visibility = 'hidden';
                c1.style.transition = '';
                c2.style.transition = '';
                c1.style.transform = '';
                c2.style.transform = '';
                c1.style.opacity = '';
                c2.style.opacity = '';
                shinkeisuijakuState.flipped = [];
                shinkeisuijakuState.lock = false;
                shinkeisuijakuState.pairs[currentPlayer-1]++;  // ペアカウント
                shinkeisuijakuState.score[currentPlayer-1]++;  // スコア
                shinkeisuijakuState.totalPairs--;              // 先に減算
                updateShinkeisuijakuScore();                   // 減算後に表示更新
                // 全ペア取得で終了
                if (shinkeisuijakuState.totalPairs === 0) {
                  setTimeout(() => {
                    showShinkeisuijakuResult();
                  }, 600);
                }
                // ペア成立時は同じプレイヤーのターン継続
              }, 700);
            }, 700);
          } else {
            // 不一致：裏返してターン交代
            setTimeout(() => {
              // batu.mp3のSE音を流す
              window.playSE('SE/batu.mp3');
              shinkeisuijakuState.flipped.forEach(c => flipCard(c));
              shinkeisuijakuState.flipped = [];
              shinkeisuijakuState.lock = false;
              // ターン交代
              currentPlayer = currentPlayer === 1 ? 2 : 1;
              updatePlayerIndicator();
            }, 900);
          }
        }, 400);
      }
    });
  });
  // ===== 神経衰弱用ホバークラスを付与 =====
  allCards.forEach(card => card.classList.add('shinkei-hoverable'));
  // ===== 神経衰弱モードフラグON =====
  document.body.classList.add('shinkeisuijaku-mode');
  // ===== 範囲選択・右クリックメニューを無効化 =====
  const container = document.getElementById('card-container');
  if (container) {
    container._origOnMouseDown = container.onmousedown;
    container._origOnContextMenu = container.oncontextmenu;
    container.onmousedown = function(e) {
      // 範囲選択禁止
      if (e.target === container && e.button === 0) return false;
      if (container._origOnMouseDown) return container._origOnMouseDown(e);
    };
    container.oncontextmenu = function(e) {
      // 右クリック禁止
      e.preventDefault();
      return false;
    };
  }
  // ===== BGM自動ON・再生 =====
  if (typeof createBgmAudio === 'function') createBgmAudio();
  if (typeof isBgmOn !== 'undefined') {
    isBgmOn = true;
    if (typeof updateBgmBtn === 'function') updateBgmBtn();
  }
  if (bgmAudio) {
    bgmAudio.src = 'BGM/tranp.mp3';
    bgmAudio.currentTime = 0;
    bgmAudio.play();
  }
}
function setupGameSevenBridge() {
  // セブンブリッジ：グリッド整列・シャッフル・全裏＋ジョーカー除外・ゲームモード
  setGameBackground(true);
  gameBtn.style.background = '#ccc';
  const allCards = Array.from(document.querySelectorAll('.card'));
  const nonJokerCards = allCards.filter(card => !card.classList.contains('joker'));
  for (let i = nonJokerCards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nonJokerCards[i], nonJokerCards[j]] = [nonJokerCards[j], nonJokerCards[i]];
  }
  nonJokerCards.forEach(card => {
    card.classList.add('flipped');
    // 裏面表示時は元のスタイルに戻す
    card.style.padding = '';
    card.innerHTML = backHtml;
    enableCardDrag(card);
  });
  alignAllCardsGrid(nonJokerCards);
  allCards.filter(card => card.classList.contains('joker')).forEach(card => {
    card.style.display = 'none';
  });
}

// ===== 神経衰弱用ボタン生成・管理 =====
function showShinkeisuijakuButtons() {
  let btnArea = document.getElementById('shinkeisuijaku-btn-area');
  if (!btnArea) {
    btnArea = document.createElement('div');
    btnArea.id = 'shinkeisuijaku-btn-area';
    btnArea.style.position = 'fixed';
    btnArea.style.top = '16px';
    btnArea.style.right = '32px';
    btnArea.style.zIndex = '4100';
    btnArea.style.display = 'flex';
    btnArea.style.gap = '12px';
    // 中断ボタン
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'pause-btn';
    pauseBtn.textContent = '中断';
    pauseBtn.style.fontSize = '15px';
    pauseBtn.style.padding = '4px 18px';
    pauseBtn.style.background = '#fff';
    pauseBtn.style.color = '#1565c0';
    pauseBtn.style.border = '1.5px solid #1565c0';
    pauseBtn.style.borderRadius = '6px';
    pauseBtn.style.cursor = 'pointer';
    // リセットボタン
    const resetBtn = document.createElement('button');
    resetBtn.id = 'reset-btn';
    resetBtn.textContent = 'リセット';
    resetBtn.style.fontSize = '15px';
    resetBtn.style.padding = '4px 18px';
    resetBtn.style.background = '#fff';
    resetBtn.style.color = '#e53935';
    resetBtn.style.border = '1.5px solid #e53935';
    resetBtn.style.borderRadius = '6px';
    resetBtn.style.cursor = 'pointer';
    btnArea.appendChild(pauseBtn);
    btnArea.appendChild(resetBtn);
    document.body.appendChild(btnArea);
  }
  btnArea.style.display = 'flex';

  // ===== 混ぜるボタンの生成・管理（左上固定） =====
  let mixBtn = document.getElementById('mix-btn');
  if (!mixBtn) {
    mixBtn = document.createElement('button');
    mixBtn.id = 'mix-btn';
    mixBtn.textContent = '混ぜる';
    mixBtn.style.position = 'fixed';
    mixBtn.style.top = '16px';
    mixBtn.style.left = '16px';
    mixBtn.style.zIndex = '4101';
    mixBtn.style.fontSize = '15px';
    mixBtn.style.padding = '4px 18px';
    mixBtn.style.background = '#fff';
    mixBtn.style.color = '#1565c0';
    mixBtn.style.border = '1.5px solid #1565c0';
    mixBtn.style.borderRadius = '6px';
    mixBtn.style.cursor = 'pointer';
    document.body.appendChild(mixBtn);
  }
  mixBtn.style.display = 'block';
  // 混ぜるボタンのイベント設定
  if (mixBtn && !mixBtn.dataset.bound) {
    mixBtn.addEventListener('click', () => {
      window.playSE('SE/click.mp3');
      // 盤面上に残っているカードのみ取得
      const remainCards = Array.from(document.querySelectorAll('.card')).filter(card => card.style.visibility !== 'hidden');
      const before = remainCards.map(card => card.style.left + ',' + card.style.top);
      // シャッフル
      for (let i = remainCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainCards[i], remainCards[j]] = [remainCards[j], remainCards[i]];
      }
      // グリッド再配置
      alignAllCardsGrid(remainCards);
      const after = remainCards.map(card => card.style.left + ',' + card.style.top);
      if (before.some((v, i) => v !== after[i])) {
        window.playSE('SE/shuffle.mp3');
      } else {
        window.playSE('SE/click.mp3');
      }
    });
    mixBtn.dataset.bound = '1';
  }

  // ===== 中断ボタンのイベント設定 =====
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn && !pauseBtn.dataset.bound) {
    pauseBtn.addEventListener('click', () => {
      window.playSE('SE/click.mp3');
      // kirakira.mp3を再生（SE音設定に従う）
      window.playSE('SE/kirakira.mp3');
      // kirakira音量フェードアウト用intervalをセット
      window._kirakiraFadeInterval = null;
      // ===== BGMフェードアウト処理追加 =====
      if (bgmAudio && !bgmAudio.paused) {
        const fadeDuration = 1200; // ms
        const fadeSteps = 24;
        const fadeStepTime = fadeDuration / fadeSteps;
        let currentStep = 0;
        const startVolume = bgmAudio.volume;
        const fadeOut = setInterval(() => {
          currentStep++;
          bgmAudio.volume = Math.max(0, startVolume * (1 - currentStep / fadeSteps));
          if (currentStep >= fadeSteps) {
            clearInterval(fadeOut);
            bgmAudio.pause();
            bgmAudio.volume = startVolume; // 次回再生時のために戻す
            if (typeof isBgmOn !== 'undefined') {
              isBgmOn = false;
              if (typeof updateBgmBtn === 'function') updateBgmBtn();
            }
          }
        }, fadeStepTime);
      } else {
        if (typeof isBgmOn !== 'undefined') {
          isBgmOn = false;
          if (typeof updateBgmBtn === 'function') updateBgmBtn();
        }
      }
      // ... existing code ...
      hideShinkeisuijakuButtons();
      // 混ぜるボタンも非表示
      let mixBtn = document.getElementById('mix-btn');
      if (mixBtn) mixBtn.style.display = 'none';
      // 白フェード演出開始
      if (whiteFadeOverlay) {
        whiteFadeOverlay.classList.remove('fadeout');
        whiteFadeOverlay.style.transition = 'opacity 1.2s cubic-bezier(.4,2,.6,1)';
        whiteFadeOverlay.style.opacity = '0';
        whiteFadeOverlay.style.display = 'block';
        whiteFadeOverlay.style.pointerEvents = 'auto';
        setTimeout(() => {
          whiteFadeOverlay.style.opacity = '1';
          setTimeout(() => {
            initializeToDefaultState();
            showMainUI();
            freeBtn.style.background = '#ccc';
            alignBtn.style.background = '#fff';
            gameBtn.style.background = '#fff';
            setTimeout(() => {
              fadeWhiteOutBack(() => {
                // ここではUI再表示は不要
              });
            }, 100);
          }, 1200);
        }, 10);
      }
    });
    pauseBtn.dataset.bound = '1';
  }
  // ===== リセットボタンのイベント設定 =====
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.addEventListener('click', () => {
      window.playSE('SE/click.mp3');
      // リセット前後でカード位置比較
      const allCards = Array.from(document.querySelectorAll('.card'));
      const before = allCards.map(card => card.style.left + ',' + card.style.top);
      setupGameShinkeisuijaku();
      // setupGameShinkeisuijaku後に位置比較（非同期のためsetTimeoutで遅延チェック）
      setTimeout(() => {
        const after = Array.from(document.querySelectorAll('.card')).map(card => card.style.left + ',' + card.style.top);
        if (before.some((v, i) => v !== after[i])) {
          window.playSE('SE/shuffle.mp3');
        } else {
          window.playSE('SE/click.mp3');
        }
      }, 10);
    });
    resetBtn.dataset.bound = '1';
  }
}
// ===== 盤面初期化関数 =====
function initializeToDefaultState() {
  // ===== 神経衰弱状態の設定を初期化 =====
  cleanupShinkeisuijakuMode();
  // ===== ネクスト状態の設定を初期化 =====
  cleanupNextMode();
  // カードを全て削除（ただし#card-canvas等ラッパー要素は消さない）
  const container = document.getElementById('card-container');
  if (container) {
    document.querySelectorAll('.card').forEach(c => c.remove());
    const selBox = container.querySelector('div[style*="dashed"]');
    if (selBox) selBox.remove();
  }
  // カードを初期状態で再生成
  for (let suit of suits) {
    for (let i = 0; i < ranks.length; i++) {
      const rank = ranks[i];
      const card = document.createElement('div');
      card.classList.add('card', suit.name);
      const cardHtml = `
        <div style="font-size:14px;">${suit.symbol} ${rank}</div>
        <div style="align-self: flex-end; font-size:14px;">${rank} ${suit.symbol}</div>
      `;
      card.innerHTML = cardHtml;
      card.dataset.frontHtml = cardHtml;
      // 神経衰弱モード用の画像パスを保存
      card.dataset.cardImage = `picture/${suit.name}_${rank}.png`;
      card.dataset.rankValue = (i + 1).toString(); // A=1, 2=2, ..., K=13
      randomPosition(card);
      enableCardDrag(card);
      container.appendChild(card);
    }
  }
  for (let i = 0; i < 2; i++) {
    const joker = document.createElement('div');
    joker.classList.add('card', 'joker');
    const jokerHtml = i === 0 ? 'JOKER<br>🃏' : 'JOKER<br>🃟';
    joker.innerHTML = jokerHtml;
    joker.dataset.frontHtml = jokerHtml;
    // 神経衰弱モード用の画像パスを保存
    joker.dataset.cardImage = `picture/joker${i + 1}.png`;
    joker.dataset.rankValue = '14'; // JOKER=14
    randomPosition(joker);
    enableCardDrag(joker);
    container.appendChild(joker);
  }
  // 神経衰弱用ボタンは非表示
  hideShinkeisuijakuButtons();
  // ネクスト用ボタンは非表示
  hideNextButtons();
  // 背景色なども初期化
  setGameBackground(false);
  // 選択状態解除
  document.querySelectorAll('.card.selected').forEach(card => card.classList.remove('selected'));
  // ===== フリーモードを必ず有効にする =====
  isFreeMode = true;
  updateModeButtons();
  // 他のUIや状態も必要に応じてここで初期化
}
function hideShinkeisuijakuButtons() {
  const btnArea = document.getElementById('shinkeisuijaku-btn-area');
  if (btnArea) btnArea.style.display = 'none';
  // 混ぜるボタンも非表示
  const mixBtn = document.getElementById('mix-btn');
  if (mixBtn) mixBtn.style.display = 'none';
}

// ===== ネクスト用ボタン生成・管理 =====
function showNextButtons() {
  let btnArea = document.getElementById('next-btn-area');
  if (!btnArea) {
    btnArea = document.createElement('div');
    btnArea.id = 'next-btn-area';
    btnArea.style.position = 'fixed';
    btnArea.style.top = '16px';
    btnArea.style.right = '32px';
    btnArea.style.zIndex = '4100';
    btnArea.style.display = 'flex';
    btnArea.style.gap = '12px';
    // 中断ボタン
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'next-pause-btn';
    pauseBtn.textContent = '中断';
    pauseBtn.style.fontSize = '15px';
    pauseBtn.style.padding = '4px 18px';
    pauseBtn.style.background = '#fff';
    pauseBtn.style.color = '#1565c0';
    pauseBtn.style.border = '1.5px solid #1565c0';
    pauseBtn.style.borderRadius = '6px';
    pauseBtn.style.cursor = 'pointer';
    // リセットボタン
    const resetBtn = document.createElement('button');
    resetBtn.id = 'next-reset-btn';
    resetBtn.textContent = 'リセット';
    resetBtn.style.fontSize = '15px';
    resetBtn.style.padding = '4px 18px';
    resetBtn.style.background = '#fff';
    resetBtn.style.color = '#e53935';
    resetBtn.style.border = '1.5px solid #e53935';
    resetBtn.style.borderRadius = '6px';
    resetBtn.style.cursor = 'pointer';
    btnArea.appendChild(pauseBtn);
    btnArea.appendChild(resetBtn);
    document.body.appendChild(btnArea);
  }
  btnArea.style.display = 'flex';

  // ===== 混ぜるボタンの生成・管理（左上固定） =====
  let mixBtn = document.getElementById('next-mix-btn');
  if (!mixBtn) {
    mixBtn = document.createElement('button');
    mixBtn.id = 'next-mix-btn';
    mixBtn.textContent = '混ぜる';
    mixBtn.style.position = 'fixed';
    mixBtn.style.top = '16px';
    mixBtn.style.left = '16px';
    mixBtn.style.zIndex = '4101';
    mixBtn.style.fontSize = '15px';
    mixBtn.style.padding = '4px 18px';
    mixBtn.style.background = '#fff';
    mixBtn.style.color = '#1565c0';
    mixBtn.style.border = '1.5px solid #1565c0';
    mixBtn.style.borderRadius = '6px';
    mixBtn.style.cursor = 'pointer';
    document.body.appendChild(mixBtn);
  }
  mixBtn.style.display = 'block';
  // 混ぜるボタンのイベント設定
  if (mixBtn && !mixBtn.dataset.bound) {
    mixBtn.addEventListener('click', () => {
      window.playSE('SE/click.mp3');
      // 盤面上に残っているカードのみ取得
      const remainCards = Array.from(document.querySelectorAll('.card')).filter(card => card.style.visibility !== 'hidden');
      const before = remainCards.map(card => card.style.left + ',' + card.style.top);
      // シャッフル
      for (let i = remainCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainCards[i], remainCards[j]] = [remainCards[j], remainCards[i]];
      }
      // グリッド再配置
      alignAllCardsGrid(remainCards);
      const after = remainCards.map(card => card.style.left + ',' + card.style.top);
      if (before.some((v, i) => v !== after[i])) {
        window.playSE('SE/shuffle.mp3');
      } else {
        window.playSE('SE/click.mp3');
      }
    });
    mixBtn.dataset.bound = '1';
  }

  // ===== 中断ボタンのイベント設定 =====
  const pauseBtn = document.getElementById('next-pause-btn');
  if (pauseBtn && !pauseBtn.dataset.bound) {
    pauseBtn.addEventListener('click', () => {
      window.playSE('SE/click.mp3');
      // kirakira.mp3を再生（SE音設定に従う）
      window.playSE('SE/kirakira.mp3');
      // kirakira音量フェードアウト用intervalをセット
      window._kirakiraFadeInterval = null;
      // ===== BGMフェードアウト処理追加 =====
      if (bgmAudio && !bgmAudio.paused) {
        const fadeDuration = 1200; // ms
        const fadeSteps = 24;
        const fadeStepTime = fadeDuration / fadeSteps;
        let currentStep = 0;
        const startVolume = bgmAudio.volume;
        const fadeOut = setInterval(() => {
          currentStep++;
          bgmAudio.volume = Math.max(0, startVolume * (1 - currentStep / fadeSteps));
          if (currentStep >= fadeSteps) {
            clearInterval(fadeOut);
            bgmAudio.pause();
            bgmAudio.volume = startVolume; // 次回再生時のために戻す
            if (typeof isBgmOn !== 'undefined') {
              isBgmOn = false;
              if (typeof updateBgmBtn === 'function') updateBgmBtn();
            }
          }
        }, fadeStepTime);
      } else {
        if (typeof isBgmOn !== 'undefined') {
          isBgmOn = false;
          if (typeof updateBgmBtn === 'function') updateBgmBtn();
        }
      }
      // ... existing code ...
      hideNextButtons();
      // 混ぜるボタンも非表示
      let mixBtn = document.getElementById('next-mix-btn');
      if (mixBtn) mixBtn.style.display = 'none';
      // 白フェード演出開始
      if (whiteFadeOverlay) {
        whiteFadeOverlay.classList.remove('fadeout');
        whiteFadeOverlay.style.transition = 'opacity 1.2s cubic-bezier(.4,2,.6,1)';
        whiteFadeOverlay.style.opacity = '0';
        whiteFadeOverlay.style.display = 'block';
        whiteFadeOverlay.style.pointerEvents = 'auto';
        setTimeout(() => {
          whiteFadeOverlay.style.opacity = '1';
          setTimeout(() => {
            initializeToDefaultState();
            showMainUI();
            freeBtn.style.background = '#ccc';
            alignBtn.style.background = '#fff';
            gameBtn.style.background = '#fff';
            setTimeout(() => {
              fadeWhiteOutBack(() => {
                // ここではUI再表示は不要
              });
            }, 100);
          }, 1200);
        }, 10);
      }
    });
    pauseBtn.dataset.bound = '1';
  }
  // ===== リセットボタンのイベント設定 =====
  const resetBtn = document.getElementById('next-reset-btn');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.addEventListener('click', () => {
      window.playSE('SE/click.mp3');
      // リセット前後でカード位置比較
      const allCards = Array.from(document.querySelectorAll('.card'));
      const before = allCards.map(card => card.style.left + ',' + card.style.top);
      setupGameNext();
      // setupGameNext後に位置比較（非同期のためsetTimeoutで遅延チェック）
      setTimeout(() => {
        const after = Array.from(document.querySelectorAll('.card')).map(card => card.style.left + ',' + card.style.top);
        if (before.some((v, i) => v !== after[i])) {
          window.playSE('SE/shuffle.mp3', 0.6);
        } else {
          window.playSE('SE/click.mp3');
        }
      }, 10);
    });
    resetBtn.dataset.bound = '1';
  }
}

function hideNextButtons() {
  const btnArea = document.getElementById('next-btn-area');
  if (btnArea) btnArea.style.display = 'none';
  // 混ぜるボタンも非表示
  const mixBtn = document.getElementById('next-mix-btn');
  if (mixBtn) mixBtn.style.display = 'none';
}

// ===== メインUI再表示関数 =====
function showMainUI() {
  const modeToggle = document.getElementById('mode-toggle');
  const sideTab = document.getElementById('side-tab');
  const utilityButtons = document.getElementById('utility-buttons');
  const counterAreaLeft = document.getElementById('counter-area-left');
  const counterAreaRight = document.getElementById('counter-area-right');
  if (modeToggle) modeToggle.style.display = '';
  if (sideTab) sideTab.style.display = '';
  if (utilityButtons) utilityButtons.style.display = '';
  // カウンターの表示状態はcounterVisibleに従う
  if (typeof counterVisible !== 'undefined') {
    if (counterAreaLeft) counterAreaLeft.style.display = counterVisible ? 'flex' : 'none';
    if (counterAreaRight) counterAreaRight.style.display = counterVisible ? 'flex' : 'none';
  } else {
    if (counterAreaLeft) counterAreaLeft.style.display = '';
    if (counterAreaRight) counterAreaRight.style.display = '';
  }
}

// ===== 神経衰弱用プレイヤー表示・ターン管理 =====
let currentPlayer = 1; // 1: プレイヤー1, 2: プレイヤー2
function showPlayerIndicator() {
  let indicator = document.getElementById('player-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'player-indicator';
    indicator.style.position = 'fixed';
    indicator.style.top = '0';
    indicator.style.left = '50%';
    indicator.style.transform = 'translateX(-50%)';
    indicator.style.zIndex = '4200';
    indicator.style.display = 'flex';
    indicator.style.gap = '32px';
    indicator.style.fontSize = '22px';
    indicator.style.fontWeight = 'bold';
    indicator.style.marginTop = '12px';
    indicator.style.userSelect = 'none';
    document.body.appendChild(indicator);
  }
  updatePlayerIndicator();
  indicator.style.display = 'flex';
}
function hidePlayerIndicator() {
  const indicator = document.getElementById('player-indicator');
  if (indicator) indicator.style.display = 'none';
}
function updatePlayerIndicator() {
  const indicator = document.getElementById('player-indicator');
  if (!indicator) return;
  indicator.innerHTML = `
    <span class="player-chip p1 ${currentPlayer===1?'active':''}">\u25b6 \u30d7\u30ec\u30a4\u30e4\u30fc1</span>
    <span class="versus">VS</span>
    <span class="player-chip p2 ${currentPlayer===2?'active':''}">\u25b6 \u30d7\u30ec\u30a4\u30e4\u30fc2</span>
  `;
}
function setCurrentPlayer(player) {
  currentPlayer = player;
  updatePlayerIndicator();
}

// ===== 神経衰弱状態終了時の後始末 =====
function cleanupShinkeisuijakuMode() {
  document.body.classList.remove('shinkeisuijaku-mode');
  hidePlayerIndicator();
  hideShinkeisuijakuScore();
  hideShinkeisuijakuResult();
  // カードのhoverクラスも除去
  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('card-hovered','player1-glow','player2-glow');
    card.onmouseenter = null;
    card.onmouseleave = null;
    // 神経衰弱用クリックイベント解除
    if (card._shinkeisuijakuClick) {
      card.removeEventListener('click', card._shinkeisuijakuClick);
      card._shinkeisuijakuClick = null;
    }
  });
  // カードコンテナのイベント元に戻す
  const container = document.getElementById('card-container');
  if (container) {
    if (container._origOnMouseDown !== undefined) {
      container.onmousedown = container._origOnMouseDown;
      delete container._origOnMouseDown;
    } else {
      container.onmousedown = null;
    }
    if (container._origOnContextMenu !== undefined) {
      container.oncontextmenu = container._origOnContextMenu;
      delete container._origOnContextMenu;
    } else {
      container.oncontextmenu = null;
    }
  }
  shinkeisuijakuState = null;
}

function cleanupNextMode() {
  document.body.classList.remove('next-mode');
  hidePlayerIndicator();
  hideNextScore();
  hideNextResult();
  // カードのhoverクラスも除去
  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('card-hovered','player1-glow','player2-glow');
    card.onmouseenter = null;
    card.onmouseleave = null;
    // ネクスト用クリックイベント解除
    if (card._nextClick) {
      card.removeEventListener('click', card._nextClick);
      card._nextClick = null;
    }
  });
  // カードコンテナのイベント元に戻す
  const container = document.getElementById('card-container');
  if (container) {
    if (container._origOnMouseDown !== undefined) {
      container.onmousedown = container._origOnMouseDown;
      delete container._origOnMouseDown;
    } else {
      container.onmousedown = null;
    }
    if (container._origOnContextMenu !== undefined) {
      container.oncontextmenu = container._origOnContextMenu;
      delete container._origOnContextMenu;
    } else {
      container.oncontextmenu = null;
    }
  }
  nextState = null;
}

// ===== 神経衰弱用スコア・状態管理 =====
let shinkeisuijakuState = null;
function resetShinkeisuijakuState() {
  shinkeisuijakuState = {
    flipped: [], // めくったカード
    lock: false, // 判定中ロック
    score: [0, 0], // [プレイヤー1, プレイヤー2] ペア枚数
    pairs: [0, 0], // 取得ペア枚数
    totalPairs: 27, // 54枚(ジョーカー含む)/2
  };
}
function updateShinkeisuijakuScore() {
  let scoreElem = document.getElementById('shinkeisuijaku-score');
  if (!scoreElem) {
    scoreElem = document.createElement('div');
    scoreElem.id = 'shinkeisuijaku-score';
    scoreElem.className = 'game-score-bar';
    document.body.appendChild(scoreElem);
  }
  const p1pairs = shinkeisuijakuState.pairs[0];
  const p2pairs = shinkeisuijakuState.pairs[1];
  const remain = shinkeisuijakuState.totalPairs;
  scoreElem.innerHTML = `
    <div class="score-item">
      <div class="score-label p1-score">♥ P1</div>
      <div class="score-value p1-score">${p1pairs}<span style="font-size:13px;opacity:0.6;"> ペア</span></div>
    </div>
    <div class="score-sep">│</div>
    <div class="score-item">
      <div class="score-label" style="color:rgba(255,255,255,0.4);font-size:10px;">残り</div>
      <div class="score-value" style="color:rgba(255,255,255,0.55);font-size:18px;">${remain}</div>
    </div>
    <div class="score-sep">│</div>
    <div class="score-item">
      <div class="score-label p2-score">♠ P2</div>
      <div class="score-value p2-score">${p2pairs}<span style="font-size:13px;opacity:0.6;"> ペア</span></div>
    </div>
  `;
  scoreElem.style.display = 'flex';
}
function hideShinkeisuijakuScore() {
  const scoreElem = document.getElementById('shinkeisuijaku-score');
  if (scoreElem) scoreElem.style.display = 'none';
}
function showShinkeisuijakuResult() {
  let resultElem = document.getElementById('shinkeisuijaku-result');
  if (!resultElem) {
    resultElem = document.createElement('div');
    resultElem.id = 'shinkeisuijaku-result';
    resultElem.style.position = 'fixed';
    resultElem.style.top = '120px';
    resultElem.style.left = '50%';
    resultElem.style.transform = 'translateX(-50%)';
    resultElem.style.zIndex = '4300';
    resultElem.style.background = 'rgba(255,255,255,0.98)';
    resultElem.style.borderRadius = '16px';
    resultElem.style.padding = '24px 48px';
    resultElem.style.fontSize = '28px';
    resultElem.style.fontWeight = 'bold';
    resultElem.style.boxShadow = '0 2px 24px rgba(0,0,0,0.18)';
    document.body.appendChild(resultElem);
  }
  // hakusyu.mp3のSEを流す
  window.playSE('SE/hakusyu.mp3');
  resultElem.style.color = '#222';
  let msg = '';
  if (shinkeisuijakuState.pairs[0] > shinkeisuijakuState.pairs[1]) msg = '🏆 プレイヤー1の勝ち！';
  else if (shinkeisuijakuState.pairs[0] < shinkeisuijakuState.pairs[1]) msg = '🏆 プレイヤー2の勝ち！';
  else msg = '🤝 引き分け！';
  resultElem.innerHTML = `<div style="font-size:26px;">${msg}</div><div style="font-size:18px;margin-top:12px;color:#555;">P1: ${shinkeisuijakuState.pairs[0]} ペア　P2: ${shinkeisuijakuState.pairs[1]} ペア</div>`;
  resultElem.style.display = 'block';
}
function hideShinkeisuijakuResult() {
  const resultElem = document.getElementById('shinkeisuijaku-result');
  if (resultElem) resultElem.style.display = 'none';
}

// ===== ネクスト用スコア・状態管理 =====
let nextState = null;
function resetNextState() {
  nextState = {
    flipped: [], // めくったカード
    lock: false, // 判定中ロック
    score: [0, 0], // [プレイヤー1, プレイヤー2]
    totalPairs: 27, // 54枚(ジョーカー含む)/2
  };
}
function updateNextScore() {
  let scoreElem = document.getElementById('next-score');
  if (!scoreElem) {
    scoreElem = document.createElement('div');
    scoreElem.id = 'next-score';
    scoreElem.style.position = 'fixed';
    scoreElem.style.top = '56px';
    scoreElem.style.left = '50%';
    scoreElem.style.transform = 'translateX(-50%)';
    scoreElem.style.zIndex = '4201';
    scoreElem.style.background = 'rgba(255,255,255,0.92)';
    scoreElem.style.borderRadius = '10px';
    scoreElem.style.padding = '6px 32px';
    scoreElem.style.fontSize = '18px';
    scoreElem.style.fontWeight = 'bold';
    scoreElem.style.boxShadow = '0 2px 12px rgba(0,0,0,0.10)';
    document.body.appendChild(scoreElem);
  }
  scoreElem.innerHTML = `<span style='color:#e53935;'>P1: ${nextState.score[0]}</span> - <span style='color:#1565c0;'>P2: ${nextState.score[1]}</span>`;
  scoreElem.style.display = 'block';
}
function hideNextScore() {
  const scoreElem = document.getElementById('next-score');
  if (scoreElem) scoreElem.style.display = 'none';
}
function showNextResult() {
  let resultElem = document.getElementById('next-result');
  if (!resultElem) {
    resultElem = document.createElement('div');
    resultElem.id = 'next-result';
    resultElem.style.position = 'fixed';
    resultElem.style.top = '120px';
    resultElem.style.left = '50%';
    resultElem.style.transform = 'translateX(-50%)';
    resultElem.style.zIndex = '4300';
    resultElem.style.background = 'rgba(255,255,255,0.98)';
    resultElem.style.borderRadius = '16px';
    resultElem.style.padding = '24px 48px';
    resultElem.style.fontSize = '28px';
    resultElem.style.fontWeight = 'bold';
    resultElem.style.boxShadow = '0 2px 24px rgba(0,0,0,0.18)';
    document.body.appendChild(resultElem);
  }
  // hakusyu.mp3のSEを流す
  window.playSE('SE/hakusyu.mp3');
  let msg = '';
  if (nextState.score[0] > nextState.score[1]) msg = 'プレイヤー1の勝ち！';
  else if (nextState.score[0] < nextState.score[1]) msg = 'プレイヤー2の勝ち！';
  else msg = '引き分け！';
  resultElem.innerHTML = `<div>${msg}</div><div style='font-size:20px;margin-top:12px;'>P1: ${nextState.score[0]} pt　P2: ${nextState.score[1]} pt</div>`;
  resultElem.style.display = 'block';
}
function hideNextResult() {
  const resultElem = document.getElementById('next-result');
  if (resultElem) resultElem.style.display = 'none';
}

// ===== BGM・SEトグルボタン制御 =====
const bgmBtn = document.getElementById('bgm-toggle-btn');
const seBtn = document.getElementById('se-toggle-btn');
if (bgmBtn) bgmBtn.classList.add('bgmse-toggle-btn');
if (seBtn) seBtn.classList.add('bgmse-toggle-btn');

// BGM用audio要素
let bgmAudio = null;
function createBgmAudio() {
  if (!bgmAudio) {
    bgmAudio = document.createElement('audio');
    bgmAudio.src = 'BGM/tranp.mp3';
    bgmAudio.loop = true;
    bgmAudio.volume = 0.05;
    document.body.appendChild(bgmAudio);
  }
}

// 状態管理
let isBgmOn = false; // デフォルトOFF
let isSeOn = true;   // デフォルトON

function updateBgmBtn() {
  if (isBgmOn) {
    bgmBtn.classList.add('active');
    bgmBtn.style.background = '#1565c0';
    bgmBtn.style.color = '#fff';
    bgmBtn.title = 'BGMオン';
  } else {
    bgmBtn.classList.remove('active');
    bgmBtn.style.background = '#fff';
    bgmBtn.style.color = '#1565c0';
    bgmBtn.title = 'BGMオフ';
  }
}
function updateSeBtn() {
  if (isSeOn) {
    seBtn.classList.add('active');
    seBtn.style.background = '#e53935';
    seBtn.style.color = '#fff';
    seBtn.title = 'SEオン';
  } else {
    seBtn.classList.remove('active');
    seBtn.style.background = '#fff';
    seBtn.style.color = '#e53935';
    seBtn.title = 'SEオフ';
  }
}

// BGMボタン挙動
if (bgmBtn) {
  updateBgmBtn();
  bgmBtn.addEventListener('click', () => {
    window.playSE('SE/click.mp3');
    isBgmOn = !isBgmOn;
    updateBgmBtn();
    createBgmAudio();
    if (isBgmOn) {
      bgmAudio.src = 'BGM/tranp.mp3';
      bgmAudio.currentTime = 0;
      bgmAudio.play();
    } else {
      bgmAudio.pause();
    }
  });
}
// SEボタン挙動
if (seBtn) {
  updateSeBtn();
  seBtn.addEventListener('click', () => {
    window.playSE('SE/click.mp3');
    isSeOn = !isSeOn;
    updateSeBtn();
  });
}

// SE再生用関数（window.playSEでどこからでも呼べる）
window.playSE = function(src, volume = 0.3) {
  if (!isSeOn) return;
  const audio = document.createElement('audio');
  audio.src = src;
  audio.volume = volume;
  audio.play();
  // 再生後に自動削除
  audio.addEventListener('ended', () => audio.remove());
};

// ===== キーボードショートカット =====
document.addEventListener('keydown', (e) => {
  // ゲームモード中はショートカット無効
  if (document.body.classList.contains('shinkeisuijaku-mode') || document.body.classList.contains('next-mode')) return;
  // 入力フォーカスがテキストエリアならスキップ
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  switch(e.key) {
    case 'Escape':
      // 範囲選拤解除
      document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'));
      window.playSE('SE/click.mp3');
      break;
    case 'a':
    case 'A':
      // 全ウラ
      document.getElementById('all-back-btn').click();
      break;
    case 'f':
    case 'F':
      // 全オモテ
      document.getElementById('all-front-btn').click();
      break;
    case 's':
    case 'S':
      // シャッフル
      document.getElementById('shuffle-btn').click();
      break;
  }
});

// ===== キーボードショートカットヒント表示 =====
(function() {
  const hint = document.createElement('div');
  hint.id = 'keyboard-hint';
  hint.innerHTML = [
    '<kbd>A</kbd> 全ウラ',
    '<kbd>F</kbd> 全オモテ',
    '<kbd>S</kbd> シャッフル',
    '<kbd>Esc</kbd> 選拤解除',
  ].join(' 　 ');
  document.body.appendChild(hint);
})();
