"""Bake the map data the game loads: data/<city>.bin and data/<city>-streets.json for each city, plus
data/world.bin and data/countries.json (the world map, in degrees, projected by the game around whichever city you're in).

Inputs (see ../README.md for how to fetch them), per city in CITIES below:
  buildings, building parts, coastline land and water around the city, land use (parks), water, street segments
and for the world:
  RAW/countries50.geojson, RAW/borders50.geojson   Natural Earth 1:50m countries (npm world-atlas)

Usage: python3 build_map.py RAW_DIR OUT_DIR [city ...]   (no city: all of them, and the world)
"""
import sys, json, math, struct, hashlib, os
import numpy as np, shapely, pyarrow.parquet as pq
from shapely.geometry import box, shape, Polygon, MultiPolygon
from shapely.ops import polylabel, unary_union

RAW, OUT = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3:]

# Each city: the game's origin (1 unit = 1 metre there), the box whose buildings are baked, a wider box for the coastline,
# and where its raw files are. New York is clipped to Manhattan; the others to their box.
CITIES = {
    'nyc': dict(origin=(40.7580, -73.9855), box=(-74.03, 40.69, -73.90, 40.885), region=(-74.40, 40.40, -73.50, 41.10), dir='.', prefix='nyc-', regionprefix='region-', county='New York County'),
    'london': dict(origin=(51.5133, -0.0890), box=(-0.135, 51.495, 0.000, 51.528), region=(-0.55, 51.33, 0.40, 51.68), dir='cities/london'),
    'tokyo': dict(origin=(35.6812, 139.7671), box=(139.742, 35.660, 139.785, 35.697), region=(139.55, 35.45, 140.05, 35.82), dir='cities/tokyo'),
    'hongkong': dict(origin=(22.2820, 114.1588), box=(114.145, 22.270, 114.190, 22.305), region=(113.95, 22.17, 114.35, 22.45), dir='cities/hongkong'),
    'dubai': dict(origin=(25.1972, 55.2744), box=(55.255, 25.180, 55.305, 25.225), region=(55.10, 25.05, 55.45, 25.35), dir='cities/dubai'),
}

R = 6378137.0
LAT0 = LON0 = K = Y0 = 0.0
def merc_y(lat): return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
def set_origin(lat, lon):
    global LAT0, LON0, K, Y0
    LAT0, LON0, K, Y0 = lat, lon, math.cos(math.radians(lat)), merc_y(lat)
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

