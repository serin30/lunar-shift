"""
combine.py - is the Sun above the terrain, and is Earth, for every hour?

AI disclosure: first draft written with an AI coding assistant (Claude) during the
NASA Space Apps 2026 hackathon; reviewed and run by the team.

Inputs
    site01.json        terrain horizon from horizon.py
    ephem_site01.csv   Sun and Earth directions from fetch_horizons.py
Output
    timeline_site01.json   one entry per hour:
        sun    share of the Sun's disc above the terrain, 0 to 1
        earth  1 if the centre of Earth is above the terrain, else 0

Usage
    python combine.py site01.json ephem_site01.csv --out timeline_site01.json
"""

import argparse
import csv
import json

import numpy as np

import horizon as hz


def load_csv(path):
    with open(path) as f:
        rows = list(csv.DictReader(f))
    times = [r["time_utc"] for r in rows]
    col = lambda k: np.array([float(r[k]) for r in rows])
    return times, col("sun_az"), col("sun_el"), col("earth_az"), col("earth_el")


def combine(profile, times, sun_az, sun_el, earth_az, earth_el, earth_margin_deg=0.0):
    sun = hz.sun_visible_fraction(profile, sun_az, sun_el)
    earth = hz.earth_visible(profile, earth_az, earth_el, earth_margin_deg)
    return {
        "site": profile["site"],
        "step_hours": 1,
        "time_utc": times,
        "sun": np.round(sun, 3).tolist(),
        "earth": earth.astype(int).tolist(),
        "sun_az": np.round(sun_az, 2).tolist(),
        "sun_el": np.round(sun_el, 3).tolist(),
        "earth_az": np.round(earth_az, 2).tolist(),
        "earth_el": np.round(earth_el, 3).tolist(),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("site_json")
    p.add_argument("ephem_csv")
    p.add_argument("--earth-margin", type=float, default=0.0,
                   help="extra degrees Earth must clear the terrain by")
    p.add_argument("--out", required=True)
    a = p.parse_args()

    with open(a.site_json) as f:
        profile = json.load(f)
    data = combine(profile, *load_csv(a.ephem_csv), earth_margin_deg=a.earth_margin)
    with open(a.out, "w") as f:
        json.dump(data, f)

    sun = np.array(data["sun"])
    earth = np.array(data["earth"])
    n = len(sun)
    print(f"{n} hours from {data['time_utc'][0]} to {data['time_utc'][-1]}")
    print(f"Average share of the Sun's disc visible: {100 * sun.mean():.1f} %")
    print(f"Hours with any Sun visible:              {100 * (sun > 0).mean():.1f} %")
    print(f"Hours with more than half the Sun:       {100 * (sun > 0.5).mean():.1f} %")
    print(f"Hours with Earth visible:                {100 * earth.mean():.1f} %")
    print(f"Hours with both:                         {100 * ((sun > 0.5) & (earth == 1)).mean():.1f} %")
    print("Saved", a.out)


if __name__ == "__main__":
    main()
