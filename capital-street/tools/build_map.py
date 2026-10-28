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

# ---------- each city's own look ----------
# Building types: 0 house, 1 terraced house, 2 apartments, 3 shop, 4 office, 5 tower, 6 factory, 7 landmark.
# Materials: 0 red brick, 1 brownstone, 2 yellow brick, 3 grey stone, 4 limestone, 5 white stucco, 6 painted plaster,
#            7 timber frame, 8 concrete, 9 glass, 10 wood siding, 11 metal cladding (drawn by the game's facade shader).
MAT_COLS = {
    0: ['#a3503c', '#9a4a38', '#b35e44', '#8c3f33', '#b8664a'],
    1: ['#7a4a3a', '#6e4234', '#86533f', '#5f3a2e'],
    2: ['#c9a96e', '#d0b47e', '#bfa06a', '#d6be8e'],
    3: ['#a9a59c', '#9c988f', '#b5b1a8', '#8f8c86'],
    4: ['#e3d6b8', '#d9c49a', '#e8dcc0', '#d8b878', '#cfc6b4'],
    5: ['#ece8e0', '#f1eee8', '#e6e2da', '#ddd8cc'],
    6: ['#e8c9a0', '#d9e2d0', '#e6d0c8', '#cfdbe3', '#efe0b0', '#d7b8a8'],
    7: ['#ece2c8', '#e9dcbc'],
    8: ['#b8b6b0', '#c4c2bc', '#a8a7a3', '#cfcdc6'],
    9: ['#4d6f96', '#5a7fa6', '#3f5d7c', '#6b8fae', '#557a8c', '#46627e', '#6f8c7f'],
    10: ['#e8e4da', '#c9d4dc', '#d9c9a8', '#9fb3a8', '#b8504a'],
    11: ['#9ea3a8', '#8a9096', '#b0b4b8', '#6f7a84', '#a8b0a0'],
}
ROOF_COLS = {'terracotta': '#b5523b', 'slate': '#4b4f57', 'brown': '#7a4a33', 'red': '#8e3b2e', 'grey': '#5d6168', 'copper': '#4f8a6a',
             'blue': '#2f4560', 'dark': '#3b3f47', 'orange': '#c0653f', 'green': '#3e6b4c'}
