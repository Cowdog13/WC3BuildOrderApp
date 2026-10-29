#!/usr/bin/env python3
"""Reads wc3data's dist/units.js as TEXT (never executes it) and writes the
melee-buildable units/buildings/heroes of the four races to JSON.
Usage: extract_units.py path/to/wc3data/dist/units.js out.json"""
import json, re, sys

src = open(sys.argv[1], encoding="utf-8").read().split("\n")
RACES = {"human", "orc", "undead", "nightelf"}
blocks, cur, buf = {}, None, []
for line in src:
    m = re.match(r"^  ([A-Za-z0-9]{4}): \{$", line)
    if m:
        cur, buf = m.group(1), []
        continue
    if cur is not None:
        if line == "  },":
            blocks[cur] = "\n".join(buf)
            cur = None
        else:
            buf.append(line)

def scalar(b, key, indent=6):
    m = re.search(r"^ {%d}%s: (.+?),?$" % (indent, key), b, re.M)
    if not m: return None
    v = m.group(1).rstrip(",")
    try: return json.loads(v)
    except Exception: return v.strip('"')

def lst(b, key):
    m = re.search(r"^ {6}%s: \[(.*?)\]," % key, b, re.M | re.S)
    return re.findall(r'"([^"]+)"', m.group(1)) if m else []

def art(b):
    m = re.search(r'Art: "ReplaceableTextures\\\\CommandButtons\\\\(BTN[^"]+)\.blp"', b)
    return m.group(1) if m else None

def name(b):
    m = re.search(r'^ {6}Name: "([^"]+)"', b, re.M)
    return m.group(1) if m else None

info = {}
for uid, b in blocks.items():
    race = scalar(b, "race")
    if race not in RACES: continue
    info[uid] = dict(id=uid, name=name(b), race=race, icon=art(b),
        gold=scalar(b, "goldcost") or 0, lumber=scalar(b, "lumbercost") or 0,
        time=scalar(b, "bldtm") or 0, food=scalar(b, "fused") or 0, fmade=scalar(b, "fmade") or 0,
        isbldg=bool(scalar(b, "isbldg")), level=scalar(b, "level") or 0,
        types=lst(b, "type"),
        trains=lst(b, "Trains"), builds=lst(b, "Builds"),
        researches=lst(b, "Researches"), upgrade=lst(b, "Upgrade"),
        sells=lst(b, "Sellunits"))

# Tower upgrades are abilities in the game data, not "Upgrade" links, so add them by hand.
for parent, kids in {"hwtw": ["hgtw", "hctw", "hatw"], "uzig": ["uzg1", "uzg2"]}.items():
    if parent in info:
        info[parent]["upgrade"] = sorted(set(info[parent]["upgrade"]) | {k for k in kids if k in info})

# transitive closure from the four workers: what a melee player can make
roots = ["hpea", "opeo", "uaco", "ewsp"]
seen, todo = set(), list(roots)
while todo:
    u = todo.pop()
    if u in seen or u not in info: continue
    seen.add(u)
    d = info[u]
    todo += d["trains"] + d["builds"] + d["upgrade"]
out = [info[u] for u in sorted(seen) if info[u]["name"]]
for d in out:
    d["kind"] = ("building" if d["isbldg"] else
                 "hero" if d["id"][0].isupper() else "unit")
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(len(out), "entries")
