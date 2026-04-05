"""3つのバグを正規表現で一括修正"""
import re

with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# ========== 修正1: flipCard - 神経衰弱モードで画像を表示 ==========
# 現在の状態: frontHtmlを直接表示
# 修正後: shinkeisuijaku-modeのとき画像を優先表示
pattern1 = re.compile(
    r"(    if \(wasFlipped\) \{)\s*\n"
    r"(\s+card\.classList\.remove\('flipped'\);)\s*\n"
    r"(\s+card\.style\.padding = '';)\s*\n"
    r"(\s+if \(card\.dataset\.frontHtml\) card\.innerHTML = card\.dataset\.frontHtml;)\s*\n"
    r"(\s+\} else \{)",
    re.MULTILINE
)

replacement1 = (
    r"\1\n"
    r"\2\n"
    r"\3\n"
    r"      // 神経衰弱モードでは画像を表示\n"
    r"      if (document.body.classList.contains('shinkeisuijaku-mode') && card.dataset.cardImage) {\n"
    r"        card.innerHTML = `<img src='${card.dataset.cardImage}' alt='card' draggable=\"false\" style='position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;border-radius:6px;display:block;'>`;\n"
    r"      } else {\n"
    r"\4\n"
    r"      }\n"
    r"\5"
)

m1 = pattern1.search(content)
if m1:
    content = pattern1.sub(replacement1, content, count=1)
    print("FIX1 SUCCESS: flipCard image branch restored")
else:
    print("FIX1 FAIL: pattern not matched")
    # Show what's there
    idx = content.find('if (wasFlipped)')
    if idx >= 0:
        print("Found wasFlipped at:", idx)
        snippet = content[idx:idx+400].replace('\r\n', '\n')
        for i,l in enumerate(snippet.split('\n')[:15]):
            print(f"  {i}: {repr(l)}")

# ========== 修正2a: alignモード前のmulti-dragのreturnの前にdragging除去 ==========
pattern2a = re.compile(
    r"(    dragSelectedCardsZIndex = null;\s*\n"
    r"    document\.removeEventListener\('mousemove', onDragMove\);\s*\n"
    r"    document\.removeEventListener\('mouseup', onDragEnd\);\s*\n"
    r"    return;\s*\n"
    r"  \}\s*\n"
    r"  if \(!isFreeMode)",
    re.MULTILINE
)
repl2a = (
    "    dragSelectedCardsZIndex = null;\n"
    "    document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));\n"
    "    document.removeEventListener('mousemove', onDragMove);\n"
    "    document.removeEventListener('mouseup', onDragEnd);\n"
    "    return;\n"
    "  }\n"
    "  if (!isFreeMode)"
)
m2a = pattern2a.search(content)
if m2a:
    content = pattern2a.sub(repl2a, content, count=1)
    print("FIX2a SUCCESS: multi-drag early return patched")
else:
    print("FIX2a FAIL")

# ========== 修正2b: alignグリッドモードのreturnの前にdragging除去 ==========
pattern2b = re.compile(
    r"(    dragTarget = null;\s*\n"
    r"    dragSelectedCards = null;\s*\n"
    r"    dragSelectedCardsStart = null;\s*\n"
    r"    dragSelectedCardsZIndex = null;\s*\n"
    r"    document\.removeEventListener\('mousemove', onDragMove\);\s*\n"
    r"    document\.removeEventListener\('mouseup', onDragEnd\);\s*\n"
    r"    return;\s*\n"
    r"  \}\s*\n"
    r"  // 単一カードドラッグ時)",
    re.MULTILINE
)
repl2b = (
    "    dragTarget = null;\n"
    "    dragSelectedCards = null;\n"
    "    dragSelectedCardsStart = null;\n"
    "    dragSelectedCardsZIndex = null;\n"
    "    document.querySelectorAll('.card.dragging').forEach(c => c.classList.remove('dragging'));\n"
    "    document.removeEventListener('mousemove', onDragMove);\n"
    "    document.removeEventListener('mouseup', onDragEnd);\n"
    "    return;\n"
    "  }\n"
    "  // 単一カードドラッグ時"
)
m2b = pattern2b.search(content)
if m2b:
    content = pattern2b.sub(repl2b, content, count=1)
    print("FIX2b SUCCESS: align-mode early return patched")
else:
    print("FIX2b FAIL")
    # debug
    idx = content.find('dragSelectedCardsZIndex = null')
    while idx >= 0:
        print(f"  Found at {idx}: {repr(content[idx:idx+200].replace(chr(13),''))}")
        idx = content.find('dragSelectedCardsZIndex = null', idx+1)

# ========== 修正3: スコア - pairsをインクリメント ==========
pattern3 = re.compile(
    r"shinkeisuijakuState\.score\[currentPlayer-1\] \+= parseInt\(v1, 10\);[^\n]*\n",
    re.MULTILINE
)
repl3 = (
    "shinkeisuijakuState.pairs[currentPlayer-1]++;  // ペアカウント\n"
    "                shinkeisuijakuState.score[currentPlayer-1]++;  // スコア\n"
)
m3 = pattern3.search(content)
if m3:
    content = pattern3.sub(repl3, content, count=1)
    print("FIX3 SUCCESS: score changed to pairs count")
else:
    print("FIX3 FAIL")
    idx = content.find('score[currentPlayer')
    if idx >= 0:
        print(f"  Found score at {idx}: {repr(content[idx:idx+100])}")

# 保存
if content != original:
    with open('script.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"\nAll changes saved. File: {len(content)} bytes")
else:
    print("\nNo changes made!")
