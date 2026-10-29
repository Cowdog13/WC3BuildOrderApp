#!/usr/bin/env python3
"""Converts Warcraft III icon files from YOUR OWN game install into the PNGs the app uses.

1. Extract the icon folder from the game with a CASC viewer (e.g. CascView / CASCExplorer):
       ReplaceableTextures\\CommandButtons      (BTNFootman.blp, BTNPeasant.blp, ...)
   Research icons live there too (and in ReplaceableTextures\\CommandButtons\\... for upgrades).
2. Run:
       pip install pillow
       python tools/import_game_icons.py  path\\to\\extracted\\CommandButtons
   Files are written to icons/<BTNName>.png (only the ones the app wants, unless --all)."""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def wanted():
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    data = json.loads(re.search(r"window\.WC3_DATA = (.*);\s*$", src, re.S).group(1))
    return {e["btn"].lower() for e in data if e.get("btn")}

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args: sys.exit(__doc__)
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Run first:  pip install pillow")
    want = None if "--all" in sys.argv else wanted()
    os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
    done = skipped = 0
    for dirpath, _, files in os.walk(args[0]):
        for f in files:
            stem, ext = os.path.splitext(f)
            if ext.lower() not in (".blp", ".dds", ".tga", ".png") or not stem.upper().startswith("BTN"): continue
            if want is not None and stem.lower() not in want: skipped += 1; continue
            try:
                im = Image.open(os.path.join(dirpath, f)).convert("RGBA")
                im.save(os.path.join(ROOT, "icons", stem + ".png"))
                done += 1
            except Exception as e:
                print("could not convert", f, "->", e)
    print("converted %d icons (%d files ignored as not needed)" % (done, skipped))

if __name__ == "__main__":
    main()
