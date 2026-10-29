#!/usr/bin/env python3
"""Builds data.js (window.WC3_DATA) from units.json (see extract_units.py) plus the
hand-written research table below, and copies matching icons into ./icons.

Usage: build_data.py units.json icon_pkg_dir   (icon_pkg_dir = unpacked w3-icons package)

Research costs/times are written from memory of the TFT 1.26-ish ladder patch and are
approximate; edit RESEARCH below (or data.js) to match your patch."""
import json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
units = json.load(open(sys.argv[1]))
pkg = sys.argv[2]

def key(s): return re.sub(r"[^a-z0-9]", "", s.lower())

# icon files available in the w3-icons package, preferring png over gif
avail = {}
for sub in ("orc", "neutral", "common"):
    d = os.path.join(pkg, sub)
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        k, ext = os.path.splitext(f)
        if ext not in (".png", ".gif", ".jpg"): continue
        if k not in avail or (ext == ".png" and not avail[k].endswith(".png")):
            avail[k] = os.path.join(d, f)

# unit/building names whose package file name differs from the stripped name
ALIAS = {"burrow": "orcburrow", "windrider": "wyvernrider", "raider": "wolfrider",
         "taurenchieftain": "chieftain", "warmill": "warmill", "beastiary": "beastiary"}

# id of units the extractor cannot find art for
ICON_FIX = {"Edem": "BTNHeroDemonHunter", "Udea": "BTNHeroDeathKnight",
            "Ulic": "BTNHeroLich", "hdhw": "BTNDragonHawk"}
EXTRA = [  # missing from the data dump but trainable in melee
    dict(id="ospw", name="Spirit Walker", race="orc", gold=195, lumber=35, time=30, food=2,
         kind="unit", icon="BTNSpiritWalker", by="osld"),
    dict(id="hdhw", name="Dragonhawk Rider", race="human", gold=200, lumber=50, time=45, food=4,
         kind="unit", icon="BTNDragonHawk", by="hgra"),
]

def research(race, by, name, gold, lumber, time, icon=None):
    return dict(id="r_%s_%s" % (by, key(name)), name=name, race=race, gold=gold, lumber=lumber,
                time=time, food=0, kind="research", icon=icon, by=by)

W = [(100, 50, 60), (175, 175, 75), (250, 300, 90)]   # weapon levels
A = [(125, 75, 60), (200, 175, 75), (275, 300, 90)]   # armor levels

def levels(race, by, names, table, icons=None):
    out = []
    for i, n in enumerate(names):
        g, l, t = table[i]
        out.append(research(race, by, n, g, l, t, icons[i] if icons else None))
    return out

RESEARCH = []
# ---------------- Human
RESEARCH += levels("human", "hbla", ["Iron Forged Swords", "Steel Forged Swords", "Mithril Forged Swords"], W)
RESEARCH += levels("human", "hbla", ["Black Gunpowder", "Refined Gunpowder", "Imbued Gunpowder"], W)
RESEARCH += levels("human", "hbla", ["Iron Plating", "Steel Plating", "Mithril Plating"], A)
RESEARCH += levels("human", "hbla", ["Studded Leather Armor", "Reinforced Leather Armor", "Dragonhide Armor"], A)
RESEARCH += [
    research("human", "hlum", "Improved Lumber Harvesting", 100, 50, 30),
    research("human", "hlum", "Advanced Lumber Harvesting", 100, 200, 30),
    research("human", "hlum", "Masonry", 100, 50, 40),
    research("human", "hlum", "Advanced Masonry", 150, 150, 40),
    research("human", "hlum", "Imbued Masonry", 200, 250, 40),
    research("human", "hbar", "Long Rifles", 100, 50, 40),
    research("human", "hbar", "Defend", 100, 50, 40),
    research("human", "hbar", "Animal War Training", 125, 125, 40),
    research("human", "hars", "Priest Adept Training", 100, 100, 40),
    research("human", "hars", "Sorceress Adept Training", 100, 100, 40),
    research("human", "hars", "Priest Master Training", 100, 300, 60),
    research("human", "hars", "Sorceress Master Training", 100, 300, 60),
    research("human", "hars", "Magic Sentry", 50, 50, 40),
    research("human", "harm", "Fragmentation Shards", 100, 50, 30),
    research("human", "harm", "Flak Cannons", 100, 50, 30),
    research("human", "harm", "Flying Machine Bombs", 100, 50, 30),
    research("human", "hgra", "Breath of Fire", 100, 100, 40),
    research("human", "hgra", "Storm Hammers", 150, 150, 40),
    research("human", "hvlt", "Control Magic", 100, 100, 40),
]
# ---------------- Orc  (icon = file name in the w3-icons package)
RESEARCH += levels("orc", "ofor", ["Steel Melee Weapons", "Thorium Melee Weapons", "Arcanite Melee Weapons"], W,
                   ["steelmeleeweapons", "thoriummeleeweapons", "arcanitemeleeweapons"])
