"""
Synthetic supply-chain operations dataset for the public exhibit.
Deterministic (seed 2022). Shaped after the Agilent 2022–23 programme:
18 monthly cycles, four regions, ~50 vendors (24 modelled), six capital-import
work streams. Headline figures are TUNED to land on the résumé outcomes
(turnaround −18–20%, 96% supply continuity). Nothing here is real company data.
"""
import json, math, random, datetime

rng = random.Random(2022)

MONTHS = []
y, m = 2022, 2
for i in range(18):
    MONTHS.append({"i": i, "key": f"{y}-{m:02d}", "label": datetime.date(y, m, 1).strftime("%b %Y"), "short": datetime.date(y, m, 1).strftime("%b %y")})
    m += 1
    if m > 12: m = 1; y += 1

INTERVENTION = 6  # Aug 2022: SOPs + vendor escalation protocol go live

REGIONS = [
    {"id": "DE", "name": "Germany", "share": 0.34, "base_otd": 0.89, "base_tat": 10.6, "base_acc": 0.966, "cont": 0.962},
    {"id": "EU", "name": "Europe (ex-DE)", "share": 0.26, "base_otd": 0.87, "base_tat": 11.9, "base_acc": 0.961, "cont": 0.958},
    {"id": "AP", "name": "Asia-Pacific", "share": 0.25, "base_otd": 0.85, "base_tat": 13.1, "base_acc": 0.957, "cont": 0.955},
    {"id": "BR", "name": "Brazil", "share": 0.15, "base_otd": 0.83, "base_tat": 14.4, "base_acc": 0.952, "cont": 0.964},
]

VENDOR_NAMES = [
    ("Helvetia Precision GmbH", "Components", ["DE", "EU"]),
    ("Rheinwerk Optik AG", "Components", ["DE"]),
    ("Nordfrakt Logistics", "Logistics", ["DE", "EU"]),
    ("Lindqvist Fluidics AB", "Components", ["EU"]),
    ("Atlantic Customs Partners", "Customs", ["EU", "BR"]),
    ("Meridian Freight Systems", "Logistics", ["EU", "AP"]),
    ("Tessaro Vacuum S.r.l.", "Components", ["EU", "DE"]),
    ("Kestrel Air Cargo", "Logistics", ["AP", "DE"]),
    ("Sunwell Electronics Co.", "Components", ["AP"]),
    ("Han-Yeong Instruments", "Components", ["AP"]),
    ("Pacific Rim Brokerage", "Customs", ["AP"]),
    ("Selangor Packaging Sdn Bhd", "Packaging", ["AP"]),
    ("Yamato Precision Glass", "Components", ["AP", "EU"]),
    ("Serra Azul Metalúrgica", "Components", ["BR"]),
    ("Transporte Guanabara", "Logistics", ["BR"]),
    ("Despachos Aduaneiros Litoral", "Customs", ["BR"]),
    ("Vale Verde Embalagens", "Packaging", ["BR"]),
    ("Bavaria Cold Chain", "Logistics", ["DE"]),
    ("Elbe Steel Fabrication", "Components", ["DE"]),
    ("Ostsee Verpackung", "Packaging", ["DE", "EU"]),
    ("Continental Clearance Ltd", "Customs", ["DE", "EU"]),
    ("Danube Circuit Works", "Components", ["EU"]),
    ("Iberia Consolidators", "Logistics", ["EU", "BR"]),
    ("Straits Cargo Line", "Logistics", ["AP", "BR"]),
]

CAUSES = [
    ("customs", "Customs documentation"),
    ("capacity", "Vendor capacity"),
    ("carrier", "Carrier delay"),
    ("entry", "Order entry error"),
    ("demand", "Demand spike / stockout"),
    ("quality", "Quality hold"),
]

def clamp(x, lo, hi): return max(lo, min(hi, x))

def progress(i):
    """0 before intervention, ramps to 1 over ~6 months after it, with a small
    early gain from the root-cause phase (Feb–Jul 2022)."""
    pre = 0.12 * (i / INTERVENTION) if i < INTERVENTION else 0.12
    if i < INTERVENTION: return pre
    k = (i - INTERVENTION + 1) / 6.5
    return clamp(pre + 0.88 * (1 - math.exp(-2.2 * k)), 0, 1)

def season(i):
    # quarter-end pushes (Mar/Jun/Sep/Dec) raise volume and stress OTD slightly
    mi = (1 + i) % 12  # month number-1 ; Feb=1
    month = ((2 + i - 1) % 12) + 1
    return 1.14 if month in (3, 6, 9, 12) else (0.94 if month in (1, 8) else 1.0)

