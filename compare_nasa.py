"""Compare our 2027 sunlight / Earth-visibility averages with NASA's LOLA average maps.

NASA maps (Mazarico et al. 2011, https://pgda.gsfc.nasa.gov/products/69) are averages
over one lunar nutation cycle (~18.6 years), 60 m per pixel, 85-90 S.

Usage: python compare_nasa.py [--sites site01 site02 site03]
"""
import argparse, json
import numpy as np
import rasterio
from horizon import latlon_to_xy

SUN_TIF = "AVGVISIB_85S_060M_201608.TIF"
EARTH_TIF = "AVGVISIB_85S_060M_201608_EARTH.TIF"


class Nasa:
    def __init__(self, path):
        with rasterio.open(path) as ds:
            raw = ds.read(1).astype(np.float64)
            self.a = np.where(raw == ds.nodata, np.nan, raw * ds.scales[0] + ds.offsets[0])
            self.inv = ~ds.transform

    def at(self, lat, lon, radius_m=0.0):
        """Mean over pixels within radius_m of the point (0 = the single pixel)."""
        x, y = latlon_to_xy(lat, lon)
        c, r = self.inv * (x, y)
        c, r = int(c), int(r)
        n = int(np.ceil(radius_m / 60.0))
        win = self.a[r - n:r + n + 1, c - n:c + n + 1]
        yy, xx = np.mgrid[-n:n + 1, -n:n + 1]
        win = win[(yy ** 2 + xx ** 2) * 60.0 ** 2 <= max(radius_m, 1) ** 2]
        return float(np.nanmean(win)) * 100.0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--sites", nargs="+", default=["site01", "site02", "site03"])
    p.add_argument("--out", default="nasa_compare.json")
    args = p.parse_args()
    sun, earth = Nasa(SUN_TIF), Nasa(EARTH_TIF)
    out = {}
    for s in args.sites:
        site = json.load(open(f"{s}.json"))["site"]
        tl = json.load(open(f"timeline_{s}.json"))
        ours_sun = 100 * np.mean(tl["sun"])
        ours_sun_c = 100 * np.mean(np.array(tl["sun"]) > 0.5)   # Sun's centre clear
        ours_earth = 100 * np.mean(tl["earth"])
        lat, lon = site["lat"], site["lon"]
        scan = json.load(open(f"scan_{s}.json"))["points"]
        o = np.array([q["sun_pct"] for q in scan])
        n = np.array([sun.at(q["lat"], q["lon"], 60) for q in scan])
        oe = np.array([q["earth_pct"] for q in scan])
        ne = np.array([earth.at(q["lat"], q["lon"], 60) for q in scan])
        out[s] = dict(
            lat=lat, lon=lon,
            sun_ours_disc=ours_sun, sun_ours_centre=ours_sun_c,
            sun_nasa_pixel=sun.at(lat, lon), sun_nasa_300m=sun.at(lat, lon, 300),
            earth_ours=ours_earth,
            earth_nasa_pixel=earth.at(lat, lon), earth_nasa_300m=earth.at(lat, lon, 300),
            scan_n=int(np.isfinite(n).sum()),
            scan_sun_corr=float(np.corrcoef(o[np.isfinite(n)], n[np.isfinite(n)])[0, 1]),
            scan_sun_mean_diff=float(np.nanmean(o - n)),
            scan_sun_mae=float(np.nanmean(np.abs(o - n))),
            scan_earth_corr=float(np.corrcoef(oe[np.isfinite(ne)], ne[np.isfinite(ne)])[0, 1]),
            scan_earth_mean_diff=float(np.nanmean(oe - ne)),
        )
        print(s, json.dumps({k: round(v, 2) if isinstance(v, float) else v for k, v in out[s].items()}))
    json.dump(out, open(args.out, "w"), indent=1)


if __name__ == "__main__":
    main()
