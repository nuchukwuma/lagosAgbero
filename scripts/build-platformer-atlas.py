"""Pack the platformer sprites into two small atlases.

  python3 -I scripts/build-platformer-atlas.py <prototype-pack-dir> <vehicle-pack-dir> <png-out-dir> <json-out-dir>

prototype pack: Craftpix "Free Pixel Art Prototype Character Sprites" (Animations/*.png,
128x128 frames in a row). vehicle pack: "Retro vehicle sprites 64x64" (one PNG per
vehicle). Each animation is cropped to the union of its frames' bounds, so the
atlas is a fraction of the original size; the anchor is where the feet stand.
Writes dummy.png and vehicles.png (served as assets) and their .json frame tables
(imported by the game code).
"""
import json
import os
import sys

from PIL import Image

proto, vehicles, out, jout = sys.argv[1:5]
os.makedirs(out, exist_ok=True)
os.makedirs(jout, exist_ok=True)

# game name -> (file, frames to keep or None for all, anchor bottom override)
ANIMS = {
    'idle': ('Stop_Running', [4], None),
    'walk': ('Walking', None, None),
    'run': ('Running', None, None),
    'stop': ('Stop_Running', None, None),
    'jump': ('Jumping', None, None),
    'double': ('Double_Jump', None, None),
    'land': ('Landing', None, None),
    'roll': ('Roll', None, None),
    'strike': ('Jump witn Strike', None, 92),  # drawn on the ground: its lowest pixel at the feet
    'crouch': ('Crouch', None, None),
    'knocked': ('Falling', None, None),
    'vault': ('Obstacle Jump', None, None),
}

F = 128
cells = []
for name, (file, keep, bottom) in ANIMS.items():
    im = Image.open(os.path.join(proto, 'Animations', f'{file}.png')).convert('RGBA')
    n = im.width // F
    frames = [im.crop((i * F, 0, i * F + F, F)) for i in range(n)]
    if keep:
        frames = [frames[i] for i in keep]
    boxes = [f.getbbox() for f in frames if f.getbbox()]
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    cells.append((name, [f.crop((x0, y0, x1, y1)) for f in frames], x0, y0, bottom or F))

atlas_w = max(sum(c.width for c in frames) for _, frames, *_ in cells)
atlas_h = sum(frames[0].height for _, frames, *_ in cells)
atlas = Image.new('RGBA', (atlas_w, atlas_h), (0, 0, 0, 0))
meta = {'source': 'Craftpix Free Pixel Art Prototype Character Sprites (craftpix.net/file-licenses)', 'anims': {}}
y = 0
for name, frames, x0, y0, bottom in cells:
    w, h = frames[0].size
    for i, f in enumerate(frames):
        atlas.alpha_composite(f, (i * w, y))
    # anchor: the feet, at x = 64 of the original 128px frame, and the frame's bottom (or the override)
    meta['anims'][name] = {'x': 0, 'y': y, 'w': w, 'h': h, 'frames': len(frames), 'ax': 64 - x0, 'ay': bottom - y0}
    y += h
atlas.save(os.path.join(out, 'dummy.png'), optimize=True)
with open(os.path.join(jout, 'dummy.json'), 'w') as fh:
    json.dump(meta, fh, indent=1)

# vehicles: cropped to their pixels, one row
VEH = {
    'danfo': 'yellow-bus', 'corolla': 'red-corolla', 'datsun': 'brown-datsun', 'blueCar': 'blue-car', 'jeep': 'pink-jeep',
    'lorry': 'luton-van', 'van': 'white-plumbing-van', 'camper': 'camper-van', 'sports': 'yellow-sports-car',
    'okada': 'motor-cycle-male', 'okada2': 'motor-cycle-female',
}
base = vehicles
sub = [d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))]
if sub:
    base = os.path.join(base, sub[0])
crops = []
for key, file in VEH.items():
    im = Image.open(os.path.join(base, f'{file}.png')).convert('RGBA')
    crops.append((key, im.crop(im.getbbox())))
vw = sum(c.width for _, c in crops) + len(crops)
vh = max(c.height for _, c in crops)
va = Image.new('RGBA', (vw, vh), (0, 0, 0, 0))
vmeta = {'source': 'Retro vehicle sprites 64x64', 'vehicles': {}}
x = 0
for key, c in crops:
    va.alpha_composite(c, (x, vh - c.height))
    vmeta['vehicles'][key] = {'x': x, 'y': vh - c.height, 'w': c.width, 'h': c.height}
    x += c.width + 1
va.save(os.path.join(out, 'vehicles.png'), optimize=True)
with open(os.path.join(jout, 'vehicles.json'), 'w') as fh:
    json.dump(vmeta, fh, indent=1)
print('dummy', atlas.size, 'vehicles', va.size)
