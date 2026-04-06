/**
 * script-mobile.js — iOS/Android タッチ操作
 *
 * 操作コマンド:
 * - カード上ダブルタップ     → カードを裏返す
 * - カード上長押し(500ms)    → カードを裏返す
 * - カード上タッチ+ドラッグ  → カードを移動
 * - 背景長押し(500ms)+ドラッグなし → 範囲選択モード起動
 * - 範囲選択モード中にドラッグ → 範囲選択（赤点線）
 * - 背景タッチ+すぐドラッグ  → 画面パン（スクロール）
 * - 2本指ピンチ             → 拡大/縮小
 */
(function () {
  'use strict';

  // ======================================================
  // 定数
  // ======================================================
  const LONG_PRESS_MS     = 500;
  const DOUBLE_TAP_MS     = 350;
  const MOVE_THRESHOLD    = 8;

  // ======================================================
  // 状態変数
  // ======================================================
  let state = 'IDLE'; // IDLE / CARD_TOUCH / CARD_DRAG / BG_TOUCH / BG_PAN / BG_RANGESELECT / PINCH

  let activeTouchId       = null;
  let touchStartX         = 0;
  let touchStartY         = 0;
  let touchStartTime      = 0;
  let longPressTimer      = null;
  let cardTarget          = null;        // カード上タッチ時の対象

  // ダブルタップ用
  let lastTapCard         = null;
  let lastTapTime         = 0;

  // パン用
  let panStartX           = 0;
  let panStartY           = 0;
  let panOffsetX          = 0;
  let panOffsetY          = 0;

  // ピンチ用
  let pinchStartDist      = 0;
  let pinchCurrentScale   = 1;
  let pinchBaseScale      = 1;
  let touch2StartX        = 0;   // ピンチ中心 X
  let touch2StartY        = 0;

  const container         = document.getElementById('card-container');

  // ======================================================
  // CSS / JS 初期化
  // ======================================================
  // iOSテキスト選択・コールアウント禁止
  document.body.style.webkitUserSelect   = 'none';
  document.body.style.webkitTouchCallout = 'none';
  document.body.style.userSelect         = 'none';

  // selectstart をキャンセル（iOS Safari 長押し対策）
  document.addEventListener('selectstart', function (e) { e.preventDefault(); });

  // ピンチズーム用にcontainerにtransformOrigin設定
  if (container) {
    container.style.transformOrigin = 'top left';
    container.style.willChange = 'transform';
  }

  // DOMContentLoaded: インラインstyle上書き
  document.addEventListener('DOMContentLoaded', function () {
    if (window.innerWidth > 900 && window.innerHeight > 600) return; // デスクトップは無視

    const bgmBtn = document.getElementById('bgm-toggle-btn');
    const seBtn  = document.getElementById('se-toggle-btn');
    if (bgmBtn) bgmBtn.style.marginRight = '0';
    if (seBtn)  seBtn.style.marginRight  = '0';

    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) {
      modeToggle.style.left      = '12px';
      modeToggle.style.right     = 'auto';
      modeToggle.style.transform = 'none';
    }

    // 縦画面警告要素を作成（神経衰弱時に使用）
    const warn = document.createElement('div');
    warn.className = 'portrait-warning';
    warn.id = 'portrait-warning';
    warn.innerHTML = `
      <div class="rotate-icon">📱</div>
      <div>横画面でプレイしてください</div>
      <div style="font-size:14px;opacity:0.7;margin-top:8px;">デバイスを回転させてください</div>
    `;
    document.body.appendChild(warn);

    // 神経衰弱モード中は縦画面警告を表示
    function checkOrientation() {
      const isGame = document.body.classList.contains('shinkeisuijaku-mode') ||
                     document.body.classList.contains('next-mode');
      warn.classList.toggle('active', isGame);
    }
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
  });

  // ======================================================
  // ユーティリティ
  // ======================================================

  /** MouseEvent を生成してターゲットにディスパッチ */
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
      buttons:    (type === 'mousedown') ? 1 : ((type === 'mouseup') ? 0 : 1),
    });
    target.dispatchEvent(evt);
  }

  /** 選択範囲をクリア */
  function clearSelection() {
    try { window.getSelection().removeAllRanges(); } catch(e) {}
  }

  /** 距離計算 */
  function dist(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  /** 座標からカード要素を取得 */
  function getCardAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.card') : null;
  }

  /** ピンチ距離 */
  function getPinchDist(e) {
    if (e.touches.length < 2) return 0;
    return dist(e.touches[0].clientX, e.touches[0].clientY,
                e.touches[1].clientX, e.touches[1].clientY);
  }

  /** パン変換をコンテナに適用 */
  function applyTransform() {
    if (!container) return;
    container.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${pinchCurrentScale})`;
  }

  /** ピンチ中心座標 */
  function getPinchCenter(e) {
    return {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
    };
  }

  // ======================================================
  // touchstart
  // ======================================================
  document.addEventListener('touchstart', function (e) {
    clearSelection();

    // ---- 2本指タッチ → ピンチモード ----
    if (e.touches.length === 2) {
      state = 'PINCH';
      activeTouchId = null;
      clearTimeout(longPressTimer);
      longPressTimer = null;
      pinchStartDist  = getPinchDist(e);
      pinchBaseScale  = pinchCurrentScale;
      const center    = getPinchCenter(e);
      touch2StartX    = center.x;
      touch2StartY    = center.y;
      // ドラッグ中のカードをmouseupで解放
      fireMouseEvent(document.body, 'mouseup', e.touches[0], 0);
      e.preventDefault();
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    activeTouchId  = touch.identifier;
    touchStartX    = touch.clientX;
    touchStartY    = touch.clientY;
    touchStartTime = Date.now();

    const card = getCardAt(touch.clientX, touch.clientY);

    if (card) {
      // ---- カード上タッチ ----
      state       = 'CARD_TOUCH';
      cardTarget  = card;

      e.preventDefault(); // スクロール禁止

      // mousedown 発行（ドラッグ開始準備）
      fireMouseEvent(card, 'mousedown', touch, 0);

      // 長押しタイマー → 裏返し
      longPressTimer = setTimeout(function () {
        if (state !== 'CARD_TOUCH') return; // ドラッグ開始済みなら無視
        clearSelection();
        // ドラッグをキャンセル
        fireMouseEvent(document.body, 'mouseup', touch, 0);
        if (typeof flipCard === 'function' && cardTarget && cardTarget.isConnected) {
          flipCard(cardTarget);
        }
        state      = 'IDLE';
        cardTarget = null;
        longPressTimer = null;
      }, LONG_PRESS_MS);

    } else {
      // ---- 背景タッチ ----
      state       = 'BG_TOUCH';
      cardTarget  = null;
      panStartX   = touch.clientX - panOffsetX;
      panStartY   = touch.clientY - panOffsetY;

      // 長押しタイマー → 範囲選択モード起動
      longPressTimer = setTimeout(function () {
        if (state !== 'BG_TOUCH') return;
        state = 'BG_RANGESELECT';
        // container の mousedown を発火 → 既存の範囲選択コードを起動
        if (container) {
          fireMouseEvent(container, 'mousedown', touch, 0);
        }
        if (window.playSE) window.playSE('SE/sentaku.mp3');
        longPressTimer = null;
      }, LONG_PRESS_MS);
    }
  }, { passive: false });

  // ======================================================
  // touchmove
  // ======================================================
  document.addEventListener('touchmove', function (e) {
    // ---- ピンチ処理 ----
    if (state === 'PINCH') {
      if (e.touches.length >= 2) {
        e.preventDefault();
        const newDist   = getPinchDist(e);
        if (pinchStartDist > 0) {
          pinchCurrentScale = Math.max(0.3, Math.min(3.0, pinchBaseScale * newDist / pinchStartDist));
          applyTransform();
        }
      }
      return;
    }

    // 対応するタッチを取得
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId) {
        touch = e.touches[i];
        break;
      }
    }
    if (!touch) return;

    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const moved = dist(touchStartX, touchStartY, touch.clientX, touch.clientY) > MOVE_THRESHOLD;

    if (state === 'CARD_TOUCH') {
      if (moved) {
        // カードドラッグ開始
        state = 'CARD_DRAG';
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    if (state === 'CARD_DRAG') {
      e.preventDefault();
      fireMouseEvent(document.body, 'mousemove', touch, 0);
    }

    if (state === 'BG_TOUCH') {
      if (moved) {
        // すぐに動いた → パン
        state = 'BG_PAN';
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    if (state === 'BG_PAN') {
      panOffsetX = touch.clientX - panStartX;
      panOffsetY = touch.clientY - panStartY;
      applyTransform();
    }

    if (state === 'BG_RANGESELECT') {
      e.preventDefault();
      // 既存の onSelectionMove に渡す（document 上の mousemove 経由）
      fireMouseEvent(document.body, 'mousemove', touch, 0);
    }
  }, { passive: false });

  // ======================================================
  // touchend
  // ======================================================
  document.addEventListener('touchend', function (e) {
    if (state === 'PINCH') {
      if (e.touches.length < 2) {
        state = 'IDLE';
      }
      return;
    }

    clearTimeout(longPressTimer);
    longPressTimer = null;

    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    activeTouchId = null;

    if (!touch) { state = 'IDLE'; return; }

    if (state === 'CARD_TOUCH') {
      // タッチ+すぐ離した → タップ
      const dt  = Date.now() - touchStartTime;
      const now = Date.now();

      // ダブルタップ判定
      const isDoubleTap = (cardTarget === lastTapCard) && (now - lastTapTime < DOUBLE_TAP_MS);

      // mouseup 発行
      fireMouseEvent(document.body, 'mouseup', touch, 0);
      // click 発行（神経衰弱めくりなど）
      if (cardTarget && cardTarget.isConnected) {
        fireMouseEvent(cardTarget, 'click', touch, 0);
      }

      if (isDoubleTap) {
        // ダブルタップ → flip
        if (typeof flipCard === 'function' && cardTarget && cardTarget.isConnected) {
          flipCard(cardTarget);
        }
        lastTapCard = null;
        lastTapTime = 0;
      } else {
        lastTapCard = cardTarget;
        lastTapTime = now;
      }

      e.preventDefault();
    }

    if (state === 'CARD_DRAG') {
      fireMouseEvent(document.body, 'mouseup', touch, 0);
      e.preventDefault();
    }

    if (state === 'BG_PAN') {
      // パン終了（オフセット保持）
    }

    if (state === 'BG_RANGESELECT') {
      // 範囲選択終了 → 既存の onSelectionUp に渡す
      fireMouseEvent(document.body, 'mouseup', touch, 0);
    }

    if (state === 'BG_TOUCH') {
      // 長押しせずに離した → 何もしない（既存カード選択解除などはmousedownで処理済み）
    }

    state      = 'IDLE';
    cardTarget = null;
  }, { passive: false });

  // ======================================================
  // touchcancel
  // ======================================================
  document.addEventListener('touchcancel', function () {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    if (state === 'CARD_DRAG') {
      const dummy = { clientX: touchStartX, clientY: touchStartY, screenX: 0, screenY: 0 };
      fireMouseEvent(document.body, 'mouseup', dummy, 0);
    }
    if (state === 'BG_RANGESELECT') {
      const dummy = { clientX: touchStartX, clientY: touchStartY, screenX: 0, screenY: 0 };
      fireMouseEvent(document.body, 'mouseup', dummy, 0);
    }
    state      = 'IDLE';
    cardTarget = null;
    activeTouchId = null;
  }, { passive: true });

  // ======================================================
  // 神経衰弱グリッドのモバイル最適化（横画面）
  // ======================================================
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.matchMedia('(max-width: 900px)').matches) return;

    // setupGameShinkeisuijaku の後にグリッドを再配置
    const origSetup = window.setupGameShinkeisuijaku;
    if (typeof origSetup === 'function') {
      window.setupGameShinkeisuijaku = function() {
        origSetup.apply(this, arguments);
        // グリッド再配置（横画面向け）
        setTimeout(function() { mobileAdjustGrid(); }, 100);
      };
    }
  });

  function mobileAdjustGrid() {
    if (!container) return;
    const allCards = Array.from(container.querySelectorAll('.card'));
    if (!allCards.length) return;

    const isLandscape = window.innerWidth > window.innerHeight;
    const marginTop   = isLandscape ? 38 : 52;
    const marginBot   = isLandscape ? 66 : 78;
    const availW      = window.innerWidth - 8;
    const availH      = window.innerHeight - marginTop - marginBot - 4;

    // 54枚が収まる最適列数を計算
    const total    = allCards.length; // 54
    const gapX     = 3, gapY = 3;

    // 列数を試して最適なものを選ぶ
    let bestCols = 9, bestScale = 0;
    for (let cols = 7; cols <= 12; cols++) {
      const rows   = Math.ceil(total / cols);
      const scaleW = (availW - gapX * (cols - 1)) / (cols * 1);
      const scaleH = (availH - gapY * (rows - 1)) / (rows * 1.5);
      const scale  = Math.min(scaleW, scaleH);
      if (scale > bestScale) {
        bestScale = scale;
        bestCols  = cols;
      }
    }

    const cardW  = Math.floor(bestScale);
    const cardH  = Math.floor(bestScale * 1.5);
    const cols   = bestCols;
    const rows   = Math.ceil(total / cols);
    const totalW = cols * (cardW + gapX) - gapX;
    const totalH = rows * (cardH + gapY) - gapY;
    const startX = Math.max(4, (availW - totalW) / 2);
    const startY = Math.max(4, (availH - totalH) / 2);

    // コンテナ高さをグリッドに合わせる
    container.style.minHeight = (totalH + startY * 2) + 'px';

    allCards.forEach(function(card, i) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = startX + col * (cardW + gapX);
      const y   = startY + row * (cardH + gapY);
      card.style.width  = cardW + 'px';
      card.style.height = cardH + 'px';
      card.style.fontSize = Math.max(8, cardW * 0.18) + 'px';
      card.style.left   = x + 'px';
      card.style.top    = y + 'px';
      card.style.transition = '';
    });
  }

  // 画面回転時にグリッド再配置
  window.addEventListener('orientationchange', function() {
    setTimeout(function() {
      if (document.body.classList.contains('shinkeisuijaku-mode')) {
        mobileAdjustGrid();
      }
    }, 300);
  });
  window.addEventListener('resize', function() {
    if (document.body.classList.contains('shinkeisuijaku-mode')) {
      mobileAdjustGrid();
    }
  });

})();
