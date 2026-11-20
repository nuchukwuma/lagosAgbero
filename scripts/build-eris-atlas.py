"""Pack Eris Esra's character template (16x32) and the expression faces into atlases.

  python3 -I scripts/build-eris-atlas.py <template-pack-dir> <expression-pack-dir> <png-out-dir> <json-out-dir>

Template: "Character Templates Pack" by Eris Esra (https://erisesra.itch.io/character-templates-pack):
32x32 frames, rows = facing (0 front, 1 front-side, 2 side, 3 back-side, 4 back).
We keep the front and side rows of idle, walk, run, jump, attack and interact.
Expressions: "Pixelart Study - Expression Sheet - Profile - 32x32": 18 heads, 3 per row:
hollow, neutral, serious / pleased, happy, elated / gloomy, sad, despair /
anxious, fear, terror / annoyed, angry, rage / confused, surprised, shocked.
"""
import json
import os
import sys

from PIL import Image

tpl, expr, out, jout = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
os.makedirs(jout, exist_ok=True)
F = 32
base = os.path.join(tpl, '16x32')
ANIMS = ['Idle', 'Walk', 'Run', 'Jump', 'Attack', 'Interact']
ROWS = {'front': 0, 'side': 2}

frames = []  # (name, facing, [images])
for a in ANIMS:
    im = Image.open(os.path.join(base, f'16x32 {a}-Sheet.png')).convert('RGBA')
    n = im.width // F
    for facing, row in ROWS.items():
        frames.append((a.lower(), facing, [im.crop((i * F, row * F, i * F + F, row * F + F)) for i in range(n)]))

aw = max(len(f[2]) for f in frames) * F
atlas = Image.new('RGBA', (aw, len(frames) * F), (0, 0, 0, 0))
meta = {'source': 'Character Templates Pack by Eris Esra (erisesra.itch.io/character-templates-pack)', 'frame': F, 'anims': {}}
for r, (name, facing, ims) in enumerate(frames):
    for i, f in enumerate(ims):
        atlas.alpha_composite(f, (i * F, r * F))
    meta['anims'][f'{name}_{facing}'] = {'y': r * F, 'frames': len(ims)}
atlas.save(os.path.join(out, 'eris.png'), optimize=True)

# expression heads: find each head's box on the sheet, keep them in reading order
sheet = Image.open(os.path.join(expr, 'Pixelart Study - Expression Sheet - Profile - 32x32.png')).convert('RGBA')
W, H = sheet.size
px = sheet.load()
seen = set()
boxes = []
for y in range(H):
    for x in range(W):
        if px[x, y][3] and (x, y) not in seen:
            stack = [(x, y)]
            seen.add((x, y))
            x0 = x1 = x
            y0 = y1 = y
            while stack:
                cx, cy = stack.pop()
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and px[nx, ny][3]:
                            seen.add((nx, ny))
                            stack.append((nx, ny))
            if (x1 - x0) > 8 and (y1 - y0) > 8:
                boxes.append((x0, y0, x1 + 1, y1 + 1))
boxes.sort(key=lambda b: (round(b[1] / 20), b[0]))
NAMES = ['hollow', 'neutral', 'serious', 'pleased', 'happy', 'elated', 'gloomy', 'sad', 'despair', 'anxious', 'fear', 'terror', 'annoyed', 'angry', 'rage', 'confused', 'surprised', 'shocked']
assert len(boxes) == len(NAMES), f'found {len(boxes)} faces'
cw = max(b[2] - b[0] for b in boxes)
ch = max(b[3] - b[1] for b in boxes)
faces = Image.new('RGBA', (cw * len(boxes), ch), (0, 0, 0, 0))
fmeta = {'w': cw, 'h': ch, 'names': NAMES}
for i, b in enumerate(boxes):
    f = sheet.crop(b)
    faces.alpha_composite(f, (i * cw + (cw - f.width) // 2, ch - f.height))
faces.save(os.path.join(out, 'faces.png'), optimize=True)
meta['faces'] = fmeta
with open(os.path.join(jout, 'eris.json'), 'w') as fh:
    json.dump(meta, fh, indent=1)
print('eris', atlas.size, 'faces', faces.size, len(boxes))