def bake_city(city, cfg):
    global GROUP
    GROUP = {}
    # ---------- region: real coastlines around New York ----------
    set_origin(*cfg['origin'])
    D, P, RP = f"{RAW}/{cfg['dir']}", cfg.get('prefix', ''), cfg.get('regionprefix', 'region-')
    REGION_BOX = box(*cfg['region'])
    # County shapes run out to the state line mid-river, so the real shoreline comes from the coastline land minus big rivers and lakes.
    land_rows = pq.read_table(f'{D}/{RP}land.parquet', columns=['geometry', 'subtype', 'class']).to_pylist()
    coast = unary_union([shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] == 'land'])
    wet = [shapely.from_wkb(r['geometry']) for r in pq.read_table(f'{D}/{RP}water.parquet', columns=['geometry', 'subtype']).to_pylist() if r['subtype'] in ('river', 'water', 'lake', 'reservoir', 'physical')]
    wet = unary_union([w for w in wet if w.geom_type in ('Polygon', 'MultiPolygon') and w.area > 2e-6])
    region_land = coast.intersection(REGION_BOX).difference(wet)
    if cfg.get('county'): # New York: Manhattan's real borough outline
        areas = pq.read_table(f'{D}/region-areas.parquet').to_pylist()
        county = next(shapely.from_wkb(r['geometry']) for r in areas if r['subtype'] == 'county' and r['class'] == 'land' and (r['names'] or {}).get('primary') == cfg['county'])
    else:
        county = box(*cfg['box'])
    manhattan = county.intersection(region_land)  # the city's playable land

    # ---------- buildings ----------
    shapely.prepare(county)
    def load(path, cols):
        t = pq.read_table(path, columns=cols)
        g = shapely.from_wkb(t.column('geometry').to_numpy(zero_copy_only=False))
        keep = shapely.contains(county, shapely.centroid(g))
        return [dict(r, geom=gg) for r, gg, k in zip(t.drop(['geometry']).to_pylist(), g, keep) if k]
    bld = load(f'{D}/{P}building.parquet', ['id', 'geometry', 'height', 'num_floors', 'min_height', 'facade_color', 'facade_material'])
    parts = load(f'{D}/{P}building_part.parquet', ['id', 'geometry', 'height', 'num_floors', 'min_height', 'building_id', 'facade_color', 'facade_material'])
    by_id = {b['id']: b for b in bld}
    with_parts = {p['building_id'] for p in parts if p['building_id'] in by_id}

    def h_of(r, fallback):
        if r['height']: return float(r['height'])
        if r['num_floors']: return float(r['num_floors']) * 3.6
        return fallback
    def hnum(key, salt=''):
        return int(hashlib.md5((key + salt).encode()).hexdigest()[:8], 16)

    # Facade styles, drawn by the game's shader: 0 glass window bands, 1 stone with punched windows, 2 brick walk-up, 3 all-glass tower
    PALETTE = {
        0: ['#d9d6cf', '#c9ccd1', '#e6e2d8', '#b9c0c8', '#d4c7b0', '#cfd3d6'],
        1: ['#e8dcc0', '#ece4d2', '#d9c49a', '#e6e2da', '#d8b878', '#cfc6b4', '#e9e9e6'],  # cream, ochre and white, like the reference
        2: ['#a3503c', '#9a4a38', '#b35e44', '#8c3f33', '#b8664a', '#a0573f', '#c9a15e'],
        3: ['#4d6f96', '#5a7fa6', '#3f5d7c', '#6b8fae', '#557a8c', '#46627e'],
    }
    def style_of(key, h, material):
        m = (material or '').lower()
        if 'glass' in m: return 3 if hnum(key, 's') % 3 == 0 else 0
        if 'brick' in m: return 2
        if m in ('stone', 'concrete', 'plaster', 'masonry', 'sandstone', 'limestone'): return 1
        r = hnum(key, 's') % 100
        if h >= 90: return 0 if r < 50 else 3 if r < 80 else 1
        if h >= 30: return 1 if r < 50 else 0 if r < 78 else 2
        return 2 if r < 70 else 1
    def colour(key, style, given):
        pal = PALETTE[style]
        base = pal[hnum(key) % len(pal)]
        if not (given and given.startswith('#') and len(given) == 7) or style == 3: return base
        # mapped facade colours are often pure black or neon: pull them toward the palette and keep them readable
        g = [int(given[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(base[i:i + 2], 16) for i in (1, 3, 5)]
        c = [(x + 2 * y) / 3 for x, y in zip(g, b)]
        lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
        if lum < 90: c = [x + (90 - lum) for x in c]
        return '#%02x%02x%02x' % tuple(min(255, round(x)) for x in c)

    rng = np.random.default_rng(7)
    recs = []   # outer ring, inner ring (parapet) or None, height, min height, colour, style
    roof = []   # rooftop things: type (0 plant room, 1 water tower, 2 chimney), x, z, base y, w, d, h, angle
    pitched = []  # pitched roofs: x, z, angle, length, width, base y, rise, ridge (1 gable, 0 hip), roof colour index, wall colour
    ROOF_COLS = ['#b5523b', '#4b4f57', '#7a4a33', '#8e3b2e', '#5d6168', '#4f8a6a']
    def axis_angle(poly):
        r = np.asarray(poly.minimum_rotated_rectangle.exterior.coords)
        e = r[1] - r[0] if np.hypot(*(r[1] - r[0])) >= np.hypot(*(r[2] - r[1])) else r[2] - r[1]
        return math.atan2(e[1], e[0]) % math.pi
    def rand_in(poly, margin, n=12):
        inner = poly.buffer(-margin)
        if inner.is_empty: return None
        x0, z0, x1, z1 = inner.bounds
        c = rng.uniform([x0, z0], [x1, z1], size=(n, 2))
        ok = c[shapely.contains_xy(inner, c[:, 0], c[:, 1])]
        return ok[0] if len(ok) else None
    GROUP = {}  # Overture building id -> building number, so all parts of one building can be bought together
    def add(geom, h, mh, key, given, material):
        gid = GROUP.setdefault(key, len(GROUP))
        style = style_of(key, h, material)
        col = colour(key, style, given)
        for p in polys(proj_geom(geom)):
            p = p.simplify(0.6, preserve_topology=True)
            if p.is_empty or p.area < 8: continue
            for q in polys(p):
                q = shapely.geometry.polygon.orient(Polygon(q.exterior), 1.0)  # outline only, counter-clockwise
                inner = None
                mrr = q.minimum_rotated_rectangle
                r = hnum(key, 'p') % 100
                if mh == 0 and h <= 40 and 50 < q.area < 1400 and (style in (1, 2) or h < 22) and q.area / max(mrr.area, 1) > 0.86 and r < 78:
                    # a pitched roof, like the reference's terraced houses: gable along the long side, hipped when squarish
                    rc = np.asarray(mrr.exterior.coords)[:4]
                    e1, e2 = rc[1] - rc[0], rc[2] - rc[1]
                    L, W = np.hypot(*e1), np.hypot(*e2)
                    ang = math.atan2(e1[1], e1[0])
                    if W > L: L, W, ang = W, L, math.atan2(e2[1], e2[0])
                    cx, cz = rc.mean(axis=0)
                    rise = min(6.0, max(1.6, W * 0.36))
                    gable = 1 if (L / W > 1.4 and r < 55) else 0
                    pitched.append((cx, cz, ang, L + 0.8, W + 0.8, h, rise, gable, hnum(key, 'c') % (len(ROOF_COLS) - (0 if r < 4 else 1)), col))
                    for k in range(1 + (L > 14)):  # chimneys on the ridge
                        off = (k - 0.5 * (L > 14)) * L * 0.5 + (rng.uniform(-0.15, 0.15) * L)
                        side = rng.uniform(-0.2, 0.2) * W
                        roof.append((2, cx + math.cos(ang) * off - math.sin(ang) * side, cz + math.sin(ang) * off + math.cos(ang) * side, h + rise * 0.55, 0.9, 0.9, rise * 0.45 + 1.4, ang))
                    recs.append((np.asarray(q.exterior.coords)[:-1], None, h, mh, col, style, gid))
                    continue
                if h - mh >= 10 and q.area >= 150:  # a parapet: a low rim around the roof
                    ib = q.buffer(-0.8, join_style=2)
                    ib = max(polys(ib), key=lambda g: g.area) if not ib.is_empty else None
                    if ib is not None and ib.area > 40:
                        inner = shapely.geometry.polygon.orient(Polygon(ib.simplify(0.3).exterior), 1.0)
                recs.append((np.asarray(q.exterior.coords)[:-1], None if inner is None else np.asarray(inner.exterior.coords)[:-1], h, mh, col, style, gid))
                top = inner if inner is not None else q
                ang, roofy = axis_angle(q), h - (1.2 if inner is not None else 0)
                r = hnum(key, 'r') % 100
                if style in (1, 2) and 18 < h < 80 and 250 < q.area < 3000 and r < 12:  # NYC water tower
                    c = rand_in(top, 4)
                    if c is not None: roof.append((1, c[0], c[1], roofy, 3.2 + (r % 4) * 0.3, 3.2, 8 + (r % 3), ang))
                if h > 20 and q.area > 400:  # plant rooms and lift overruns
                    for k in range(1 + (q.area > 1500) + (q.area > 4000)):
                        w = rng.uniform(3, min(12, math.sqrt(q.area) / 3)); d = rng.uniform(3, min(12, math.sqrt(q.area) / 3))
                        c = rand_in(top, max(w, d) / 2 + 0.6)
                        if c is not None: roof.append((0, c[0], c[1], roofy, w, d, rng.uniform(2.5, 5), ang))
    for b in bld:
        if b['id'] in with_parts: continue  # its parts describe it better
        add(b['geom'], h_of(b, 12.0), float(b['min_height'] or 0), b['id'], b['facade_color'], b['facade_material'])
    for p in parts:
        parent = by_id.get(p['building_id'])
        ph = h_of(parent, 12.0) if parent else 12.0
        add(p['geom'], h_of(p, ph), float(p['min_height'] or 0), p['building_id'] or p['id'], p['facade_color'] or (parent or {}).get('facade_color'), p['facade_material'] or (parent or {}).get('facade_material'))

    def q16(a):
        a = np.round(np.asarray(a) * 2)  # half-metre steps
        assert np.abs(a).max() < 32767, 'the city no longer fits in int16'
        return a.astype(np.int16).ravel()
    xy = np.concatenate([c for c, *_ in recs])
    inner_xy = [i for _, i, *_ in recs if i is not None]
    hex3 = lambda c: [int(c[i:i + 2], 16) for i in (1, 3, 5)]
    roof_a = np.array(roof)
    nyc = {
        'b.n': np.array([len(c) for c, *_ in recs], dtype=np.uint16),
        'b.ni': np.array([0 if i is None else len(i) for _, i, *_ in recs], dtype=np.uint16),
        'b.h': np.array([min(65535, round(r[2] * 10)) for r in recs], dtype=np.uint16),
        'b.mh': np.array([min(65535, round(r[3] * 10)) for r in recs], dtype=np.uint16),
        'b.c': np.array([hex3(r[4]) for r in recs], dtype=np.uint8).ravel(),
        'b.s': np.array([r[5] for r in recs], dtype=np.uint8),
        'b.g': np.array([r[6] for r in recs], dtype=np.uint32),
        'b.xy': q16(xy),
        'b.ixy': q16(np.concatenate(inner_xy)),
        'r.t': roof_a[:, 0].astype(np.uint8),
        'r.xy': q16(roof_a[:, 1:3]),
        'r.y': np.round(roof_a[:, 3] * 10).astype(np.uint16),
        'r.s': np.round(roof_a[:, 4:7] * 10).clip(0, 255).astype(np.uint8).ravel(),
        'r.a': np.round(roof_a[:, 7] % math.pi / math.pi * 255).astype(np.uint8),
        'p.f': np.array([[x, z, a, L, W, y, rise] for x, z, a, L, W, y, rise, *_ in pitched], dtype=np.float32).ravel(),
        'p.g': np.array([g for *_, g, _, _ in pitched], dtype=np.uint8),
        'p.c': np.array([hex3(ROOF_COLS[c]) + hex3(wc) for *_, c, wc in pitched], dtype=np.uint8).ravel(),
    }

    # ---------- the city's ground: land, parks, lakes ----------
    man_p = proj_geom(manhattan).simplify(1.0)
    poly_layer('land', polys(man_p), nyc)
    lu = pq.read_table(f'{D}/{P}landuse.parquet', columns=['geometry', 'subtype', 'class']).to_pylist()
    PARK = {('park', 'park'), ('park', 'dog_park'), ('recreation', 'recreation_ground'), ('cemetery', 'cemetery'), ('managed', 'grass'), ('recreation', 'pitch'), ('golf', 'fairway')}
    woods = unary_union([shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] in ('forest', 'shrub', 'grass') and r['class'] not in ('shrub',)]).intersection(manhattan)
    green = unary_union([shapely.from_wkb(r['geometry']) for r in lu if (r['subtype'], r['class']) in PARK] + [woods]).intersection(manhattan)
    green = [p for p in polys(proj_geom(green).simplify(1.5)) if p.area > 1500]
    poly_layer('park', green, nyc)
    wt = pq.read_table(f'{D}/{P}water.parquet' if os.path.exists(f'{D}/{P}water.parquet') else f'{D}/{RP}water.parquet', columns=['geometry', 'subtype', 'class']).to_pylist()
    lakes = unary_union([shapely.from_wkb(r['geometry']) for r in wt if r['subtype'] in ('water', 'pond', 'reservoir', 'lake') and r['class'] not in ('wastewater',)]).intersection(manhattan)
    inland = proj_geom(manhattan).buffer(-15)
    lakes = [p for p in polys(proj_geom(lakes).simplify(1.5)) if p.area > 800 and p.within(inland)]
    poly_layer('lake', lakes, nyc)
    # roads: every drivable street as asphalt, and street names to paint on the ground
    from shapely.ops import linemerge
    WIDTH = {'motorway': 20, 'trunk': 18, 'primary': 16, 'secondary': 14, 'tertiary': 12, 'residential': 10, 'unclassified': 9, 'living_street': 7, 'service': 5, 'unknown': 8}
    seg = pq.read_table(f'{D}/{P}segments.parquet', columns=['geometry', 'subtype', 'class', 'names', 'road_flags']).to_pylist()
    def tunnel(r): return any('is_tunnel' in (f.get('values') or []) for f in (r['road_flags'] or []))
    roads, named, centre = [], {}, []
    for r in seg:
        if r['subtype'] != 'road' or r['class'] not in WIDTH or tunnel(r): continue
        g = proj_geom(shapely.from_wkb(r['geometry']))
        roads.append(g.buffer(WIDTH[r['class']] / 2, quad_segs=2))
        centre.append((g, r['class']))
        nm = (r['names'] or {}).get('primary')
        if nm and r['class'] != 'service': named.setdefault(nm, []).append(g)
    man_proj = proj_geom(manhattan)
    road = unary_union(roads).intersection(man_proj).simplify(0.5)
    road = [p for p in polys(road) if p.area > 30]
    poly_layer('road', road, nyc)
    walk = unary_union([g.buffer(WIDTH[c] / 2 + 3.2, quad_segs=2) for g, c in centre]).intersection(man_proj).simplify(0.6)
    poly_layer('walk', [p for p in polys(walk) if p.area > 30], nyc)
    # centre lines (for lane markings, cars and people) and zebra crossings where three or more streets meet
    CLASS_ID = {c: i for i, c in enumerate(WIDTH)}
    lr, lxy, lc = [], [], []
    ends = {}
    for g, c in centre:
        for line in getattr(g, 'geoms', [g]):
            line = line.simplify(1.0)
            co = np.asarray(line.coords)
            if len(co) < 2 or line.length < 8: continue
            lr.append(len(co)); lxy.append(co); lc.append(CLASS_ID[c])
            for a, b in ((co[0], co[1]), (co[-1], co[-2])):
                ends.setdefault((round(a[0]), round(a[1])), []).append((a, b, WIDTH[c], c))
    nyc['l.n'] = np.array(lr, dtype=np.uint16)
    nyc['l.c'] = np.array(lc, dtype=np.uint8)
    nyc['l.xy'] = np.concatenate(lxy).astype(np.float32).ravel()
    cross = []
    for pts in ends.values():
        if len(pts) < 3: continue
        wmax = max(w for *_, w, _ in pts)
        for a, b, w, c in pts:
            if c in ('service', 'unknown'): continue
            d = b - a; L = np.hypot(*d)
            if L < wmax / 2 + 6: continue
            u = d / L; p = a + u * (wmax / 2 + 2.5)
            if man_proj.contains(shapely.geometry.Point(p)): cross.append((p[0], p[1], math.atan2(u[1], u[0]), w))
    nyc['x.f'] = np.array(cross, dtype=np.float32).ravel()
    names, sl = [], []
    for nm, gs in named.items():
        u = unary_union(gs)
        merged = linemerge(u) if u.geom_type == 'MultiLineString' else u
        for line in getattr(merged, 'geoms', [merged]):
            L = line.length
            if L < 120: continue
            at = [L / 2] if L < 300 else list(np.arange(130, L - 60, 260))
            for d in at:
                p0, p1 = line.interpolate(max(0, d - 6)), line.interpolate(min(L, d + 6))
                ang = math.atan2(p1.y - p0.y, p1.x - p0.x)
                if ang > math.pi / 2: ang -= math.pi
                if ang < -math.pi / 2: ang += math.pi
                pt = line.interpolate(d)
                if not man_proj.contains(pt): continue
                if nm not in names: names.append(nm)
                sl.append((names.index(nm), pt.x, pt.y, ang))
    sl = np.array(sl)
    nyc['sl.i'] = sl[:, 0].astype(np.uint16)
    nyc['sl.xy'] = q16(sl[:, 1:3])
    nyc['sl.a'] = sl[:, 3].astype(np.float32)
    json.dump(names, open(f'{OUT}/{city}-streets.json', 'w'), separators=(',', ':'))
    # trees: every mapped tree, plus woods filled in at roughly one tree per 70 m²
    pts = [project(g.x, g.y) for g in (shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] == 'tree' and r['class'] == 'tree') if county.contains(g)]
    wp = proj_geom(unary_union([shapely.from_wkb(r['geometry']) for r in land_rows if r['subtype'] == 'forest']).intersection(manhattan))
    for p in polys(wp):
        x0, z0, x1, z1 = p.bounds
        cand = rng.uniform([x0, z0], [x1, z1], size=(int(p.envelope.area / 70), 2))
        pts += [tuple(c) for c in cand[shapely.contains_xy(p, cand[:, 0], cand[:, 1])]]
    nyc['t.xy'] = np.round(np.array(pts) * 2).astype(np.int16).ravel()
    nyc['t.s'] = rng.integers(0, 256, len(pts)).astype(np.uint8)
    # the coastline around the city for the zoomed-out map: its land, and the water inside its box (drawn over the coarse world map)
    region = [p for p in polys(proj_geom(region_land).simplify(15)) if p.area > 2e4]
    poly_layer('region', region, nyc)
    poly_layer('rwater', [p for p in polys(proj_geom(REGION_BOX.difference(region_land)).simplify(15)) if p.area > 2e4], nyc)
    write_bin(f'{OUT}/{city}.bin', nyc)
    print(f'{city}.bin: %d building pieces (%d with parapets, %d pitched roofs), %d points, %d rooftop items, %d road polygons, %d street lines, %d crossings, %d street labels (%d names), %d parks, %d lakes, %d trees' % (
        len(recs), len(inner_xy), len(pitched), len(xy), len(roof), len(road), len(lr), len(cross), len(sl), len(names), len(green), len(lakes), len(pts)))


