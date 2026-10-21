#!/usr/bin/env python3
"""Subset the Mukta font to the characters this app actually shows, so the font costs ~60 KB, not ~250 KB.

Setup (once):   npm i --no-save @fontsource/mukta      (or point FONT_SRC at any folder with the fontsource woff2 files)
                pip install fonttools brotli
Run:            python3 scripts/subset_fonts.py
Re-run it after you add Hindi names to data/*.json or strings to i18n.js. A character that is missing from the
subset is not lost: the browser falls back to the phone's own Devanagari font for it.
"""
import os, re, glob, sys
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("FONT_SRC") or next(iter(glob.glob(os.path.join(ROOT, "node_modules/@fontsource/mukta/files"))), None)
if not SRC or not os.path.isdir(SRC):
    sys.exit("Font source not found. Run: npm i --no-save @fontsource/mukta   (or set FONT_SRC)")

# every Devanagari character used anywhere in the app's text and data
text = ""
for pat in ("*.js", "*.html", "data/*.json"):
    for f in glob.glob(os.path.join(ROOT, pat)):
        text += open(f, encoding="utf-8").read()
deva = "".join(sorted(set(re.findall(r"[ऀ-ॿ‌‍]", text)))) + "".join(chr(c) for c in range(0x0966, 0x0970))
latin = "".join(chr(c) for c in range(0x20, 0x7F)) + " ·–—‘’“”…₹"

os.makedirs(os.path.join(ROOT, "fonts"), exist_ok=True)
for weight in (500, 800):
    for script, chars in (("devanagari", deva), ("latin", latin)):
        src = os.path.join(SRC, f"mukta-{script}-{weight}-normal.woff2")
        out = os.path.join(ROOT, "fonts", f"mukta-{script}-{weight}.woff2")
        opts = subset.Options(); opts.flavor = "woff2"; opts.layout_features = ["*"]; opts.notdef_outline = True
        opts.name_IDs = [1, 2]; opts.drop_tables += ["DSIG"]
        font = subset.load_font(src, opts)
        sub = subset.Subsetter(opts); sub.populate(text=chars); sub.subset(font)
        subset.save_font(font, out, opts)
        print(f"{os.path.basename(out)}: {os.path.getsize(out)/1024:.1f} KB")
