"""
scan.py - what if we land a little off target?

AI disclosure: first draft written with an AI coding assistant (Claude) during the
NASA Space Apps 2026 hackathon; reviewed and run by the team.

Repeats the sunlight and Earth-contact calculation on a grid of points around the
target, and also reads the ground slope at each point. The result shows how fast
conditions change over a few hundred metres, and where the best spot nearby is.

Usage
    python scan.py LDEM_80S_80MPP_ADJ.TIF ephem_site01.csv --lat -89.4632 --lon 222.51 \
        --radius 800 --spacing 160 --out scan_site01.json

The same Sun and Earth table is used for every point. Over 1 km the directions
change by far less than the terrain does, so this is a safe shortcut.
Limit: the map has 80 m pixels, so features smaller than that are invisible.
"""

import argparse
import json
import time

import numpy as np

import horizon as hz
from combine import load_csv


def slope_deg(dem, lat, lon, base_m=None):
    """Ground slope at a point, from heights one pixel away on each side."""
    b = base_m or dem.pixel_m
    h = [float(dem.height(*hz.destination(lat, lon, az, b))) for az in (0, 90, 180, 270)]
    dn = (h[0] - h[2]) / (2 * b)
    de = (h[1] - h[3]) / (2 * b)
    return float(np.degrees(np.arctan(np.hypot(dn, de))))


def scan(dem, lat, lon, eph, radius_m=800.0, spacing_m=160.0, mast_m=2.0, max_km=300.0):
    times, sun_az, sun_el, earth_az, earth_el = eph
    n = int(radius_m // spacing_m)
    pts = []
    t0 = time.time()
    offsets = [(i * spacing_m, j * spacing_m) for j in range(-n, n + 1) for i in range(-n, n + 1)
               if np.hypot(i, j) * spacing_m <= radius_m + 1e-6]
    for k, (east, north) in enumerate(offsets):
        dist = float(np.hypot(east, north))
        az = float(np.degrees(np.arctan2(east, north))) % 360.0
        plat, plon = (lat, lon) if dist == 0 else hz.destination(lat, lon, az, dist)
        prof = hz.horizon_profile(dem, float(plat), float(plon), mast_m, az_step_deg=1.0, max_km=max_km)
        sun = hz.sun_visible_fraction(prof, sun_az, sun_el)
        earth = hz.earth_visible(prof, earth_az, earth_el)
        pts.append({
            "east_m": east, "north_m": north, "dist_m": round(dist, 1),
            "lat": round(float(plat), 5), "lon": round(float(plon) % 360.0, 4),
            "ground_m": round(prof["site"]["ground_m"], 1),
            "slope_deg": round(slope_deg(dem, float(plat), float(plon)), 1),
            "sun_pct": round(100 * float(sun.mean()), 1),
            "earth_pct": round(100 * float(earth.mean()), 1),
            "both_pct": round(100 * float(((sun > 0.5) & earth).mean()), 1),
        })
        if (k + 1) % 20 == 0:
            print(f"  {k + 1}/{len(offsets)} points, {time.time() - t0:.0f} s")
    return pts


def main():
    p = argparse.ArgumentParser()
    p.add_argument("dem")
    p.add_argument("ephem_csv")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--radius", type=float, default=800.0, help="metres around the target")
    p.add_argument("--spacing", type=float, default=160.0, help="metres between grid points")
    p.add_argument("--mast", type=float, default=2.0)
    p.add_argument("--out", required=True)
    a = p.parse_args()

    dem = hz.Dem.open(a.dem)
    pts = scan(dem, a.lat, a.lon, load_csv(a.ephem_csv), a.radius, a.spacing, a.mast)
    with open(a.out, "w") as f:
        json.dump({"target": {"lat": a.lat, "lon": a.lon}, "radius_m": a.radius,
                   "spacing_m": a.spacing, "mast_m": a.mast, "points": pts}, f)

    sun = np.array([q["sun_pct"] for q in pts])
    target = next(q for q in pts if q["dist_m"] == 0)
    best = max(pts, key=lambda q: q["sun_pct"])
    worst = min(pts, key=lambda q: q["sun_pct"])
    near = [q for q in pts if q["dist_m"] <= 250]
    print(f"\n{len(pts)} points within {a.radius:.0f} m of the target")
    print(f"Target:  sunlight {target['sun_pct']} %, Earth {target['earth_pct']} %, "
          f"slope {target['slope_deg']} deg, height {target['ground_m']} m")
    print(f"Sunlight across the area: lowest {sun.min():.1f} %, middle {np.median(sun):.1f} %, highest {sun.max():.1f} %")
    print(f"Best point:  {best['sun_pct']} % at lat {best['lat']}, lon {best['lon']} "
          f"({best['dist_m']:.0f} m from target, height {best['ground_m']} m, slope {best['slope_deg']} deg)")
    print(f"Worst point: {worst['sun_pct']} % ({worst['dist_m']:.0f} m from target)")
    if near:
        s = np.array([q["sun_pct"] for q in near])
        print(f"Within 250 m: sunlight from {s.min():.1f} % to {s.max():.1f} %")
    print("Saved", a.out)


if __name__ == "__main__":
    main()
