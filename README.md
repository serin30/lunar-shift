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
- what any spot you click on the 3D terrain offers: sunlight, Earth visibility, longest dark stretch and landing dates,
- roughly how much battery and solar panel the chosen date demands, for a power draw you set.

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

## Comparison with NASA's average illumination map

NASA's LOLA average illumination and Earth visibility maps (Mazarico et al. 2011, https://pgda.gsfc.nasa.gov/products/69, files `AVGVISIB_85S_060M_201608.TIF` and `..._EARTH.TIF`, 60 m per pixel) give, for every pixel, the share of time the Sun (or Earth) is above the local terrain, averaged over one 18.6-year lunar nutation cycle. Our numbers are the same quantity for the single year 2027. `python compare_nasa.py` reads both maps (not stored in this repository, download from the products page), writes `nasa_compare.json` and prints this table. Values are percent of time.

| Site | Sun, ours (2027) | Sun, NASA at the same pixel | Sun, NASA mean within 300 m | Earth, ours | Earth, NASA same pixel |
|---|---|---|---|---|---|
| site01 Connecting Ridge | 46.4 | 43.9 | 49.5 | 39.8 | 39.1 |
| site02 Nobile Rim 1 | 79.2 | 76.8 | 49.7 | 62.1 | 67.4 |
| site03 Mons Malapert | 77.1 | 64.0 | 49.1 | 67.4 | 70.9 |

Across the 81 scan points around each site (NASA value averaged over a 60 m radius):

| Site | Sun correlation | Sun, ours minus NASA (mean, points) | Earth correlation | Earth, ours minus NASA (mean, points) |
|---|---|---|---|---|
| site01 | 0.74 | +6.0 | 0.97 | -3.8 |
| site02 | 0.82 | +4.1 | 0.98 | -3.1 |
| site03 | 0.92 | +4.5 | 0.98 | +1.4 |

What this shows:

- **Site01 matches well.** Our sunlight is within 2.5 points of NASA at the target pixel (46.4 against 43.9), and our Earth visibility within 1 point (39.8 against 39.1).
- **The pattern across space agrees.** Where NASA sees more sun or more Earth, so do we. Earth visibility follows NASA closely (correlation 0.97 to 0.98 at all three sites). Sunlight correlates 0.74 to 0.92.
- **We read sunlight about 4 to 6 points high on average** around all three sites. Sites 2 and 3 are the worst at the target itself: the pixel is a bright spot (NASA 77% and 64%) inside terrain that averages about 49% within 300 m, and our value of 79% and 77% sits at or above the bright spot. The causes we know of: our elevation map ends at 80 S, so terrain far to the north of sites 2 and 3 is missing from the skyline (see below); our observer is 2 m above the ground while NASA's is on the ground; and NASA's pixel is 60 m wide against our 80 m map. We have not separated the three.
- **Earth visibility differs by up to 5 points** at a pixel (site02: 62.1 against 67.4). NASA counts Earth as visible if any part of its disc is clear, we count it only when its centre is clear, so we should read lower.
- **Years differ.** NASA averages 18.6 years, we compute 2027 only. The Sun's yearly height range is similar every year, but a single year can sit above or below the long-term average.

So the three sites are ranked the same way by both sources (site02 and site03 far brighter than site01), and site01 agrees closely in absolute value. For sites 2 and 3, treat our sunlight as an upper bound.

## Power estimate

For the chosen landing date the site turns the result into two rough sizes:

- **Battery** = power draw × longest dark stretch of the stay (cautious reading), at 150 Wh per kg.
- **Solar panel** = power draw ÷ average visible share of the Sun over the stay ÷ (1,361 W/m² × 28% cell efficiency), for a panel that turns to face the Sun.

Losses, heaters and safety margins are left out. The preset power values (3,000 W crew, 300 W robot) are examples, not real mission figures.

## What this tool does not see

- **Rocks and small craters.** The elevation map has 80 m pixels.
- **Temperature.** We report hours of darkness, which drives the cold, but we do not model heat.
- **Other years.** Only 2027 is computed, and polar lighting shifts from year to year.
- **The exact shape of the terrain edge across the Sun.** The disc is cut by a level line.
- **A working radio link.** "Earth in view" means line of sight. Ground stations and Earth's phase are not modelled.
- **Fine direction sampling in the painted map.** It checks every 1° instead of every 0.5°, so its counts can differ from the single-point verdict by a few dates.

## Data sources

- **LOLA average illumination and Earth visibility maps**, `AVGVISIB_85S_060M_201608.TIF` and `AVGVISIB_85S_060M_201608_EARTH.TIF`, 60 m per pixel, Mazarico et al. (2011), *Icarus* 211, 1066-1081, https://doi.org/10.1016/j.icarus.2010.10.030, used only for the comparison above: https://pgda.gsfc.nasa.gov/products/69
- **LOLA south pole elevation map**, `LDEM_80S_80MPP_ADJ.TIF`, 80 m per pixel, from NASA Goddard's Planetary Geodesy Data Archive: https://pgda.gsfc.nasa.gov/products/90
- **Candidate site coordinates** for site02 (Nobile Rim 1, point NR103: 85.5456° S, 37.5572° E) and site03 (Mons Malapert, point MMA_K2023: 85.9919° S, 2.0564° E), from the landing-site shapefile that accompanies Wueller et al. (2026), *Journal of Geophysical Research: Planets*, https://doi.org/10.1029/2025JE009434 (data: https://doi.org/10.5281/zenodo.17084058, CC BY 4.0). Both lie in NASA's October 2024 Artemis III candidate regions (https://ntrs.nasa.gov/citations/20250011660). Site01 is Connecting Ridge, from NASA's 2022 candidate list.
- **JPL Horizons**, for the apparent azimuth and elevation of the Sun and Earth from a site on the Moon: https://ssd.jpl.nasa.gov/horizons/
- **three.js** (MIT licence) for the 3D view.

We are not affiliated with or endorsed by NASA.

## Use of AI tools

Most of the code and the wording were drafted with an AI assistant (Claude) and then run, tested and reviewed by the team. The idea, the scope, the choice of sites and every run on NASA data are ours. The full list is in `AI_USAGE.md`.

## Sites computed

- site01 Connecting Ridge (89.4632 S, 222.51 E)
- site02 Nobile Rim 1 (85.5456 S, 37.5572 E)
- site03 Mons Malapert (85.9919 S, 2.0564 E)

Coordinates for sites 2 and 3 come from the dataset of Wueller et al. (2026, JGR Planets). These two sites are about 135 km from the pole and our elevation map ends at 80 S, so terrain far to their north is missing from the skyline search and their sunlight may read slightly high.
