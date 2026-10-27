"""Bake the map data the game loads: data/nyc.bin (Manhattan) and data/world.bin (the world map).

Inputs (see ../README.md for how to fetch them):
  RAW/region-areas.parquet      Overture divisions, counties around NYC
  RAW/region-land.parquet       Overture base land (coastline based) around NYC
  RAW/region-water.parquet      Overture base water around NYC (rivers, lakes)
  RAW/nyc-building.parquet      Overture buildings
  RAW/nyc-building_part.parquet Overture building parts (setbacks, spires)
  RAW/nyc-landuse.parquet       Overture land use (parks)
  RAW/nyc-water.parquet         Overture water (lakes, the reservoir)
  RAW/countries50.geojson       Natural Earth 1:50m countries (npm world-atlas)
  RAW/borders50.geojson         their shared borders

Usage: python3 build_map.py RAW_DIR OUT_DIR
"""
import sys, json, math, struct, hashlib
import numpy as np, shapely, pyarrow.parquet as pq
from shapely.geometry import box, shape, Polygon, MultiPolygon
from shapely.ops import polylabel, unary_union

RAW, OUT = sys.argv[1], sys.argv[2]

# Projection shared with the game: Web Mercator scaled so 1 unit is 1 metre at New York, origin at Times Square.
LAT0, LON0 = 40.7580, -73.9855
R = 6378137.0
K = math.cos(math.radians(LAT0))
def merc_y(lat): return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
Y0 = merc_y(LAT0)
def project(lon, lat):
    return R * K * math.radians(lon - LON0), -R * K * (merc_y(lat) - Y0)  # x east, z south
def proj_geom(g):
    return shapely.transform(g, lambda c: np.array([project(x, y) for x, y in c]))

def polys(g):
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, MultiPolygon): return list(g.geoms)
    return [p for x in getattr(g, 'geoms', []) for p in polys(x)]

# ---------- tiny binary container: u32 header length, JSON header, then 8-byte aligned arrays ----------
def write_bin(path, arrays):
    head, blobs, off = {}, [], 0
    for name, a in arrays.items():
        a = np.ascontiguousarray(a)
        b = a.tobytes(); pad = (-len(b)) % 8
        head[name] = [str(a.dtype), off, a.size]
        blobs.append(b + b'\0' * pad); off += len(b) + pad
    h = json.dumps(head).encode(); h += b' ' * ((-len(h) - 4) % 8)
    with open(path, 'wb') as f:
        f.write(struct.pack('<I', len(h))); f.write(h)
        for b in blobs: f.write(b)

def poly_layer(name, ps, out):
    """Polygons with holes: NAME.r = [count, (rings, len, len, ...)...], NAME.xy = float32 x,z pairs."""
    r, xy = [len(ps)], []
    for p in ps:
        rings = [p.exterior] + list(p.interiors)
        r.append(len(rings))
        for ring in rings:
            c = np.asarray(ring.coords)[:-1]
            r.append(len(c)); xy.append(c)
    out[name + '.r'] = np.array(r, dtype=np.uint32)
    out[name + '.xy'] = np.concatenate(xy).astype(np.float32).ravel() if xy else np.zeros(0, np.float32)

# ---------- region: real coastlines around New York ----------
areas = pq.read_table(f'{RAW}/region-areas.parquet').to_pylist()
name = lambda r: (r['names'] or {}).get('primary')
REGION_BOX = box(-74.40, 40.40, -73.50, 41.10)
# County shapes run out to the state line mid-river, so the real shoreline comes from the coastline land minus big rivers and lakes.
land_rows = pq.read_table(f'{RAW}/region-land.parquet', columns=['geometry', 'subtype', 'class']).to_pylist()
coast = unary_union([shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] == 'land'])
wet = [shapely.from_wkb(r['geometry']) for r in pq.read_table(f'{RAW}/region-water.parquet', columns=['geometry', 'subtype']).to_pylist() if r['subtype'] in ('river', 'water', 'lake', 'reservoir', 'physical')]
wet = unary_union([w for w in wet if w.geom_type in ('Polygon', 'MultiPolygon') and w.area > 2e-6])
region_land = coast.intersection(REGION_BOX).difference(wet)
county = next(shapely.from_wkb(r['geometry']) for r in areas if r['subtype'] == 'county' and r['class'] == 'land' and name(r) == 'New York County')
manhattan = county.intersection(region_land)

