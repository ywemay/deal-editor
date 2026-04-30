#!/usr/bin/env python3
"""
Thumbnailer for .deal files (Deal Editor).

Freedesktop thumbnailer spec:
    deal-thumbnailer -s SIZE URI OUTPUT_PATH

Usage:
    deal-thumbnailer -s 256 file:///path/to/file.deal /tmp/thumb.png
"""

import os
import sys
import urllib.parse
import urllib.request
from PIL import Image, ImageDraw, ImageFont


def unquote_uri(uri: str) -> str:
    """Convert file:// URI to local filesystem path."""
    parsed = urllib.parse.urlparse(uri)
    if parsed.scheme == "file":
        path = urllib.request.url2pathname(parsed.path)
        return path
    return uri


def generate_thumbnail(size: int, output_path: str):
    """Generate a placeholder thumbnail for .deal files."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = max(2, size // 24)
    r = max(4, size // 8)

    # Deal purple gradient background
    draw.rounded_rectangle(
        [(margin, margin), (size - margin, size - margin)],
        radius=r,
        fill=(156, 39, 176, 255),
        outline=(130, 30, 150, 255),
        width=max(2, size // 64),
    )

    # Draw "DEAL" text
    font_size = size // 6
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size
        )
    except (OSError, IOError):
        font = ImageFont.load_default()

    text = "DEAL"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) // 2, (size - th) // 2),
        text,
        fill=(255, 255, 255, 255),
        font=font,
    )

    # Draw file icon decoration
    icon_size = size // 5
    icon_x = size - icon_size - margin
    icon_y = margin
    draw.rounded_rectangle(
        [(icon_x, icon_y), (icon_x + icon_size, icon_y + int(icon_size * 1.3))],
        radius=icon_size // 8,
        fill=(255, 255, 255, 60),
        outline=(255, 255, 255, 100),
        width=1,
    )

    img.save(output_path, "PNG")


def main():
    if len(sys.argv) < 4:
        print(
            f"Usage: {sys.argv[0]} -s SIZE URI OUTPUT_PATH",
            file=sys.stderr,
        )
        sys.exit(1)

    size_idx = None
    for i, arg in enumerate(sys.argv):
        if arg == "-s":
            size_idx = i + 1
            break

    if size_idx is None or size_idx >= len(sys.argv):
        print("Missing -s SIZE argument", file=sys.stderr)
        sys.exit(1)

    size = int(sys.argv[size_idx])
    uri = sys.argv[size_idx + 1]
    output_path = sys.argv[size_idx + 2]

    filepath = unquote_uri(uri)
    if not os.path.exists(filepath):
        # File doesn't exist, still make a placeholder
        pass

    generate_thumbnail(size, output_path)


if __name__ == "__main__":
    main()
