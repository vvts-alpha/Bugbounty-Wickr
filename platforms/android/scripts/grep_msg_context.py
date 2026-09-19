import re, glob, os

pats = [
    r'addEventListener\(\s*["\']message["\']',
    r'\.origin\s*={2,3}\s*',
    r'window\.onmessage\s*=',
    r'\.postMessage\(',
]

for f in sorted(glob.glob('webassets/*.js')):
    if 'worker' in os.path.basename(f).lower():
        continue
    src = open(f, encoding='utf-8', errors='replace').read()
    for p in pats:
        for m in re.finditer(p, src):
            s = max(0, m.start() - 260)
            e = min(len(src), m.end() + 340)
            print('=' * 20, os.path.basename(f), '@', m.start(), p)
            print(src[s:e].replace('\n', ' '))
            print()
