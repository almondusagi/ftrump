"""
実際のファイル内容を確認してから正確な置換を行う。
"""
with open('script.js', 'rb') as f:
    raw = f.read()

# flipCard内のwasFlippedブロックを探す
idx = raw.find(b'if (wasFlipped)')
chunk = raw[idx:idx+600]
print("=== wasFlipped block ===")
# 表示しやすくするため改行を変換
text = chunk.decode('utf-8', errors='replace')
lines = text.replace('\r\n', '\n').split('\n')
for i, line in enumerate(lines):
    print(f"{i:3}: {repr(line)}")

print()
# スコアのコードを探す
idx2 = raw.find(b'rankValue\xe5\x88\x86\xe5\x8a\xa0\xe7\xae\x97')  # rankValue分加算
if idx2 < 0:
    idx2 = raw.find(b'score[currentPlayer-1] +=')
    if idx2 < 0:
        idx2 = raw.find(b'score[currentPlayer')
print(f"\n=== score area (idx={idx2}) ===")
if idx2 >= 0:
    chunk2 = raw[idx2:idx2+300]
    text2 = chunk2.decode('utf-8', errors='replace').replace('\r\n', '\n')
    lines2 = text2.split('\n')
    for i, line in enumerate(lines2):
        print(f"{i:3}: {repr(line)}")

# alignモードのreturn近辺
idx3 = raw.find(b'dragSelectedCardsZIndex = null;\r\n    document.removeEventListener')
print(f"\n=== align return area (idx={idx3}) ===")
if idx3 >= 0:
    chunk3 = raw[idx3:idx3+200]
    text3 = chunk3.decode('utf-8', errors='replace').replace('\r\n', '\n')
    for i, line in enumerate(text3.split('\n')):
        print(f"{i:3}: {repr(line)}")
