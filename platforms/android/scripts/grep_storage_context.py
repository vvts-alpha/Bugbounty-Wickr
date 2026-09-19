import re, glob, os

pats = [r'localStorage', r'window\.name', r'document\.cookie', r'sessionStorage']

for f in sorted(glob.glob('webassets/*.js')):
    src = open(f, encoding='utf-8', errors='replace').read()
    for p in pats:
        for m in re.finditer(p, src):
            s = max(0, m.start() - 200)
            e = min(len(src), m.end() + 220)
            print('=' * 16, os.path.basename(f), '@', m.start(), p)
            print(src[s:e].replace('\n', ' '))
            print()
