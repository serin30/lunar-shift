"""
test_horizon.py - checks horizon.py against cases where the right answer is known.

AI disclosure: drafted with an AI coding assistant (Claude), reviewed by the team.

Run:  python test_horizon.py
No NASA data is needed: every test builds a small made-up Moon whose correct
horizon can be worked out by hand.
"""

import numpy as np
from affine import Affine

import horizon as hz

PIXEL = 400.0                      # metres per pixel of the made-up maps
HALF = 310_000.0                   # map covers +-310 km around the pole
N = int(2 * HALF / PIXEL)
TRANSFORM = Affine(PIXEL, 0, -HALF, 0, -PIXEL, HALF)


def make_dem(height_fn):
    """Build a map by calling height_fn(lat, lon) for every pixel centre."""
    cols = (np.arange(N) + 0.5) * PIXEL - HALF
    rows = HALF - (np.arange(N) + 0.5) * PIXEL
    x, y = np.meshgrid(cols, rows)
    r = np.hypot(x, y)
    lat = np.degrees(2.0 * np.arctan(r / (2.0 * hz.R_MOON)) - np.pi / 2.0)
    lon = np.degrees(np.arctan2(x, y))
    return hz.Dem(height_fn(lat, lon), TRANSFORM, name="synthetic")


def great_circle_m(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dl = np.radians(lon2 - lon1)
    c = np.sin(p1) * np.sin(p2) + np.cos(p1) * np.cos(p2) * np.cos(dl)
    return hz.R_MOON * np.arccos(np.clip(c, -1, 1))


def test_projection_roundtrip():
    # A point at latitude -80 must sit 2R*tan(5 deg) from the pole.
    x, y = hz.latlon_to_xy(-80.0, 90.0)
    assert abs(x - 2 * hz.R_MOON * np.tan(np.radians(5))) < 1e-6 and abs(y) < 1e-6
    print("ok  projection: latitude -80 is %.1f km from the pole" % (x / 1000))


def test_smooth_moon():
    # On a perfectly smooth Moon the horizon dips below level by acos(R / (R + mast)).
    dem = make_dem(lambda lat, lon: np.zeros_like(lat))
    for mast in (2.0, 100.0):
        prof = hz.horizon_profile(dem, -88.0, 40.0, mast_m=mast)
        want = -np.degrees(np.arccos(hz.R_MOON / (hz.R_MOON + mast)))
        got = np.array(prof["horizon_deg"])
        assert np.all(np.abs(got - want) < 0.005), (got.min(), got.max(), want)
        print("ok  smooth Moon, mast %5.0f m: horizon %.4f deg (expected %.4f)" % (mast, got.mean(), want))


def test_ring_wall():
    # A 3 km high wall, 50 to 54 km from the site in every direction.
    site = (-87.0, 200.0)
    wall_h, d_in, d_out = 3000.0, 50_000.0, 54_000.0

    def heights(lat, lon):
        d = great_circle_m(site[0], site[1], lat, lon)
        return np.where((d >= d_in) & (d <= d_out), wall_h, 0.0)

    prof = hz.horizon_profile(make_dem(heights), *site, mast_m=2.0)
    def wall_angle(d):
        theta = d / hz.R_MOON
        return np.degrees(np.arctan2((hz.R_MOON + wall_h) * np.cos(theta) - (hz.R_MOON + 2.0),
                                     (hz.R_MOON + wall_h) * np.sin(theta)))

    # A map made of 400 m pixels cannot place the wall's edge better than about
    # two pixels, so the answer must lie between the exact edge and 2.5 pixels behind it.
    want_hi, want_lo = wall_angle(d_in), wall_angle(d_in + 2.5 * PIXEL)
    got = np.array(prof["horizon_deg"])
    assert np.all((got <= want_hi + 0.002) & (got >= want_lo - 0.002)), (got.min(), got.max(), want_lo, want_hi)
    dist = np.array(prof["horizon_dist_km"])
    assert np.all((dist >= 49.9) & (dist <= 51.1)), (dist.min(), dist.max())
    print("ok  ring wall: horizon %.3f to %.3f deg (allowed %.3f to %.3f), found %.1f km away"
          % (got.min(), got.max(), want_lo, want_hi, dist.mean()))


def test_directions():
    # One mountain due north of the site and a taller one due east of it.
    site = (-85.0, 30.0)
    north = hz.destination(site[0], site[1], 0.0, 40_000.0)
    east = hz.destination(site[0], site[1], 90.0, 40_000.0)
    assert north[0] > site[0] and abs(north[1] - site[1]) < 1e-6      # nearer the north pole
    assert east[1] > site[1]                                          # larger east longitude

    def heights(lat, lon):
        dn = great_circle_m(north[0], north[1], lat, lon)
        de = great_circle_m(east[0], east[1], lat, lon)
        return 2000.0 * np.exp(-(dn / 3000.0) ** 2) + 4000.0 * np.exp(-(de / 3000.0) ** 2)

    prof = hz.horizon_profile(make_dem(heights), *site, mast_m=2.0)
    az = np.array(prof["az_deg"])
    h = np.array(prof["horizon_deg"])
    peak_east = az[np.argmax(h)]
    near_north = (az < 20) | (az > 340)
    peak_north = az[near_north][np.argmax(h[near_north])]
    assert abs(peak_east - 90.0) <= 1.0, peak_east
    assert min(peak_north, 360 - peak_north) <= 1.0, peak_north
    print("ok  directions: north mountain at azimuth %.1f, east mountain at azimuth %.1f" % (peak_north, peak_east))


def test_sun_fraction():
    prof = {"az_deg": [0.0, 90.0, 180.0, 270.0], "horizon_deg": [1.0, 1.0, 1.0, 1.0]}
    r = hz.SUN_RADIUS_DEG
    f = hz.sun_visible_fraction(prof, [10, 10, 10, 10, 10], [1.0 + r, 1.0, 1.0 - r, 1.0 + r / 2, 3.0])
    assert abs(f[0] - 1) < 1e-9 and abs(f[1] - 0.5) < 1e-9 and abs(f[2]) < 1e-9 and abs(f[4] - 1) < 1e-9
    assert abs(f[3] - 0.8045) < 1e-3, f[3]         # half a radius above: 80.45 % of the disc
    assert bool(hz.earth_visible(prof, 45.0, 1.2)) and not bool(hz.earth_visible(prof, 45.0, 0.8))
    print("ok  Sun disc: centre on the horizon shows 50 %%, half a radius above shows %.1f %%" % (100 * f[3]))


if __name__ == "__main__":
    test_projection_roundtrip()
    test_smooth_moon()
    test_ring_wall()
    test_directions()
    test_sun_fraction()
    print("\nAll checks passed.")
