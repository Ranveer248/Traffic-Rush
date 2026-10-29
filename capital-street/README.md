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

## Goal 5: buy property ✅

| Check | Result |
|---|---|
| Tap any real building | ✅ any of Manhattan's buildings can be tapped (all parts of a building count as one): it turns yellow, like the reference video, and its listing opens with a photo of the building, its type, street, floors, floor area, height, price and weekly rent income |
| Browse listings | ✅ a property screen (key button in the dock) lists buildings with photos; filter by Homes, Shops, Offices or Towers and by price, show only what's in view, sort by cheapest or biggest |
| Your first office on Wall Street | ✅ the listings open with the goal: the cheapest office floor in a building on Wall Street. Buy a single floor of a tower, or a whole building (5% off). Owning an office on Wall Street triggers a milestone |
| Yours on the map | ✅ owned buildings are tinted green with a "YOURS" marker (or "YOURS · 3/47 floors"); tap it to open the listing |
| Rent and prices | ✅ tenants pay rent every night (about 2.8% of the value a week); prices follow a New York property index that drifts daily and falls in crashes, plane crashes, hurricanes, blackouts and rate hikes |
| Sell, and it counts | ✅ sell a floor or everything (6% fee); property counts toward net worth and shows in the portfolio. If rent or a loan can't be paid, shares are sold first, then property |

## Goal 6: your office and staff ✅

| Check | Result |
|---|---|
| Your office, roof off | ✅ the first office floor you buy becomes your office (or pick any building you own: "Make this my office"). The briefcase button, or "Enter your office" on its listing, looks straight down into the top floor: the roof, rooftop machinery and any tiled roof are lifted off, leaving a wooden floor inside the building's real outline |
| Furnish it | ✅ 13 items in 4 groups (desks, trading desks, meeting tables, plants, coffee machine, water cooler, sofas, ping-pong, rugs, bookshelves, walls, server racks, news screens), placed by tapping a grid on the floor; rotate, or remove for half back. Furniture counts toward net worth at half its price |
| Hire staff | ✅ every day new interns, employees and brokers apply, each with a name, skill stars, a salary and a hiring fee. Everyone needs a desk; brokers need a trading desk. They sit at their desks as round-headed people, like the reference videos |
| They earn (or lose) money | ✅ every night: interns and employees bring in office income; brokers trade for you, riding the day's market, with the odd monster day or disaster day; salaries are paid. A nightly report shows the profit or loss |
| Vibe | ✅ plants, coffee, sofas, ping-pong and more raise the office vibe (30 to 100), which sets how fast people work (60% to 140%). A gloomy office makes people quit |
| Promotions and surprises | ✅ interns can be promoted to employees after 5 days, employees to brokers after 10; staff you can't pay quit; selling the building closes the office |

## Goal 7: more cities ✅

| Check | Result |
|---|---|
| Cities on the globe | ✅ New York, London, Tokyo, Hong Kong and Dubai have markers on the zoomed-out map and globe: ● where you are, ✓ open, 🔒 locked. Tap one for its card |
| Unlock with money | ✅ each city needs a net worth and an opening fee in cash: London $150k / $20k, Tokyo $500k / $60k, Hong Kong $1.2M / $150k, Dubai $3M / $350k. The card shows your progress |
| Real streets and buildings | ✅ every city is baked from Overture Maps like New York: its own buildings, roads, parks, water and coastline, with its own districts and landmarks labelled |
| Travel | ✅ "Fly to …" zooms out to the globe and flies you into the new city; the house button flies you home to New York. Cash, shares, loans, buildings and staff go with you |
| Its own companies | ✅ 4 companies per city (16 more in all) join your Share Exchange when you open a branch; until then they can't be traded |
| Its own property | ✅ buildings in every city can be bought, rented out and sold, and any of them can become your office |

## Goal 8: the app ✅ (store upload waits on your developer accounts)

