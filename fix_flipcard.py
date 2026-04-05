import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find flipCard using regex marker
start_marker = 'function flipCard(card) {'
end_marker = '\nwindow.playSE(\'SE/flip.mp3\');\n}'

idx_start = content.find(start_marker)
if idx_start < 0:
    print('ERROR: flipCard function not found')
    exit(1)

# Find the closing brace of the function
# Count braces from start
depth = 0
i = idx_start
found_end = -1
in_str = False
str_char = None
escape_next = False

for ci in range(i, len(content)):
    ch = content[ci]
    if escape_next:
        escape_next = False
        continue
    if ch == '\\':
        escape_next = True
        continue
    if not in_str:
        if ch in ('"', "'", '`'):
            in_str = True
            str_char = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                found_end = ci
                break
    else:
        if ch == str_char:
            in_str = False

if found_end < 0:
    print('ERROR: could not find end of flipCard')
    exit(1)

old_func = content[idx_start:found_end+1]
print(f'Found flipCard ({len(old_func)} chars, lines {content[:idx_start].count(chr(10))+1}-{content[:found_end].count(chr(10))+1})')

new_func = r"""function flipCard(card) {
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
      if (document.body.classList.contains('shinkeisuijaku-mode') && card.dataset.cardImage) {
        card.style.padding = '0';
        card.innerHTML = `<img src='${card.dataset.cardImage}' alt='card' draggable="false" style='position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:8px;display:block;user-drag:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;z-index:1;'>`;
      } else {
        card.style.padding = '';
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
}"""

content = content[:idx_start] + new_func + content[found_end+1:]

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('SUCCESS: flipCard replaced with animation version')
print(f'Final file size: {len(content)} chars')
