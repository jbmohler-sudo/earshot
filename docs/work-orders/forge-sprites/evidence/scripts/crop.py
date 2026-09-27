# Crop the Forge yard out of a <label>-world.png (art pixels) and upscale x4 nearest.
# Usage: python crop.py <evidence dir> <label> [<label> ...]
import sys
from PIL import Image

d = sys.argv[1]
for label in sys.argv[2:]:
    im = Image.open(f"{d}/{label}-world.png").convert("RGBA")
    c = im.crop((120, 10, 340, 180))
    c = c.resize((c.width * 4, c.height * 4), Image.NEAREST)
    c.save(f"{d}/{label}-forge-x4.png")
    print(f"{d}/{label}-forge-x4.png", c.size)