# vendor personas
vendors = []
for vi, (name, vtype, regs) in enumerate(VENDOR_NAMES):
    q = rng.uniform(0.80, 0.965)        # baseline on-time quality
    resp = rng.uniform(0.35, 1.0)       # how much they respond to escalation protocol
    vol = rng.uniform(0.55, 1.6)        # relative volume
    lt = rng.uniform(-1.8, 2.6)         # lead-time offset in days
    acc = rng.uniform(0.94, 0.985)
    vendors.append({"id": f"V{vi+1:02d}", "name": name, "type": vtype, "regions": regs,
                    "q": q, "resp": resp, "vol": vol, "lt": lt, "acc": acc})

# a couple of deliberate narratives
for v in vendors:
    if v["name"] == "Despachos Aduaneiros Litoral": v["q"], v["resp"] = 0.78, 0.9    # worst pre, strong recovery
    if v["name"] == "Pacific Rim Brokerage": v["q"], v["resp"] = 0.80, 0.25          # chronic — stays at risk
    if v["name"] == "Kestrel Air Cargo": v["q"], v["resp"] = 0.86, 0.15              # slides late in period
    if v["name"] == "Helvetia Precision GmbH": v["q"], v["resp"], v["vol"] = 0.955, 0.8, 1.7

rows = []
backlog = []
causes = []
continuity = []

for mo in MONTHS:
    i = mo["i"]; p = progress(i); s = season(i)
    for r in REGIONS:
        region_rows = []
        for v in vendors:
            if r["id"] not in v["regions"]: continue
            share = 1.0 / len(v["regions"])
            lam = 62 * r["share"] * v["vol"] * share * s
            n = max(4, int(rng.gauss(lam, lam * 0.14)))
            # on-time probability: blend of region base + vendor quality, lifted by programme progress
            base = 0.5 * r["base_otd"] + 0.5 * v["q"]
            lift = p * (0.19 * v["resp"] + 0.06)          # up to ~+0.25 for responsive vendors
            slide = -0.06 * max(0, (i - 12) / 5) if v["name"] == "Kestrel Air Cargo" else 0
            q_end = clamp(base + lift * (0.985 - base) / 0.25 + slide + rng.gauss(0, 0.012) - (0.02 if s > 1.1 else 0), 0.62, 0.995)
            ot = int(round(n * q_end))
            acc_p = clamp(0.5 * r["base_acc"] + 0.5 * v["acc"] + p * 0.016 + rng.gauss(0, 0.004), 0.9, 0.982)
            accu = int(round(n * acc_p))
            tat = r["base_tat"] + v["lt"] - p * (0.235 * (r["base_tat"] + v["lt"])) * (0.6 + 0.4 * v["resp"]) + rng.gauss(0, 0.35) + (0.5 if s > 1.1 else 0)
            tat = round(max(4.5, tat), 1)
            late = n - ot
            esc_rate = (0.55 if i < INTERVENTION else 0.42) if late > 0 else 0
            esc = int(round(late * esc_rate * rng.uniform(0.7, 1.2))) if late > 4 else (1 if late > 2 and rng.random() < 0.4 else 0)
            row = {"m": i, "r": r["id"], "v": v["id"], "n": n, "ot": ot, "acc": accu, "tat": tat, "esc": esc}
            rows.append(row); region_rows.append(row)
        # backlog by age bucket at month end
        tot_n = sum(x["n"] for x in region_rows)
        late_n = sum(x["n"] - x["ot"] for x in region_rows)
        open_total = int(tot_n * (0.42 - 0.13 * p) * rng.uniform(0.93, 1.07))
        over30 = int(late_n * (0.55 - 0.40 * p) * rng.uniform(0.85, 1.15))
        b15 = int(open_total * (0.22 - 0.08 * p))
        b8 = int(open_total * (0.28 - 0.03 * p))
        b0 = max(0, open_total - over30 - b15 - b8)
        backlog.append({"m": i, "r": r["id"], "b0": b0, "b8": b8, "b15": b15, "b30": over30})
        # late-shipment causes
        weights = {
            "customs": 0.36 - 0.22 * p, "capacity": 0.27 - 0.13 * p, "carrier": 0.15 + 0.04 * p,
            "entry": 0.10 - 0.05 * p, "demand": 0.07 + 0.03 * p, "quality": 0.05,
        }
        if r["id"] in ("BR", "AP"): weights["customs"] += 0.08
        if r["id"] == "DE": weights["carrier"] += 0.04
        wsum = sum(weights.values())
        cts = {k: int(round(late_n * w / wsum)) for k, w in weights.items()}
        causes.append({"m": i, "r": r["id"], **cts})
        # supply continuity: share of SKU-weeks without a stockout, target 95
        c = r["cont"] + p * 0.008 + rng.gauss(0, 0.006) - (0.006 if s > 1.1 else 0)
        continuity.append({"m": i, "r": r["id"], "c": round(clamp(c, 0.93, 0.985) * 100, 1)})

