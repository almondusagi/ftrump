with open('script.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

keywords = ['score', 'Score', 'pair', 'Pair', '\u30da\u30a2', '\u30b9\u30b3\u30a2']
result = []
for i, line in enumerate(lines, 1):
    if any(k in line for k in keywords):
        result.append(f'{i}: {line.rstrip()}')

with open('score_refs.txt', 'w', encoding='utf-8') as out:
    out.write('\n'.join(result))

print(f'Written {len(result)} lines')
print('\n'.join(result[:50]))
