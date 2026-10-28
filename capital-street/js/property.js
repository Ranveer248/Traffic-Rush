// Capital Street property: tap any real building to see its listing, buy a floor or the whole building, collect rent.
// Styled after the reference videos' property auctions: the selected building turns yellow, listings carry a photo.
'use strict';
window.Property = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  let NYC = null, streetNames = [], streetGrid = new Map();
  const info$ = new Map(); // building number -> listing info (cached)

  // ---------- what a building is and what it costs ----------
  const WALL_A = ll(40.70745, -74.01115), WALL_B = ll(40.70470, -74.00610);
  function onWallSt(x, z) {
    const dx = WALL_B[0] - WALL_A[0], dz = WALL_B[1] - WALL_A[1], t = Math.max(0, Math.min(1, ((x - WALL_A[0]) * dx + (z - WALL_A[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - WALL_A[0] - dx * t, z - WALL_A[1] - dz * t) < 50;
  }
  const FIDI = ll(40.7075, -74.0100), MIDTOWN = ll(40.7549, -73.9840), PARKSIDE = ll(40.7812, -73.9665);
  const near = (x, z, p, r) => Math.exp(-((x - p[0]) ** 2 + (z - p[1]) ** 2) / (r * r));
  const locMult = (x, z) => 1 + 2.2 * near(x, z, FIDI, 1300) + 2.0 * near(x, z, MIDTOWN, 2000) + 0.6 * near(x, z, PARKSIDE, 2500);
  function streetNear(x, z) {
    let best = null, bd = 160 * 160;
    for (let gx = -1; gx <= 1; gx++) for (let gz = -1; gz <= 1; gz++) for (const s of streetGrid.get((Math.floor(x / 200) + gx) + ',' + (Math.floor(z / 200) + gz)) || []) {
      const d = (s[1] - x) ** 2 + (s[2] - z) ** 2; if (d < bd) { bd = d; best = s[0]; }
    }
    return best;
  }
  function info(g) {
    if (info$.has(g)) return info$.get(g);
    const list = (groups.get(g) || []).map(i => pieces[i]);
    if (!list.length) return null;
    const ground = list.filter(p => p.mh < 1);
    const footprint = Math.max(30, (ground.length ? ground : list).reduce((s, p) => s + p.area, 0));
    let maxH = 0, x = 0, z = 0, w = 0, big = list[0];
    for (const p of list) { maxH = Math.max(maxH, p.h); x += p.x * p.area; z += p.z * p.area; w += p.area; if (p.area > big.area) big = p; }
    x /= w; z /= w;
    const floors = Math.min(120, Math.max(1, Math.round(maxH / 3.6)));
    const mult = locMult(x, z), business = mult > 2.2, glass = big.sty === 0 || big.sty === 3;
    const type = floors <= 4 ? (big.sty === 2 && !business ? 'Townhouse' : 'Shop') : floors <= 12 ? (glass || business ? 'Offices' : 'Apartments') : (glass || business ? 'Office tower' : 'Residential tower');
    const kind = type === 'Townhouse' || type === 'Apartments' || type === 'Residential tower' ? 'homes' : type === 'Shop' ? 'shops' : floors > 12 ? 'towers' : 'offices';
    const floorPrice = Math.max(800, Math.round(footprint * 10 * mult * (kind === 'shops' ? 1.15 : kind === 'homes' ? 0.9 : 1) / 10) * 10);
    const wallSt = onWallSt(x, z), street = wallSt ? 'Wall Street' : streetNear(x, z);
    const num = 1 + (g * 2654435761 >>> 0) % 140;
    const name = street ? `${num} ${street}` : `Building ${g}`;
    const it = { g, type, kind, floors, footprint, maxH, x, z, floorPrice, street, name, color: big.col, wallSt };
    info$.set(g, it);
    return it;
  }
  // building numbers are per city: New York keeps plain numbers (older saves), other cities are "london:123"
  const key = g => CITY.id === 'nyc' ? String(g) : CITY.id + ':' + g;
  const isHere = k => CITY.id === 'nyc' ? !k.includes(':') : k.startsWith(CITY.id + ':');
  const gOf = k => Number(k.includes(':') ? k.split(':')[1] : k);
  const cityOf = k => k.includes(':') ? k.split(':')[0] : 'nyc';
  const owned = g => M.state.props[key(g)];
  const wholePrice = it => it.floors * it.floorPrice * M.state.reIndex * (it.floors > 1 ? 0.95 : 1);
  const perFloor = it => it.floorPrice * M.state.reIndex;

  // ---------- highlights: yellow for the selected building, green for yours ----------
  const pickMat = new THREE.MeshStandardMaterial({ color: lin(0xffd23f), emissive: lin(0x5a4100), roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const ownMat = new THREE.MeshStandardMaterial({ color: lin(0x2fd47a), emissive: lin(0x0b3b1c), roughness: 0.6, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  function shellGeo(g, grow) { // walls and roofs of all a building's pieces, pushed out a little
    const pos = [], idx = [], XY = NYC['b.xy'];
    for (const i of groups.get(g) || []) {
      const p = pieces[i], pts = [];
      for (let j = 0; j < p.k; j++) {
        const vx = XY[p.off + 2 * j] / 2, vz = XY[p.off + 2 * j + 1] / 2, dx = vx - p.x, dz = vz - p.z, l = Math.hypot(dx, dz) || 1;
        pts.push(new THREE.Vector2(vx + dx / l * grow, vz + dz / l * grow));
      }
      const base = pos.length / 3, y0 = Math.max(0, p.mh - 0.05), y1 = p.h + grow;
      for (const v of pts) pos.push(v.x, y0, v.y, v.x, y1, v.y);
      for (let j = 0; j < p.k; j++) { const a = base + 2 * j, b = base + 2 * ((j + 1) % p.k); idx.push(a, b + 1, b, a, a + 1, b + 1, a, b, b + 1, a, b + 1, a + 1); }
      for (const t of THREE.ShapeUtils.triangulateShape(pts, [])) idx.push(base + 2 * t[0] + 1, base + 2 * t[2] + 1, base + 2 * t[1] + 1, base + 2 * t[0] + 1, base + 2 * t[1] + 1, base + 2 * t[2] + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); geo.computeBoundingSphere();
    return geo;
  }
  let pickMesh = null, selected = null;
  const ownMeshes = new Map(), ownLabels = new Map();
  function highlight(g) {
    if (pickMesh) { scene.remove(pickMesh); pickMesh.geometry.dispose(); pickMesh = null; }
    if (g == null) return;
    pickMesh = new THREE.Mesh(shellGeo(g, 0.35), pickMat);
    pickMesh.renderOrder = 12; // no shadow casting: an extra caster here made every frame several times slower
    scene.add(pickMesh);
  }
  function drawOwned() {
    const have = new Set(Object.keys(M.state.props).filter(isHere).map(gOf));
    const hq = window.Office ? Office.hq() : null; // no green tint over your office: you look into it from above
    for (const [g, m] of ownMeshes) if (!have.has(g) || g === hq) { scene.remove(m); m.geometry.dispose(); ownMeshes.delete(g); }
    for (const [g, l] of ownLabels) if (!have.has(g)) { l.el.remove(); labels.splice(labels.indexOf(l), 1); ownLabels.delete(g); }
    for (const g of have) {
      if (!groups.has(g)) continue;
      const it = info(g), p = owned(g);
      if (!ownMeshes.has(g) && g !== hq) { const m = new THREE.Mesh(shellGeo(g, 0.25), ownMat); m.renderOrder = 11; scene.add(m); ownMeshes.set(g, m); }
      const txt = (g === hq ? 'YOUR OFFICE' : 'YOURS') + (p.floors >= it.floors ? '' : ` · ${p.floors}/${it.floors} floors`);
      if (!ownLabels.has(g)) { const l = label(txt, 'place mine', [it.x, it.z], it.maxH + 6, 0, 9000); l.el.onclick = () => select(g, true); ownLabels.set(g, l); }
      else ownLabels.get(g).el.textContent = txt;
    }
  }
  frameHooks.push(() => { // sink with the city when zooming out
    const hs = tiles.length ? tiles[0].mesh.scale.y : 1;
    if (pickMesh) pickMesh.scale.y = hs;
    for (const m of ownMeshes.values()) m.scale.y = hs;
  });

  // ---------- a photo of the building for its listing ----------
  const photos = new Map();
  // the photo is drawn straight onto the screen and copied before the browser shows it, then the normal view is
  // drawn again: no extra shaders to compile and the shadows already worked out are reused
  function photo(it) {
    if (photos.has(it.g)) return photos.get(it.g);
    const W = 320, H = 220, cv = renderer.domElement;
    // the crop below spans the full screen width, so set a 50° horizontal view whatever the screen's shape
    const aspect = cv.width / cv.height, fov = 2 * Math.atan(Math.tan(25 * Math.PI / 180) / aspect) * 180 / Math.PI;
    const cam = new THREE.PerspectiveCamera(fov, aspect, 1, 20000);
    const size = Math.max(it.maxH * 0.85, Math.sqrt(it.footprint) * 1.6, 18), d = size * 2.1, az = current().az + 0.5;
    cam.position.set(it.x + Math.sin(az) * d * 0.8, it.maxH * 0.5 + d * 0.55, it.z + Math.cos(az) * d * 0.8);
    cam.lookAt(it.x, it.maxH * 0.45, it.z);
    const was = pickMesh && pickMesh.visible, auto = renderer.autoClear, shadows = renderer.shadowMap.autoUpdate;
    if (pickMesh) pickMesh.visible = false;
    renderer.autoClear = true; renderer.shadowMap.autoUpdate = false;
    renderer.render(scene, cam);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const sw = Math.min(cv.width, cv.height * W / H), sh = sw * H / W; // the middle of the screen, cropped to the photo's shape
    out.getContext('2d').drawImage(cv, (cv.width - sw) / 2, (cv.height - sh) / 2, sw, sh, 0, 0, W, H);
    if (pickMesh) pickMesh.visible = was;
    renderer.render(scene, camera); // put the normal view back before anything is shown
    renderer.autoClear = auto; renderer.shadowMap.autoUpdate = shadows;
    const url = out.toDataURL('image/jpeg', 0.82);
    photos.set(it.g, url);
    return url;
  }
  function isoArt(it) { // a quick drawing for cards that have no photo yet
    const [r, g, b] = it.color, wall = `rgb(${r},${g},${b})`, side = `rgb(${r * 0.75 | 0},${g * 0.75 | 0},${b * 0.75 | 0})`;
    const hgt = Math.min(70, 8 + it.floors * 2.4), base = 96;
    return `<svg viewBox="0 0 160 110"><rect width="160" height="110" fill="#6aaa4c"/><polygon points="40,${base - 18} 80,${base} 80,${base - hgt} 40,${base - 18 - hgt}" fill="${wall}"/><polygon points="80,${base} 120,${base - 18} 120,${base - 18 - hgt} 80,${base - hgt}" fill="${side}"/><polygon points="40,${base - 18 - hgt} 80,${base - hgt} 120,${base - 18 - hgt} 80,${base - 36 - hgt}" fill="#3a3c42"/></svg>`;
  }

  // ---------- the listing card ----------
  const sheet = $('listing');
  function select(g, fly) {
    const it = info(g);
    if (!it) return;
    selected = g; highlight(g);
    if (fly) flyTo(view([it.x, it.z], Math.max(160, it.maxH * 2.2), 0.85, current().az, it.maxH * 0.45), 2.2, () => drawListing(true));
    $('ex').hidden = true; $('bank').hidden = true; $('props').hidden = true;
    drawListing(false);
  }
  function deselect() { selected = null; highlight(null); sheet.hidden = true; }
  function drawListing(withPhoto) {
    const it = info(selected); if (!it) return;
    const p = owned(selected), s = M.state, mine = p ? p.floors : 0, left = it.floors - mine;
    const income = it.floors * perFloor(it) * M.PROP_YIELD * 7;
    const pic = photos.get(it.g) || (withPhoto ? photo(it) : null);
    const trend = (s.reIndex - 1) * 100;
    sheet.innerHTML = `
      <div class="lsh"><b>PROPERTY LISTING</b><button id="lsX" aria-label="Close">✕</button></div>
      <div class="lpic">${pic ? `<img src="${pic}" alt="">` : isoArt(it)}<span class="tag ${p ? 'own' : ''}">${p ? (left ? `You own ${mine} of ${it.floors} floors` : 'YOURS') : 'FOR SALE'}</span></div>
      <div class="lbody">
        <div class="lt"><div><b>${it.type}</b><span>${it.name}</span></div><div class="lp"><strong>${usd(wholePrice(it))}</strong><span>${it.floors > 1 ? usd(perFloor(it)) + ' a floor' : 'whole building'}</span></div></div>
        <div class="stats">
          <div>Floors<b>${it.floors}</b></div><div>Floor area<b>${Math.round(it.footprint).toLocaleString('en-US')} m²</b></div><div>Height<b>${Math.round(it.maxH)} m</b></div><div>Rent income<b class="up">${usd(income)}/wk</b></div>
          <div>Market<b class="${trend >= 0 ? 'up' : 'dn'}">${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%</b></div><div>Your cash<b>${usd(s.cash, 2)}</b></div>${p ? `<div>Your value<b>${usd(p.floors * M.floorValue(p))}</b></div><div>Rent earned<b class="up">${usd(p.earned, 2)}</b></div>` : ''}
        </div>
        <div class="lbtns">
          ${left > 0 && it.floors > 1 ? `<button class="buy" data-buy="1">Buy 1 floor · ${usd(perFloor(it))}</button>` : ''}
          ${left > 0 ? `<button class="buy" data-buy="${left}">${mine ? `Buy the other ${left} floors` : it.floors > 1 ? 'Buy the whole building' : 'Buy it'} · ${usd(mine ? left * perFloor(it) : wholePrice(it))}</button>` : ''}
          ${p && p.floors > 1 ? `<button class="sell" data-sell="1">Sell 1 floor · ${usd(M.floorValue(p) * (1 - M.PROP_FEE))}</button>` : ''}
          ${p ? `<button class="sell" data-sell="${p.floors}">Sell ${p.floors > 1 ? 'everything' : 'it'} · ${usd(p.floors * M.floorValue(p) * (1 - M.PROP_FEE))}</button>` : ''}
          ${p && window.Office ? (Office.hq() === it.g ? '<button class="buy" id="lsOffice">Enter your office</button>' : '<button class="plain" id="lsOffice">Make this my office</button>') : ''}
          <button class="plain" id="lsFly">Fly there</button>
        </div>
        <p class="note">Tenants pay rent every night. Prices follow the New York property market, which crashes and booms with everything else. Selling costs ${M.PROP_FEE * 100}%.</p>
      </div>`;
    sheet.hidden = false;
    $('lsX').onclick = deselect;
    $('lsFly').onclick = () => select(selected, true);
    if ($('lsOffice')) $('lsOffice').onclick = () => { if (Office.hq() !== it.g) { Office.setHQ(it.g); drawListing(false); } else Office.enter(); };
    sheet.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const n = +b.dataset.buy, cost = mine || n === 1 || it.floors === 1 ? n * perFloor(it) : wholePrice(it);
      CSUI.story(`<small>BUY PROPERTY</small><b>${it.type} at ${it.name}</b><p>${n === it.floors ? 'The whole building' : n + ' floor' + (n > 1 ? 's' : '')} for ${usd(cost)}. It earns about ${usd(n * perFloor(it) * M.PROP_YIELD * 7)} a week in rent.</p>`,
        [['Buy it', () => { const r = M.buyProperty(key(it.g), n, { name: it.name, type: it.type, floorPrice: it.floorPrice, totalFloors: it.floors, x: it.x, z: it.z, city: CITY.id }); if (!r.ok) toast('Can\'t buy', r.why); drawListing(true); }], ['Not now', () => {}]]);
    });
    sheet.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const r = M.sellProperty(key(it.g), +b.dataset.sell); if (!r.ok) toast('Can\'t sell', r.why); if (selected != null) drawListing(true); });
  }
  function tap(ray) {
    const meshes = tiles.filter(t => t.mesh.visible).map(t => t.mesh);
    const hit = ray.intersectObjects(meshes, false)[0];
    if (!hit) { if (selected != null) { deselect(); return true; } return false; }
    const t = tiles.find(t => t.mesh === hit.object), i = t.pid[hit.face.a];
    select(pieces[i].g, false);
    setTimeout(() => { if (selected === pieces[i].g) drawListing(true); }, 30); // take the photo after this frame
    return true;
  }

  // ---------- the listings screen ----------
  const panel = $('props');
  let tab = 'sale', kind = 'all', maxPrice = Infinity, inView = true, sort = 'cheap';
  const KINDS = [['all', 'All'], ['homes', 'Homes'], ['shops', 'Shops'], ['offices', 'Offices'], ['towers', 'Towers']];
  const PRICES = [[Infinity, 'Any price'], [10000, 'Under $10k'], [50000, 'Under $50k'], [250000, 'Under $250k'], [1e6, 'Under $1M']];
  function goal() { // the dream: an office on Wall Street, the best-placed office building near it
    if (CITY.id !== 'nyc') return null;
    let best = null, bd = Infinity;
    for (const g of groups.keys()) {
      const p = pieces[groups.get(g)[0]];
      if ((p.x - PLACE.wall[0]) ** 2 + (p.z - PLACE.wall[1]) ** 2 > 450 ** 2) continue;
      const it = info(g); if (!it || !it.wallSt || it.floors < 6 || !/Office/.test(it.type)) continue;
      const d = it.floorPrice; // the cheapest floor on Wall Street
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }
  function card(it) {
    const p = owned(it.g);
    return `<button class="pcard" data-g="${it.g}"><div class="pp">${photos.get(it.g) ? `<img src="${photos.get(it.g)}" alt="">` : isoArt(it)}${p ? '<span class="tag own">YOURS</span>' : ''}</div>
      <b>${it.floors > 1 ? 'from ' + usd(perFloor(it)) : usd(wholePrice(it))}</b><span>${it.type} · ${it.floors} floor${it.floors > 1 ? 's' : ''}</span><span>${it.name}</span></button>`;
  }
  function drawPanel() {
    const s = M.state;
    document.querySelectorAll('#props .tabs button').forEach(b => b.classList.toggle('on', b.dataset.pt === tab));
    let html = '';
    if (tab === 'sale') {
      const gl = goal();
      if (gl && !owned(gl.g)) html += `<div class="goal" data-g="${gl.g}"><small>★ YOUR GOAL</small><b>An office on Wall Street</b><span>${gl.name}: ${gl.floors} floors, from ${usd(perFloor(gl))} a floor</span></div>`;
      html += `<div class="chips">${KINDS.map(([k, n]) => `<button data-k="${k}" class="${k === kind ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="chips">${PRICES.map(([v, n]) => `<button data-mp="${v}" class="${v === maxPrice ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="chips"><button id="pView" class="${inView ? 'on' : ''}">In view only</button><button data-s="cheap" class="${sort === 'cheap' ? 'on' : ''}">Cheapest</button><button data-s="big" class="${sort === 'big' ? 'on' : ''}">Biggest</button></div>`;
      const t = controls.target, R = Math.max(500, current().dist * 0.9), list = [];
      for (const g of groups.keys()) {
        const p = pieces[groups.get(g)[0]];
        if (inView && (p.x - t.x) ** 2 + (p.z - t.z) ** 2 > R * R) continue;
        const it = info(g);
        if (!it || it.footprint < 60 || (kind !== 'all' && it.kind !== kind)) continue;
        if ((it.floors > 1 ? perFloor(it) : wholePrice(it)) > maxPrice) continue;
        list.push(it);
      }
      list.sort(sort === 'cheap' ? (a, b) => perFloor(a) - perFloor(b) : (a, b) => b.footprint * b.floors - a.footprint * a.floors);
      html += `<p class="note">${list.length.toLocaleString('en-US')} buildings${inView ? ' in view' : ' in Manhattan'}${list.length > 60 ? ', showing 60' : ''}</p><div class="pgrid">${list.slice(0, 60).map(card).join('')}</div>`;
    } else {
      const all = Object.entries(s.props), mine = all.filter(([k]) => isHere(k)).map(([k, p]) => [gOf(k), p]), away = all.length - mine.length;
      const val = M.propValue(), earned = mine.reduce((a, [, p]) => a + p.earned, 0);
      html += `<div class="cards"><div>Property value<b>${usd(val)}</b></div><div>Rent earned<b class="up">${usd(earned, 2)}</b></div><div>Buildings<b>${mine.length}</b></div></div>`;
      if (away) html += `<p class="note">+ ${away} building${away > 1 ? 's' : ''} in your other cities (see the portfolio).</p>`;
      html += mine.length ? `<div class="pgrid">${mine.map(([g]) => info(+g)).filter(Boolean).map(card).join('')}</div>` : '<p class="note">You don\'t own any property yet. Tap any building on the map to see its listing.</p>';
    }
    $('propsBody').innerHTML = html;
    snapQueue = [...$('propsBody').querySelectorAll('.pcard')].map(c => +c.dataset.g).filter(g => !photos.has(g)).slice(0, 24);
    $('propsBody').querySelectorAll('[data-g]').forEach(b => b.onclick = () => select(+b.dataset.g, true));
    $('propsBody').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { kind = b.dataset.k; drawPanel(); });
    $('propsBody').querySelectorAll('[data-mp]').forEach(b => b.onclick = () => { maxPrice = +b.dataset.mp; drawPanel(); });
    $('propsBody').querySelectorAll('[data-s]').forEach(b => b.onclick = () => { sort = b.dataset.s; drawPanel(); });
    if ($('pView')) $('pView').onclick = () => { inView = !inView; drawPanel(); };
  }
  // listing photos are taken a few at a time while the screen is open, so it never stalls
  let snapQueue = [], snapT = 0;
  frameHooks.push(dt => {
    if (panel.hidden || !snapQueue.length || (snapT += dt) < 0.2) return;
    snapT = 0;
    const g = snapQueue.shift(), it = info(g), url = it && photo(it), el = url && $('propsBody').querySelector(`.pcard[data-g="${g}"] .pp`);
    if (el) { const tag = el.querySelector('.tag'); el.innerHTML = `<img src="${url}" alt="">`; if (tag) el.appendChild(tag); }
  });
  function open(which = 'sale') { tab = which; $('ex').hidden = true; $('bank').hidden = true; sheet.hidden = true; panel.hidden = false; drawPanel(); }
  document.querySelectorAll('#props .tabs button').forEach(b => b.onclick = () => { tab = b.dataset.pt; drawPanel(); });
  $('propsX').onclick = () => { panel.hidden = true; };

  M.on((type, d) => {
    if (type === 'property') {
      drawOwned();
      if (d.kind === 'bought') {
        toast('Property bought', `${d.floors} floor${d.floors > 1 ? 's' : ''} for ${usd(d.cost)}. Rent starts tonight.`);
        const it = isHere(d.id) ? info(gOf(d.id)) : null;
        if (it && /Office/.test(it.type) && it.wallSt && !M.state.wallOffice) {
          M.state.wallOffice = true; M.save();
          CSUI.story(`<small>MILESTONE</small><b>Your first office on Wall Street.</b><p>A few days ago you were counting coins for rent. Now you have a key to ${it.name}. Next: fill it with desks, screens and people.</p>`, [['Go inside', () => Office.enter()]]);
        }
      }
      if (d.kind === 'sold') toast('Property sold', `${d.floors} floor${d.floors > 1 ? 's' : ''} for ${usd(d.gets)}.`);
      if (d.kind === 'income') toast('Rent collected', `Your tenants paid ${usd(d.income, 2)} overnight.`);
      if (!panel.hidden) drawPanel();
    }
    // the open listing only redraws when something it shows changes, so taps on its buttons never get lost
    if (['property', 'fill', 'loan', 'event'].includes(type) && !sheet.hidden && selected != null) drawListing(false);
  });

  function init(nyc, names) {
    NYC = nyc; streetNames = names;
    const I = nyc['sl.i'], XY = nyc['sl.xy'];
    for (let i = 0; i < I.length; i++) {
      const x = XY[2 * i] / 2, z = XY[2 * i + 1] / 2, k = Math.floor(x / 200) + ',' + Math.floor(z / 200);
      if (!streetGrid.has(k)) streetGrid.set(k, []);
      streetGrid.get(k).push([names[I[i]], x, z]);
    }
    drawOwned();
  }
  return { init, tap, select, open, info, goal, deselect, refreshOwned: drawOwned, key, isHere, gOf, cityOf, debug: () => ({ meshes: ownMeshes.size, labels: [...ownLabels.values()].map(l => [l.el.textContent, l.on, l.p.y]) }) };
})();
