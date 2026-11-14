"""
decision_map.py - a decision map: for every spot around the site, how many landing dates work?

AI disclosure: first draft written with an AI coding assistant (Claude) during the
NASA Space Apps 2026 hackathon; reviewed and run by the team.

For each cell of a grid around the site it computes the terrain horizon from the
NASA LOLA map, compares it with the Sun and Earth directions from JPL Horizons for
every hour of the year, and stores:
    sun_pct      share of the year with sunlight (average visible share of the Sun's disc)
    earth_pct    share of the year with Earth above the terrain
    crew_go      landing dates that pass the Crew requirement on the cautious reading
    crew_pass    ... on the optimistic reading (go + marginal)
    robot_go, robot_pass   the same for the Robot requirement
    dark_h       longest unbroken dark stretch in the year, in hours

The pass rules are the same as in web/app.js:
    Crew:  stay 6 days,  no dark gap,          Earth in view at least 8 h every day
    Robot: stay 14 days, dark gap up to 24 h,  no Earth requirement
    cautious reading:   more than half of the Sun's disc visible; Earth clears terrain by 0.5 deg
    optimistic reading: more than a tenth of the Sun's disc;      Earth just above terrain

Usage
    python decision_map.py LDEM_80S_80MPP_ADJ.TIF ephem_site01.csv --lat -89.4632 --lon 222.51 \
        --half-km 8 --step 160 --out map_site01.json
"""

import argparse
import json
import os
import time
from multiprocessing import Pool

import numpy as np

import horizon as hz
from combine import load_csv

PRESETS = {"crew": (6, 0, 8), "robot": (14, 24, 0)}           # stay days, max dark hours, Earth hours per day
CAUTIOUS, OPTIMISTIC = (0.5, 0.5), (0.1, 0.0)                 # (Sun share threshold, Earth margin in degrees)

_G = {}


def count_passing_days(sun, earth_clear, stay, max_dark, min_contact, sun_thr, earth_margin):
    """Number of landing dates (00:00 UTC each day) whose whole stay meets the requirement."""
    n = len(sun)
    dark = sun <= sun_thr
    # run[i] = length of the dark stretch ending at hour i
    idx = np.arange(n)
    last_lit = np.maximum.accumulate(np.where(~dark, idx, -1))
    run = idx - last_lit
    days = (n - 1) // 24
    contact = (earth_clear[: days * 24] > earth_margin).reshape(days, 24).sum(axis=1)
    ramp = np.arange(1, stay * 24 + 1)
    passed = 0
    for d in range(days):
        a, b = d * 24, d * 24 + stay * 24
        if b > n - 1:
            break
        if np.minimum(run[a:b], ramp).max() > max_dark:
            continue
        if contact[d:d + stay].min() < min_contact:
            continue
        passed += 1
    return passed


def longest_run(mask):
    idx = np.arange(len(mask))
    last = np.maximum.accumulate(np.where(~mask, idx, -1))
    return int((idx - last).max())


def cell(args):
    east, north = args
    dem, eph, lat, lon, mast = _G["dem"], _G["eph"], _G["lat"], _G["lon"], _G["mast"]
    dist = float(np.hypot(east, north))
    az = float(np.degrees(np.arctan2(east, north))) % 360.0
    plat, plon = (lat, lon) if dist == 0 else hz.destination(lat, lon, az, dist)
    try:
        prof = hz.horizon_profile(dem, float(plat), float(plon), mast, az_step_deg=1.0)
    except ValueError:
        return None
    _, sun_az, sun_el, earth_az, earth_el = eph
    sun = np.round(hz.sun_visible_fraction(prof, sun_az, sun_el), 2)
    clear = earth_el - hz.horizon_at(prof, earth_az)
    out = {"sun_pct": round(100 * float(sun.mean()), 1),
           "earth_pct": round(100 * float((clear > 0).mean()), 1),
           "dark_h": longest_run(sun <= 0.1)}
    for name, (stay, md, mc) in PRESETS.items():
        out[name + "_go"] = count_passing_days(sun, clear, stay, md, mc, *CAUTIOUS)
        out[name + "_pass"] = count_passing_days(sun, clear, stay, md, mc, *OPTIMISTIC)
    return out


def _init(dem_path, eph_path, lat, lon, mast):
    _G.update(dem=hz.Dem.open(dem_path), eph=load_csv(eph_path), lat=lat, lon=lon, mast=mast)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("dem")
    p.add_argument("ephem_csv")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--half-km", type=float, default=8.0)
    p.add_argument("--step", type=float, default=160.0)
    p.add_argument("--mast", type=float, default=2.0)
    p.add_argument("--workers", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    p.add_argument("--out", required=True)
    a = p.parse_args()

    n = int(round(a.half_km * 1000 / a.step))
    axis = np.arange(-n, n + 1) * a.step
    cells = [(float(e), float(nn)) for nn in axis for e in axis]            # rows south to north
    print(f"{len(cells)} cells ({2 * n + 1} x {2 * n + 1}), {a.step:.0f} m apart, {a.workers} workers")

    t0 = time.time()
    results = []
    with Pool(a.workers, initializer=_init, initargs=(a.dem, a.ephem_csv, a.lat, a.lon, a.mast)) as pool:
        for k, r in enumerate(pool.imap(cell, cells, chunksize=16)):
            results.append(r)
            if (k + 1) % 500 == 0:
                done = (k + 1) / len(cells)
                print(f"  {k + 1}/{len(cells)}  {time.time() - t0:.0f} s  (about {(time.time() - t0) * (1 - done) / done:.0f} s left)")

    keys = ["sun_pct", "earth_pct", "dark_h", "crew_go", "crew_pass", "robot_go", "robot_pass"]
    data = {"site": {"lat": a.lat, "lon": a.lon}, "step_m": a.step, "size": 2 * n + 1, "half_m": float(n * a.step),
            "mast_m": a.mast, "rows_south_to_north": True, "presets": PRESETS}
    for key in keys:
        data[key] = [None if r is None else r[key] for r in results]
    with open(a.out, "w") as f:
        json.dump(data, f, separators=(",", ":"))

    centre = results[len(cells) // 2]
    crew = np.array([r["crew_go"] for r in results if r])
    sun = np.array([r["sun_pct"] for r in results if r])
    print(f"\nDone in {time.time() - t0:.0f} s")
    print(f"Target cell: sunlight {centre['sun_pct']} %, crew go {centre['crew_go']}, crew pass {centre['crew_pass']}, "
          f"robot go {centre['robot_go']}, robot pass {centre['robot_pass']}")
    print(f"Sunlight over the area: {sun.min():.1f} % to {sun.max():.1f} %")
    print(f"Cells where at least one crew landing date is a go: {100 * (crew > 0).mean():.1f} %")
    print(f"Best cell for crew: {crew.max()} go dates")
    print(f"Cells that never see the Sun: {100 * (sun == 0).mean():.1f} %")
    print("Saved", a.out)


if __name__ == "__main__":
    main()
