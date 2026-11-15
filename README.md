# LUNAR//SHIFT

**When the mission moves, the Moon changes.**

Live site: https://serin30.github.io/lunar-shift/

NASA Space Apps Challenge 2026 · Seoul · Challenge: Lunar Landing Site Navigator · Team STARLEY LAB

## What it does

You enter what a mission needs: how long it stays on the surface, how long a dark gap it can survive, and how many hours of Earth contact it needs each day. LUNAR//SHIFT tells you, for a landing site near the Moon's south pole:

- which landing dates in 2027 are a **go**, **marginal** or **no-go**,
- how many days of launch delay each date survives,
- how the answer changes if the lander comes down a few hundred metres off target,
- where on the surrounding terrain a mission could land at all.

At the south pole the Sun never rises more than about 2° above the horizon, so a single distant ridge can hide it. Averages hide this. A mission fails in its longest dark gap, not on its average sunlight.

## How it works

There is no server. Python scripts compute everything ahead of time and write data files. The website is static and only reads those files, so it cannot go down during judging.

```
NASA LOLA elevation map ──► horizon.py ──────────► siteNN.json          terrain horizon, 720 directions
JPL Horizons ─────────────► fetch_horizons.py ───► ephem_siteNN.csv     Sun and Earth direction, every hour of 2027
both ─────────────────────► combine.py ──────────► timeline_siteNN.json hourly sunlight share and Earth visibility
both ─────────────────────► scan.py ─────────────► scan_siteNN.json     81 points around the target
both ─────────────────────► decision_map.py ─────► map_siteNN.json      10,201 points: passing landing dates per spot
NASA LOLA elevation map ──► export_terrain.py ───► terrain_siteNN.json  terrain for the 3D view
NASA LOLA elevation map ──► export_polar.py ─────► polar_siteNN.json    wide landscape, out to 200 km
all of the above ─────────► build_site_data.py ──► web/data/sites.js    the one file the website loads
```

## Set up

```
git clone https://github.com/serin30/lunar-shift.git
cd lunar-shift
python3 -m venv .venv
source .venv/bin/activate
pip install numpy scipy rasterio
python test_horizon.py
```

`python test_horizon.py` must end with `All checks passed.`

Download the elevation map (181 MB, not stored in this repository):

```
curl -L -O https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF
```

To see the site locally, open `web/index.html` in a browser.

## Add a new site

Replace `site02`, the name, and the latitude and longitude. Longitude is east longitude in degrees, from 0 to 360. The site must be south of 80° S, because the elevation map ends there.

```
# 1. Terrain horizon. Note the "Ground height at site" it prints.
python horizon.py LDEM_80S_80MPP_ADJ.TIF --lat LAT --lon LON --mast 2 --out site02.json

# 2. Sun and Earth directions. --alt-km is the ground height from step 1, in kilometres.
python fetch_horizons.py --lat LAT --lon LON --alt-km GROUND_KM --out ephem_site02.csv

# 3. Hourly sunlight and Earth visibility at the target.
python combine.py site02.json ephem_site02.csv --out timeline_site02.json

# 4. Landing-miss scan. Note the "Best point" latitude and longitude it prints.
python scan.py LDEM_80S_80MPP_ADJ.TIF ephem_site02.csv --lat LAT --lon LON --radius 800 --spacing 160 --out scan_site02.json

# 5. The best nearby point, using the latitude and longitude from step 4.
python horizon.py LDEM_80S_80MPP_ADJ.TIF --lat BEST_LAT --lon BEST_LON --mast 2 --out site02_best.json
python combine.py site02_best.json ephem_site02.csv --out timeline_site02_best.json

# 6. Terrain for the 3D view.
python export_terrain.py LDEM_80S_80MPP_ADJ.TIF --lat LAT --lon LON --half-km 12 --step 80 --out terrain_site02.json

# 7. Decision map. Takes about 5 minutes.
python decision_map.py LDEM_80S_80MPP_ADJ.TIF ephem_site02.csv --lat LAT --lon LON --half-km 8 --step 160 --out map_site02.json

# 8. Wide landscape for the 3D view.
python export_polar.py LDEM_80S_80MPP_ADJ.TIF --lat LAT --lon LON --out polar_site02.json

# 9. Rebuild the website data with every site listed.
python build_site_data.py --site site01 "Connecting Ridge" --site site02 "Name of the new site"
```

Then open `web/index.html`. A comparison table appears as soon as there are two sites.

## Data files

