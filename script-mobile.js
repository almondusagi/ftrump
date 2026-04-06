/**
 * script-mobile.js — iOS / Android タッチ操作サポート
 *
 * - タップ    → click（カードめくり・ボタン操作）
 * - ドラッグ  → マウスドラッグと同等の動作
 * - 長押し    → 裏返し（右クリック相当）500ms
 * - iOS長押し → テキスト選択モードを抑制
 */
(function () {
  'use strict';

  // ---- 定数 ----
  const LONG_PRESS_MS  = 500;
  const MOVE_THRESHOLD = 10;

  // ---- 状態 ----
  let touching        = false;
  let touchMoved      = false;
  let touchStartX     = 0;
  let touchStartY     = 0;
  let touchStartTime  = 0;
  let longPressTimer  = null;
  let activeTouchId   = null;
  let lastCardTarget  = null;

  // ---- iOS 全体テキスト選択防止 ----
  document.body.style.webkitUserSelect      = 'none';
  document.body.style.webkitTouchCallout    = 'none';
  document.body.style.userSelect            = 'none';

  // selectstart を常にキャンセル（iOS Safari 対策）
  document.addEventListener('selectstart', function (e) {
    e.preventDefault();
  });

  // ---- MouseEvent 生成ヘルパー ----
  function fireMouseEvent(target, type, touch, button) {
    if (!target) return;
    try {
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
    } catch (err) {
      // 古いブラウザ向けフォールバック
      console.warn('[mobile] fireMouseEvent error:', err);
    }
  }

  /** 座標からカード要素を取得 */
  function cardAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.card') : null;
  }

  /** 選択状態をすべてクリア（iOS長押し対策） */
  function clearSelection() {
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
  }

  // ==================================================
  // touchstart
  // ==================================================
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return; // マルチタッチ無視

    const touch        = e.touches[0];
    activeTouchId      = touch.identifier;
    touching           = true;
    touchMoved         = false;
    touchStartX        = touch.clientX;
    touchStartY        = touch.clientY;
    touchStartTime     = Date.now();
    lastCardTarget     = cardAt(touch.clientX, touch.clientY);

    // カード上のタッチ：スクロール防止 & mousedown 発火
    if (lastCardTarget) {
      e.preventDefault();
      clearSelection();
      fireMouseEvent(lastCardTarget, 'mousedown', touch, 0);

      // 長押しタイマー
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(function () {
        if (!touchMoved && lastCardTarget && lastCardTarget.isConnected) {
          clearSelection();
          // ドラッグをキャンセルしてからカードを裏返す
          fireMouseEvent(document.body, 'mouseup', touch, 0);
          if (typeof flipCard === 'function') {
            flipCard(lastCardTarget);
          }
          lastCardTarget = null; // touchend での click を抑制
        }
        longPressTimer = null;
      }, LONG_PRESS_MS);
    }
  }, { passive: false });

  // ==================================================
  // touchmove
  // ==================================================
  document.addEventListener('touchmove', function (e) {
    if (!touching) return;

    // 対応するタッチを取得
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
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // カードドラッグ中はページスクロールをブロック
    if (lastCardTarget) {
      e.preventDefault();
    }

    // mousemove を document に発行 → script.js の onDragMove が処理する
    fireMouseEvent(document.body, 'mousemove', touch, 0);
  }, { passive: false });

  // ==================================================
  // touchend
  // ==================================================
  document.addEventListener('touchend', function (e) {
    if (!touching) return;
    touching = false;

    clearTimeout(longPressTimer);
    longPressTimer = null;

    // 対応する changedTouch を取得
    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    activeTouchId = null;
    if (!touch) return;

    // mouseup 発行（ドラッグ終了）
    fireMouseEvent(document.body, 'mouseup', touch, 0);

    // 短いタップ → click 発行（神経衰弱めくり・ボタン押下など）
    const dt = Date.now() - touchStartTime;
    if (!touchMoved && dt < 400 && lastCardTarget && lastCardTarget.isConnected) {
      fireMouseEvent(lastCardTarget, 'click', touch, 0);
    }

    // ゴーストクリック防止
    if (lastCardTarget) {
      e.preventDefault();
    }

    lastCardTarget = null;
  }, { passive: false });

  // ==================================================
  // touchcancel
  // ==================================================
  document.addEventListener('touchcancel', function () {
    touching       = false;
    lastCardTarget = null;
    activeTouchId  = null;
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }, { passive: true });

  // ==================================================
  // DOMContentLoaded: レイアウト調整（JS側）
  // ==================================================
  document.addEventListener('DOMContentLoaded', function () {
    const isMobileWidth = window.innerWidth <= 600;
    if (!isMobileWidth) return;

    // BGM/SE ボタンのインライン margin-right をリセット
    const bgmBtn = document.getElementById('bgm-toggle-btn');
    const seBtn  = document.getElementById('se-toggle-btn');
    if (bgmBtn) bgmBtn.style.marginRight = '0';
    if (seBtn)  seBtn.style.marginRight  = '0';

    // #mode-toggle をページ左寄せに変更（重なり対策）
    const modeToggle = document.getElementById('mode-toggle');
    if (modeToggle) {
      modeToggle.style.left      = '12px';
      modeToggle.style.right     = 'auto';
      modeToggle.style.transform = 'none';
    }

    // リサイズ時に再調整
    window.addEventListener('resize', function () {
      if (window.innerWidth > 600) return;
      if (bgmBtn) bgmBtn.style.marginRight = '0';
      if (seBtn)  seBtn.style.marginRight  = '0';
    });
  });

})();
