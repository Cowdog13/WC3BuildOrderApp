#!/usr/bin/env python3
"""Downloads the Warcraft III command-button icons the app is missing into ./icons.

Run it on your own computer (the cloud sandbox this was written in cannot reach wiki sites):
    python3 tools/fetch_icons.py            # fetch every icon that is still missing
    python3 tools/fetch_icons.py --list     # just show what is missing
    python3 tools/fetch_icons.py --base 'https://example.com/icons/{name}.png'   # your own source

Icons are saved as icons/<BTNName>.png, which is where the app looks. Tries each URL template
in turn and prints the ones nobody had, so you can drop those in by hand."""
import argparse, json, os, re, sys, urllib.error, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# {name} = e.g. BTNFootman. Special:FilePath redirects to the real image on any Fandom wiki.
TEMPLATES = [
    "https://wc3.fandom.com/wiki/Special:FilePath/{name}.png",
    "https://warcraft.fandom.com/wiki/Special:FilePath/{name}.png",
]

def wanted():
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    data = json.loads(re.search(r"window\.WC3_DATA = (.*);\s*$", src, re.S).group(1))
    names = {}
    for e in data:
        if e.get("img") or not e.get("btn"): continue
        names.setdefault(e["btn"], []).append(e["name"])
    return names

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
WIKIS = ["https://wc3.fandom.com", "https://warcraft.fandom.com"]
VERBOSE = False

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

def fetch(url):
    body = get(url)
    if not body.startswith(b"\x89PNG"): raise ValueError("not a PNG (got %r)" % body[:20])
    return body

def via_api(wiki, name):
    """Ask the wiki's MediaWiki API where File:<name>.png lives, then download it."""
    q = urllib.parse.urlencode({"action": "query", "titles": "File:%s.png" % name, "prop": "imageinfo",
                                "iiprop": "url", "format": "json"})
    pages = json.loads(get(wiki + "/api.php?" + q))["query"]["pages"]
    for p in pages.values():
        if p.get("imageinfo"): return fetch(p["imageinfo"][0]["url"])
    raise ValueError("no such file on " + wiki)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true", help="print why each attempt failed")
    ap.add_argument("--base", action="append", help="extra URL template with {name}")
    a = ap.parse_args()
    global VERBOSE; VERBOSE = a.verbose
    templates = (a.base or []) + TEMPLATES
    os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
    todo = {n: u for n, u in wanted().items() if not os.path.exists(os.path.join(ROOT, "icons", n + ".png"))}
    print(len(todo), "icons missing")
    if a.list:
        for n, u in sorted(todo.items()): print(" ", n, "(" + ", ".join(sorted(set(u))) + ")")
        return
    missed = []
    for n in sorted(todo):
        attempts = [lambda t=t: fetch(t.format(name=urllib.parse.quote(n))) for t in templates] + \
                   [lambda w=w: via_api(w, n) for w in WIKIS]
        for attempt in attempts:
            try:
                body = attempt()
            except (urllib.error.URLError, ValueError, TimeoutError, KeyError, json.JSONDecodeError) as e:
                if VERBOSE: print("   fail", n, "->", e)
                continue
            open(os.path.join(ROOT, "icons", n + ".png"), "wb").write(body)
            print("ok  ", n); break
        else:
            missed.append(n); print("miss", n)
    print("\nDone: %d fetched, %d not found" % (len(todo) - len(missed), len(missed)))
    if missed: print("Not found (drop icons/<name>.png in by hand):", ", ".join(missed))

if __name__ == "__main__":
    sys.exit(main())