# ---------- the world, in degrees: the game projects it around whichever city you're in ----------
def bake_world():
    CLIP = box(-180, -58, 180, 82)  # Mercator can't do the poles
    fc = json.load(open(f'{RAW}/countries50.geojson'))['features']
    land, labels = [], []
    set_origin(0, 0)
    for f in fc:
        g = shape(f['geometry']).buffer(0).intersection(CLIP)
        if g.is_empty: continue
        big = max(polys(g), key=lambda p: p.area)
        lp = polylabel(big, 0.05)
        labels.append([f['properties']['name'], round(lp.y, 3), round(lp.x, 3), round(proj_geom(g).area / 1e6 * math.cos(math.radians(lp.y)) ** 2)])
        land.append(g)
    world_land = [p.simplify(0.012) for p in polys(unary_union(land))]
    world_land = [p for p in world_land if not p.is_empty and p.area > 4e-4]
    world = {}
    poly_layer('world', world_land, world)
    bl = shape(json.load(open(f'{RAW}/borders50.geojson')))
    lr, lxy = [0], []
    for l in getattr(bl, 'geoms', [bl]):
        l = l.intersection(CLIP)
        for s_ in getattr(l, 'geoms', [l]):
            if s_.is_empty or s_.geom_type != 'LineString': continue
            c = np.asarray(s_.simplify(0.012).coords)
            lr.append(len(c)); lxy.append(c)
    lr[0] = len(lr) - 1
    world['border.r'] = np.array(lr, dtype=np.uint32)
    world['border.xy'] = np.concatenate(lxy).astype(np.float32).ravel()
    write_bin(f'{OUT}/world.bin', world)
    labels.sort(key=lambda l: -l[3])
    json.dump(labels, open(f'{OUT}/countries.json', 'w'), separators=(',', ':'))
    print('world.bin: %d land polygons, %d border lines, %d labels (lon, lat degrees)' % (len(world_land), lr[0], len(labels)))

for city in (ONLY or CITIES):
    if city == 'world': continue
    if not os.path.exists(f"{RAW}/{CITIES[city]['dir']}"): print('skipping', city, '(no raw data)'); continue
    bake_city(city, CITIES[city])
if not ONLY or 'world' in ONLY: bake_world()
