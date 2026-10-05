"""Extract embedded page images from the image-only brochures (standard library only).

The four regional brochures have no text layer; each page is a placed image.
JPEG (DCTDecode) streams are written as-is; Flate-compressed RGB/Gray streams
are re-wrapped as PNG with zlib. Output: research/raw/brochure-images/<pdf>-<n>.<ext>
(git-ignored). Read-only on the PDFs.
"""
import re, struct, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "raw" / "pdfs"
OUT = ROOT / "raw" / "brochure-images"
OUT.mkdir(parents=True, exist_ok=True)

def png(w, h, channels, raw):
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    ctype = {1: 0, 3: 2}[channels]
    stride = w * channels
    rows = b"".join(b"\x00" + raw[y * stride:(y + 1) * stride] for y in range(h))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ctype, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows, 6)) + chunk(b"IEND", b""))

for pdf in sorted(SRC.glob("*.pdf")):
    data = pdf.read_bytes()
    n = 0
    for m in re.finditer(rb"(\d+) 0 obj\s*<<(.*?)>>\s*stream\r?\n", data, re.S):
        d = m.group(2)
        if b"/Image" not in d:
            continue
        length = re.search(rb"/Length (\d+)(?! \d+ R)", d)
        start = m.end()
        end = start + int(length.group(1)) if length else data.index(b"endstream", start)
        stream = data[start:end]
        w = int(re.search(rb"/Width (\d+)", d).group(1)); h = int(re.search(rb"/Height (\d+)", d).group(1))
        n += 1
        stem = f"{pdf.stem}-{n:02d}-{w}x{h}"
        if b"DCTDecode" in d:
            # Some streams are [/FlateDecode /DCTDecode]: a JPEG wrapped in zlib.
            if b"FlateDecode" in d and stream[:2] != b"\xff\xd8":
                stream = zlib.decompress(stream)
            (OUT / f"{stem}.jpg").write_bytes(stream)
        elif b"FlateDecode" in d and b"/DecodeParms" not in d:
            cs = 3 if b"DeviceRGB" in d else 1 if b"DeviceGray" in d else None
            if cs is None:
                print("  skip (colour space)", stem); continue
            raw = zlib.decompress(stream)
            if len(raw) != w * h * cs:
                print("  skip (size)", stem); continue
            (OUT / f"{stem}.png").write_bytes(png(w, h, cs, raw))
        else:
            print("  skip (filter)", stem, re.findall(rb"/Filter\s*/?\[?\s*/(\w+)", d)); continue
        print(pdf.name, stem)
