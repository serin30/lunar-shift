"""
horizon.py - terrain horizon seen from a point near the lunar south pole.

AI disclosure: this file was drafted with an AI coding assistant (Claude) during
the NASA Space Apps 2026 hackathon and then reviewed and tested by the team.

What it does
------------
From one site (latitude, longitude) it looks outward in every compass direction
and finds how high the terrain rises above the level horizon in that direction.
The result is the "horizon profile": one elevation angle per azimuth.
The Sun or Earth is visible only when it is above that profile.

Input data
----------
A LOLA elevation map (GeoTIFF) in south polar stereographic projection, for example
LDEM_80S_80MPP_ADJ.TIF from NASA PGDA. Pixel values are heights in metres relative
to a sphere of radius 1737.4 km.

Usage
-----
    python horizon.py LDEM_80S_80MPP_ADJ.TIF --lat -89.46 --lon 222.51 --mast 2 --out site01.json

Azimuth convention: 0 = toward the lunar north pole, 90 = toward increasing east
longitude. This is the same convention JPL Horizons uses for azimuth.
"""

import argparse
import json

import numpy as np
from scipy.ndimage import map_coordinates

R_MOON = 1737400.0          # metres; reference sphere of the LOLA maps
SUN_RADIUS_DEG = 0.2666     # mean angular radius of the Sun seen from the Moon


# ---------------------------------------------------------------- map projection

def latlon_to_xy(lat_deg, lon_deg):
    """Latitude/longitude (degrees) -> south polar stereographic x, y (metres).

    The pole is at (0, 0). Longitude 0 points along +y, longitude 90E along +x.
    """
    lat = np.radians(lat_deg)
    lon = np.radians(lon_deg)
    r = 2.0 * R_MOON * np.tan(np.pi / 4.0 + lat / 2.0)
    return r * np.sin(lon), r * np.cos(lon)


def destination(lat_deg, lon_deg, az_deg, dist_m):
    """Walk dist_m along the sphere from (lat, lon) in direction az. Returns lat, lon (degrees)."""
    lat1 = np.radians(lat_deg)
    lon1 = np.radians(lon_deg)
    az = np.radians(az_deg)
    delta = dist_m / R_MOON
    sin_lat2 = np.sin(lat1) * np.cos(delta) + np.cos(lat1) * np.sin(delta) * np.cos(az)
    lat2 = np.arcsin(np.clip(sin_lat2, -1.0, 1.0))
    lon2 = lon1 + np.arctan2(np.sin(az) * np.sin(delta) * np.cos(lat1),
                             np.cos(delta) - np.sin(lat1) * sin_lat2)
    return np.degrees(lat2), np.degrees(lon2)


# ---------------------------------------------------------------- elevation map

class Dem:
    """Elevation map held in memory, with a lookup by latitude/longitude."""

    def __init__(self, heights, transform, nodata=None, name=""):
        self.h = np.asarray(heights, dtype=np.float32)
        if nodata is not None:
            self.h = np.where(self.h == nodata, np.nan, self.h)
        self.inv = ~transform                 # map metres -> (column, row)
        self.pixel_m = abs(transform.a)
        self.name = name

    @classmethod
    def open(cls, path):
        import rasterio
        with rasterio.open(path) as ds:
            dem = cls(ds.read(1), ds.transform, ds.nodata, name=str(path))
            dem.projection_error_m = _projection_check(ds)
        return dem

    def height(self, lat_deg, lon_deg):
        """Height in metres at the given points (bilinear). NaN outside the map."""
        x, y = latlon_to_xy(lat_deg, lon_deg)
        col, row = self.inv * (x, y)
        # pixel centres are at integer + 0.5 in (column, row) space
        row = np.atleast_1d(np.asarray(row, dtype=float))
        col = np.atleast_1d(np.asarray(col, dtype=float))
        out = map_coordinates(self.h, np.array([row - 0.5, col - 0.5]),
                              order=1, mode="constant", cval=np.nan)
        return out.reshape(np.shape(lat_deg))


def _projection_check(ds):
    """Compare our projection formula with the file's own map definition.

    Returns the largest disagreement in metres, or None if the file has no
    map definition to compare with. A large value means the file is not in
    the projection this code assumes.
    """
    if ds.crs is None:
        return None
    try:
        from rasterio.warp import transform
        lats = [-89.5, -87.0, -85.0, -82.0]
        lons = [10.0, 123.0, 222.0, 300.0]
        xs, ys = transform("+proj=longlat +R=1737400 +no_defs", ds.crs, lons, lats)
        mx, my = latlon_to_xy(np.array(lats), np.array(lons))
        return float(np.max(np.hypot(np.array(xs) - mx, np.array(ys) - my)))
    except Exception:
        return None


# ---------------------------------------------------------------- horizon

def sample_distances(pixel_m, max_km=300.0, near_km=20.0, growth=1.004):
    """Distances (metres) at which the terrain is sampled along each direction.

    Every pixel out to near_km, then steps that grow by 0.4 % each time.
    Far terrain is wide in angle, so coarser steps there lose very little.
    """
    near = np.arange(pixel_m, near_km * 1000.0, pixel_m)
    n = int(np.ceil(np.log(max_km / near_km) / np.log(growth))) + 1
    far = np.geomspace(near_km * 1000.0, max_km * 1000.0, n)
    return np.concatenate([near, far])


