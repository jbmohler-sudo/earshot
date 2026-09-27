# Side-by-side of two world images (art px), cropped to a region, upscaled nearest.
# Usage: python compare.py out.png x0 y0 x1 y1 scale a.png b.png [c.png ...]
import sys
from PIL import Image, ImageDraw

out = sys.argv[1]
x0, y0, x1, y1, s = map(int, sys.argv[2:7])
ims = [Image.open(p).convert("RGBA").crop((x0, y0, x1, y1)) for p in sys.argv[7:]]
w, h = (x1 - x0) * s, (y1 - y0) * s
sheet = Image.new("RGBA", (w * len(ims) + 10 * (len(ims) - 1), h + 24), (255, 255, 255, 255))
d = ImageDraw.Draw(sheet)
for i, (im, p) in enumerate(zip(ims, sys.argv[7:])):
    sheet.paste(im.resize((w, h), Image.NEAREST), (i * (w + 10), 24))
    d.text((i * (w + 10) + 4, 4), p.replace("\\", "/").split("/")[-1], fill=(0, 0, 0, 255))
sheet.save(out)
print(out, sheet.size)
