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

## Goal 2: city-builder foundation ✅ (replaced in goal 3)

Modelled on SimCity BuildIt's systems (see [RESEARCH.md](RESEARCH.md)), with our own names and art. Goal 3 replaced this HUD with the trading UI from the reference videos.

| Check | Result |
|---|---|
| Level system like BuildIt | ✅ level star and XP bar; XP to the next level is 40 × level^1.8; a level-up screen shows what unlocked |
| Same kinds of buildings | ✅ Build menu with 7 families (Homes, Shops, Industry, Finance, Services, Parks, Landmarks), 34 buildings, each locked until its level |
| HUD like BuildIt | ✅ level and XP top-left, population centre, cash and gold top-right, big Build button bottom-right, Market bottom-left |
| Earn XP from the start | ✅ five starter tasks (Wall Street, Build menu, the world, Central Park, the Stock Exchange) worth XP and cash; progress is saved on the device |
| Zoom out and the city turns into the world map | ✅ buildings sink smoothly into the map between 6 km and 70 km, then the world map takes over |
| Installable as an app | ✅ app manifest, icons and a service worker: "Add to Home Screen" gives a full-screen app that works offline after the first visit |
| UI from Figma | ✅ screens "04 City — builder HUD" and "05 Build menu" |

## Goal 3: the trading game, styled after the reference videos ✅

| Check | Result |
|---|---|
| The story | ✅ you live alone in a rooftop studio; rent ($1,850) is due at the end of day 3; you have $340 and find a $2,000 envelope. Pay the rent or get evicted; it comes back every 7 days |
| Paper trading simulator | ✅ 16 fictional New York companies with prices that move every game minute (market, sector and company moves); market and limit orders, positions, P&amp;L, trade history; saved on the device |
| The market opens and closes | ✅ 09:30–16:00 game time, one game minute per second (1×, 5× or 20×); nights fast-forward; "Skip to open" |
| Anything can happen | ✅ 12 kinds of surprise events, about three a day: crashes, rallies, a plane hitting a Midtown tower (with smoke you can fly to), blackouts that close the exchange, hacks and halts, rate hikes, scandals, earnings, meme squeezes, buyouts, hurricanes, sector booms and slumps |
| UI like the videos | ✅ thin dark top banner, cash/worth/rent pills, avatar dock with four small round buttons, scrolling company ticker, dark Share Exchange panel (company list with sparklines, price and stats, line/candle chart with time ranges, order book, buy/sell ticket with 25/50/75/max) |
| Buildings like the videos | ✅ 24,205 pitched tiled roofs (gables and hips) with chimneys on rectangular low-rise buildings, framed windows, cream, ochre and brick walls, green lots, beige sidewalks, asphalt with yellow centre lines, white lane dashes and 14,993 zebra crossings |
| People and traffic | ✅ ball-headed people walking the sidewalks and boxy cars driving the streets wherever you look |
| Zoom out like the videos | ✅ the city sinks into the map, then the map turns into a 3D globe with a glowing atmosphere in starry space, with countries, borders and New York marked |

## Goal 4: the bank loan ✅

| Check | Result |
|---|---|
| A bank on Wall Street | ✅ Big Apple Bank is marked on the map by Wall Street; the bank button (or tapping the marker) flies you there and opens it. The loan officer explains the starter loan the first time |
| Start small | ✅ only the $1,000 Starter Loan is open at first. Four bigger loans ($5k, $25k, $100k, $500k) unlock with a better credit score and more net worth; each shows what it needs |
| Interest and a due date | ✅ interest grows every game minute (1.2% a day at a poor score, down to 0.3% at an excellent one; a Fed rate hike makes new loans dearer); 7 to 30 day terms |
| Repay early or in parts | ✅ repay any amount (25/50/75%/all); paying on time raises your score (+45) |
| Miss it and there are consequences | ✅ on the due date the bank takes your cash and sells your shares. If that isn't enough: a 10% late fee, a higher rate, −90 score and 3 more days. Miss again: default, score 300 |
| The loan on screen | ✅ a Loan pill on the top bar shows what you owe and when (tap it to open the bank); net worth subtracts the debt; the portfolio shows the loan and your score |

## Roadmap

1. ✅ The New York map
2. ✅ City-builder foundation (since replaced by the trading UI from the reference videos)
3. ✅ The trading game and the reference style
4. ✅ Bank loan
5. **Buy property:** buy real buildings in Manhattan, starting with an office on Wall Street
6. **Customise your building:** rooms, desks and decor, seen from above with the roof off; hire brokers, employees and interns
7. **More cities:** unlock cities on the globe
8. **App stores:** wrap the game for the App Store and Google Play

## Putting it online

The game is a static website, so it can be hosted anywhere that serves files:

- **GitHub Pages (free, already used by this repo):** merge this branch into `main`, then in the repo go to Settings → Pages → Deploy from branch → `main` / root. The game is at `https://ranveer248.github.io/<repo-name>/capital-street/` (the repo is now named `Traffic-Rush`).
- **Its own address:** a new repo just for Capital Street gives `https://ranveer248.github.io/capital-street/`. Netlify or Cloudflare Pages work too: drag in the `capital-street` folder.
- **As an app:** open the site on a phone and choose "Add to Home Screen". It installs full-screen with its own icon.
- **App Store / Google Play:** wrap the same files with Capacitor. This needs an Apple developer account ($99 a year) and a Google Play account ($25 once).

## Map data

`data/` is baked by `tools/build_map.py` and is checked in, so the game needs no build step.

To rebuild it:

```sh
pip install pyarrow shapely requests numpy
cd tools
RAW=/some/scratch/dir
# Overture Maps (release 2026-10-21.0), read straight from its public S3 bucket
python3 grab.py buildings building      -74.03 40.69 -73.90 40.885 $RAW/nyc-building.parquet id,geometry,bbox,height,num_floors,min_height,facade_color,facade_material
python3 grab.py buildings building_part -74.03 40.69 -73.90 40.885 $RAW/nyc-building_part.parquet id,geometry,bbox,height,num_floors,min_height,building_id,facade_color,facade_material
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