def horizon_profile(dem, lat_deg, lon_deg, mast_m=2.0, az_step_deg=0.5, max_km=300.0):
    """Terrain horizon around one site.

    mast_m is the height of the eye / solar panel / antenna above the ground.
    Returns a dict with the azimuths, the horizon elevation angle for each
    azimuth (degrees) and the distance to the terrain that sets it (km).
    """
    ground = float(dem.height(lat_deg, lon_deg))
    if np.isnan(ground):
        raise ValueError("Site is outside the elevation map.")
    r_obs = R_MOON + ground + mast_m

    az = np.arange(0.0, 360.0, az_step_deg)
    dist = sample_distances(dem.pixel_m, max_km)
    az_grid, d_grid = np.meshgrid(az, dist, indexing="ij")      # (n_az, n_dist)

    lat2, lon2 = destination(lat_deg, lon_deg, az_grid, d_grid)
    h = dem.height(lat2, lon2)

    # Exact geometry on a sphere. theta is the angle at the Moon's centre between
    # the observer and the terrain point; no flat-ground approximation is used.
    theta = d_grid / R_MOON
    r_t = R_MOON + h
    elev = np.degrees(np.arctan2(r_t * np.cos(theta) - r_obs, r_t * np.sin(theta)))

    elev = np.where(np.isnan(elev), -np.inf, elev)              # ignore points off the map
    best = np.argmax(elev, axis=1)
    rows = np.arange(len(az))
    return {
        "site": {"lat": lat_deg, "lon": lon_deg, "ground_m": ground, "mast_m": mast_m},
        "dem": {"file": dem.name, "pixel_m": dem.pixel_m, "max_km": max_km},
        "az_deg": az.tolist(),
        "horizon_deg": np.round(elev[rows, best], 4).tolist(),
        "horizon_dist_km": np.round(dist[best] / 1000.0, 2).tolist(),
    }


# ---------------------------------------------------------------- visibility

def horizon_at(profile, az_deg):
    """Horizon elevation (degrees) at any azimuth, interpolated around the full circle."""
    az = np.asarray(profile["az_deg"])
    hz = np.asarray(profile["horizon_deg"])
    return np.interp(np.mod(az_deg, 360.0), np.append(az, 360.0), np.append(hz, hz[0]))


def sun_visible_fraction(profile, sun_az_deg, sun_el_deg, sun_radius_deg=SUN_RADIUS_DEG):
    """Fraction of the Sun's disc above the terrain, from 0 to 1.

    The Sun is a disc about 0.53 degrees wide. Near the pole it skims the
    horizon, so "partly hidden" is the normal case and matters for power.
    Approximation: the terrain edge is treated as a level line across the disc.
    """
    k = (np.asarray(sun_el_deg) - horizon_at(profile, sun_az_deg)) / sun_radius_deg
    k = np.clip(k, -1.0, 1.0)
    return 0.5 + (k * np.sqrt(1.0 - k * k) + np.arcsin(k)) / np.pi


def earth_visible(profile, earth_az_deg, earth_el_deg, margin_deg=0.0):
    """True when the centre of Earth is above the terrain by at least margin_deg."""
    return np.asarray(earth_el_deg) > horizon_at(profile, earth_az_deg) + margin_deg


# ---------------------------------------------------------------- command line

def main():
    p = argparse.ArgumentParser(description="Terrain horizon profile for a lunar south pole site.")
    p.add_argument("dem", help="LOLA elevation GeoTIFF, south polar stereographic")
    p.add_argument("--lat", type=float, required=True, help="latitude in degrees (south is negative)")
    p.add_argument("--lon", type=float, required=True, help="east longitude in degrees")
    p.add_argument("--mast", type=float, default=2.0, help="height above ground in metres")
    p.add_argument("--max-km", type=float, default=300.0, help="how far to search for terrain")
    p.add_argument("--out", required=True, help="output JSON file")
    a = p.parse_args()

    dem = Dem.open(a.dem)
    err = getattr(dem, "projection_error_m", None)
    if err is None:
        print("Projection check: the file has no map definition to compare with.")
    else:
        print(f"Projection check: our formula and the file agree to {err:.2f} m.")
        if err > dem.pixel_m:
            print("WARNING: that is more than one pixel. Do not trust the result.")

    prof = horizon_profile(dem, a.lat, a.lon, a.mast, max_km=a.max_km)
    hz = np.array(prof["horizon_deg"])
    print(f"Ground height at site: {prof['site']['ground_m']:.1f} m")
    print(f"Horizon: lowest {hz.min():.2f} deg, highest {hz.max():.2f} deg, "
          f"farthest blocking terrain {max(prof['horizon_dist_km']):.0f} km away")
    with open(a.out, "w") as f:
        json.dump(prof, f)
    print("Saved", a.out)


if __name__ == "__main__":
    main()