| Check | Result |
|---|---|
| Works offline | ✅ three.js and the fonts are now inside the game (`lib/`, `fonts/`) instead of loaded from the internet. Tested with every outside request blocked: the game loads with no errors |
| Android app | ✅ `capital-street-app/` wraps the game with Capacitor. GitHub Actions builds an installable APK on every change (first run: 17.5 MB, all five cities inside) |
| iPhone app | ✅ the Xcode project builds on GitHub's Mac runner (Xcode 26.6, passes Apple's store validation step) |
| Feels like an app | ✅ own icon and splash screen, portrait only, no status bar, Android back button closes the open panel, the game saves when you leave the app |
| Store ready | ✅ privacy policy (`privacy.html`), store listing text, and the signing and upload steps are wired into the build. They switch on once you add your Google Play and Apple keys as GitHub secrets: see `capital-street-app/README.md` |

## Goal 9: buildings that look like where they're built ✅

From the first new reference video ("every building looks like the place it's built in").

| Check | Result |
|---|---|
| Every building has a type | ✅ house, terraced house, apartments, shop, office, tower, factory or landmark, worked out from the map's own tags, the 550,000 real places in the five cities (shops, restaurants, offices, factories, churches, schools) that fall inside each building and the building's size and shape. New York: 1,415 houses, 23,914 terraced and walk-up buildings, 15,945 apartment buildings, 4,500 office buildings, 468 factories, 2,387 landmarks |
| 12 materials | ✅ red brick, brownstone, yellow brick, grey stone, limestone, white stucco, painted plaster, timber frame, concrete, glass, wood siding and ribbed metal. Up close the shader draws brick courses, stone blocks, oak beams, boards and ribs |
| Each type looks different | ✅ houses get front doors and small framed windows, terraces tall narrow windows, offices window bands, towers glass or stone piers, landmarks tall arched windows, factories a strip of high windows and loading doors, shops display windows under coloured or striped awnings |
| Each city has its own style | ✅ New York brownstones, brick walk-ups and water towers; London yellow-brick and white-stucco terraces under slate with rows of chimneys; Tokyo concrete and plaster with dark tile and blue metal roofs; Hong Kong concrete towers; Dubai sandstone and white stucco with domes |
| Attics, chimneys, solar panels | ✅ pitched roofs get attic dormers along both slopes and an attic window in each gable; chimneys on the ridge; solar panels on sunny slopes and in rows on flat roofs |
| Domes, spires, battlements | ✅ domes with a drum and lantern (copper, gold or stone) on churches, mosques, civic buildings and some towers; spires on churches; castle battlements on old stone landmarks. New York: 328 domes, 362 spires, 201 battlemented roofs |
| Factories | ✅ sawtooth roofs with rows of north-light windows on big factories and warehouses (129 in New York, 148 in London) |
| No frame-rate loss | ✅ by draw calls and triangles, measured at the same views before and after: city view 605 draw calls and 4.5M triangles (before: 509 and 4.1M), street view 591 and 7.7M (before: 1,642 and 7.8M). All rooftop things and crowns are now drawn in one batch per kind, and crowns hide before the city sinks into the map. Frame times on this cloud machine's software renderer swing by ±50% between runs, so the heavier facade shader still needs a look on a real PC |

## Goal 10: PC-first, smooth, and a proper main menu ✅