RESEARCH += levels("orc", "ofor", ["Steel Ranged Weapons", "Thorium Ranged Weapons", "Arcanite Ranged Weapons"], W,
                   ["steelrangedweapons", "thoriumrangedweapons", "arcaniterangedweapons"])
RESEARCH += levels("orc", "ofor", ["Steel Armor", "Thorium Armor", "Arcanite Armor"], A,
                   ["steelarmor", "thoriumarmor", "arcanitearmor"])
RESEARCH += [
    research("orc", "ofor", "Reinforced Defenses", 100, 100, 60, "reinforceddefenses"),
    research("orc", "ofor", "Spiked Barricades", 100, 75, 60, "spikedbarricades"),
    research("orc", "ofor", "Improved Spiked Barricades", 150, 150, 60, "improvedspikedbarricades"),
    research("orc", "obar", "Berserker Strength", 100, 50, 50, "berserkerupgrade"),
    research("orc", "obar", "Troll Regeneration", 100, 50, 50, "trollregeneration"),
    research("orc", "obea", "Envenomed Spears", 100, 50, 50, "envenomedspears"),
    research("orc", "obea", "Pillage", 100, 50, 50, "pillage"),
    research("orc", "obea", "Burning Oil", 100, 50, 50, "burningoil"),
    research("orc", "obea", "Liquid Fire", 100, 50, 50, "liquidfire"),
    research("orc", "otto", "War Drums", 100, 100, 40, "wardrumsdamageincrease"),
    research("orc", "otto", "Pulverize", 100, 100, 40, "pulverizedamageincrease"),
    research("orc", "otto", "Endurance Aura", 100, 100, 40),
    research("orc", "osld", "Shaman Adept Training", 100, 100, 40, "shamanadepttraining"),
    research("orc", "osld", "Shaman Master Training", 100, 200, 60, "shamanmastertraining"),
    research("orc", "ovln", "Witch Doctor Adept Training", 100, 100, 40, "witchdoctoradepttraining"),
    research("orc", "ovln", "Witch Doctor Master Training", 100, 200, 60, "witchdoctormastertraining"),
    research("orc", "osld", "Spirit Walker Adept Training", 100, 100, 40, "spiritwalkeradepttraining"),
    research("orc", "osld", "Spirit Walker Master Training", 100, 200, 60, "spiritwalkermastertraining"),
    research("orc", "ostr", "Backpack", 100, 50, 30, "unitinventory"),
]
# ---------------- Undead
RESEARCH += levels("undead", "ugrv", ["Unholy Strength", "Unholy Strength II", "Unholy Strength III"], W)
RESEARCH += levels("undead", "ugrv", ["Creature Attack", "Creature Attack II", "Creature Attack III"], W)
RESEARCH += levels("undead", "ugrv", ["Unholy Armor", "Unholy Armor II", "Unholy Armor III"], A)
RESEARCH += levels("undead", "ugrv", ["Creature Carapace", "Creature Carapace II", "Creature Carapace III"], A)
RESEARCH += [
    research("undead", "usep", "Ghoul Frenzy", 100, 100, 40),
    research("undead", "usep", "Cannibalize", 50, 50, 30),
    research("undead", "usep", "Stone Form", 100, 100, 40),
    research("undead", "usep", "Burrow", 50, 25, 30),
    research("undead", "usep", "Web", 75, 25, 40),
    research("undead", "uslh", "Disease Cloud", 100, 100, 40),
    research("undead", "uslh", "Exhume Corpses", 100, 100, 40),
    research("undead", "utod", "Necromancer Adept Training", 100, 100, 40),
    research("undead", "utod", "Necromancer Master Training", 100, 200, 60),
    research("undead", "utod", "Banshee Adept Training", 100, 100, 40),
    research("undead", "utod", "Banshee Master Training", 100, 200, 60),
    research("undead", "ubon", "Freezing Breath", 100, 100, 40),
]
# ---------------- Night Elf
RESEARCH += levels("nightelf", "eaom", ["Strength of the Moon", "Improved Strength of the Moon", "Advanced Strength of the Moon"], W)
RESEARCH += levels("nightelf", "eaom", ["Strength of the Wild", "Improved Strength of the Wild", "Advanced Strength of the Wild"], W)
RESEARCH += levels("nightelf", "eaom", ["Moon Armor", "Improved Moon Armor", "Advanced Moon Armor"], A)
RESEARCH += levels("nightelf", "eaom", ["Hide Armor", "Improved Hide Armor", "Advanced Hide Armor"], A)
RESEARCH += [
    research("nightelf", "edob", "Marksmanship", 100, 100, 60),
    research("nightelf", "edob", "Improved Bows", 100, 50, 50),
    research("nightelf", "edob", "Sentinel", 100, 100, 50),
    research("nightelf", "edob", "Moon Glaive", 100, 100, 50),
    research("nightelf", "edob", "Ultravision", 100, 50, 40),
    research("nightelf", "edob", "Well Spring", 100, 100, 60),
    research("nightelf", "eaoe", "Bear Form", 100, 100, 60),
    research("nightelf", "eaoe", "Resistant Skin", 100, 100, 40),
    research("nightelf", "eaoe", "Abolish Magic", 100, 100, 60),
    research("nightelf", "eaoe", "Hardened Skin", 100, 100, 60),
    research("nightelf", "eaoe", "Mark of the Claw", 100, 100, 60),
    research("nightelf", "eaow", "Druid of the Talon Adept Training", 100, 100, 40),
    research("nightelf", "eaow", "Druid of the Talon Master Training", 100, 200, 60),
    research("nightelf", "eaoe", "Druid of the Claw Adept Training", 100, 100, 40),
    research("nightelf", "eaoe", "Druid of the Claw Master Training", 100, 200, 60),
    research("nightelf", "etol", "Nature's Blessing", 100, 100, 60),
    research("nightelf", "etol", "Ensnare", 100, 100, 40),
    research("nightelf", "edos", "Corrosive Breath", 100, 100, 50),
]

