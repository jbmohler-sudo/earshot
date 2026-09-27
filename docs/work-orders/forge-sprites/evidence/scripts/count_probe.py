# Count visible probe pixels (pure #ff00ff/#00ffff/#00ff00/#0000ff) around each probe spot.
# Usage: python count_probe.py <dir> <label>
import json, sys
from PIL import Image

d, label = sys.argv[1], sys.argv[2]
spots = json.load(open(f"{d}/{label}-spots.json"))
COLS = {(255, 0, 255), (0, 255, 255), (0, 255, 0), (0, 0, 255)}
iso = lambda x, y: ((x - y) * 8 + 256, (x + y) * 4 + 70)
for s in spots:
    im = Image.open(s["file"]).convert("RGB")
    cx, cy = map(round, iso(s["x"], s["y"]))
    n = sum(1 for i in range(cx - 8, cx + 9) for j in range(cy - 20, cy + 3) if im.getpixel((i, j)) in COLS)
    s["visible_px"] = n
    print(f'{s["name"]:24s} tile=({s["x"]},{s["y"]}) depth={s["depth"]:5}  visible probe px = {n}')
json.dump(spots, open(f"{d}/{label}-spots.json", "w"), indent=2)