# --- tune supply continuity to average exactly ~96.0 across the programme
avg_c = sum(x["c"] for x in continuity) / len(continuity)
shift = 96.0 - avg_c
for x in continuity: x["c"] = round(x["c"] + shift, 1)

# --- capital-import work streams (USD thousands)
WS = [
    ("WS-01", "Instrument line, lab expansion", 1840, 1612, 0.92, "on-track"),
    ("WS-02", "Clean-room fit-out, regional hub", 960, 1004, 0.86, "over-budget"),
    ("WS-03", "Cold-chain racking, distribution centre", 420, 388, 1.00, "complete"),
    ("WS-04", "Calibration cell, manufacturing site", 1275, 1010, 0.78, "on-track"),
    ("WS-05", "Automated packaging line, plant", 730, 512, 0.61, "at-risk"),
    ("WS-06", "Bonded-warehouse racking, port hub", 385, 371, 0.97, "on-track"),
]
workstreams = []
for wid, name, budget, spent, pct, status in WS:
    planned_to_date = round(budget * min(1, pct + 0.04), 0)
    workstreams.append({"id": wid, "name": name, "budget": budget, "spent": spent,
                        "planned": planned_to_date, "pct": pct, "status": status,
                        "variance": spent - planned_to_date})

# --- headline verification
def agg(filt):
    xs = [x for x in rows if filt(x)]
    n = sum(x["n"] for x in xs); ot = sum(x["ot"] for x in xs); acc = sum(x["acc"] for x in xs)
    tat = sum(x["tat"] * x["n"] for x in xs) / n
    return n, ot / n * 100, acc / n * 100, tat

first3 = agg(lambda x: x["m"] < 3); last3 = agg(lambda x: x["m"] >= 15)
print("orders first3/last3", first3[0], last3[0])
print("OTD  %.1f -> %.1f" % (first3[1], last3[1]))
print("ACC  %.1f -> %.1f" % (first3[2], last3[2]))
print("TAT  %.1f -> %.1f  (%.1f%%)" % (first3[3], last3[3], (last3[3] - first3[3]) / first3[3] * 100))
print("CONT avg %.1f" % (sum(x["c"] for x in continuity) / len(continuity)))
bl0 = [b for b in backlog if b["m"] == 0]; bl17 = [b for b in backlog if b["m"] == 17]
print("backlog m0", sum(b["b0"]+b["b8"]+b["b15"]+b["b30"] for b in bl0), ">30:", sum(b["b30"] for b in bl0))
print("backlog m17", sum(b["b0"]+b["b8"]+b["b15"]+b["b30"] for b in bl17), ">30:", sum(b["b30"] for b in bl17))
for r in REGIONS:
    a = agg(lambda x, r=r: x["m"] >= 15 and x["r"] == r["id"]); b = agg(lambda x, r=r: x["m"] < 3 and x["r"] == r["id"])
    print(" ", r["id"], "OTD %.1f -> %.1f  TAT %.1f -> %.1f" % (b[1], a[1], b[3], a[3]))
m0 = agg(lambda x: x["m"] == 0); m17 = agg(lambda x: x["m"] == 17)
print("endpoint OTD %.1f -> %.1f  TAT %.1f -> %.1f (%.1f%%)" % (m0[1], m17[1], m0[3], m17[3], (m17[3]-m0[3])/m0[3]*100))
print("rows", len(rows))

out = {
    "meta": {
        "title": "Supply-chain operations exhibit",
        "seed": 2022, "generated": "2026-09-11", "intervention": INTERVENTION,
        "targets": {"otd": 95, "acc": 98, "cont": 95, "tat": 10},
        "disclosure": "Synthetic dataset generated for a public portfolio. Shaped after a real 2022–23 programme (18 monthly cycles, four regions, six capital-import work streams) and tuned so its headline outcomes match the résumé; vendors, orders and figures are invented.",
        "skus": 120, "vendorsTotal": 50,
    },
    "months": MONTHS,
    "regions": [{"id": r["id"], "name": r["name"]} for r in REGIONS],
    "vendors": [{"id": v["id"], "name": v["name"], "type": v["type"], "regions": v["regions"]} for v in vendors],
    "causes": [{"id": k, "name": n} for k, n in CAUSES],
    "rows": rows, "backlog": backlog, "lateCauses": causes, "continuity": continuity,
    "workstreams": workstreams,
}
with open("data.js", "w") as f:
    f.write("/* Synthetic dataset — see generate_data.py. Not real company data. */\nwindow.SCX = ")
    json.dump(out, f, separators=(",", ":"))
    f.write(";\n")
with open("data.json", "w") as f:
    json.dump(out, f, indent=1)
print("written data.js", len(json.dumps(out, separators=(",", ":"))) // 1024, "KB")
