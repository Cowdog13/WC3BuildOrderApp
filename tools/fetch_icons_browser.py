#!/usr/bin/env python3
"""Same job as fetch_icons.py, but through a real Chromium window, which gets past the
bot checks that reject plain scripts (HTTP 403).

One-time setup (on your own computer):
    pip install playwright
    playwright install chromium
Run:
    python tools/fetch_icons_browser.py
A browser window opens. If the wiki shows a "verify you are human" page, solve it once in that
window and the script carries on by itself."""
import json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://warcraft.wiki.gg/wiki/Special:FilePath/{name}.png"

def wanted():
    src = open(os.path.join(ROOT, "data.js"), encoding="utf-8").read()
    data = json.loads(re.search(r"window\.WC3_DATA = (.*);\s*$", src, re.S).group(1))
    return sorted({e["btn"] for e in data if e.get("btn") and not e.get("img")
                   and not os.path.exists(os.path.join(ROOT, "icons", e["btn"] + ".png"))})

def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Run first:  pip install playwright  &&  playwright install chromium")
    names = wanted()
    print(len(names), "icons to fetch")
    os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
    missed = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_context().new_page()
        page.goto("https://warcraft.wiki.gg/wiki/Footman")
        input("If the page asks you to verify you are human, do that now. Press Enter when the wiki page is showing... ")
        for n in names:
            try:
                r = page.request.get(BASE.format(name=urllib.parse.quote(n)))
                body = r.body()
                if r.ok and body.startswith(b"\x89PNG"):
                    open(os.path.join(ROOT, "icons", n + ".png"), "wb").write(body); print("ok  ", n); continue
                print("miss", n, "(HTTP %s)" % r.status)
            except Exception as e:
                print("miss", n, "(%s)" % str(e).splitlines()[0])
            missed.append(n)
        browser.close()
    print("\nDone: %d fetched, %d not found" % (len(names) - len(missed), len(missed)))
    if missed: print("Not found:", ", ".join(missed))

if __name__ == "__main__":
    main()
