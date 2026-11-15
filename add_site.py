"""Run the whole pipeline for one new site, then rebuild the website data.

AI disclosure: drafted with an AI assistant (Claude); run and checked by the team.

Example (IM-2 Athena landing spot, coordinates from NASA's LRO camera team):
    python add_site.py site04 -84.7906 29.1957

Takes about 10 to 15 minutes. Needs LDEM_80S_80MPP_ADJ.TIF in this folder.
"""
import argparse, json, subprocess, sys

DEM = "LDEM_80S_80MPP_ADJ.TIF"
NAMES = {"site01": "Connecting Ridge", "site02": "Nobile Rim 1", "site03": "Mons Malapert",
         "site04": "IM-2 landing spot (Mons Mouton)"}


def run(*args):
    cmd = [sys.executable] + [str(a) for a in args]
    print("\n>>> " + " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("site_id")
    p.add_argument("lat", type=float)
    p.add_argument("lon", type=float)
    p.add_argument("--polar-half-km", type=float, default=115.0)
    a = p.parse_args()
    s, lat, lon = a.site_id, a.lat, a.lon
    ll = [f"--lat={lat}", f"--lon={lon}"]

    run("horizon.py", DEM, *ll, "--mast", 2, "--out", f"{s}.json")
    ground_km = json.load(open(f"{s}.json"))["site"]["ground_m"] / 1000.0
    run("fetch_horizons.py", *ll, f"--alt-km={ground_km:.4f}", "--out", f"ephem_{s}.csv")
    run("combine.py", f"{s}.json", f"ephem_{s}.csv", "--out", f"timeline_{s}.json")
    run("scan.py", DEM, f"ephem_{s}.csv", *ll, "--radius", 800, "--spacing", 160, "--out", f"scan_{s}.json")
    best = max(json.load(open(f"scan_{s}.json"))["points"], key=lambda q: q["sun_pct"])
    run("horizon.py", DEM, f"--lat={best['lat']}", f"--lon={best['lon']}", "--mast", 2, "--out", f"{s}_best.json")
    run("combine.py", f"{s}_best.json", f"ephem_{s}.csv", "--out", f"timeline_{s}_best.json")
    run("export_terrain.py", DEM, *ll, "--half-km", 12, "--step", 80, "--out", f"terrain_{s}.json")
    run("decision_map.py", DEM, f"ephem_{s}.csv", *ll, "--half-km", 8, "--step", 160, "--out", f"map_{s}.json")
    run("export_polar.py", DEM, *ll, "--half-km", a.polar_half_km, "--out", f"polar_{s}.json")

    import os
    sites = [k for k in sorted(set(list(NAMES) + [s])) if os.path.exists(f"timeline_{k}.json")]
    build = ["build_site_data.py"]
    for k in sites:
        build += ["--site", k, NAMES.get(k, k)]
    run(*build)
    print("\nDone. Sites on the website:", ", ".join(sites))


if __name__ == "__main__":
    main()
