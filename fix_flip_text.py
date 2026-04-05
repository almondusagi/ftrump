"""
神経衰弱うら→おもての時に画像ではなくテキスト(frontHtml)を表示するよう修正。
デバッグで確認した実際の内容を使用。
"""
with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """if (wasFlipped) {
      card.classList.remove('flipped');
      card.style.padding = '';
      if (document.body.classList.contains('shinkeisuijaku-mode') && card.dataset.cardImage) {
        card.innerHTML = `<img src='${card.dataset.cardImage}' alt='card' draggable="false" style='position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center;border-radius:8px;display:block;user-drag:none;-webkit-user-drag:none;user-select:none;-webkit-user-select:none;z-index:1;'>`;
      } else {
        card.style.padding = '';
        if (card.dataset.frontHtml) card.innerHTML = card.dataset.frontHtml;
      }
    } else {"""

new_block = """if (wasFlipped) {
      card.classList.remove('flipped');
      card.style.padding = '';
      if (card.dataset.frontHtml) card.innerHTML = card.dataset.frontHtml;
    } else {"""

if old_block in content:
    content = content.replace(old_block, new_block, 1)
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: removed shinkeisuijaku image branch')
else:
    # Try normalized whitespace approach - find by regex
    import re
    # Find the block more flexibly
    pattern = r"if \(wasFlipped\) \{\s+card\.classList\.remove\('flipped'\);\s+card\.style\.padding = '';\s+if \(document\.body\.classList\.contains\('shinkeisuijaku-mode'\)[^\}]+\}\s+\} else \{"
    m = re.search(pattern, content, re.DOTALL)
    if m:
        found = m.group(0)
        print('Found via regex:')
        print(repr(found[:300]))
        # Replace
        replacement = """if (wasFlipped) {
      card.classList.remove('flipped');
      card.style.padding = '';
      if (card.dataset.frontHtml) card.innerHTML = card.dataset.frontHtml;
    } else {"""
        content = content[:m.start()] + replacement + content[m.end():]
        with open('script.js', 'w', encoding='utf-8') as f:
            f.write(content)
        print('SUCCESS via regex')
    else:
        print('ERROR: regex also failed')
        idx = content.find('if (wasFlipped)')
        print('Context around wasFlipped:')
        print(repr(content[idx:idx+600]))
