"""
script.js から画像表示時の padding='0' 設定を除去する。
box-sizing: border-box を追加したので不要になった。
"""
with open('script.js', 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# flipCard内: wasFlipped=trueの分岐で画像表示する箇所
content = content.replace(
    "        card.style.padding = '0';\r\n        card.innerHTML = `<img src='${card.dataset.cardImage}'",
    "        card.innerHTML = `<img src='${card.dataset.cardImage}'"
)
content = content.replace(
    "        card.style.padding = '0';\n        card.innerHTML = `<img src='${card.dataset.cardImage}'",
    "        card.innerHTML = `<img src='${card.dataset.cardImage}'"
)

# allFrontBtn内やshinkeisuijaku内で padding='0' してから画像を設定している箇所
import re

# パターン1: card.style.padding = '0'; の次の行が imageHtml または card.innerHTML
# まとめて全ての `      card.style.padding = '0';` を削除(画像表示前の空行として残す)
# より厳密に: padding='0'の後にimgが来るパターンのみ削除

def remove_padding_zero_before_img(text):
    # 「card.style.padding = '0';」の直後（改行を挟んで）imageHtmlかcard.innerHTMLがある箇所を削除
    pattern = r"( +)card\.style\.padding = '0';\r?\n(\s+(?:const imageHtml|card\.innerHTML = `<img))"
    result = re.sub(pattern, r'\2', text)
    return result

content = remove_padding_zero_before_img(content)

# 残った `card.style.padding = '0'` を確認
remaining = [i for i, line in enumerate(content.split('\n'), 1) if "padding = '0'" in line]
print(f"Original size: {original_len}, New size: {len(content)}")
print(f"Remaining padding='0' lines: {remaining}")

with open('script.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done.")
