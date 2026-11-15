"""
build_site_data.py - pack the results of one or more sites into the file the website loads.

AI disclosure: first draft written with an AI coding assistant (Claude) during the
NASA Space Apps 2026 hackathon; reviewed and run by the team.

For each site id (for example site01) it reads, from the current folder:
    site01.json, timeline_site01.json, scan_site01.json, terrain_site01.json
    and, if present: site01_best.json + timeline_site01_best.json, map_site01.json, polar_site01.json
and writes everything to web/data/sites.js

Usage (list every site you want on the page, in order):
    python build_site_data.py --site site01 "Connecting Ridge"
    python build_site_data.py --site site01 "Connecting Ridge" --site site02 "Second site name"
"""

import argparse
import json
import os


def load(path):
    with open(path) as f:
        return json.load(f)


def point(pid, label, prof, tl, east=0.0, north=0.0):
    return {
        "id": pid, "label": label,
        "lat": prof["site"]["lat"], "lon": prof["site"]["lon"],
        "ground_m": round(prof["site"]["ground_m"], 1), "mast_m": prof["site"]["mast_m"],
        "east_m": east, "north_m": north,
        "horizon_deg": [round(v, 3) for v in prof["horizon_deg"]],
        "horizon_dist_km": [round(v, 1) for v in prof["horizon_dist_km"]],
        "sun": [round(v, 2) for v in tl["sun"]],
    }


def build(sid, name):
    prof = load(f"{sid}.json")
    tl = load(f"timeline_{sid}.json")
    scan = load(f"scan_{sid}.json")
    terrain = load(f"terrain_{sid}.json")

    points = [point("target", "Target point", prof, tl)]
    if os.path.exists(f"{sid}_best.json") and os.path.exists(f"timeline_{sid}_best.json"):
        bp, bt = load(f"{sid}_best.json"), load(f"timeline_{sid}_best.json")
        near = min(scan["points"], key=lambda q: abs(q["lat"] - bp["site"]["lat"]) + abs(q["lon"] - bp["site"]["lon"]) / 100)
        points.append(point("best", f"Best spot nearby ({near['dist_m']:.0f} m away)", bp, bt, near["east_m"], near["north_m"]))

    site = {
        "id": sid, "name": name,
        "t0": tl["time_utc"][0], "step_hours": tl["step_hours"],
        "ephem": {k: tl[k] for k in ("sun_az", "sun_el", "earth_az", "earth_el")},
        "points": points, "scan": scan, "terrain": terrain, "dem": prof.get("dem", {}),
    }
    if os.path.exists(f"map_{sid}.json"):
        site["map"] = load(f"map_{sid}.json")
    if os.path.exists(f"polar_{sid}.json"):
        site["polar"] = load(f"polar_{sid}.json")
    return site


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--site", nargs=2, action="append", required=True, metavar=("ID", "NAME"))
    p.add_argument("--out", default="web/data/sites.js")
    a = p.parse_args()

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as f:
        f.write("window.LUNAR={sites:{}};\n")
        for sid, name in a.site:
            site = build(sid, name)
            f.write("window.LUNAR.sites[" + json.dumps(sid) + "]=")
            json.dump(site, f, separators=(",", ":"))
            f.write(";\n")
            print(f"  {sid}: {name}  points {[q['id'] for q in site['points']]}  decision map {'yes' if 'map' in site else 'no'}")
    print(f"Saved {a.out} ({os.path.getsize(a.out) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
