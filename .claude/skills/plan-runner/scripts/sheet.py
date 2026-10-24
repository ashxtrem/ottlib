"""One small contact sheet from any screenshots, so a helper looks at one picture instead of many (the guard's image budget).

Usage: python .claude/skills/plan-runner/scripts/sheet.py OUT.png IN1.png IN2.png ...   (or a folder, or a glob in quotes)
Each picture is scaled to the same height, labelled with its file name, and placed side by side; rows wrap so the sheet stays
under 1600 px wide (the guard's size limit).
"""
import glob
import os
import sys

from PIL import Image, ImageDraw

MAX_W = 1600
HEIGHT = 420
GAP = 8
LABEL = 18


def collect(args):
    out = []
    for a in args:
        if os.path.isdir(a):
            out += sorted(glob.glob(os.path.join(a, "*.png")))
        elif any(c in a for c in "*?["):
            out += sorted(glob.glob(a))
        else:
            out.append(a)
    return out


def build(out_path, paths):
    tiles = []
    for p in paths:
        im = Image.open(p).convert("RGB")
        w = max(1, int(im.width * HEIGHT / im.height))
        if w > MAX_W:
            w, h = MAX_W, max(1, int(im.height * MAX_W / im.width))
        else:
            h = HEIGHT
        tiles.append((os.path.basename(p), im.resize((w, h))))
    rows, row, x = [], [], 0
    for name, im in tiles:
        if row and x + im.width > MAX_W:
            rows.append(row)
            row, x = [], 0
        row.append((name, im))
        x += im.width + GAP
    if row:
        rows.append(row)
    width = min(MAX_W, max(sum(im.width for _, im in r) + GAP * (len(r) - 1) for r in rows))
    height = sum(max(im.height for _, im in r) + LABEL + GAP for r in rows)
    sheet = Image.new("RGB", (width, height), (30, 30, 30))
    draw = ImageDraw.Draw(sheet)
    y = 0
    for r in rows:
        x = 0
        for name, im in r:
            draw.text((x + 2, y + 2), name[:40], fill=(230, 230, 230))
            sheet.paste(im, (x, y + LABEL))
            x += im.width + GAP
        y += max(im.height for _, im in r) + LABEL + GAP
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    sheet.save(out_path)
    return sheet.size


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    files = collect(sys.argv[2:])
    if not files:
        sys.exit("no pictures found")
    print("%s %dx%d from %d pictures" % ((sys.argv[1],) + build(sys.argv[1], files) + (len(files),)))
