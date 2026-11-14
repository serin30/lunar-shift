"""
export_terrain.py - cut out the real terrain around a site for the 3D view.

AI disclosure: first draft written with an AI coding assistant (Claude) during the
NASA Space Apps 2026 hackathon; reviewed and run by the team.

Samples the NASA LOLA elevation map on a square grid centred on the site.
The grid uses local axes: +east and +north in metres from the site, the same
axes as scan.py and the same directions as azimuth (0 = north, 90 = east).

Usage
    python export_terrain.py LDEM_80S_80MPP_ADJ.TIF --lat -89.4632 --lon 222.51 \
        --half-km 12 --step 80 --out terrain_site01.json
"""

import argparse
import json

import numpy as np

import horizon as hz


def export(dem, lat, lon, half_m=12000.0, step_m=80.0):
    n = int(round(half_m / step_m))
    axis = np.arange(-n, n + 1) * step_m                 # metres, west to east / south to north
    east, north = np.meshgrid(axis, axis)                # row 0 = southern edge
    dist = np.hypot(east, north)
    az = np.degrees(np.arctan2(east, north)) % 360.0
    plat, plon = hz.destination(lat, lon, az, dist)
    h = dem.height(plat, plon)
    h = np.where(np.isnan(h), np.nanmin(h), h)
    return {
        "site": {"lat": lat, "lon": lon},
        "step_m": step_m,
        "size": int(2 * n + 1),
        "half_m": float(n * step_m),
        "min_m": float(h.min()),
        "max_m": float(h.max()),
        "rows_south_to_north": True,
        "heights_m": np.round(h).astype(int).ravel().tolist(),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("dem")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True)
    p.add_argument("--half-km", type=float, default=12.0)
    p.add_argument("--step", type=float, default=80.0)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    data = export(hz.Dem.open(a.dem), a.lat, a.lon, a.half_km * 1000.0, a.step)
    with open(a.out, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"{data['size']} x {data['size']} heights, every {a.step:.0f} m, "
          f"from {data['min_m']:.0f} m to {data['max_m']:.0f} m")
    print("Saved", a.out)


if __name__ == "__main__":
    main()