out, seen = [], set()
by_id = {u["id"]: u for u in units}
upgrade_parent = {}
for u in units:
    for t in u["upgrade"]: upgrade_parent[t] = u
all_units = list(units) + [dict(e, types=[], upgrade=[], fmade=0, isbldg=False) for e in EXTRA
                           if e["id"] not in by_id]
for u in all_units:
    if u["id"] in seen or u["id"] in ("hrtt", "ewar_x"): continue   # hrtt = duplicate Siege Engine
    seen.add(u["id"])
    icon_name = u.get("icon") or ICON_FIX.get(u["id"])
    e = dict(id=u["id"], name=u["name"], race=u["race"], kind=u["kind"],
             gold=u["gold"], lumber=u["lumber"], time=u["time"], food=u["food"],
             fmade=u.get("fmade", 0), icon=icon_name)
    p = upgrade_parent.get(u["id"])
    if p:
        e["gold"] -= p["gold"]; e["lumber"] -= p["lumber"]; e["upgradeFrom"] = p["id"]
        e["fmade"] = max(0, e["fmade"] - p.get("fmade", 0))
    if u["isbldg"] is False and u["kind"] == "hero": e["time"] = u["time"]
    by = u.get("by")
    if by: e["by"] = by
    out.append(e)
for r in RESEARCH: out.append(r)

os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
have = 0
for e in out:
    cands = [e["icon"]] if e["kind"] == "research" else [key(e["name"]), ALIAS.get(key(e["name"]), "")]
    path = next((avail[c] for c in cands if c and c in avail), None)
    if path:
        ext = os.path.splitext(path)[1]
        dst = "icons/%s%s" % (e["id"], ext)
        shutil.copyfile(path, os.path.join(ROOT, dst))
        e["img"] = dst; have += 1
    else:
        e["img"] = None

with open(os.path.join(ROOT, "data.js"), "w") as f:
    f.write("// Generated by tools/build_data.py - edit freely (costs/times for research are approximate).\n")
    f.write("window.WC3_DATA = ")
    json.dump(out, f, indent=1)
    f.write(";\n")
print(len(out), "entries,", have, "with bundled icons")