All angles are in degrees. Azimuth is 0 at north and 90 at east. Elevation is measured from the level horizon of a smooth Moon. Times are UTC. Offsets are in metres east and north of the target.

| File | Contents |
|---|---|
| `siteNN.json` | `site` (lat, lon, ground_m, mast_m), `az_deg`, `horizon_deg`, `horizon_dist_km`: 720 values each, one every 0.5° |
| `ephem_siteNN.csv` | Columns `time_utc, sun_az, sun_el, earth_az, earth_el`, one row per hour, 8,761 rows for 2027 |
| `timeline_siteNN.json` | `time_utc`, `sun` (share of the Sun's disc above the terrain, 0 to 1), `earth` (1 if Earth's centre is above the terrain), plus the four angle arrays |
| `scan_siteNN.json` | `points`: for each of 81 spots `east_m, north_m, dist_m, lat, lon, ground_m, slope_deg, sun_pct, earth_pct, both_pct` |
| `map_siteNN.json` | A 101 × 101 grid, rows south to north, with `sun_pct, earth_pct, dark_h, crew_go, crew_pass, robot_go, robot_pass` |
| `terrain_siteNN.json` | A 301 × 301 grid of heights in metres, rows south to north, 80 m apart |
| `polar_siteNN.json` | A 401 × 401 grid of heights in metres, rows south to north, 1 km apart |
| `web/data/sites.js` | Everything above for every site, packed for the browser |

## The pass rule

A landing date passes when, for the whole stay starting at 00:00 UTC on that date:

- the longest unbroken dark stretch is no longer than the mission can survive, and
- Earth is in view for at least the required number of hours on every day.

Each date is judged twice. The **cautious** reading counts sunlight only when more than half of the Sun's disc clears the terrain, and counts Earth only when its centre clears the terrain by 0.5°. The **optimistic** reading accepts one tenth of the Sun and Earth just above the terrain. Go means both readings pass. Marginal means only the optimistic one passes. When in doubt, the more careful colour is shown.

Presets: **Crew** is 6 days, no dark gap, 8 hours of Earth contact a day. **Robot** is 14 days, a dark gap of up to 24 hours, no Earth requirement.

The rule is written twice, in Python (`decision_map.py`) and in JavaScript (`web/app.js`). On the same target data both give 10 go dates and 16 passing dates.

## How we checked the numbers

| Check | Result | Expected |
|---|---|---|
| Smooth Moon, eye 2 m up: how far the horizon dips | −0.0871° | −0.0869° from geometry |
| Smooth Moon, eye 100 m up | −0.6147° | −0.6147° from geometry |
| A 3 km wall placed 50 km away | 2.549° to 2.599° | 2.520° to 2.604° |
| Mountains placed due north and due east | found at 0.0° and 90.0° | 0° and 90° |
| Sun's centre exactly on the terrain line | 50% of the disc visible | 50% |
| Our map projection against the NASA file's own definition | 0.00 m difference | under one 80 m pixel |
| Sun's yearly height range at the site, from JPL Horizons | −2.06° to +2.05° | about ±2.1° at this latitude |
| Best-lit point near the target, sunlight over 2027 | 83.7% | NASA studies report roughly 70% or more for the best spots on this ridge |

Run the first five yourself with `python test_horizon.py`.

## What this tool does not see

- **Rocks and small craters.** The elevation map has 80 m pixels.
- **Temperature.** We report hours of darkness, which drives the cold, but we do not model heat.
- **Other years.** Only 2027 is computed, and polar lighting shifts from year to year.
- **The exact shape of the terrain edge across the Sun.** The disc is cut by a level line.
- **A working radio link.** "Earth in view" means line of sight. Ground stations and Earth's phase are not modelled.
- **Fine direction sampling in the painted map.** It checks every 1° instead of every 0.5°, so its counts can differ from the single-point verdict by a few dates.

## Data sources

- **LOLA south pole elevation map**, `LDEM_80S_80MPP_ADJ.TIF`, 80 m per pixel, from NASA Goddard's Planetary Geodesy Data Archive: https://pgda.gsfc.nasa.gov/products/90
- **JPL Horizons**, for the apparent azimuth and elevation of the Sun and Earth from a site on the Moon: https://ssd.jpl.nasa.gov/horizons/
- **three.js** (MIT licence) for the 3D view.

We are not affiliated with or endorsed by NASA.

## Use of AI tools

Parts of the code were drafted with an AI coding assistant and then run, tested and reviewed by the team. See `AI_USAGE.md` for the list.
