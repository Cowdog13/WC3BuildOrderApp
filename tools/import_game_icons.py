#!/usr/bin/env python3
"""Converts Warcraft III icon files from YOUR OWN game install into the PNGs the app uses.

1. Extract the icon folder from the game with a CASC viewer (e.g. CascView / CASCExplorer):
       ReplaceableTextures\\CommandButtons      (BTNFootman.blp, BTNPeasant.blp, ...)
   Research icons live there too (and in ReplaceableTextures\\CommandButtons\\... for upgrades).
2. Run (folder or .zip):
       pip install pillow
       python tools/import_game_icons.py  path\\to\\icons.zip
   Files are written to icons/<BTNName>.png (only the ones the app wants, unless --all).
       --suggest   list zip file names that look like each item that still has no icon"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def wanted():
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    data = json.loads(re.search(r"window\.WC3_DATA = (.*);\s*$", src, re.S).group(1))
    return {e["btn"].lower() for e in data if e.get("btn") and not e.get("img")}

def candidates(args):
    """Yield (stem, opener) for every image under a folder or inside a .zip."""
    import io, zipfile
    for path in args:
        if zipfile.is_zipfile(path):
            z = zipfile.ZipFile(path)
            for n in z.namelist():
                yield os.path.splitext(os.path.basename(n)), (lambda n=n, z=z: io.BytesIO(z.read(n)))
        else:
            for dirpath, _, files in os.walk(path):
                for f in files:
                    yield os.path.splitext(f), (lambda p=os.path.join(dirpath, f): p)

def tokens(s):
    return {t.lower() for t in re.findall(r"[A-Z][a-z]+|[a-z]+|\d+", s.replace("'", "")) if t.lower() not in ("btn", "of", "the")}

def suggest(args):
    """For every item still without an icon, list zip file names that look like it."""
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    data = json.loads(re.search(r"window\.WC3_DATA = (.*);\s*$", src, re.S).group(1))
    have = {f[:-4].lower() for f in os.listdir(os.path.join(ROOT, "icons"))} if os.path.isdir(os.path.join(ROOT, "icons")) else set()
    stems = sorted({stem for (stem, ext), _ in candidates(args) if ext.lower() in (".blp", ".dds", ".tga", ".png") and stem.upper().startswith("BTN")})
    seen = set()
    for e in data:
        if e.get("img") or (e.get("btn") and e["btn"].lower() in have): continue
        key = (e["name"], e["race"], e.get("btn"))
        if key in seen: continue
        seen.add(key)
        want = tokens(e["name"])
        scored = sorted(((len(want & tokens(st)) - 0.01 * len(tokens(st)), st) for st in stems), reverse=True)[:6]
        print("%-9s %-8s %-34s (currently %s)\n    %s" % (e["race"], e["kind"], e["name"], e.get("btn") or "no name",
              ", ".join(st for sc, st in scored if sc > 0) or "-"))

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args: sys.exit(__doc__)
    if "--suggest" in sys.argv: return suggest(args)
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Run first:  pip install pillow")
    want = None if "--all" in sys.argv else wanted()
    os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
    done, skipped, got = 0, 0, set()
    names = {}                      # canonical BTN name (as in data.js) by lowercase
    if want is not None:
        src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
        for k in want: names[k] = next(m for m in re.findall(r'"btn": "(BTN[^"]+)"', src) if m.lower() == k)
    for (stem, ext), opener in candidates(args):
        if ext.lower() not in (".blp", ".dds", ".tga", ".png", ".jpg", ".webp"): continue
        key = stem.lower() if stem.lower().startswith("btn") else "btn" + stem.lower()
        if want is not None and key not in want: skipped += 1; continue
        out = names.get(key) or (stem if stem.upper().startswith("BTN") else "BTN" + stem)
        try:
            Image.open(opener()).convert("RGBA").save(os.path.join(ROOT, "icons", out + ".png"))
            done += 1; got.add(key)
        except Exception as e:
            print("could not convert", stem + ext, "->", e)
    print("converted %d icons (%d other files ignored)" % (done, skipped))
    if want is not None:
        missing = sorted(names[k] for k in want if k not in got)
        if missing: print("still missing %d: %s" % (len(missing), ", ".join(missing)))

if __name__ == "__main__":
    main()
