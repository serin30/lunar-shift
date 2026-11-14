"""
fetch_horizons.py - download Sun and Earth directions for a lunar surface site.

AI disclosure: first draft written with an AI coding assistant (Claude) during the
NASA Space Apps 2026 hackathon; the request settings were confirmed by the team
against a manual JPL Horizons query.

For every hour in the chosen period it asks NASA/JPL Horizons where the Sun and
the Earth are in the sky of the site, and saves one CSV file with the columns
    time_utc, sun_az, sun_el, earth_az, earth_el
Angles are in degrees. Azimuth: 0 = north, 90 = east. Elevation: 0 = level
horizon of a smooth Moon, negative = below it. Times are UTC.

Usage
-----
    python fetch_horizons.py --lat -89.4632 --lon 222.51 --alt-km 1.9433 \
        --start 2027-01-01 --stop 2028-01-01 --out ephem_site01.csv

--alt-km is the ground height printed by horizon.py, in kilometres.
"""

import argparse
import csv
import ssl
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
SUN, EARTH = "10", "399"


def _ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def parse_table(text):
    """Read the rows between $$SOE and $$EOE. Returns a list of (datetime, az, el)."""
    if "$$SOE" not in text:
        raise RuntimeError("Horizons returned no table. Its message was:\n" + text[:1500])
    body = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    rows = []
    for line in body.strip().splitlines():
        parts = line.split()
        if len(parts) < 4:
            continue
        # the first two fields are date and time; the last two are azimuth and elevation.
        # anything in between is a daylight or Earth-presence marker, which we ignore.
        when = datetime.strptime(parts[0] + " " + parts[1], "%Y-%b-%d %H:%M")
        rows.append((when, float(parts[-2]), float(parts[-1])))
    return rows


def query(target, lon, lat, alt_km, start, stop, step="1h", tries=3):
    params = {
        "format": "text",
        "COMMAND": f"'{target}'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",               # a point on the Moon (body 301)
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{lon},{lat},{alt_km}'",   # east longitude, latitude, height in km
        "START_TIME": f"'{start}'",
        "STOP_TIME": f"'{stop}'",
        "STEP_SIZE": f"'{step}'",
        "QUANTITIES": "'4'",                   # apparent azimuth and elevation
    }
    url = API + "?" + urllib.parse.urlencode(params)
    last = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=120, context=_ssl_context()) as r:
                return parse_table(r.read().decode("utf-8", "replace"))
        except Exception as e:               # network hiccup or busy server: wait and retry
            last = e
            time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"Horizons request failed after {tries} tries: {last}")


def chunks(start, stop, days=90):
    """Split a long period into pieces so that no single request is too large."""
    a = datetime.fromisoformat(start)
    end = datetime.fromisoformat(stop)
    while a < end:
        b = min(a + timedelta(days=days), end)
        yield a.strftime("%Y-%m-%d %H:%M"), b.strftime("%Y-%m-%d %H:%M")
        a = b


def fetch(lon, lat, alt_km, start, stop, step="1h"):
    sun, earth = {}, {}
    for a, b in chunks(start, stop):
        print(f"  {a} to {b}")
        for when, az, el in query(SUN, lon, lat, alt_km, a, b, step):
            sun[when] = (az, el)
        for when, az, el in query(EARTH, lon, lat, alt_km, a, b, step):
            earth[when] = (az, el)
        time.sleep(1)                        # be polite to the public server
    times = sorted(set(sun) & set(earth))
    return [(t, *sun[t], *earth[t]) for t in times]


def main():
    p = argparse.ArgumentParser(description="Sun and Earth directions from a lunar site (JPL Horizons).")
    p.add_argument("--lat", type=float, required=True)
    p.add_argument("--lon", type=float, required=True, help="east longitude in degrees")
    p.add_argument("--alt-km", type=float, required=True, help="ground height in km")
    p.add_argument("--start", default="2027-01-01")
    p.add_argument("--stop", default="2028-01-01")
    p.add_argument("--step", default="1h")
    p.add_argument("--out", required=True)
    a = p.parse_args()

    print("Asking JPL Horizons:")
    rows = fetch(a.lon, a.lat, a.alt_km, a.start, a.stop, a.step)
    with open(a.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["time_utc", "sun_az", "sun_el", "earth_az", "earth_el"])
        for t, saz, sel, eaz, eel in rows:
            w.writerow([t.strftime("%Y-%m-%dT%H:%MZ"), saz, sel, eaz, eel])
    sel = [r[2] for r in rows]
    eel = [r[4] for r in rows]
    print(f"Saved {len(rows)} rows to {a.out}")
    print(f"Sun elevation   {min(sel):.2f} to {max(sel):.2f} deg")
    print(f"Earth elevation {min(eel):.2f} to {max(eel):.2f} deg")


if __name__ == "__main__":
    main()