Designed first in Figma ([Capital Street — PC UI](https://www.figma.com/design/U7FfBzmGHr4QYbCReSROtb)): colour, spacing and radius tokens, reusable components (buttons, menu items, stat chips, dock buttons, key caps, toggles, segmented controls) and four 1920×1080 screens: main menu, in-game HUD, settings and pause. Dark glass panels over the city, one green accent, and the keyboard shortcut shown next to everything, like current PC simulators.

| Check | Result |
|---|---|
| Main menu | ✅ a left column (title, Play or Continue with your day, city and net worth, New game, World, Settings, Credits) over the city turning slowly behind it; on PC a "Your empire" card and the market status; arrow keys, Enter and each item's letter work; New game asks twice before erasing a save |
| PC layout | ✅ clock bar top left, money chips top centre, settings and pause buttons top right, a labelled dock with each key (B, X, H, P, O, M), panels docked on the right so the city stays in view, and the dock slides into the visible part of the city |
| Mouse and keyboard | ✅ W A S D or arrows move, Q E turn, R F zoom, Shift goes faster, Space pauses time, 1 2 3 set the speed, Esc closes a panel or opens the pause menu, F10 settings, F3 frame rate, ? lists every key |
| Pause menu | ✅ Resume, Settings, World map, Save and quit to menu; time stops while it's open, and in the main menu |
| Graphics settings | ✅ presets (Low, Medium, High, Ultra), resolution scale, frame-rate limit (30, 60, 120, Max), sun shadows (Off, Low, High), anti-aliasing, building detail, frame-rate counter; saved on the device |
| Smooth | ✅ "Keep 60 fps automatically" lowers the resolution 10% after 2 slow seconds and raises it again after 5 smooth ones (tested: on this slow cloud machine it stepped down by itself) |
| Phones still work | ✅ the same menu as a stack with a big green Play, a pause button in the clock bar, no key hints on touch screens |

## Roadmap

1. ✅ The New York map
2. ✅ City-builder foundation (since replaced by the trading UI from the reference videos)
3. ✅ The trading game and the reference style
4. ✅ Bank loan
5. ✅ Buy property
6. ✅ Your office and staff
7. ✅ More cities
8. ✅ The app (Android and iPhone builds; publishing needs your store accounts)

### Phase 2: a player-run world, on PC, multiplayer

From the 5 new reference videos (a player-run economy game on the real world map). We build the same kind of game, better, one goal at a time, with our own name, art and code (see Legal below).

9. ✅ **Buildings that look like where they're built:** house, terrace, apartments, shop, office, tower, factory, church; each city's own style; 12 facade materials; attics, chimneys, solar panels, domes, battlements, sawtooth factory roofs, shopfronts
10. ✅ **PC-first and smooth:** a perfect main menu and HUD designed in Figma from trending simulator UIs, mouse and keyboard controls, graphics settings, 60 fps
11. ✅ **Multiplayer:** accounts and one shared world; everyone sees who owns what; chat
12. **Real land and buildings for everyone:** land plots on the map; a Zillow-style property market with photos, filters and auctions with max bids; everything for sale lights up
13. **Businesses:** farms, mines, oil rigs and shops on your land; NPC income that rewards setup cost and effort without inflating the economy
14. **Player-set markets:** an item exchange where players set every price; production chains from raw resources to finished goods; a factory planner
15. **Inside buildings:** rooms, furniture, renting rooms to players and NPCs, extensions and basements, temperature (heat from machines, cooling, happy tenants and workers)
16. **Companies and the stock market:** start a company, take it public, players trade its shares
17. **Logistics:** ports, ships and trucks moving goods between cities
18. **Wiki, changelog and community**
19. **Launch on PC:** hosting for a game of any size, then a desktop download (Steam / itch.io)

## Legal

Not legal advice: have a lawyer read these before a paid launch.

- [Terms of Service](terms.html): game money has no real value, no real-money trading, nothing is financial advice, real places appear only as a map and their owners aren't connected to the game, fair-play and chat rules, the game is our own work and not connected to any other game, takedown contact.
- [Privacy Policy](privacy.html): playing alone collects nothing; playing online keeps only a player name, owned buildings, chat, reported net worth and (optionally) an email, on Supabase as our processor; delete-my-account in the game removes it all; age rules match the Terms.
- [Credits](credits.html): every outside source and its licence (OpenStreetMap ODbL attribution, Overture, Natural Earth, three.js MIT, supabase-js MIT, fonts OFL, Capacitor MIT).
- Linked from the title screen.
- How we avoid copying the reference game: we build the same *kind* of game (game ideas and mechanics can't be owned), but never use its name, logo, art, text, UI layouts or code. Our name, buildings, characters, companies and UI are our own. Real company names and logos stay out of the game.

## Turning on multiplayer

Online play needs a free [Supabase](https://supabase.com) project. Until one is set, the game plays alone exactly as before and the menu says "Solo".

1. Create a project (free plan is fine), open **SQL Editor**, paste all of [`server/schema.sql`](server/schema.sql) and run it. It is safe to run again after updates.
2. **Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins** (for "Play online as a guest") and keep **Email** on. Optional: turn off "Confirm email" while testing.
3. **Project Settings → API Keys:** copy the project URL and the **publishable** key (`sb_publishable_...`, or the legacy `anon` key) into [`js/net-config.js`](js/net-config.js). Never put the `service_role` / secret key in the game: everything in it is public.
4. Reload the game. The chip next to your cash turns into "Sign in"; press **O** in the menu or **T** in the game.

Who may change what is enforced by the database itself (row-level security plus two checked functions), not by the game, so a modified game can't take someone else's building, post as someone else or rename them.


The game is a static website, so it can be hosted anywhere that serves files:

- **GitHub Pages (free, already used by this repo):** merge this branch into `main`, then in the repo go to Settings → Pages → Deploy from branch → `main` / root. The game is at `https://ranveer248.github.io/<repo-name>/capital-street/` (the repo is now named `Traffic-Rush`).
- **Its own address:** a new repo just for Capital Street gives `https://ranveer248.github.io/capital-street/`. Netlify or Cloudflare Pages work too: drag in the `capital-street` folder.
- **As an app:** open the site on a phone and choose "Add to Home Screen". It installs full-screen with its own icon.
- **When it gets big (more cities, the whole world):** GitHub refuses single files over 100 MB and slows down past a few GB. Plan: the game itself on **Cloudflare Pages** (free; files up to 25 MB, 20,000 files) and the big map data on **Cloudflare R2** (10 GB free, then $0.015 per GB a month, and no fee for players downloading it). Cities stream in as you visit them, so a multi-gigabyte world never has to download at once.
- **On PC as a download:** **Steam** ($100 per game, paid back once the game makes $1,000) or **itch.io** (free; downloads up to 1 GB per file). The same files run in a desktop window.
- **App Store / Google Play:** done with Capacitor in `capital-street-app/`. GitHub Actions builds the apps; publishing needs an Apple developer account ($99 a year) and a Google Play account ($25 once). Step-by-step: `capital-street-app/README.md`.

## Map data

`data/` is baked by `tools/build_map.py` and is checked in, so the game needs no build step.

To rebuild it:

```sh
pip install pyarrow shapely requests numpy
cd tools
RAW=/some/scratch/dir
# Overture Maps (release 2026-10-21.0), read straight from its public S3 bucket
python3 grab.py buildings building      -74.03 40.69 -73.90 40.885 $RAW/nyc-building.parquet id,geometry,bbox,height,num_floors,min_height,min_floor,roof_shape,roof_height,class,names,facade_color,roof_color,facade_material,roof_material
python3 grab.py buildings building_part -74.03 40.69 -73.90 40.885 $RAW/nyc-building_part.parquet id,geometry,bbox,height,num_floors,min_height,min_floor,roof_shape,roof_height,names,building_id,facade_color,roof_color,facade_material,roof_material
# shops, offices, factories, churches...: used to tell what each building is
python3 grab.py places place -74.03 40.69 -73.90 40.885 $RAW/nyc-places.parquet id,geometry,bbox,categories,basic_category,taxonomy,names,confidence
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

The other cities use the same Overture files (building, building_part, places, land_use, segments, and a wider land and water box for the coastline) saved in `$RAW/cities/<city>/` as `building.parquet`, `building_part.parquet`, `places.parquet`, `landuse.parquet`, `segments.parquet`, `region-land.parquet` and `region-water.parquet`. Each city's look (materials per building type, roof colours, how often attics, chimneys, solar panels, domes and water towers appear) is in `STYLE` in `build_map.py`. Their boxes are in `CITIES` at the top of `build_map.py`. Bake one city with `python3 build_map.py $RAW ../data london`, or the world map with `... world`.

Map data © OpenStreetMap contributors and Overture Maps Foundation (ODbL / CDLA-Permissive-2.0). Country shapes: Natural Earth (public domain). three.js: MIT licence (`lib/three-LICENSE.txt`). Fonts: Inter and Archivo Black, SIL Open Font License.
