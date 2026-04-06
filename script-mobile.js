/**
 * script-mobile.js — スマートフォン向けタッチ操作
 *
 * タッチ → マウスイベント変換でドラッグ・タップを実現
 * 長押し (500ms) → 右クリック相当（カードを裏返す）
 */

(function() {
  'use strict';

  // ---- 定数 ----
  const LONG_PRESS_MS  = 500;   // ロングタップ判定時間(ms)
  const MOVE_THRESHOLD = 8;     // ドラッグ開始とみなすピクセル数

  // ---- 状態変数 ----
  let touching        = false;
  let touchMoved      = false;
  let touchStartX     = 0;
  let touchStartY     = 0;
  let touchStartTime  = 0;
  let longPressTimer  = null;
  let activeTouchId   = null;
  let lastTouchTarget = null;

  /** タッチから MouseEvent を生成して target にディスパッチ */
  function fireMouseEvent(target, type, touch, button) {
    if (!target) return;
    const evt = new MouseEvent(type, {
      bubbles:    true,
      cancelable: true,
      view:       window,
      clientX:    touch.clientX,
      clientY:    touch.clientY,
      screenX:    touch.screenX,
      screenY:    touch.screenY,
      button:     button || 0,
      buttons:    (type === 'mouseup') ? 0 : 1,
    });
    target.dispatchEvent(evt);
  }

  /** 座標からカード要素を取得（透過検索） */
  function cardAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.card') : null;
  }

  // ---- touchstart ----
  document.addEventListener('touchstart', function(e) {
    if (e.touches.length !== 1) return; // マルチタッチは無視

    const touch = e.touches[0];
    activeTouchId  = touch.identifier;
    touching       = true;
    touchMoved     = false;
    touchStartX    = touch.clientX;
    touchStartY    = touch.clientY;
    touchStartTime = Date.now();

    const card = cardAt(touch.clientX, touch.clientY);
    lastTouchTarget = card;

    if (card) {
      e.preventDefault(); // スクロール防止（カード上のみ）

      // マウスダウンを発火
      fireMouseEvent(card, 'mousedown', touch, 0);

      // ロングタップ → 裏返し
      longPressTimer = setTimeout(function() {
        if (!touchMoved) {
          // 長押しで flipCard（右クリック相当）
          if (typeof flipCard === 'function' && card.isConnected) {
            // ドラッグ用のmouseupを先に発行してドラッグをキャンセル
            fireMouseEvent(document.body, 'mouseup', touch, 0);
            flipCard(card);
          }
          lastTouchTarget = null; // タップflipを抑制
        }
        longPressTimer = null;
      }, LONG_PRESS_MS);
    }
  }, { passive: false });

  // ---- touchmove ----
  document.addEventListener('touchmove', function(e) {
    if (!touching) return;

    // 正しいタッチを取得
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      touchMoved = true;
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    if (lastTouchTarget) {
      e.preventDefault(); // カードドラッグ中はスクロール防止
    }

    // mousemove を document に発行（onDragMove が拾う）
    fireMouseEvent(document.body, 'mousemove', touch, 0);
  }, { passive: false });

  // ---- touchend ----
  document.addEventListener('touchend', function(e) {
    if (!touching) return;
    touching = false;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch) { activeTouchId = null; return; }

    // mouseup を発行（ドラッグ終了）
    fireMouseEvent(document.body, 'mouseup', touch, 0);

    // 短いタップ → click 発行（神経衰弱のカードめくり等に使用）
    const dt = Date.now() - touchStartTime;
    const dx = Math.abs(touch.clientX - touchStartX);
    const dy = Math.abs(touch.clientY - touchStartY);

    if (!touchMoved && dt < 400 && lastTouchTarget && lastTouchTarget.isConnected) {
      fireMouseEvent(lastTouchTarget, 'click', touch, 0);
    }

    e.preventDefault(); // ゴーストクリック防止
    activeTouchId   = null;
    lastTouchTarget = null;
  }, { passive: false });

  // ---- touchcancel ----
  document.addEventListener('touchcancel', function(e) {
    touching = false;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    activeTouchId   = null;
    lastTouchTarget = null;
  }, { passive: true });

  // ---- モバイル向けgrid調整 ----
  const isMobile = window.matchMedia('(max-width: 600px)').matches;

  if (isMobile) {
    // 神経衰弱のグリッドをモバイル用に調整（6列×9行 → 7列か自動）
    const origAlignAll = window.alignAllCardsGrid;

    window.alignAllCardsGridMobile = function(cardsArr) {
      const allCards = cardsArr || Array.from(document.querySelectorAll('.card'));
      if (!allCards.length) return;

      const containerEl = document.getElementById('card-container');
      if (!containerEl) return;
      const containerW = containerEl.clientWidth;

      // カードの実際のサイズを取得
      const cardW = allCards[0].offsetWidth  || Math.floor(containerW * 0.14);
      const cardH = allCards[0].offsetHeight || Math.floor(cardW * 1.5);

      // 画面幅に収まる列数を計算（左右12pxマージン）
      const availW = containerW - 24;
      const gapX   = 4;
      const cols   = Math.floor((availW + gapX) / (cardW + gapX));
      const rows   = Math.ceil(allCards.length / cols);

      const offsetX = 12;
      const offsetY = 12;

      // alignGridOrder を更新
      if (typeof alignGridOrder !== 'undefined') {
        // eslint-disable-next-line no-global-assign
        alignGridOrder = allCards.slice();
      }

      allCards.forEach(function(card, i) {
        const col  = i % cols;
        const row  = Math.floor(i / cols);
        const left = offsetX + col * (cardW + gapX);
        const top  = offsetY + row * (cardH + gapX);
        card.style.transition = 'left 0.4s cubic-bezier(.4,2,.6,1), top 0.4s cubic-bezier(.4,2,.6,1)';
        card.style.left       = left + 'px';
        card.style.top        = top  + 'px';
        card.style.zIndex     = 1000 + i;
        setTimeout(function() { card.style.transition = ''; }, 500);
      });

      // コンテナ高さを動的に調整
      const totalH = offsetY + rows * (cardH + gapX) + 12;
      containerEl.style.minHeight = totalH + 'px';
    };

    // グローバル関数を上書き（script.jsのalignAllCardsGridをオーバーライド）
    // script.js読み込み後に実行されるため、DOMContentLoadedを利用
    document.addEventListener('DOMContentLoaded', function() {
      if (typeof alignAllCardsGrid === 'function') {
        const _orig = alignAllCardsGrid;
        // グローバルスコープに上書き（letではないので直接置換できない場合は警告のみ）
        try {
          // eslint-disable-next-line no-global-assign
          alignAllCardsGrid = window.alignAllCardsGridMobile;
        } catch(err) {
          console.warn('[mobile] could not override alignAllCardsGrid:', err);
        }
      }
    });
  }

})();
