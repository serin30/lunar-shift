"""
export_polar.py - the wide landscape around a site, for the 3D view.

AI disclosure: first draft written with an AI coding assistant (Claude) during the
NASA Space Apps 2026 hackathon; reviewed and run by the team.

Samples the NASA LOLA elevation map on a coarse grid out to 200 km from the site,
so the website can show the site inside the real south pole landscape, with the
Moon's curvature, instead of as a small isolated tile.

Usage
    python export_polar.py LDEM_80S_80MPP_ADJ.TIF --lat -89.4632 --lon 222.51 --out polar_site01.json
"""

import argparse
import json

import numpy as np

import horizon as hz


def export(dem, lat, lon, half_m=200000.0, step_m=1000.0):
    n = int(round(half_m / step_m))
    axis = np.arange(-n, n + 1) * step_m
    east, north = np.meshgrid(axis, axis)                # row 0 = southern edge
    dist = np.hypot(east, north)
    az = np.degrees(np.arctan2(east, north)) % 360.0
    plat, plon = hz.destination(lat, lon, az, dist)
    h = dem.height(plat, plon)
    missing = np.isnan(h)
    h = np.where(missing, np.nanmin(h), h)
    return {
        "site": {"lat": lat, "lon": lon}, "step_m": step_m, "size": int(2 * n + 1), "half_m": float(n * step_m),
        "min_m": float(h.min()), "max_m": float(h.max()), "missing_pct": round(100 * float(missing.mean()), 2),
        "rows_south_to_north": True, "heights_m": np.round(h).astype(int).ravel().tolist(),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("dem")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--half-km", type=float, default=200.0)
    p.add_argument("--step", type=float, default=1000.0)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    data = export(hz.Dem.open(a.dem), a.lat, a.lon, a.half_km * 1000.0, a.step)
    with open(a.out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"{data['size']} x {data['size']} heights, every {a.step:.0f} m, out to {a.half_km:.0f} km, "
          f"from {data['min_m']:.0f} m to {data['max_m']:.0f} m, outside the map: {data['missing_pct']} %")
    print("Saved", a.out)


if __name__ == "__main__":
    main()
