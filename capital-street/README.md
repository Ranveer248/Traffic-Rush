# Capital Street

A trading game. You're a broke student in New York: borrow a little, trade, and work your way up to your own tower on Wall Street, then hire brokers, employees and interns, and expand.

Play it by opening `capital-street/index.html` from a web server (GitHub Pages works). It's built for high-end phones and computers.

## How we build it

One small goal at a time. Each goal has a short checklist. When it's built, we check it against the list. If it doesn't pass, we fix it or redefine the goal. No extras that aren't in the goal.

## Goal 1: the New York map ✅

The target is the two reference images: a flat world map when zoomed out (image 2), real 3D New York when zoomed in (image 1).

| Check | Result |
|---|---|
| Zoomed out matches image 2 | ✅ flat green land and blue sea in the reference colours, thick black borders, dark country names with a white halo, continent names, and New York shown as a small office-block icon with a blue badge |
| Everything except New York is locked | ✅ a light tint outside New York; tapping there shows "Locked", and you can only zoom in over New York |
| Zoomed in matches image 1 | ✅ 56,759 real building pieces from Overture Maps with real heights, setbacks and spires. Facades are drawn per style: glass window bands, stone with punched windows, brick walk-ups, all-glass towers, plus shop fronts on the ground floor. Dark roofs with light parapet rims, 11,382 rooftop plant rooms and water towers, asphalt streets, and 3,404 street names painted on the map ("John Street") |
| Start like image 1 | ✅ Play flies from the world map to the roof of 28 Liberty Street by John Street, Liberty Place and Broadway, where the student's rooftop room is: "WHERE YOU START" |
| HUD like image 1 | ✅ the player in the middle of a dock with two round buttons on each side, and a scrolling price ticker along the bottom |
| Recognisable New York | ✅ real coastline, Central Park, 45,000 real trees, parks and lakes; labels for neighbourhoods, landmarks and rivers |
| Controls | ✅ drag to move, pinch/scroll to zoom, twist/right-drag to turn; tilt opens up as you zoom in |
| High-end graphics | ✅ physically based lighting, real-time sun shadows, sky reflections in window glass, up to 3× pixel density |
| UI from Figma | ✅ [Capital Street — Game UI](https://www.figma.com/design/9PMFhcKouB5mSqsUjjD64j) (tokens, components, three screens) |

Only Manhattan has buildings for now. Brooklyn, Queens, the Bronx and New Jersey are visible but flat. The Staff and Shop buttons and the ticker prices are placeholders until later goals.

## Map data

`data/` is baked by `tools/build_map.py` and is checked in, so the game needs no build step.

To rebuild it:

```sh
pip install pyarrow shapely requests numpy
cd tools
RAW=/some/scratch/dir
# Overture Maps (release 2026-10-21.0), read straight from its public S3 bucket
python3 grab.py buildings building      -74.03 40.69 -73.90 40.885 $RAW/nyc-building.parquet id,geometry,bbox,height,num_floors,min_height,facade_color
python3 grab.py buildings building_part -74.03 40.69 -73.90 40.885 $RAW/nyc-building_part.parquet id,geometry,bbox,height,num_floors,min_height,building_id,facade_color
python3 grab.py divisions division_area -74.40 40.40 -73.50 41.10 $RAW/region-areas.parquet id,geometry,bbox,subtype,class,names
python3 grab.py base land     -74.40 40.40 -73.50 41.10 $RAW/region-land.parquet id,geometry,bbox,subtype,class
python3 grab.py base water    -74.40 40.40 -73.50 41.10 $RAW/region-water.parquet id,geometry,bbox,subtype,class
python3 grab.py base land_use -74.03 40.68 -73.90 40.885 $RAW/nyc-landuse.parquet id,geometry,bbox,subtype,class
python3 grab.py base water    -74.03 40.68 -73.90 40.885 $RAW/nyc-water.parquet id,geometry,bbox,subtype,class
python3 grab.py transportation segment -74.03 40.69 -73.90 40.885 $RAW/nyc-segments.parquet id,geometry,bbox,subtype,class,names,road_flags
# Natural Earth countries, via npm world-atlas
npm i world-atlas@2 topojson-client@3
node -e "const t=require('topojson-client'),w=require('world-atlas/countries-50m.json'),fs=require('fs');fs.writeFileSync('$RAW/countries50.geojson',JSON.stringify(t.feature(w,w.objects.countries)));fs.writeFileSync('$RAW/borders50.geojson',JSON.stringify(t.mesh(w,w.objects.countries,(a,b)=>a!==b)))"
python3 build_map.py $RAW ../data
```

Map data © OpenStreetMap contributors and Overture Maps Foundation (ODbL / CDLA-Permissive-2.0). Country shapes: Natural Earth (public domain).
