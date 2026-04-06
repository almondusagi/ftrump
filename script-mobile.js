/**
 * script-mobile.js — iOS/Android タッチ操作
 *
 * ▸ ズーム/パンは #card-canvas（内部ラッパー）のみに適用
 *   外側のUIボタンは固定
 * ▸ 操作コマンド:
 *   カードダブルタップ      → 裏返し
 *   カード長押し 500ms      → 裏返し
 *   カードドラッグ          → 移動
 *   背景長押し 500ms+ドラッグ→ 範囲選択（赤点線）
 *   背景すぐドラッグ        → パン
 *   2本指ピンチ             → 拡大/縮小
 */
(function () {
  'use strict';

  /* ======================================================
     定数
  ====================================================== */
  const LONG_PRESS_MS  = 500;
  const DOUBLE_TAP_MS  = 350;
  const MOVE_THRESHOLD = 8;

  /* ======================================================
     状態
  ====================================================== */
  let appState    = 'IDLE';
  let activeTouchId  = null;
  let touchStartX    = 0, touchStartY    = 0;
  let touchStartTime = 0;
  let longPressTimer = null;
  let cardTarget     = null;

  // ダブルタップ
  let lastTapCard    = null;
  let lastTapTime    = 0;

  // パン
  let panOffsetX     = 0, panOffsetY     = 0;
  let panStartX      = 0, panStartY      = 0;

  // ピンチ
  let pinchBaseDist  = 0;
  let pinchBaseScale = 1;
  let canvasScale    = 1;           // 現在の拡大率

  // DOM
  const container    = document.getElementById('card-container');
  let   canvas       = null;        // #card-canvas（内部ラッパー）

  /* ======================================================
     #card-canvas 初期化
     container の直接の子（card / selectionBox 以外）を除き
     .card を canvas に格納。新規 card は MutationObserver で移動。
  ====================================================== */
  function initCanvas() {
    if (!container || document.getElementById('card-canvas')) return;

    canvas = document.createElement('div');
    canvas.id = 'card-canvas';
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;' +
      'transform-origin:0 0;will-change:transform;';
    container.appendChild(canvas);

    // 既存の .card を canvas へ移動
    Array.from(container.querySelectorAll('.card'))
      .forEach(c => canvas.appendChild(c));

    // 後から追加される .card も canvas へ
    const obs = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1 && node.classList &&
              node.classList.contains('card') &&
              node.parentNode === container) {
            canvas.appendChild(node);
          }
        });
      });
    });
    obs.observe(container, { childList: true });

    // container は overflow:hidden でカードをクリップ
    container.style.overflow = 'hidden';

    applyTransform();
  }

  /* ======================================================
     transform 適用
  ====================================================== */
  function applyTransform() {
    if (!canvas) return;
    canvas.style.transform =
      `translate(${panOffsetX}px,${panOffsetY}px) scale(${canvasScale})`;
  }

  /** transform をリセット（範囲選択時に使用） */
  function resetTransform() {
    canvasScale  = 1;
    panOffsetX   = 0;
    panOffsetY   = 0;
    pinchBaseScale = 1;
    applyTransform();
  }

  /* ======================================================
     座標変換: viewport → canvas-local
     ドラッグコードが canvas-local 座標を期待するため変換が必要
  ====================================================== */
  function toCanvasLocal(vx, vy) {
    const r  = container.getBoundingClientRect();
    const cx = (vx - r.left - panOffsetX) / canvasScale;
    const cy = (vy - r.top  - panOffsetY) / canvasScale;
    return { x: r.left + cx, y: r.top + cy };
  }

  /* ======================================================
     MouseEvent ヘルパー
     adjust=true のとき canvas-local へ座標変換して送る
  ====================================================== */
  function fireME(target, type, touch, button, adjust) {
    if (!target) return;
    let cx = touch.clientX, cy = touch.clientY;
    if (adjust && canvasScale !== 1) {
      const p = toCanvasLocal(touch.clientX, touch.clientY);
      cx = p.x; cy = p.y;
    }
    target.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: cx, clientY: cy,
      screenX: touch.screenX || 0, screenY: touch.screenY || 0,
      button:  button || 0,
      buttons: (type === 'mouseup') ? 0 : 1,
    }));
  }

  function clearSel() {
    try { window.getSelection().removeAllRanges(); } catch(e) {}
  }

  /* ======================================================
     iOS テキスト選択防止
  ====================================================== */
  Object.assign(document.body.style, {
    webkitUserSelect:   'none',
    webkitTouchCallout: 'none',
    userSelect:         'none',
  });
  document.addEventListener('selectstart', e => e.preventDefault());

  /* ======================================================
     ピンチ補助
  ====================================================== */
  function pinchDist(e) {
    return e.touches.length < 2 ? 0
      : Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY);
  }

  /* ======================================================
     touchstart
  ====================================================== */
  document.addEventListener('touchstart', function (e) {
    clearSel();

    // ── 2本指: ピンチ開始 ───────────────────────────────
    if (e.touches.length === 2) {
      appState     = 'PINCH';
      activeTouchId = null;
      clearTimeout(longPressTimer);
      pinchBaseDist  = pinchDist(e);
      pinchBaseScale = canvasScale;
      // 進行中のドラッグをキャンセル
      fireME(document.body, 'mouseup', e.touches[0], 0, false);
      e.preventDefault();
      return;
    }

    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    activeTouchId  = touch.identifier;
    touchStartX    = touch.clientX;
    touchStartY    = touch.clientY;
    touchStartTime = Date.now();

    const card = (() => {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      return el ? el.closest('.card') : null;
    })();

    if (card) {
      // ── カード上 ────────────────────────────────────
      appState   = 'CARD_TOUCH';
      cardTarget = card;
      e.preventDefault();

      // mousedown（ドラッグ準備、canvas-local 座標へ変換）
      fireME(card, 'mousedown', touch, 0, true);

      // 長押し → 裏返し
      longPressTimer = setTimeout(() => {
        if (appState !== 'CARD_TOUCH') return;
        clearSel();
        fireME(document.body, 'mouseup', touch, 0, false);
        if (typeof flipCard === 'function' && cardTarget?.isConnected)
          flipCard(cardTarget);
        appState = 'IDLE'; cardTarget = null; longPressTimer = null;
      }, LONG_PRESS_MS);

    } else {
      // ── 背景 ────────────────────────────────────────
      appState  = 'BG_TOUCH';
      cardTarget = null;
      panStartX = touch.clientX - panOffsetX;
      panStartY = touch.clientY - panOffsetY;

      // 長押し → 範囲選択モード
      longPressTimer = setTimeout(() => {
        if (appState !== 'BG_TOUCH') return;
        // 範囲選択は zoom=1 状態で行う（座標ずれ防止）
        resetTransform();
        appState = 'BG_RANGESELECT';
        if (container) fireME(container, 'mousedown', touch, 0, false);
        longPressTimer = null;
      }, LONG_PRESS_MS);
    }
  }, { passive: false });

  /* ======================================================
     touchmove
  ====================================================== */
  document.addEventListener('touchmove', function (e) {
    // ── ピンチ ──────────────────────────────────────────
    if (appState === 'PINCH') {
      if (e.touches.length >= 2) {
        e.preventDefault();
        const d = pinchDist(e);
        if (pinchBaseDist > 0) {
          canvasScale = Math.max(0.4, Math.min(4.0,
            pinchBaseScale * d / pinchBaseDist));
          applyTransform();
        }
      }
      return;
    }

    // 対応タッチ取得
    let touch = null;
    for (let i = 0; i < e.touches.length; i++) {
      if (e.touches[i].identifier === activeTouchId) { touch = e.touches[i]; break; }
    }
    if (!touch) return;

    const moved = Math.hypot(
      touch.clientX - touchStartX, touch.clientY - touchStartY) > MOVE_THRESHOLD;

    // CARD_TOUCH → CARD_DRAG
    if (appState === 'CARD_TOUCH' && moved) {
      appState = 'CARD_DRAG';
      clearTimeout(longPressTimer); longPressTimer = null;
    }
    if (appState === 'CARD_DRAG') {
      e.preventDefault();
      fireME(document.body, 'mousemove', touch, 0, true);  // canvas-local 変換
    }

    // BG_TOUCH → BG_PAN
    if (appState === 'BG_TOUCH' && moved) {
      appState = 'BG_PAN';
      clearTimeout(longPressTimer); longPressTimer = null;
    }
    if (appState === 'BG_PAN') {
      panOffsetX = touch.clientX - panStartX;
      panOffsetY = touch.clientY - panStartY;
      applyTransform();
    }

    // 範囲選択ドラッグ
    if (appState === 'BG_RANGESELECT') {
      e.preventDefault();
      fireME(document.body, 'mousemove', touch, 0, false);
    }
  }, { passive: false });

  /* ======================================================
     touchend
  ====================================================== */
  document.addEventListener('touchend', function (e) {
    if (appState === 'PINCH') {
      if (e.touches.length < 2) appState = 'IDLE';
      return;
    }

    clearTimeout(longPressTimer); longPressTimer = null;

    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        touch = e.changedTouches[i]; break;
      }
    }
    activeTouchId = null;
    if (!touch) { appState = 'IDLE'; return; }

    if (appState === 'CARD_TOUCH') {
      fireME(document.body, 'mouseup', touch, 0, false);
      if (cardTarget?.isConnected) fireME(cardTarget, 'click', touch, 0, false);

      // ダブルタップ判定
      const now = Date.now();
      if (cardTarget === lastTapCard && now - lastTapTime < DOUBLE_TAP_MS) {
        if (typeof flipCard === 'function' && cardTarget?.isConnected)
          flipCard(cardTarget);
        lastTapCard = null; lastTapTime = 0;
      } else {
        lastTapCard = cardTarget; lastTapTime = now;
      }
      e.preventDefault();
    }

    if (appState === 'CARD_DRAG') {
      fireME(document.body, 'mouseup', touch, 0, false);
      e.preventDefault();
    }

    if (appState === 'BG_RANGESELECT') {
      fireME(document.body, 'mouseup', touch, 0, false);
    }

    appState = 'IDLE'; cardTarget = null;
  }, { passive: false });

  /* ======================================================
     touchcancel
  ====================================================== */
  document.addEventListener('touchcancel', function () {
    clearTimeout(longPressTimer); longPressTimer = null;
    const dummy = { clientX: touchStartX, clientY: touchStartY, screenX: 0, screenY: 0 };
    if (appState === 'CARD_DRAG' || appState === 'BG_RANGESELECT')
      fireME(document.body, 'mouseup', dummy, 0, false);
    appState = 'IDLE'; cardTarget = null; activeTouchId = null;
  }, { passive: true });

  /* ======================================================
     DOMContentLoaded: 初期化 & レイアウト調整
  ====================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    const isMobile = window.innerWidth <= 900 || window.innerHeight <= 600;
    if (!isMobile) return;

    // canvas ラッパー作成
    initCanvas();

    // BGM/SE インライン margin リセット
    const bgm = document.getElementById('bgm-toggle-btn');
    const se  = document.getElementById('se-toggle-btn');
    if (bgm) bgm.style.marginRight = '0';
    if (se)  se.style.marginRight  = '0';

    // mode-toggle を左寄せ
    const mt = document.getElementById('mode-toggle');
    if (mt) { mt.style.left = '12px'; mt.style.right = 'auto'; mt.style.transform = 'none'; }

    // 縦画面警告
    const warn = document.createElement('div');
    warn.className = 'portrait-warning'; warn.id = 'portrait-warning';
    warn.innerHTML = '<div class="rotate-icon">📱</div><div>横画面でプレイしてください</div>';
    document.body.appendChild(warn);

    function checkOrientation() {
      const isGame = document.body.classList.contains('shinkeisuijaku-mode') ||
                     document.body.classList.contains('next-mode');
      warn.classList.toggle('active', isGame);
      if (isGame && document.body.classList.contains('shinkeisuijaku-mode'))
        mobileAdjustGrid();
    }
    window.addEventListener('orientationchange', () => setTimeout(checkOrientation, 300));
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
  });

  /* ======================================================
     神経衰弱グリッド最適化
  ====================================================== */
  function mobileAdjustGrid() {
    const target = canvas || container;
    if (!target || !container) return;
    const allCards = Array.from(target.querySelectorAll('.card'));
    if (!allCards.length) return;

    const isLandscape = window.innerWidth > window.innerHeight;
    const hUsed = isLandscape ? 104 : 130;
    const availW = window.innerWidth  - 8;
    const availH = window.innerHeight - hUsed - 4;
    const total  = allCards.length;
    const gapX = 3, gapY = 3;

    let bestCols = 9, bestW = 0;
    for (let cols = 7; cols <= 13; cols++) {
      const rows  = Math.ceil(total / cols);
      const scaleW = (availW - gapX * (cols - 1)) / cols;
      const scaleH = (availH - gapY * (rows - 1)) / rows / 1.5;
      const w = Math.min(scaleW, scaleH);
      if (w > bestW) { bestW = w; bestCols = cols; }
    }

    const cardW = Math.floor(bestW);
    const cardH = Math.floor(bestW * 1.5);
    const cols  = bestCols;
    const rows  = Math.ceil(total / cols);
    const startX = Math.max(4, (availW - cols * (cardW + gapX) + gapX) / 2);
    const startY = Math.max(4, (availH - rows * (cardH + gapY) + gapY) / 2);

    allCards.forEach((card, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      Object.assign(card.style, {
        width:      cardW + 'px',
        height:     cardH + 'px',
        fontSize:   Math.max(7, Math.floor(cardW * 0.17)) + 'px',
        left:       (startX + col * (cardW + gapX)) + 'px',
        top:        (startY + row * (cardH + gapY)) + 'px',
        transition: 'none',
      });
    });
  }

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      if (document.body.classList.contains('shinkeisuijaku-mode')) {
        resetTransform();
        mobileAdjustGrid();
      }
    }, 300);
  });
  window.addEventListener('resize', () => {
    if (document.body.classList.contains('shinkeisuijaku-mode')) mobileAdjustGrid();
  });

})();