# ---------- buildings ----------
shapely.prepare(county)
def load(path, cols):
    t = pq.read_table(path, columns=cols)
    g = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False))
    keep = shapely.contains(county, shapely.centroid(g))
    return [dict(r, geom=gg) for r, gg, k in zip(t.drop(['geometry']).to_pylist(), g, keep) if k]
bld = load(f'{RAW}/nyc-building.parquet', ['id', 'geometry', 'height', 'num_floors', 'min_height', 'facade_color'])
parts = load(f'{RAW}/nyc-building_part.parquet', ['id', 'geometry', 'height', 'num_floors', 'min_height', 'building_id', 'facade_color'])
by_id = {b['id']: b for b in bld}
with_parts = {p['building_id'] for p in parts if p['building_id'] in by_id}

def h_of(r, fallback):
    if r['height']: return float(r['height'])
    if r['num_floors']: return float(r['num_floors']) * 3.6
    return fallback
LOW = ['#9b6a55', '#a8735a', '#7d5b4a', '#c9b79c', '#9a9a96', '#d8d4cc', '#b38b6d', '#8c7f73', '#cfc6b4']
HIGH = ['#5c7ea3', '#7d97b0', '#a7adb3', '#4a6078', '#c8bfae', '#d9d9d4', '#6d8aa8', '#b9c3cc', '#8f9aa5']
def colour(key, h, given):
    n = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
    base = (HIGH if h > 60 else LOW)[n % len(HIGH if h > 60 else LOW)]
    if not (given and given.startswith('#') and len(given) == 7): return base
    # mapped facade colours are often pure black or neon; pull them halfway to the palette and keep them light enough to read
    g = [int(given[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(base[i:i + 2], 16) for i in (1, 3, 5)]
    c = [(x + y) / 2 for x, y in zip(g, b)]
    lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    if lum < 90: c = [x + (90 - lum) for x in c]
    return '#%02x%02x%02x' % tuple(min(255, round(x)) for x in c)

recs = []  # (exterior coords projected, height, min_height, colour)
def add(geom, h, mh, col):
    for p in polys(proj_geom(geom)):
        p = p.simplify(0.6, preserve_topology=True)
        if p.is_empty or p.area < 8: continue
        for q in polys(p):
            q = shapely.geometry.polygon.orient(Polygon(q.exterior), 1.0)  # outline only, counter-clockwise
            recs.append((np.asarray(q.exterior.coords)[:-1], h, mh, col))
for b in bld:
    if b['id'] in with_parts: continue  # its parts describe it better
    h = h_of(b, 12.0)
    add(b['geom'], h, float(b['min_height'] or 0), colour(b['id'], h, b['facade_color']))
for p in parts:
    parent = by_id.get(p['building_id'])
    ph = h_of(parent, 12.0) if parent else 12.0
    h = h_of(p, ph)
    add(p['geom'], h, float(p['min_height'] or 0), colour(p['building_id'] or p['id'], ph, p['facade_color'] or (parent or {}).get('facade_color')))

n = np.array([len(c) for c, *_ in recs], dtype=np.uint16)
xy = np.concatenate([c for c, *_ in recs])
q = np.round(xy * 2)  # half-metre steps
assert np.abs(q).max() < 32767, 'Manhattan no longer fits in int16'
nyc = {
    'b.n': n,
    'b.h': np.array([min(65535, round(h * 10)) for _, h, _, _ in recs], dtype=np.uint16),
    'b.mh': np.array([min(65535, round(m * 10)) for _, _, m, _ in recs], dtype=np.uint16),
    'b.c': np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for *_, c in recs], dtype=np.uint8).ravel(),
    'b.xy': q.astype(np.int16).ravel(),
}

