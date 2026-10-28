// Capital Street city dressing in the style of the reference videos: pitched tiled roofs and chimneys, lane markings and
// zebra crossings, cars and people on the streets, your apartment's interior, and smoke when disaster strikes.
// Runs after the main page script; the page calls these builders once the map data has loaded.
'use strict';

const ROAD_W = [20, 18, 16, 14, 12, 10, 9, 7, 5, 8]; // by class id, same order as tools/build_map.py WIDTH
const cityTiles = []; // { mesh, kind } for culling and the zoom-out sink
const frameHooks = [];

function tileOf(x, z, size = 1000) { return Math.floor(x / size) + ',' + Math.floor(z / size); }
function geoMesh(pos, nor, col, extra, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(col), 3, true));
  for (const [k, [arr, n]] of Object.entries(extra || {})) g.setAttribute(k, new THREE.Float32BufferAttribute(arr, n));
  g.computeBoundingSphere();
  return new THREE.Mesh(g, mat);
}

// ---------- pitched roofs: gables and hips with tile rows ----------
const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.35 });
roofMat.onBeforeCompile = sh => {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 rt;\nvarying vec2 vRt;\nvarying vec3 vRP;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvRt = rt;\nvRP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRt;\nvarying vec3 vRP;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 c = pow(diffuseColor.rgb, vec3(2.2));
      if (vRt.y > 0.5) { // tiles: rows down the slope, staggered columns, a little colour noise per tile
        float row = vRP.y / 0.3, fr = fract(row), wr = fwidth(row);
        float col = (vRt.x + mod(floor(row), 2.0) * 0.22) / 0.44, fc = fract(col), wc = fwidth(col);
        float n = fract(sin(dot(floor(vec2(col, row)), vec2(12.9898, 78.233))) * 43758.5453);
        float far = smoothstep(0.25, 0.6, max(wr, wc));
        c *= mix(0.86 + 0.22 * n, 1.0, far);
        c *= 1.0 - (1.0 - smoothstep(0.0, 0.2 + wr, fr)) * 0.35 * (1.0 - far);
        c *= 1.0 - (1.0 - smoothstep(0.0, 0.08 + wc, fc)) * 0.2 * (1.0 - far);
      }
      diffuseColor.rgb = c;`);
};
const pitched = { F: null, G: null, C: null, tiles: new Map(), hidden: () => false }; // tile -> { mesh, list of roofs }
function pitchedGeo(list) {
  const { F, G, C } = pitched, b = { pos: [], nor: [], col: [], rt: [] };
  for (const i of list) {
    const [x, z, a, L, W, y, rise] = F.subarray(7 * i, 7 * i + 7), gable = G[i];
    if (pitched.hidden(x, z)) continue; // the roof over your office is lifted off
    const ca = Math.cos(a), sa = Math.sin(a), hl = L / 2, hw = W / 2, r = gable ? hl : Math.max(0, hl - hw);
    const P = (lx, ly, lz) => [x + ca * lx - sa * lz, y + ly, z + sa * lx + ca * lz];
    const A = P(-hl, 0, -hw), B = P(hl, 0, -hw), Cc = P(hl, 0, hw), D = P(-hl, 0, hw), R1 = P(-r, rise, 0), R2 = P(r, rise, 0);
    const roofC = [C[6 * i], C[6 * i + 1], C[6 * i + 2]], wallC = [C[6 * i + 3], C[6 * i + 4], C[6 * i + 5]];
    const tri = (p, q, s, colr, isRoof, along) => {
      const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], e2 = [s[0] - p[0], s[1] - p[1], s[2] - p[2]];
      const nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0], l = Math.hypot(nx, ny, nz) || 1;
      for (const [v, u] of [[p, along[0]], [q, along[1]], [s, along[2]]]) { b.pos.push(...v); b.nor.push(nx / l, ny / l, nz / l); b.col.push(...colr); b.rt.push(u, isRoof); }
    };
    const ax = v => (v[0] - x) * ca + (v[2] - z) * sa; // position along the ridge, for tile columns
    if (r > 0.01) { tri(A, R2, B, roofC, 1, [ax(A), ax(R2), ax(B)]); tri(A, R1, R2, roofC, 1, [ax(A), ax(R1), ax(R2)]); tri(Cc, R1, D, roofC, 1, [ax(Cc), ax(R1), ax(D)]); tri(Cc, R2, R1, roofC, 1, [ax(Cc), ax(R2), ax(R1)]); }
    else { tri(A, R2, B, roofC, 1, [ax(A), ax(R2), ax(B)]); tri(Cc, R1, D, roofC, 1, [ax(Cc), ax(R1), ax(D)]); }
    const endC = gable ? wallC : roofC, endR = gable ? 0 : 1;
    const ac = v => (v[0] - x) * -sa + (v[2] - z) * ca; // across the ridge, for hip tiles
    tri(B, R2, Cc, endC, endR, [ac(B), ac(R2), ac(Cc)]); tri(D, R1, A, endC, endR, [ac(D), ac(R1), ac(A)]);
  }
  return geoMesh(b.pos, b.nor, b.col, { rt: [b.rt, 2] }, roofMat).geometry;
}
function buildPitched(d) {
  Object.assign(pitched, { F: d['p.f'], G: d['p.g'], C: d['p.c'] });
  const lists = new Map();
  for (let i = 0; i < pitched.G.length; i++) {
    const key = tileOf(pitched.F[7 * i], pitched.F[7 * i + 1]);
    if (!lists.has(key)) lists.set(key, []);
    lists.get(key).push(i);
  }
  for (const [key, list] of lists) {
    const m = new THREE.Mesh(pitchedGeo(list), roofMat);
    m.castShadow = m.receiveShadow = true; m.renderOrder = 10;
    scene.add(m); cityTiles.push({ mesh: m, kind: 'roof' });
    pitched.tiles.set(key, { mesh: m, list });
  }
}
// rebuild the roofs near a spot, after pitched.hidden has changed
function refreshPitched(x, z) {
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    const t = pitched.tiles.get(tileOf(x + dx * 1000, z + dz * 1000));
    if (t) { t.mesh.geometry.dispose(); t.mesh.geometry = pitchedGeo(t.list); }
  }
}

// ---------- lane markings and zebra crossings ----------
function lines(d) {
  const N = d['l.n'], Cl = d['l.c'], XY = d['l.xy'], out = [];
  let p = 0;
  for (let i = 0; i < N.length; i++) { const pts = []; for (let j = 0; j < N[i]; j++, p += 2) pts.push([XY[p], XY[p + 1]]); out.push({ pts, cls: Cl[i], w: ROAD_W[Cl[i]] }); }
  return out;
}
function buildMarkings(d, L) {
  const bins = new Map(), Y = 0.06;
  const bin = (x, z) => { const k = tileOf(x, z); let b = bins.get(k); if (!b) bins.set(k, b = { pos: [], col: [] }); return b; };
  const quad = (b, ax, az, bx, bz, half, off, col) => { // a strip from a to b, offset sideways
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    const o1 = off - half, o2 = off + half;
    const v = [[ax + nx * o1, az + nz * o1], [bx + nx * o1, bz + nz * o1], [bx + nx * o2, bz + nz * o2], [ax + nx * o2, az + nz * o2]];
    for (const k of [0, 2, 1, 0, 3, 2]) { b.pos.push(v[k][0], Y, v[k][1]); b.col.push(...col); }
  };
  const YEL = [232, 190, 60], WHT = [236, 236, 230];
  for (const { pts, cls, w } of L) {
    if (cls > 7) continue; // no markings on service roads
    for (let j = 0; j < pts.length - 1; j++) {
      const [ax, az] = pts[j], [bx, bz] = pts[j + 1], b = bin(ax, az), len = Math.hypot(bx - ax, bz - az);
      if (cls <= 4) { quad(b, ax, az, bx, bz, 0.08, 0.17, YEL); quad(b, ax, az, bx, bz, 0.08, -0.17, YEL); }
      const dashes = (off) => { for (let s = 1; s + 3 < len; s += 9) { const t0 = s / len, t1 = (s + 3) / len; quad(b, ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1, 0.08, off, WHT); } };
      if (cls > 4) dashes(0);
      if (w >= 14) { dashes(w / 4); dashes(-w / 4); }
    }
  }
  const X = d['x.f'];
  for (let i = 0; i < X.length / 4; i++) {
    const [x, z, a, w] = X.subarray(4 * i, 4 * i + 4), b = bin(x, z), ux = Math.cos(a), uz = Math.sin(a);
    for (let k = -w / 2 + 0.6; k < w / 2 - 0.4; k += 1.1) {
      const cx = x - uz * k, cz = z + ux * k;
      quad(b, cx - ux * 1.6, cz - uz * 1.6, cx + ux * 1.6, cz + uz * 1.6, 0.27, 0, WHT);
    }
  }
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, depthWrite: false });
  for (const b of bins.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(b.pos.length).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(b.col), 3, true));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 4.6; m.receiveShadow = true;
    scene.add(m); cityTiles.push({ mesh: m, kind: 'marks' });
  }
}

// ---------- traffic and people ----------
const walkers = { list: [], cars: [], people: [] };
function mergeColoured(parts) { // [geometry, [r,g,b] 0-1] → one geometry with vertex colours
  const pos = [], nor = [], col = [], idx = [];
  let off = 0;
  for (const [g0, c] of parts) {
    const g = g0.index ? g0 : g0;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (let i = 0; i < g.attributes.position.count; i++) col.push(...c);
    for (const i of g.index.array) idx.push(i + off);
    off += g.attributes.position.count;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); m.setIndex(idx);
  return m;
}
function buildTraffic(L) {
  // drivable streets, with cumulative lengths so things can move along them
  const roads = L.filter(l => l.cls <= 7).map(l => {
    const cum = [0];
    for (let j = 1; j < l.pts.length; j++) cum.push(cum[j - 1] + Math.hypot(l.pts[j][0] - l.pts[j - 1][0], l.pts[j][1] - l.pts[j - 1][1]));
    const mid = l.pts[l.pts.length >> 1];
    return Object.assign(l, { cum, len: cum[cum.length - 1], mx: mid[0], mz: mid[1] });
  }).filter(l => l.len > 25);
  // traffic lives around the camera: streets bucketed into 400 m cells, and anything that drifts out of view is moved back in
  const CELL = 400, grid = new Map();
  for (const l of roads) { const k = Math.floor(l.mx / CELL) + ',' + Math.floor(l.mz / CELL); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(l); }
  const pickNear = (x, z, r) => {
    for (let tries = 0; tries < 6; tries++) {
      const cx = Math.floor((x + (Math.random() * 2 - 1) * r) / CELL), cz = Math.floor((z + (Math.random() * 2 - 1) * r) / CELL), c = grid.get(cx + ',' + cz);
      if (c && c.length) return c[Math.floor(Math.random() * c.length)];
    }
    return null;
  };
  const respawnCar = (w, l) => { w.l = l; w.s = Math.random() * l.len; w.dir = Math.random() < 0.5 ? 1 : -1; w.off = w.dir * (l.w / 4 + 0.2); w.seg = 0; };
  const respawnPerson = (w, l) => { w.l = l; w.s = Math.random() * l.len; w.dir = Math.random() < 0.5 ? 1 : -1; w.off = (Math.random() < 0.5 ? 1 : -1) * (l.w / 2 + 1.2 + Math.random() * 1.6); w.seg = 0; };
  const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  walkers.cars = mk(1800, () => ({ l: null, s: 0, dir: 1, off: 0, v: 7 + Math.random() * 7, seg: 0 }));
  walkers.people = mk(3500, () => ({ l: null, s: 0, dir: 1, off: 0, v: 1.1 + Math.random() * 0.6, seg: 0, ph: Math.random() * 6 }));
  // a boxy low-poly car and a ball-headed person, like the reference
  const body = new THREE.BoxGeometry(4.3, 1.0, 1.85).translate(0, 0.75, 0), cab = new THREE.BoxGeometry(2.3, 0.75, 1.65).translate(-0.25, 1.62, 0);
  const wheels = [[-1.4, -0.85], [1.4, -0.85], [-1.4, 0.85], [1.4, 0.85]].map(([x, z]) => [new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10).rotateX(Math.PI / 2).translate(x, 0.36, z), [0.08, 0.08, 0.09]]);
  const carGeo = mergeColoured([[body, [1, 1, 1]], [cab, [0.55, 0.62, 0.7]], ...wheels]);
  const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
  const cars = new THREE.InstancedMesh(carGeo, carMat, walkers.cars.length);
  const CAR_COLS = [0xd8d4cc, 0x2c2f36, 0x1f3f7a, 0x8e2b2b, 0x3e6b45, 0xe8c25a, 0xf2f2f0, 0x5b6470, 0xb5523b, 0x24589e];
  const c = new THREE.Color();
  walkers.cars.forEach((o, i) => cars.setColorAt(i, c.setHex(CAR_COLS[i % CAR_COLS.length]).convertSRGBToLinear()));
  const pBody = new THREE.CylinderGeometry(0.2, 0.27, 1.05, 8).translate(0, 0.62, 0), pHead = new THREE.SphereGeometry(0.21, 10, 8).translate(0, 1.42, 0);
  const people = new THREE.InstancedMesh(pBody, new THREE.MeshStandardMaterial({ roughness: 0.8 }), walkers.people.length);
  const heads = new THREE.InstancedMesh(pHead, new THREE.MeshStandardMaterial({ roughness: 0.6 }), walkers.people.length);
  const SHIRTS = [0x3b6fd8, 0xd94c3d, 0x2f8f5a, 0xe8c25a, 0x7a4fd8, 0x2c2f36, 0xf2f2f0, 0xe07a2f], SKIN = [0xf1c9a5, 0xd9a47a, 0xa8714f, 0x6b4430, 0xc7a17a, 0x9aa1aa];
  walkers.people.forEach((o, i) => { people.setColorAt(i, c.setHex(SHIRTS[i % SHIRTS.length]).convertSRGBToLinear()); heads.setColorAt(i, c.setHex(SKIN[(i * 7) % SKIN.length]).convertSRGBToLinear()); });
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (const m of [cars, people, heads]) { for (let i = 0; i < m.count; i++) m.setMatrixAt(i, hide); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.renderOrder = 10; scene.add(m); }
  walkers.meshes = { cars, people, heads };
  const o = new THREE.Object3D();
  const place = (w, t, scale, bob, lanes) => { // move along the street, turning round at the ends (cars change lanes)
    const l = w.l;
    w.s += w.v * w.dir * t;
    if (w.s > l.len || w.s < 0) { w.s = Math.min(l.len, Math.max(0, w.s)); w.dir = -w.dir; if (lanes) w.off = -w.off; }
    while (w.seg < l.cum.length - 2 && w.s > l.cum[w.seg + 1]) w.seg++;
    while (w.seg > 0 && w.s < l.cum[w.seg]) w.seg--;
    const a = l.pts[w.seg], b = l.pts[w.seg + 1], sl = (l.cum[w.seg + 1] - l.cum[w.seg]) || 1, f = (w.s - l.cum[w.seg]) / sl;
    const dx = (b[0] - a[0]) / sl, dz = (b[1] - a[1]) / sl;
    o.position.set(a[0] + (b[0] - a[0]) * f - dz * w.off, bob, a[1] + (b[1] - a[1]) * f + dx * w.off);
    o.rotation.set(0, -Math.atan2(dz * w.dir, dx * w.dir), 0);
    o.scale.setScalar(scale);
    o.updateMatrix();
  };
  let clock = 0;
  frameHooks.push((dt, dist) => {
    const show = dist < 2600;
    cars.visible = people.visible = heads.visible = show;
    if (!show) return;
    clock += dt;
    const t = controls.target, R = Math.min(1500, Math.max(350, dist * 1.6)), R2 = R * R;
    walkers.cars.forEach((w, i) => {
      if (!w.l || (w.l.mx - t.x) ** 2 + (w.l.mz - t.z) ** 2 > R2) { const l = pickNear(t.x, t.z, R * 0.9); if (!l) return; respawnCar(w, l); }
      place(w, dt, 1, 0, true); cars.setMatrixAt(i, o.matrix);
    });
    walkers.people.forEach((w, i) => {
      if (!w.l || (w.l.mx - t.x) ** 2 + (w.l.mz - t.z) ** 2 > R2) { const l = pickNear(t.x, t.z, R * 0.9); if (!l) return; respawnPerson(w, l); }
      place(w, dt, 1.25, Math.abs(Math.sin(clock * 8 + w.ph)) * 0.08);
      people.setMatrixAt(i, o.matrix); heads.setMatrixAt(i, o.matrix);
    });
    cars.instanceMatrix.needsUpdate = people.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
  });
}

// ---------- your apartment: a studio on the roof, seen from above with the ceiling off ----------
function personMesh(shirt, scale = 1.3) {
  const g = new THREE.Group(), mat = c => new THREE.MeshStandardMaterial({ color: lin(c), roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 1.05, 10).translate(0, 0.62, 0), mat(shirt));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10).translate(0, 1.42, 0), mat(0xa3a9b2));
  for (const m of [body, head]) { m.castShadow = true; g.add(m); }
  g.scale.setScalar(scale);
  return g;
}
function buildApartment(at, y, angle) {
  const room = new THREE.Group(), box = (w, h, d, x, z, c, yy = 0, rough = 0.8, emissive) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).translate(x, yy + h / 2, z), new THREE.MeshStandardMaterial({ color: lin(c), roughness: rough, emissive: emissive ? lin(emissive) : 0x000000 }));
    m.castShadow = m.receiveShadow = true; room.add(m); return m;
  };
  box(18, 0.1, 12, 0, 0, 0x9a6b45); // wooden floor
  for (const [x, z, w, d] of [[0, -6, 18, 0.35], [0, 6, 18, 0.35], [-9, 0, 0.35, 12], [9, -3.4, 0.35, 5.2], [9, 3.6, 0.35, 4.8], [-2.5, -3, 0.3, 6]]) box(w, 2.8, d, x, z, 0xf2efe8);
  box(3.2, 0.5, 2.2, -6.6, -4.4, 0x2f4f7a); box(3.2, 0.12, 0.7, -6.6, -5.2, 0xf4f4f2, 0.5); // bed with a pillow
  box(2.4, 0.08, 0.9, 1.2, -5.3, 0x7a5236, 0.75); for (const x of [0.15, 2.25]) box(0.08, 0.75, 0.8, x, -5.3, 0x4a3426); // desk
  box(0.5, 0.03, 0.35, 1.2, -5.35, 0x2c2f36, 0.83); box(0.48, 0.3, 0.03, 1.2, -5.5, 0x9fd3ff, 0.86, 0.3, 0x3a8adf); // laptop, screen on
  box(0.55, 0.5, 0.55, 1.2, -4.4, 0x2c2f36); // chair
  box(3, 0.8, 1, 4.5, 4.9, 0x6b7280); box(3, 0.6, 0.3, 4.5, 5.35, 0x5b6470, 0.8); // sofa
  box(2.8, 0.02, 2, 4.5, 2.8, 0xb5523b); // rug
  box(1.6, 0.5, 0.45, 4.5, 0.4, 0x2c2f36); box(1.4, 0.8, 0.06, 4.5, 0.25, 0x111318, 0.5); // TV
  box(1, 0.95, 4, -8.2, 3.2, 0xe6e2d8); box(1, 1.9, 1, -8.2, 0.6, 0xd8dde3); // kitchen counter and fridge
  const pot = box(0.5, 0.5, 0.5, 7.8, -5.2, 0xb5523b);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshStandardMaterial({ color: lin(0x4f8a3c), flatShading: true }));
  leaves.position.set(7.8, 1.1, -5.2); leaves.castShadow = true; room.add(leaves);
  const you = personMesh(0x3b6fd8, 1.3); you.position.set(1.2, 0.1, -4.4); you.rotation.y = Math.PI; room.add(you);
  for (let k = 0; k < 3; k++) box(0.5, 0.03, 0.4, -6 + k * 0.7, 2.5 + (k % 2) * 0.4, 0xf4f4f2, 0.5); // the unpaid bills
  room.position.set(at[0], y, at[1]); room.rotation.y = -angle;
  scene.add(room);
  return room;
}

// ---------- smoke and fire, for when a plane hits a tower ----------
const smokes = [];
function smokeAt(x, z, h) {
  const n = 70, geo = new THREE.IcosahedronGeometry(1, 1);
  const smoke = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: lin(0x3a3a3d), roughness: 1, flatShading: true }), n);
  const fire = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: lin(0xff7a1a) }), 14);
  const parts = Array.from({ length: n }, (_, i) => ({ age: i / n * 12 }));
  const flames = Array.from({ length: 14 }, (_, i) => ({ a: i / 14 * Math.PI * 2, r: 6 + Math.random() * 6 }));
  smoke.frustumCulled = fire.frustumCulled = false;
  scene.add(smoke, fire);
  const o = new THREE.Object3D();
  smokes.push({ dt: (dt, clock) => {
    parts.forEach((p, i) => {
      p.age = (p.age + dt) % 12;
      const k = p.age / 12, s = 4 + k * 26;
      o.position.set(x + Math.sin(i * 1.7) * 6 + k * 60, h * 0.82 + k * 220, z + Math.cos(i * 2.3) * 6 + k * 25);
      o.scale.setScalar(s); o.updateMatrix(); smoke.setMatrixAt(i, o.matrix);
    });
    flames.forEach((f, i) => {
      o.position.set(x + Math.cos(f.a) * f.r, h * 0.8 + Math.sin(clock * 9 + i) * 2, z + Math.sin(f.a) * f.r);
      o.scale.setScalar(3 + Math.abs(Math.sin(clock * 7 + i * 1.3)) * 3); o.updateMatrix(); fire.setMatrixAt(i, o.matrix);
    });
    smoke.instanceMatrix.needsUpdate = fire.instanceMatrix.needsUpdate = true;
  } });
}
let smokeClock = 0;
frameHooks.push(dt => { smokeClock += dt; for (const s of smokes) s.dt(dt, smokeClock); });
