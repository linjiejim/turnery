"""Cut the Chinese heading face out of IBM Plex Sans SC.

The UI is set in IBM Plex Sans; headings and buttons set their Chinese in its
CJK companion, IBM Plex Sans SC, while body text keeps the system font (PingFang,
YaHei). The full font is 4 MB a weight, so this keeps every hanzi the app's own
strings use plus the 3755 common ones (GB2312 level 1), and splits them into
chunks, each an @font-face with its own unicode-range, so a page fetches only
the chunks its headings need. Characters from short UI strings (labels, titles,
button text) come first, in small chunks, then the rest of the app's hanzi,
then the common ones nothing uses yet. A character outside the subset falls
back to the system font.

The subset is renamed Turnery Sans SC: the licence reserves the name "Plex" for
unmodified versions of the font.

    python3 -m pip install fonttools brotli
    curl -LO https://unpkg.com/@ibm/plex-sans-sc@1.1.0/fonts/complete/woff2/hinted/IBMPlexSansSC-Medium.woff2
    curl -LO https://unpkg.com/@ibm/plex-sans-sc@1.1.0/fonts/complete/woff2/hinted/IBMPlexSansSC-SemiBold.woff2
    python3 scripts/build-ui-fonts.py IBMPlexSansSC-Medium.woff2 IBMPlexSansSC-SemiBold.woff2

Writes src/styles/fonts/turnery-sans-sc-<weight>-<n>.woff2 and turnery-sans-sc.css.
Run it again after adding Chinese strings with characters the subset lacks.
Licence: SIL OFL 1.1, copied next to the fonts (src/styles/fonts/OFL.txt).
"""

import collections
import os
import re
import sys

from fontTools import subset

APP = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(APP, "src", "styles", "fonts")
FAMILY = "Turnery Sans SC"
# Characters per chunk: small ones while the characters come from short UI strings, then bigger.
CHUNK_UI, CHUNK_REST = 150, 600
# Short strings are what headings and buttons say: t("…") labels, title/name/label fields, short JSX text.
SHORT = 14


def is_han(ch: str) -> bool:
    return "一" <= ch <= "鿿"


SHORT_FIELD = re.compile(
    r"""(?:\bt\(\s*|\b(?:title|name|label|heading|short|link|cta)\s*[:=]\s*\{?\s*)(["'`])([^"'`\n]{1,%d})\1""" % SHORT
)
SHORT_JSX = re.compile(r">\s*([^<>{}\n]{1,%d}?)\s*<" % SHORT)


def app_usage() -> tuple[collections.Counter, collections.Counter]:
    """How often each hanzi appears in the app's short UI strings, and in its sources overall."""
    short: collections.Counter = collections.Counter()
    every: collections.Counter = collections.Counter()
    src = os.path.join(APP, "src")
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "fonts")]
        for name in files:
            if not name.endswith((".ts", ".tsx", ".md", ".json")):
                continue
            with open(os.path.join(root, name), encoding="utf-8", errors="ignore") as f:
                text = f.read()
            every.update(ch for ch in text if is_han(ch))
            if name.endswith((".ts", ".tsx")):
                for m in SHORT_FIELD.finditer(text):
                    short.update(ch for ch in m.group(2) if is_han(ch))
                for m in SHORT_JSX.finditer(text):
                    short.update(ch for ch in m.group(1) if is_han(ch))
    return short, every


def gb2312_level1() -> list[str]:
    out = []
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                out.append(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return out


def ordered(cmap: dict) -> tuple[list[str], int]:
    """Every character to keep, in the order chunks take them, and how many come from short UI strings."""
    short, every = app_usage()
    # Punctuation first: every heading with a comma needs it.
    punct = sorted(c for c in map(chr, range(0x3000, 0x3040)) if ord(c) in cmap)
    punct += sorted(c for c in map(chr, range(0xFF01, 0xFF5F)) if ord(c) in cmap)
    seen = set(punct)
    out = list(punct)

    def take(chars) -> None:
        for ch in chars:
            if ch not in seen and ord(ch) in cmap:
                out.append(ch)
                seen.add(ch)

    take(ch for ch, _ in short.most_common())
    ui = len(out)
    take(ch for ch, _ in every.most_common())
    take(gb2312_level1())
    return out, ui


def chunks(chars: list[str], ui: int) -> list[list[str]]:
    out, i = [], 0
    while i < len(chars):
        n = CHUNK_UI if i < ui else CHUNK_REST
        out.append(chars[i : i + n])
        i += n
    if len(out) > 1 and len(out[-1]) < CHUNK_UI:  # no near-empty file at the end
        tail = out.pop()
        out[-1] += tail
    return out


def unicode_range(chars: list[str]) -> str:
    cps = sorted(ord(c) for c in chars)
    parts, start, prev = [], cps[0], cps[0]
    for cp in cps[1:] + [None]:
        if cp is not None and cp == prev + 1:
            prev = cp
            continue
        parts.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
        if cp is not None:
            start = prev = cp
    return ", ".join(parts)


def rename(font, weight_name: str) -> None:
    """Drop the reserved name everywhere the font names itself."""
    ps = f"TurnerySansSC-{weight_name}"
    name = font["name"]
    for platform in ((3, 1, 0x409), (1, 0, 0)):
        name.setName(FAMILY, 1, *platform)
        name.setName(weight_name, 2, *platform)
        name.setName(f"{ps};subset", 3, *platform)
        name.setName(f"{FAMILY} {weight_name}", 4, *platform)
        name.setName(ps, 6, *platform)
    if "CFF " in font:
        cff = font["CFF "].cff
        cff.fontNames = [ps]
        top = cff.topDictIndex[0]
        top.FullName = f"{FAMILY} {weight_name}"
        top.FamilyName = FAMILY


def cut(src: str) -> list[str]:
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.hinting = False
    opts.name_IDs = [0, 7, 13, 14]  # copyright, trademark, licence; the names are set by rename()
    opts.notdef_outline = True
    probe = subset.load_font(src, opts)
    weight = probe["OS/2"].usWeightClass
    weight_name = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold"}[weight]
    groups = chunks(*ordered(probe.getBestCmap()))
    probe.close()

    faces = []
    for i, group in enumerate(groups):
        font = subset.load_font(src, opts)
        sub = subset.Subsetter(opts)
        sub.populate(text="".join(group))
        sub.subset(font)
        rename(font, weight_name)
        file = f"turnery-sans-sc-{weight}-{i}.woff2"
        subset.save_font(font, os.path.join(OUT, file), opts)
        size = os.path.getsize(os.path.join(OUT, file)) / 1024
        print(f"{file}: {len(group)} chars, {size:.0f} KB")
        faces.append(
            "@font-face {\n"
            f'  font-family: "{FAMILY}";\n'
            "  font-style: normal;\n"
            f"  font-weight: {weight};\n"
            "  font-display: swap;\n"
            f'  src: url("./{file}") format("woff2");\n'
            f"  unicode-range: {unicode_range(group)};\n"
            "}\n"
        )
    return faces


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.startswith("turnery-sans-sc-") and f.endswith(".woff2"):
            os.remove(os.path.join(OUT, f))
    faces = []
    for src in sys.argv[1:]:
        faces += cut(src)
    head = (
        "/* Generated by scripts/build-ui-fonts.py from IBM Plex Sans SC (SIL OFL 1.1, see OFL.txt).\n"
        " * Chinese for headings and buttons; the first chunks hold the characters of short UI strings. */\n"
    )
    with open(os.path.join(OUT, "turnery-sans-sc.css"), "w") as f:
        f.write(head + "\n".join(faces))
