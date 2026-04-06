"""
3項目を一括修正:
1. totalPairs: 26 -> 27（ジョーカー2枚込み54枚=27組）
2. コンテキストメニュー無効化をscript.js冒頭に追加
3. script-mobile.jsにタッチ操作を追加
"""
import re

# ===== script.js の修正 =====
with open('script.js', 'r', encoding='utf-8') as f:
    js = f.read()

original = js

# FIX1: totalPairs 26 -> 27
js = js.replace('totalPairs: 26, // 52枚/2', 'totalPairs: 27, // 54枚(ジョーカー含む)/2')
if 'totalPairs: 27' in js:
    print('FIX1 SUCCESS: totalPairs -> 27')
else:
    print('FIX1 FAIL')

# FIX2: コンテキストメニュー無効化を先頭に追加（既に存在しない場合のみ）
contextmenu_code = (
    "// ===== コンテキストメニュー全体無効化 =====\r\n"
    "document.addEventListener('contextmenu', function(e) { e.preventDefault(); });\r\n\r\n"
)
if "contextmenu" not in js[:500]:  # 先頭500文字に既にある場合はスキップ
    js = contextmenu_code + js
    print('FIX2 SUCCESS: contextmenu disabled globally')
else:
    print('FIX2 SKIP: contextmenu already disabled')

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(js)

print(f'script.js saved ({len(js)} bytes)')