_P = lambda **k: k
STYLE = {  # materials by building type as (material, weight); roofs; how often each feature appears
    'nyc': _P(mats={0: [(10, 3), (0, 4), (5, 2), (1, 1)], 1: [(1, 4), (0, 4), (2, 1), (4, 1)], 2: [(0, 5), (2, 3), (1, 2), (4, 2), (3, 1)],
                    3: [(0, 5), (1, 2), (4, 2), (5, 1)], 4: [(4, 4), (3, 2), (9, 3), (8, 1)], 5: [(9, 5), (4, 3), (3, 2), (8, 1)],
                    6: [(0, 5), (11, 3), (8, 2)], 7: [(4, 5), (3, 4), (0, 1)]},
              roofs=['red', 'slate', 'brown', 'grey', 'terracotta', 'copper'], pitched={0: 0.9, 1: 0.12, 2: 0.08, 3: 0.15}, rise=0.36,
              dormers=0.55, solar=0.08, chimneys=1, water_towers=True, offices=0.5, shops=0.3, tower_dome=0.05, worship_dome=0.2),
    'london': _P(mats={0: [(2, 5), (0, 3), (5, 3), (7, 1)], 1: [(2, 6), (5, 3), (0, 2)], 2: [(0, 3), (2, 3), (8, 2), (4, 1), (5, 1)],
                       3: [(2, 3), (0, 3), (5, 2), (7, 1)], 4: [(4, 5), (9, 3), (8, 1)], 5: [(9, 6), (4, 2), (8, 1)],
                       6: [(0, 4), (2, 2), (11, 3)], 7: [(4, 5), (3, 3), (0, 1)]},
                 roofs=['slate', 'slate', 'grey', 'dark', 'red', 'terracotta'], pitched={0: 0.95, 1: 0.85, 2: 0.45, 3: 0.6}, rise=0.42,
                 dormers=0.5, solar=0.1, chimneys=2, water_towers=False, offices=0.6, shops=0.35, tower_dome=0.04, worship_dome=0.25),
    'tokyo': _P(mats={0: [(6, 4), (10, 3), (8, 2), (5, 2)], 1: [(6, 4), (8, 3), (5, 2)], 2: [(8, 5), (6, 3), (5, 2)],
                      3: [(8, 3), (6, 3), (11, 2)], 4: [(8, 4), (9, 4), (3, 1)], 5: [(9, 6), (8, 3)],
                      6: [(11, 6), (8, 3)], 7: [(3, 3), (8, 3), (5, 1)]},
                roofs=['dark', 'blue', 'grey', 'brown', 'green'], pitched={0: 0.7, 1: 0.4, 2: 0.1, 3: 0.2}, rise=0.3,
                dormers=0.0, solar=0.2, chimneys=0, water_towers=False, offices=0.7, shops=0.45, tower_dome=0.02, worship_dome=0.1),
    'hongkong': _P(mats={0: [(6, 4), (5, 3), (8, 2)], 1: [(6, 4), (8, 3)], 2: [(8, 4), (6, 4), (5, 2)],
                         3: [(6, 3), (8, 3), (11, 1)], 4: [(9, 5), (8, 3), (4, 1)], 5: [(9, 6), (8, 4)],
                         6: [(11, 5), (8, 4)], 7: [(4, 3), (3, 3), (5, 2)]},
                   roofs=['grey', 'dark', 'terracotta', 'green'], pitched={0: 0.5, 1: 0.2, 2: 0.05, 3: 0.1}, rise=0.32,
                   dormers=0.0, solar=0.1, chimneys=0, water_towers=False, offices=0.55, shops=0.5, tower_dome=0.03, worship_dome=0.3),
    'dubai': _P(mats={0: [(4, 5), (5, 4), (6, 1)], 1: [(4, 5), (5, 4)], 2: [(4, 5), (5, 4), (8, 2)],
                      3: [(4, 4), (5, 4), (6, 1)], 4: [(9, 5), (4, 3), (5, 1)], 5: [(9, 7), (4, 2), (8, 1)],
                      6: [(11, 5), (4, 3)], 7: [(5, 5), (4, 5)]},
                roofs=['terracotta', 'orange', 'brown'], pitched={0: 0.05, 1: 0.0, 2: 0.0, 3: 0.0}, rise=0.3,
                dormers=0.0, solar=0.25, chimneys=0, water_towers=False, offices=0.6, shops=0.4, tower_dome=0.04, worship_dome=0.85),
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
    BCOLS = ['id', 'geometry', 'height', 'num_floors', 'min_height', 'facade_color', 'facade_material', 'class', 'roof_shape', 'names']
    def cols_in(path, want): return [c for c in want if c in pq.read_schema(path).names]
    bld = load(f'{D}/{P}building.parquet', cols_in(f'{D}/{P}building.parquet', BCOLS))
    parts = load(f'{D}/{P}building_part.parquet', cols_in(f'{D}/{P}building_part.parquet', BCOLS[:7] + ['building_id', 'roof_shape']))
    by_id = {b['id']: b for b in bld}
    with_parts = {p['building_id'] for p in parts if p['building_id'] in by_id}
    style = STYLE[city]

    def h_of(r, fallback):
        if r['height']: return float(r['height'])
        if r['num_floors']: return float(r['num_floors']) * 3.6
        return fallback
    def hnum(key, salt=''):
        return int(hashlib.md5((key + salt).encode()).hexdigest()[:8], 16)
    def pick(key, salt, weighted):  # a weighted choice that is always the same for the same building
        tot = sum(w for _, w in weighted); r = hnum(key, salt) % 1000 / 1000 * tot
        for v, w in weighted:
            r -= w
            if r < 0: return v
        return weighted[-1][0]
    def chance(key, salt, p): return hnum(key, salt) % 10000 < p * 10000

    # ---------- what each building is: places inside it (shops, offices, factories, churches...), its shape and its map tags ----------
    pl_path = f'{D}/{P}places.parquet' if os.path.exists(f'{D}/{P}places.parquet') else f'{D}/places.parquet'
    POI = np.zeros((0, 2)); poi_kind = np.zeros(0, np.int8)
    if os.path.exists(pl_path):
        pt = pq.read_table(pl_path, columns=['geometry', 'basic_category', 'taxonomy', 'confidence']).to_pylist()
        def kind_of(r):
            if (r['confidence'] or 0) < 0.4: return -1
            bc = r['basic_category'] or ''; top = ((r['taxonomy'] or {}).get('hierarchy') or [''])[0]
            if 'place_of_worship' in bc: return 4
            if bc in ('manufacturer', 'storage_facility', 'shipping_or_delivery_service', 'building_or_construction_service', 'industrial_facility', 'factory', 'warehouse'): return 3
            if top in ('food_and_drink', 'shopping') or bc in ('bank_or_credit_union', 'pharmacy_and_drug_store', 'personal_or_beauty_service', 'laundry_service'): return 1
            if top in ('community_and_government', 'education', 'cultural_and_historic') and bc not in ('civic_organization', 'social_or_community_service'): return 5
            if top == 'services_and_business': return 2
            if top == 'lodging': return 6
            return -1
        kinds = np.array([kind_of(r) for r in pt], np.int8)
        g = shapely.from_wkb([r['geometry'] for r in pt])
        ok = kinds >= 0
        POI = np.array([project(pp.x, pp.y) for pp in g[ok]]) if ok.any() else POI; poi_kind = kinds[ok]
    poi_tree = shapely.STRtree(shapely.points(POI)) if len(POI) else None
    def poi_counts(poly):
        cnt = np.zeros(7, int)
        if poi_tree is not None:
            for j in poi_tree.query(poly, predicate='contains'): cnt[poi_kind[j]] += 1
        return cnt

    HOUSE = {'house', 'detached', 'semidetached_house', 'bungalow', 'cabin', 'farm', 'villa', 'hut'}
    TERRACE = {'terrace', 'townhouse'}
    APART = {'apartments', 'residential', 'dormitory', 'hotel'}
    RETAIL = {'retail', 'commercial', 'supermarket', 'kiosk', 'shop', 'mall'}
    OFFICE = {'office', 'bank'}
    INDUS = {'industrial', 'warehouse', 'factory', 'manufacture', 'hangar', 'storage_tank', 'service', 'garage', 'garages', 'parking', 'transportation', 'train_station'}
    LANDMARK = {'church', 'cathedral', 'chapel', 'mosque', 'temple', 'synagogue', 'shrine', 'religious', 'civic', 'government', 'public', 'school', 'university', 'college', 'museum', 'hospital', 'library', 'courthouse', 'town_hall', 'fire_station', 'stadium'}
    def classify(key, cls, h, poly, cnt, w, l):
        c = (cls or '').lower()
        if c in HOUSE: return 0
        if c in TERRACE: return 1
        if c in RETAIL: return 3 if h <= 14 else 2
        if c in OFFICE: return 5 if h >= 70 else 4
        if c in INDUS and h < 30: return 6
        if c in LANDMARK: return 7
        if cnt[4] and poly.area > 150 and h < 60: return 7
        if h >= 70: return 5
        if cnt[3] and h < 25 and poly.area > 500: return 6
        if poly.area > 4000 and h < 20 and cnt[1] + cnt[2] < 3: return 6
        if cnt[5] and poly.area > 900 and h < 40: return 7
        if h <= 11 and poly.area < 240: return 1 if (w < 8 and l / max(w, 1) > 1.5) else 0
        if h <= 22 and w < 9.5 and l / max(w, 1) > 1.4 and cnt[2] < 2: return 1
        if h <= 9 and cnt[1]: return 3
        if h >= 15 and cnt[2] >= max(3, 2 * cnt[6]): return 4
        if h >= 35 and chance(key, 'off', style['offices']): return 4
        return 2
    def material(key, typ, given):
        m = (given or '').lower()
        if 'glass' in m: return 9
        if 'brick' in m: return pick(key, 'br', [(v, w) for v, w in style['mats'][typ] if v in (0, 1, 2)] or [(0, 1)])
        if m in ('stone', 'masonry', 'sandstone', 'limestone', 'marble', 'granite'): return 4 if m in ('sandstone', 'limestone') else pick(key, 'st', [(3, 1), (4, 1)])
        if m == 'concrete': return 8
        if m in ('plaster', 'render', 'stucco'): return pick(key, 'pl', [(5, 1), (6, 1)])
        if m == 'metal': return 11
        if m == 'wood': return 10
        return pick(key, 'm', style['mats'][typ])
    def colour(key, mat, given):
        pal = MAT_COLS[mat]
        base = pal[hnum(key) % len(pal)]
        if not (given and given.startswith('#') and len(given) == 7) or mat == 9: return base
        # mapped facade colours are often pure black or neon: pull them toward the palette and keep them readable
        g = [int(given[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(base[i:i + 2], 16) for i in (1, 3, 5)]
        c = [(x + 2 * y) / 3 for x, y in zip(g, b)]
        lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
        if lum < 90: c = [x + (90 - lum) for x in c]
        return '#%02x%02x%02x' % tuple(min(255, round(x)) for x in c)
    def mrr_dims(poly):
        rc = np.asarray(poly.minimum_rotated_rectangle.exterior.coords)[:4]
        a, b = np.hypot(*(rc[1] - rc[0])), np.hypot(*(rc[2] - rc[1]))
        return min(a, b), max(a, b)

    # one decision per building (its parts share it): type, material, colour, shops, crown
    DECIDE = {}
    def decide(key, row, h, geom):
        if key in DECIDE: return DECIDE[key]
        poly = max(polys(proj_geom(geom)), key=lambda g: g.area, default=None)
        if poly is None: DECIDE[key] = None; return None
        w, l = mrr_dims(poly)
        cnt = poi_counts(poly)
        typ = classify(key, row.get('class'), h, poly, cnt, w, l)
        mat = material(key, typ, row.get('facade_material'))
        col = colour(key, mat, row.get('facade_color'))
        flags = 0
        if typ == 3 or (cnt[1] and typ in (1, 2, 4, 5)) or (typ == 2 and h < 40 and chance(key, 'shop', style['shops'])): flags |= 8
        flags |= (hnum(key, 'aw') % 8) << 4
        rs = (row.get('roof_shape') or '').lower()
        if rs in ('dome', 'round', 'onion'): flags |= 2
        elif typ == 7:
            if cnt[4] and chance(key, 'dm', style['worship_dome']): flags |= 2
            elif cnt[4] and chance(key, 'sp', 0.6): flags |= 4
            elif mat in (3, 4) and chance(key, 'bt', 0.15): flags |= 1
            elif chance(key, 'dm2', 0.12): flags |= 2
        elif typ == 5 and chance(key, 'dm', style['tower_dome']): flags |= 2
        elif typ == 5 and chance(key, 'sp', 0.03): flags |= 4
        elif typ == 2 and mat in (3, 4) and h < 40 and chance(key, 'bt', 0.012): flags |= 1
        DECIDE[key] = (typ, mat, col, flags, cnt)
        return DECIDE[key]

    rng = np.random.default_rng(7)
    recs = []   # outer ring, inner ring (parapet) or None, height, min height, colour, type*16+material, building number, flags
    roof = []   # rooftop things: type (0 plant room, 1 water tower, 2 chimney, 3 solar panel), x, z, base y, w, d, h, angle
    pitched = []  # pitched roofs: x, z, angle, length, width, base y, rise, ridge (1 gable, 0 hip), roof colour, wall colour, extras (1 dormers)
    saw = []    # factory sawtooth roofs: x, z, angle, length, width, base y
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
    TOP = {}    # building id -> height of its tallest part (only that part gets the crown)
    for p_ in parts:
        if p_['building_id']: TOP[p_['building_id']] = max(TOP.get(p_['building_id'], 0), h_of(p_, 0))
    def add(geom, h, mh, key, d):
        if d is None: return
        typ, mat, col, flags, cnt = d
        gid = GROUP.setdefault(key, len(GROUP))
        if h < TOP.get(key, 0) - 0.5: flags &= ~7  # domes and spires only on the top part
        code = typ * 16 + mat
        for p in polys(proj_geom(geom)):
            p = p.simplify(0.6, preserve_topology=True)
            if p.is_empty or p.area < 8: continue
            for q in polys(p):
                q = shapely.geometry.polygon.orient(Polygon(q.exterior), 1.0)  # outline only, counter-clockwise
                inner = None
                mrr = q.minimum_rotated_rectangle
                rect = q.area / max(mrr.area, 1)
                rc = np.asarray(mrr.exterior.coords)[:4]
                e1, e2 = rc[1] - rc[0], rc[2] - rc[1]
                L, W = np.hypot(*e1), np.hypot(*e2)
                ang = math.atan2(e1[1], e1[0])
                if W > L: L, W, ang = W, L, math.atan2(e2[1], e2[0])
                cx, cz = rc.mean(axis=0)
                want_pitch = (typ in (0, 1) and chance(key, 'pp', style['pitched'][typ])) or (typ == 7 and not flags & 7 and chance(key, 'pp', 0.7)) \
                    or (typ in (2, 3) and h <= 24 and chance(key, 'pp', style['pitched'][typ]))
                if mh == 0 and want_pitch and h <= 40 and 40 < q.area < 2500 and rect > 0.84 and not flags & 3:
                    # a pitched roof: gable along the long side, hipped when squarish; churches get a steep one
                    rise = min(14.0 if typ == 7 else 6.5, max(1.6, W * (0.62 if typ == 7 else style['rise'])))
                    gable = 1 if (L / W > 1.4 and chance(key, 'gb', 0.6)) or typ == 7 else 0
                    extra = (1 if rise >= 2.4 and L >= 6 and chance(key, 'dr', style['dormers']) else 0)
                    roofc = ROOF_COLS[style['roofs'][hnum(key, 'c') % len(style['roofs'])]] if typ != 7 or chance(key, 'cr', 0.6) else ROOF_COLS['copper' if city != 'dubai' else 'terracotta']
                    pitched.append((cx, cz, ang, L + 0.8, W + 0.8, h, rise, gable, roofc, col, extra))
                    if typ != 7:
                        for k in range(1 + (L > 14) + (style['chimneys'] > 1 and L > 8)):  # chimneys on the ridge
                            off = (k / max(1, (1 + (L > 14) + (style['chimneys'] > 1 and L > 8)) - 1) - 0.5) * L * 0.7 if L > 8 else rng.uniform(-0.15, 0.15) * L
                            side = rng.uniform(-0.2, 0.2) * W
                            if chance(key, 'ch%d' % k, 0.8 if style['chimneys'] else 0.25):
                                roof.append((2, cx + math.cos(ang) * off - math.sin(ang) * side, cz + math.sin(ang) * off + math.cos(ang) * side, h + rise * 0.55, 0.9, 0.9, rise * 0.45 + 1.4, ang))
                    if chance(key, 'sol', style['solar']) and typ in (0, 1, 2) and L > 6:  # solar panels on the sunny slope
                        roof.append((3, cx, cz, h, min(L * 0.6, 9), W, rise, ang))
                    recs.append((np.asarray(q.exterior.coords)[:-1], None, h, mh, col, code, gid, flags & ~7))
                    continue
                if typ == 6 and mh == 0 and h < 25 and q.area > 500 and rect > 0.8 and chance(key, 'saw', 0.7):  # a sawtooth factory roof
                    saw.append((cx, cz, ang, L - 0.6, W - 0.6, h))
                    recs.append((np.asarray(q.exterior.coords)[:-1], None, h, mh, col, code, gid, flags & ~7))
                    continue
                if h - mh >= 10 and q.area >= 150 and typ != 6:  # a parapet: a low rim around the roof
                    ib = q.buffer(-0.8, join_style=2)
                    ib = max(polys(ib), key=lambda g: g.area) if not ib.is_empty else None
                    if ib is not None and ib.area > 40:
                        inner = shapely.geometry.polygon.orient(Polygon(ib.simplify(0.3).exterior), 1.0)
                recs.append((np.asarray(q.exterior.coords)[:-1], None if inner is None else np.asarray(inner.exterior.coords)[:-1], h, mh, col, code, gid, flags))
                top = inner if inner is not None else q
                ang, roofy = axis_angle(q), h - (1.2 if inner is not None else 0)
                if flags & 7: continue  # a crown fills the roof
                r = hnum(key, 'r') % 100
                if style['water_towers'] and typ in (1, 2, 3, 4) and 18 < h < 80 and 250 < q.area < 3000 and r < 14:  # New York water tower
                    c = rand_in(top, 4)
                    if c is not None: roof.append((1, c[0], c[1], roofy, 3.2 + (r % 4) * 0.3, 3.2, 8 + (r % 3), ang))
                if h > 20 and q.area > 400:  # plant rooms and lift overruns
                    for k in range(1 + (q.area > 1500) + (q.area > 4000)):
                        w = rng.uniform(3, min(12, math.sqrt(q.area) / 3)); dd = rng.uniform(3, min(12, math.sqrt(q.area) / 3))
                        c = rand_in(top, max(w, dd) / 2 + 0.6)
                        if c is not None: roof.append((0, c[0], c[1], roofy, w, dd, rng.uniform(2.5, 5), ang))
                if typ in (2, 3, 6) and h < 30 and q.area > 200 and chance(key, 'flsol', style['solar'] * 0.6):  # solar on flat roofs
                    c = rand_in(top, 3)
                    if c is not None: roof.append((4, c[0], c[1], roofy, min(14, math.sqrt(q.area) * 0.5), min(8, math.sqrt(q.area) * 0.35), 0, ang))
    for b in bld:
        if b['id'] in with_parts: continue  # its parts describe it better
        h = h_of(b, 12.0)
        add(b['geom'], h, float(b['min_height'] or 0), b['id'], decide(b['id'], b, h, b['geom']))
    for p in parts:
        parent = by_id.get(p['building_id'])
        ph = h_of(parent, 12.0) if parent else 12.0
        key = p['building_id'] or p['id']
        src = parent or p
        d = decide(key, dict(src, roof_shape=p.get('roof_shape') or src.get('roof_shape'), facade_material=p['facade_material'] or src.get('facade_material'), facade_color=p['facade_color'] or src.get('facade_color')), max(TOP.get(key, 0), h_of(src, ph)), src['geom'])
        add(p['geom'], h_of(p, ph), float(p['min_height'] or 0), key, d)
    types = np.bincount([r[5] >> 4 for r in recs], minlength=8)
    print(city, 'types (house, terrace, apartments, shop, office, tower, factory, landmark):', list(types),
          'domes', sum(1 for r in recs if r[7] & 2), 'spires', sum(1 for r in recs if r[7] & 4), 'battlements', sum(1 for r in recs if r[7] & 1), 'sawtooth', len(saw))

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
        'b.f': np.array([r[7] for r in recs], dtype=np.uint8),
        'b.xy': q16(xy),
        'b.ixy': q16(np.concatenate(inner_xy)),
        'r.t': roof_a[:, 0].astype(np.uint8),
        'r.xy': q16(roof_a[:, 1:3]),
        'r.y': np.round(roof_a[:, 3] * 10).astype(np.uint16),
        'r.s': np.round(roof_a[:, 4:7] * 10).clip(0, 255).astype(np.uint8).ravel(),
        'r.a': np.round(roof_a[:, 7] % math.pi / math.pi * 255).astype(np.uint8),
        'p.f': np.array([[x, z, a, L, W, y, rise] for x, z, a, L, W, y, rise, *_ in pitched], dtype=np.float32).ravel(),
        'p.g': np.array([g for *_, g, _, _, _ in pitched], dtype=np.uint8),
        'p.c': np.array([hex3(c) + hex3(wc) for *_, c, wc, _ in pitched], dtype=np.uint8).ravel(),
        'p.x': np.array([x for *_, x in pitched], dtype=np.uint8),
        's.f': np.array(saw, dtype=np.float32).ravel() if saw else np.zeros(0, np.float32),
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
