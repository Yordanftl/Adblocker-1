#!/usr/bin/env python3
"""Generate AdShield toolbar/store icons (16/32/48/128 px) with Pillow.

Draws a shield with a check mark, supersampled 4x then downscaled for
crisp edges. Run from the project root:

    python3 tools/generate_icons.py
"""
import os
from PIL import Image, ImageDraw

SHIELD = [(0.50, 0.04), (0.88, 0.16), (0.88, 0.50), (0.50, 0.96),
          (0.12, 0.50), (0.12, 0.16)]
HIGHLIGHT = [(0.50, 0.04), (0.88, 0.16), (0.88, 0.42), (0.12, 0.42),
             (0.12, 0.16)]
CHECK = [(0.33, 0.50), (0.455, 0.63), (0.69, 0.35)]


def draw_icon(size):
    s = size * 4  # supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon([(x * s, y * s) for x, y in SHIELD], fill=(79, 70, 229, 255))
    d.polygon([(x * s, y * s) for x, y in HIGHLIGHT], fill=(255, 255, 255, 34))
    d.line([(x * s, y * s) for x, y in CHECK], fill=(255, 255, 255, 255),
           width=int(s * 0.085), joint="curve")
    return img.resize((size, size), Image.LANCZOS)


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "icons")
    os.makedirs(out_dir, exist_ok=True)
    for size in (16, 32, 48, 128):
        path = os.path.join(out_dir, f"icon-{size}.png")
        draw_icon(size).save(path)
        print(f"icon-{size}.png")


if __name__ == "__main__":
    main()