# ---------- Manhattan ground: land, parks, lakes ----------
man_p = proj_geom(manhattan).simplify(1.0)
poly_layer('land', polys(man_p), nyc)
lu = pq.read_table(f'{RAW}/nyc-landuse.parquet', columns=['geometry', 'subtype', 'class']).to_pylist()
PARK = {('park', 'park'), ('park', 'dog_park'), ('recreation', 'recreation_ground'), ('cemetery', 'cemetery'), ('managed', 'grass'), ('recreation', 'pitch'), ('golf', 'fairway')}
woods = unary_union([shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] in ('forest', 'shrub', 'grass') and r['class'] not in ('shrub',)]).intersection(manhattan)
green = unary_union([shapely.from_wkb(r['geometry']) for r in lu if (r['subtype'], r['class']) in PARK] + [woods]).intersection(manhattan)
green = [p for p in polys(proj_geom(green).simplify(1.5)) if p.area > 1500]
poly_layer('park', green, nyc)
wt = pq.read_table(f'{RAW}/nyc-water.parquet', columns=['geometry', 'subtype', 'class']).to_pylist()
lakes = unary_union([shapely.from_wkb(r['geometry']) for r in wt if r['subtype'] in ('water', 'pond', 'reservoir', 'lake') and r['class'] not in ('wastewater',)]).intersection(manhattan)
inland = proj_geom(manhattan).buffer(-15)
lakes = [p for p in polys(proj_geom(lakes).simplify(1.5)) if p.area > 800 and p.within(inland)]
poly_layer('lake', lakes, nyc)
# trees: every mapped tree, plus woods filled in at roughly one tree per 70 m²
rng = np.random.default_rng(7)
pts = [project(g.x, g.y) for g in (shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] == 'tree' and r['class'] == 'tree') if county.contains(g)]
wp = proj_geom(unary_union([shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] == 'forest']).intersection(manhattan))
for p in polys(wp):
    x0, z0, x1, z1 = p.bounds
    cand = rng.uniform([x0, z0], [x1, z1], size=(int(p.envelope.area / 70), 2))
    pts += [tuple(c) for c in cand[shapely.contains_xy(p, cand[:, 0], cand[:, 1])]]
nyc['t.xy'] = np.round(np.array(pts) * 2).astype(np.int16).ravel()
nyc['t.s'] = rng.integers(0, 256, len(pts)).astype(np.uint8)
write_bin(f'{OUT}/nyc.bin', nyc)
print('nyc.bin: %d building pieces, %d points, %d parks, %d lakes, %d trees' % (len(recs), len(xy), len(green), len(lakes), len(pts)))

# ---------- the world ----------
CLIP = box(-180, -58, 180, 82)  # Mercator can't do the poles
fc = json.load(open(f'{RAW}/countries50.geojson'))['features']
land, labels = [], []
for f in fc:
    g = shape(f['geometry']).buffer(0).intersection(CLIP)
    if g.is_empty: continue
    big = max(polys(g), key=lambda p: p.area)
    lp = polylabel(big, 0.05)
    x, z = project(lp.x, lp.y)
    labels.append([f['properties']['name'], round(x), round(z), round(proj_geom(g).area / 1e6)])
    land.append(g.difference(REGION_BOX))
world_land = [p.simplify(1200) for p in polys(proj_geom(unary_union(land)))]
world_land = [p for p in world_land if not p.is_empty and p.area > 4e6]
region = [p for p in polys(proj_geom(region_land).simplify(15)) if p.area > 2e4]
world = {}
poly_layer('world', world_land, world)
poly_layer('region', region, world)
bl = shape(json.load(open(f'{RAW}/borders50.geojson')))
lines = [l for l in getattr(bl, 'geoms', [bl])]
lr, lxy = [len(lines)], []
for l in lines:
    l = l.intersection(CLIP)
    for s in getattr(l, 'geoms', [l]):
        if s.is_empty or s.geom_type != 'LineString': continue
        c = np.asarray(proj_geom(s).simplify(1200).coords)
        lr.append(len(c)); lxy.append(c)
lr[0] = len(lr) - 1
world['border.r'] = np.array(lr, dtype=np.uint32)
world['border.xy'] = np.concatenate(lxy).astype(np.float32).ravel()
write_bin(f'{OUT}/world.bin', world)
labels.sort(key=lambda l: -l[3])
json.dump(labels, open(f'{OUT}/countries.json', 'w'), separators=(',', ':'))
print('world.bin: %d land polygons, %d region polygons, %d border lines, %d labels' % (len(world_land), len(region), lr[0], len(labels)))
