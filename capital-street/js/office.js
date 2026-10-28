// Capital Street office: your headquarters seen from above with the roof off. Furnish it on a grid, hire interns,
// employees and brokers, and let them earn (or lose) money every day. Modelled on the reference videos' interiors.
'use strict';
window.Office = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 0) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const CELL = 1.2; // metres per grid square
  let NYC = null;

  // ---------- what you can put in an office ----------
  // w x d in grid squares; seat: which staff can work there; vibe: how much nicer the office gets (up to cap of each)
  const ITEMS = {
    desk: { name: 'Desk', cat: 'Desks', w: 2, d: 1, cost: 400, seat: 'work', icon: '🖥️' },
    tdesk: { name: 'Trading desk', cat: 'Desks', w: 2, d: 1, cost: 1500, seat: 'trade', icon: '📈' },
    meeting: { name: 'Meeting table', cat: 'Desks', w: 2, d: 2, cost: 900, vibe: 6, cap: 2, icon: '🪑' },
    plant: { name: 'Plant', cat: 'Comfort', w: 1, d: 1, cost: 60, vibe: 3, cap: 12, icon: '🪴' },
    coffee: { name: 'Coffee machine', cat: 'Comfort', w: 1, d: 1, cost: 350, vibe: 8, cap: 1, icon: '☕' },
    cooler: { name: 'Water cooler', cat: 'Comfort', w: 1, d: 1, cost: 120, vibe: 4, cap: 1, icon: '🚰' },
    sofa: { name: 'Sofa', cat: 'Comfort', w: 2, d: 1, cost: 500, vibe: 5, cap: 3, icon: '🛋️' },
    pingpong: { name: 'Ping-pong table', cat: 'Comfort', w: 3, d: 2, cost: 1200, vibe: 10, cap: 1, icon: '🏓' },
    rug: { name: 'Rug', cat: 'Decor', w: 2, d: 2, cost: 150, vibe: 2, cap: 4, icon: '🟥' },
    shelf: { name: 'Bookshelf', cat: 'Decor', w: 1, d: 1, cost: 250, vibe: 2, cap: 5, icon: '📚' },
    wall: { name: 'Wall', cat: 'Decor', w: 1, d: 1, cost: 80, icon: '🧱' },
    server: { name: 'Server rack', cat: 'Tech', w: 1, d: 1, cost: 2000, icon: '🗄️', note: 'Brokers earn 10% more (up to 3)' },
    tv: { name: 'News screen', cat: 'Tech', w: 2, d: 1, cost: 800, vibe: 3, cap: 2, icon: '📺' }
  };
  const CATS = ['Desks', 'Comfort', 'Decor', 'Tech'];
  // fee to hire, salary a day, what they earn a day before skill and vibe
  const ROLES = {
    intern: { name: 'Intern', fee: 0, salary: 60, base: 95, seat: 'work', shirt: 0xe8c25a },
    employee: { name: 'Employee', fee: 500, salary: 220, base: 340, seat: 'work', shirt: 0x3b6fd8 },
    broker: { name: 'Broker', fee: 2500, salary: 600, base: 0, seat: 'trade', shirt: 0x2c2f36 }
  };
  const FIRST = ['Ava', 'Marcus', 'Priya', 'Leo', 'Sofia', 'Jamal', 'Mei', 'Diego', 'Hannah', 'Omar', 'Zoe', 'Tyler', 'Nina', 'Kofi', 'Lucia', 'Ben', 'Aisha', 'Sam', 'Yuki', 'Carlos', 'Grace', 'Ivan', 'Fatima', 'Noah'];
  const LAST = ['Rivera', 'Chen', 'Patel', 'Kowalski', 'Okafor', 'Rossi', 'Kim', 'Novak', 'Haddad', 'Brooks', 'Silva', 'Nguyen', 'Cohen', 'Mendez', 'Park', 'Walsh', 'Ali', 'Fischer', 'Ortiz', 'Shah'];

  // ---------- state, saved with the rest of the game ----------
  const O = () => M.state.office;
  const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)];
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const stars = s => '★★★★★'.slice(0, Math.max(1, Math.min(5, Math.round(s * 3.3)))) + '☆☆☆☆☆'.slice(0, 5 - Math.max(1, Math.min(5, Math.round(s * 3.3))));
  function candidates() {
    const o = O(), today = M.day();
    if (o.cands && o.cands.day === today) return o.cands.list;
    const list = [];
    for (const [role, n] of [['intern', 3], ['employee', 3], ['broker', 2]]) for (let i = 0; i < n; i++) {
      const skill = +(0.6 + rnd() * 0.9).toFixed(2), R = ROLES[role];
      list.push({ id: today * 100 + list.length, role, name: `${pick(FIRST)} ${pick(LAST)}`, skill, salary: Math.round(R.salary * (0.8 + 0.4 * skill) / 5) * 5, fee: Math.round(R.fee * (0.7 + 0.6 * skill) / 50) * 50 });
    }
    o.cands = { day: today, list };
    return list;
  }

  // ---------- the floor plan: a grid laid over the top of your building ----------
  let plan = null; // { g, cx, cz, a, y, u0, v0, cols, rows, ok: Uint8Array, outline: [[u,v]] }
  function inside(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function makePlan(g) {
    const list = (groups.get(g) || []).map(i => pieces[i]);
    if (!list.length) return null;
    const biggest = Math.max(...list.map(p => p.area));
    const top = list.filter(p => p.area >= biggest * 0.4).sort((a, b) => b.h - a.h)[0]; // the top floor, ignoring thin spires
    const XY = NYC['b.xy'], pts = [];
    for (let j = 0; j < top.k; j++) pts.push([XY[top.off + 2 * j] / 2, XY[top.off + 2 * j + 1] / 2]);
    let a = 0, L = 0;
    for (let j = 0; j < pts.length; j++) { const p = pts[j], q = pts[(j + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > L) { L = l; a = Math.atan2(q[1] - p[1], q[0] - p[0]); } }
    const ca = Math.cos(a), sa = Math.sin(a), cx = top.x, cz = top.z;
    const outline = pts.map(([x, z]) => [(x - cx) * ca + (z - cz) * sa, -(x - cx) * sa + (z - cz) * ca]);
    const us = outline.map(p => p[0]), vs = outline.map(p => p[1]);
    const umin = Math.min(...us), umax = Math.max(...us), vmin = Math.min(...vs), vmax = Math.max(...vs);
    const cols = Math.min(60, Math.floor((umax - umin - 0.6) / CELL)), rows = Math.min(60, Math.floor((vmax - vmin - 0.6) / CELL));
    if (cols < 2 || rows < 2) return null;
    const u0 = (umin + umax) / 2 - cols * CELL / 2, v0 = (vmin + vmax) / 2 - rows * CELL / 2, ok = new Uint8Array(cols * rows);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const e = 0.3, U = u0 + c * CELL, V = v0 + r * CELL;
      ok[c * rows + r] = [[U + e, V + e], [U + CELL - e, V + e], [U + e, V + CELL - e], [U + CELL - e, V + CELL - e]].every(([u, v]) => inside(outline, u, v)) ? 1 : 0;
    }
    return { g, cx, cz, a, y: top.h + 0.08, u0, v0, cols, rows, ok, outline, worldPts: pts, size: Math.max(umax - umin, vmax - vmin) };
  }
  const toWorld = (u, v) => [plan.cx + u * Math.cos(plan.a) - v * Math.sin(plan.a), plan.cz + u * Math.sin(plan.a) + v * Math.cos(plan.a)];
  const toLocal = (x, z) => { const dx = x - plan.cx, dz = z - plan.cz, ca = Math.cos(plan.a), sa = Math.sin(plan.a); return [dx * ca + dz * sa, -dx * sa + dz * ca]; };
  const dims = it => { const I = ITEMS[it.type]; return it.rot % 2 ? [I.d, I.w] : [I.w, I.d]; };
  function occupied(skipId) {
    const occ = new Map();
    for (const it of O().items) { if (it.id === skipId) continue; const [w, d] = dims(it); for (let c = it.c; c < it.c + w; c++) for (let r = it.r; r < it.r + d; r++) occ.set(c * plan.rows + r, it); }
    return occ;
  }
  function fits(it) {
    const [w, d] = dims(it), occ = occupied(it.id);
    for (let c = it.c; c < it.c + w; c++) for (let r = it.r; r < it.r + d; r++) {
      if (c < 0 || r < 0 || c >= plan.cols || r >= plan.rows || !plan.ok[c * plan.rows + r] || occ.has(c * plan.rows + r)) return false;
    }
    return true;
  }

  // ---------- low-poly models, built from boxes like the reference videos' desks and plants ----------
  const mats = new Map();
  const mat = (c, extra) => { const k = c + JSON.stringify(extra || {}); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: lin(c), roughness: 0.75 }, extra))); return mats.get(k); };
  function box(g, w, h, d, x, y, z, c, extra) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c, extra)); m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
  function cyl(g, r, h, x, y, z, c, seg = 10) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat(c)); m.position.set(x, y + h / 2, z); m.castShadow = true; g.add(m); return m; }
  function leaves(g, r, x, y, z) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(0x4f8a3c, { flatShading: true })); m.position.set(x, y, z); m.castShadow = true; g.add(m); }
  const SCREEN = { emissive: lin(0x3a8adf), emissiveIntensity: 0.9 };
  const MODELS = { // local frame: long side along x, the person sits at +z facing -z
    desk(g) { box(g, 2.2, 0.05, 0.85, 0, 0.72, -0.15, 0xc8a26e); for (const x of [-1, 1]) box(g, 0.06, 0.72, 0.75, x, 0, -0.15, 0x6b7280); box(g, 0.62, 0.38, 0.04, 0, 0.82, -0.4, 0x9fd3ff, SCREEN); box(g, 0.08, 0.1, 0.08, 0, 0.77, -0.4, 0x2c2f36); box(g, 0.5, 0.45, 0.5, 0, 0, 0.42, 0x2c2f36); box(g, 0.5, 0.5, 0.08, 0, 0.45, 0.66, 0x2c2f36); },
    tdesk(g) { box(g, 2.3, 0.05, 0.9, 0, 0.72, -0.15, 0x3a3c42); for (const x of [-1.05, 1.05]) box(g, 0.06, 0.72, 0.8, x, 0, -0.15, 0x2c2f36); for (const x of [-0.7, 0, 0.7]) box(g, 0.6, 0.38, 0.04, x, 0.84, -0.45, 0x9fd3ff, { emissive: lin(x ? 0x22c55e : 0x3a8adf), emissiveIntensity: 0.8 }); box(g, 0.5, 0.45, 0.5, 0, 0, 0.42, 0x111318); box(g, 0.5, 0.6, 0.08, 0, 0.45, 0.66, 0x111318); },
    meeting(g) { box(g, 1.9, 0.06, 1.1, 0, 0.72, 0, 0xf2efe8); box(g, 0.2, 0.72, 0.2, 0, 0, 0, 0x6b7280); for (const x of [-0.6, 0, 0.6]) for (const z of [-0.85, 0.85]) box(g, 0.4, 0.45, 0.4, x, 0, z, 0x3b6fd8); },
    plant(g) { cyl(g, 0.22, 0.4, 0, 0, 0, 0xb5523b); leaves(g, 0.42, 0, 0.75, 0); leaves(g, 0.28, 0.12, 1.05, 0.05); },
    coffee(g) { box(g, 1.1, 0.9, 0.6, 0, 0, 0, 0xe6e2d8); box(g, 0.35, 0.45, 0.35, -0.2, 0.9, 0, 0x2c2f36); for (const x of [0.15, 0.3]) cyl(g, 0.05, 0.1, x, 0.9, 0.1, 0xf4f4f2, 8); },
    cooler(g) { box(g, 0.4, 0.95, 0.4, 0, 0, 0, 0xf4f4f2); cyl(g, 0.17, 0.45, 0, 0.95, 0, 0x7cc7ff); },
    sofa(g) { box(g, 2.2, 0.42, 0.85, 0, 0, 0, 0x5b6470); box(g, 2.2, 0.45, 0.22, 0, 0.42, 0.32, 0x4b5360); for (const x of [-1.02, 1.02]) box(g, 0.18, 0.3, 0.85, x, 0.42, 0, 0x4b5360); },
    pingpong(g) { box(g, 2.7, 0.05, 1.5, 0, 0.75, 0, 0x1f7a4a); box(g, 0.02, 0.01, 1.5, 0, 0.8, 0, 0xffffff); box(g, 0.04, 0.15, 1.6, 0, 0.8, 0, 0xf4f4f2); for (const x of [-1.1, 1.1]) for (const z of [-0.6, 0.6]) box(g, 0.06, 0.75, 0.06, x, 0, z, 0x2c2f36); },
    rug(g) { box(g, 2.2, 0.02, 2.2, 0, 0, 0, 0xb5523b); box(g, 1.8, 0.021, 1.8, 0, 0, 0, 0xd9a066); },
    shelf(g) { box(g, 1.0, 1.9, 0.4, 0, 0, 0, 0x7a5236); for (let k = 0; k < 4; k++) for (let b = 0; b < 5; b++) box(g, 0.14, 0.32, 0.3, -0.36 + b * 0.18, 0.12 + k * 0.45, 0, [0x3b6fd8, 0xd94c3d, 0xe8c25a, 0x2f8f5a, 0xf4f4f2][(k + b) % 5]); },
    wall(g) { box(g, 1.2, 2.8, 0.14, 0, 0, 0, 0xe9ece6); },
    server(g) { box(g, 0.75, 2.0, 0.9, 0, 0, 0, 0x16181d); for (let k = 0; k < 8; k++) box(g, 0.05, 0.05, 0.02, 0.25, 0.2 + k * 0.22, 0.46, 0x22c55e, { emissive: lin(0x22c55e), emissiveIntensity: 1 }); },
    tv(g) { box(g, 2.0, 0.6, 0.45, 0, 0, 0, 0x2c2f36); box(g, 1.9, 1.1, 0.06, 0, 0.75, 0, 0x111318, { emissive: lin(0xb91c1c), emissiveIntensity: 0.55 }); }
  };

  // ---------- drawing the office ----------
  let root = null, itemsGroup = null, gridLines = null, ghost = null, hiddenThings = [];
  const people = new Map(); // staff id -> mesh
  function clearScene() {
    if (root) { scene.remove(root); root = null; }
    people.clear();
    for (const [m, i, mtx] of hiddenThings) { m.setMatrixAt(i, mtx); m.instanceMatrix.needsUpdate = true; }
    hiddenThings = [];
    pitched.hidden = () => false; if (plan) refreshPitched(plan.cx, plan.cz);
  }
  function buildScene() {
    clearScene();
    plan = hereHQ() != null ? makePlan(hereHQ()) : null;
    if (!plan) return;
    root = new THREE.Group(); scene.add(root);
    // lift the roof off: rooftop machinery and pitched roofs over the office disappear
    const wp = plan.worldPts, inHQ = (x, z) => inside(wp, x, z);
    const mtx = new THREE.Matrix4(), pos = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const m of roofThings) for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, mtx); pos.setFromMatrixPosition(mtx);
      if (Math.abs(pos.x - plan.cx) < plan.size && Math.abs(pos.z - plan.cz) < plan.size && inHQ(pos.x, pos.z)) { hiddenThings.push([m, i, mtx.clone()]); m.setMatrixAt(i, zero); m.instanceMatrix.needsUpdate = true; }
    }
    pitched.hidden = (x, z) => inHQ(x, z); refreshPitched(plan.cx, plan.cz);
    // the floor: warm wood, with the outer walls of the building around it
    const shape = new THREE.Shape(wp.map(([x, z]) => new THREE.Vector2(x, -z)));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), mat(0xb88a5a, { roughness: 0.9 }));
    floor.position.y = plan.y; floor.receiveShadow = true; root.add(floor);
    for (let j = 0; j < wp.length; j++) {
      const [x1, z1] = wp[j], [x2, z2] = wp[(j + 1) % wp.length], L = Math.hypot(x2 - x1, z2 - z1);
      if (L < 0.2) continue;
      const w = new THREE.Mesh(new THREE.BoxGeometry(L + 0.25, 2.9, 0.25), mat(0xf2efe8));
      w.position.set((x1 + x2) / 2, plan.y + 1.45, (z1 + z2) / 2); w.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      w.castShadow = w.receiveShadow = true; root.add(w);
    }
    // grid lines, shown while furnishing
    const seg = [];
    for (let c = 0; c < plan.cols; c++) for (let r = 0; r < plan.rows; r++) {
      if (!plan.ok[c * plan.rows + r]) continue;
      const U = plan.u0 + c * CELL, V = plan.v0 + r * CELL, P = [toWorld(U, V), toWorld(U + CELL, V), toWorld(U + CELL, V + CELL), toWorld(U, V + CELL)];
      for (let k = 0; k < 4; k++) seg.push(P[k][0], plan.y + 0.03, P[k][1], P[(k + 1) % 4][0], plan.y + 0.03, P[(k + 1) % 4][1]);
    }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    gridLines = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
    gridLines.visible = false; root.add(gridLines);
    itemsGroup = new THREE.Group(); root.add(itemsGroup);
    drawItems();
  }
  function placeObj(obj, it) {
    const [w, d] = dims(it), u = plan.u0 + (it.c + w / 2) * CELL, v = plan.v0 + (it.r + d / 2) * CELL, [x, z] = toWorld(u, v);
    obj.position.set(x, plan.y, z); obj.rotation.y = -plan.a - it.rot * Math.PI / 2;
  }
  function drawItems() {
    if (!itemsGroup) return;
    itemsGroup.clear(); people.clear();
    for (const it of O().items) { const g = new THREE.Group(); MODELS[it.type](g); placeObj(g, it); g.userData.id = it.id; itemsGroup.add(g); }
    for (const st of O().staff) { // everyone at their desk; unassigned staff stand by the wall
      const p = personMesh(ROLES[st.role].shirt, 1.25);
      const desk = O().items.find(i => i.id === st.desk);
      if (desk) { placeObj(p, desk); p.translateZ(0.42); p.rotateY(Math.PI); p.position.y = plan.y + 0.12; }
      else { const k = O().staff.indexOf(st), [x, z] = toWorld(plan.u0 + 0.6 + (k % 6) * 0.7, plan.v0 + 0.6); p.position.set(x, plan.y, z); }
      p.userData.ph = rnd() * 6; itemsGroup.add(p); people.set(st.id, p);
    }
  }
  let clock = 0;
  frameHooks.push(dt => {
    clock += dt;
    if (!root) return;
    const hs = tiles.length ? tiles[0].mesh.scale.y : 1; root.scale.y = hs; root.visible = hs > 0.3; // sink with the city
    for (const p of people.values()) p.children[1].position.y = Math.sin(clock * 3 + p.userData.ph) * 0.03; // heads bob as they work
  });

  // ---------- the economy: salaries out, income in, every night ----------
  const vibeParts = () => {
    const counts = {};
    for (const it of O().items) counts[it.type] = (counts[it.type] || 0) + 1;
    const parts = [];
    for (const [t, n] of Object.entries(counts)) { const I = ITEMS[t]; if (I.vibe) parts.push([I.name, Math.min(n, I.cap) * I.vibe]); }
    return parts;
  };
  const vibe = () => Math.max(0, Math.min(100, 30 + vibeParts().reduce((s, p) => s + p[1], 0)));
  const productivity = () => 0.6 + vibe() / 100 * 0.8;
  const servers = () => Math.min(3, O().items.filter(i => i.type === 'server').length);
  function officeDay(S, ret) {
    const o = S.office; if (!o || o.g == null || !o.staff.length) return;
    const prod = productivity(), lines = [], quit = [];
    let revenue = 0, brokers = 0, salaries = 0;
    for (const st of [...o.staff]) {
      if (S.cash >= st.salary) { S.cash = +(S.cash - st.salary).toFixed(2); salaries += st.salary; }
      else { quit.push(`${st.name} quit: you couldn't pay their salary`); o.staff.splice(o.staff.indexOf(st), 1); continue; }
      st.days++;
      let made = 0;
      if (st.desk != null) {
        if (st.role === 'broker') { // brokers trade: they ride the market and anything can happen
          made = st.skill * (gauss() * 1400 + 700 + 60000 * ret) * (1 + 0.1 * servers()) * (0.8 + prod * 0.2);
          if (rnd() < 0.04) { const big = rnd() < 0.5 + st.skill * 0.2; made += big ? 6000 + rnd() * 9000 : -(5000 + rnd() * 7000); lines.push(`${st.name} had ${big ? 'a monster day' : 'a disaster day'}`); }
          brokers += made;
        } else { made = ROLES[st.role].base * (st.role === 'intern' ? 1 : st.skill) * prod * (1 + gauss() * 0.15); revenue += made; }
      }
      st.last = made; st.earned = (st.earned || 0) + made;
      if (vibe() < 40 && rnd() < 0.04) { quit.push(`${st.name} quit: the office is too gloomy`); o.staff.splice(o.staff.indexOf(st), 1); }
    }
    S.cash = +(S.cash + revenue + brokers).toFixed(2);
    o.last = { day: Math.floor(S.time / 1440) + 1, revenue, brokers, salaries, net: revenue + brokers - salaries, lines, quit };
    o.total = (o.total || 0) + revenue + brokers - salaries;
    M.emit('office', o.last);
  }
  M.onDay(officeDay);
  M.addWorth(S => S.office ? S.office.items.reduce((s, it) => s + ITEMS[it.type].cost * 0.5, 0) : 0); // furniture resells at half price

  // ---------- actions ----------
  function ensure() { if (!M.state.office) M.state.office = { g: null, items: [], staff: [], nextId: 1, total: 0 }; return M.state.office; }
  const officeCity = () => (O() && O().city) || 'nyc';
  const officeKey = () => O() && O().g != null ? (officeCity() === 'nyc' ? String(O().g) : officeCity() + ':' + O().g) : null;
  const hereHQ = () => O() && O().g != null && officeCity() === CITY.id ? O().g : null; // the office is drawn only in its own city
  function setHQ(g) {
    const o = ensure();
    if (o.g === g && officeCity() === CITY.id) return;
    const refund = o.items.reduce((s, it) => s + ITEMS[it.type].cost * 0.5, 0);
    if (refund) M.state.cash = +(M.state.cash + refund).toFixed(2);
    o.g = g; o.city = CITY.id; o.items = []; for (const st of o.staff) st.desk = null;
    M.save(); buildScene(); Property.refreshOwned();
    if (refund) toast('Office moved', `Old furniture sold for ${usd(refund)}.`);
  }
  function closeOffice(why) {
    const o = O(); if (!o || o.g == null) return;
    const refund = o.items.reduce((s, it) => s + ITEMS[it.type].cost * 0.5, 0), n = o.staff.length;
    M.state.cash = +(M.state.cash + refund).toFixed(2);
    Object.assign(o, { g: null, items: [], staff: [] }); M.save();
    exit(); buildScene();
    CSUI.story(`<small>OFFICE CLOSED</small><b>${why}</b><p>The furniture sold for ${usd(refund)}${n ? ` and your ${n} staff had to go` : ''}.</p>`, [['OK', () => {}]]);
  }
  function freeSeat(role) {
    const o = O(), taken = new Set(o.staff.map(s => s.desk));
    const seats = o.items.filter(i => ITEMS[i.type].seat && !taken.has(i.id));
    return role === 'broker' ? seats.find(i => ITEMS[i.type].seat === 'trade') : (seats.find(i => ITEMS[i.type].seat === 'work') || seats.find(i => ITEMS[i.type].seat === 'trade'));
  }
  function seatEveryone() { for (const st of O().staff) if (st.desk == null) { const s = freeSeat(st.role); if (s) st.desk = s.id; } }
  function hire(cid) {
    const o = O(), c = candidates().find(x => x.id === cid);
    if (!c) return { ok: false, why: 'They took another job' };
    const seat = freeSeat(c.role);
    if (!seat) return { ok: false, why: c.role === 'broker' ? 'Brokers need a free trading desk' : 'Put down a free desk first' };
    if (M.state.cash < c.fee) return { ok: false, why: `The hiring fee is ${usd(c.fee)}` };
    M.state.cash = +(M.state.cash - c.fee).toFixed(2);
    o.staff.push({ id: o.nextId++, role: c.role, name: c.name, skill: c.skill, salary: c.salary, desk: seat.id, days: 0, hired: M.state.time, earned: 0 });
    o.cands.list = o.cands.list.filter(x => x.id !== cid);
    M.save(); drawItems(); drawBar();
    return { ok: true };
  }
  function promote(id) {
    const o = O(), st = o.staff.find(s => s.id === id); if (!st) return;
    const next = st.role === 'intern' ? 'employee' : 'broker';
    if (next === 'broker' && !freeSeat('broker')) { toast('No trading desk', 'Put down a free trading desk first.'); return; }
    const old = st.desk;
    st.role = next; st.skill = +(st.skill + 0.1).toFixed(2); st.salary = Math.round(ROLES[next].salary * (0.8 + 0.4 * st.skill) / 5) * 5; st.days = 0;
    if (next === 'broker') { st.desk = null; st.desk = freeSeat('broker').id; }
    else st.desk = old;
    toast('Promoted', `${st.name} is now ${next === 'broker' ? 'a broker' : 'an employee'}.`);
    M.save(); drawItems(); drawBar();
  }
  function fire(id) { const o = O(); o.staff = o.staff.filter(s => s.id !== id); M.save(); drawItems(); drawBar(); }
  const canPromote = st => (st.role === 'intern' && st.days >= 5) || (st.role === 'employee' && st.days >= 10 && st.skill >= 0.9);

  // ---------- office mode: the camera looks down into the office, tap to furnish ----------
  let active = false, tool = null, rot = 0; // tool: item type, or 'remove'
  function enter() {
    if (!O() || O().g == null) { toast('No office yet', 'Buy an office floor first, then make it your office.'); Property.open(); return; }
    if (hereHQ() == null) { toast('Your office is elsewhere', `It's in ${CITIES[officeCity()].name}. Fly there from the globe, or make a building here your office.`); return; }
    if (!plan) buildScene();
    if (!plan) { toast('Too small', 'This building is too narrow for an office.'); return; }
    active = true; Property.deselect();
    ['ex', 'bank', 'props'].forEach(id => $(id).hidden = true);
    document.getElementById('hud').classList.add('in-office'); document.body.classList.add('in-office'); $('obar').hidden = false;
    flyTo(view([plan.cx, plan.cz], Math.max(28, plan.size * 1.35), 0.32, Math.PI / 2 - plan.a, plan.y), 2.2);
    drawBar();
    if (!O().items.length && !O().seen) { O().seen = true; M.save(); CSUI.story(`<small>YOUR OFFICE</small><b>An empty floor.</b><p>Bare walls and a wooden floor. Put down a desk, then hire an intern. Plants and coffee make people work better; brokers need a trading desk.</p>`, [['Furnish it', () => openTray()]]); }
  }
  function exit() {
    active = false; closeTray(); $('obar').hidden = true; $('ostaff').hidden = true;
    document.getElementById('hud').classList.remove('in-office'); document.body.classList.remove('in-office');
  }
  function drawBar() {
    if (!O()) return;
    const seats = O().items.filter(i => ITEMS[i.type].seat).length;
    $('oVibe').textContent = Math.round(vibe());
    $('oStaff').textContent = `${O().staff.length}/${seats}`;
  }
  function openTray(cat = 'Desks') {
    $('otray').hidden = false; gridLines && (gridLines.visible = true);
    $('otray').innerHTML = `<div class="ocats">${CATS.map(c => `<button data-c="${c}" class="${c === cat ? 'on' : ''}">${c}</button>`).join('')}<button data-t="remove" class="rm ${tool === 'remove' ? 'on' : ''}">🗑 Remove</button><button id="oRot">⟳ Rotate</button></div>
      <div class="oitems">${Object.entries(ITEMS).filter(([, I]) => I.cat === cat).map(([t, I]) => `<button data-t="${t}" class="${tool === t ? 'on' : ''}"><i>${I.icon}</i><b>${I.name}</b><span>${usd(I.cost)}</span>${I.vibe ? `<em>+${I.vibe} vibe</em>` : I.seat ? `<em>${I.seat === 'trade' ? 'for brokers' : 'a workstation'}</em>` : I.note ? `<em>${I.note}</em>` : ''}</button>`).join('')}</div>
      <p class="note">${tool === 'remove' ? 'Tap something to remove it (you get half back).' : tool ? `Tap the floor to place a ${ITEMS[tool].name.toLowerCase()}.` : 'Pick something, then tap the floor.'}</p>`;
    $('otray').querySelectorAll('[data-c]').forEach(b => b.onclick = () => openTray(b.dataset.c));
    $('otray').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tool = tool === b.dataset.t ? null : b.dataset.t; openTray(cat); });
    $('oRot').onclick = () => { rot = (rot + 1) % 4; toast('Rotated', `Now facing ${['north', 'east', 'south', 'west'][rot]}.`); };
  }
  function closeTray() { $('otray').hidden = true; tool = null; if (gridLines) gridLines.visible = false; }
  function tap(ray) {
    if (!active || !plan) return false;
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -plan.y * (root ? root.scale.y : 1)), new THREE.Vector3());
    if (!hit) return true;
    const [u, v] = toLocal(hit.x, hit.z), c = Math.floor((u - plan.u0) / CELL), r = Math.floor((v - plan.v0) / CELL);
    if (!tool) { // no tool: tapping a person says who they are
      const occ = occupied(), it = occ.get(c * plan.rows + r), st = it && O().staff.find(s => s.desk === it.id);
      if (st) toast(`${st.name} · ${ROLES[st.role].name}`, `${stars(st.skill)} · ${usd(st.salary)}/day · yesterday ${usd(st.last || 0)}`);
      return true;
    }
    if (tool === 'remove') {
      const it = occupied().get(c * plan.rows + r);
      if (!it) return true;
      O().items = O().items.filter(x => x !== it);
      for (const st of O().staff) if (st.desk === it.id) st.desk = null;
      seatEveryone();
      M.state.cash = +(M.state.cash + ITEMS[it.type].cost * 0.5).toFixed(2);
      toast('Removed', `${ITEMS[it.type].name} sold for ${usd(ITEMS[it.type].cost * 0.5)}.`);
    } else {
      const I = ITEMS[tool], it = { id: O().nextId++, type: tool, rot };
      const [w, d] = dims(it); it.c = c - Math.floor((w - 1) / 2); it.r = r - Math.floor((d - 1) / 2);
      if (!fits(it)) { toast('No room there', 'It must fit on the floor without overlapping.'); return true; }
      if (M.state.cash < I.cost) { toast('Not enough cash', `${I.name} costs ${usd(I.cost)}.`); return true; }
      M.state.cash = +(M.state.cash - I.cost).toFixed(2);
      O().items.push(it); seatEveryone();
    }
    M.save(); drawItems(); drawBar();
    return true;
  }

  // ---------- staff screen ----------
  let stab = 'staff';
  function openStaff(t = 'staff') { stab = t; $('ostaff').hidden = false; closeTray(); drawStaff(); }
  function drawStaff() {
    if ($('ostaff').hidden || !O()) return;
    document.querySelectorAll('#ostaff .tabs button').forEach(b => b.classList.toggle('on', b.dataset.st === stab));
    const o = O(); let html = '';
    if (stab === 'staff') {
      html = o.staff.length ? o.staff.map(st => `<div class="srow"><div class="av" style="background:#${ROLES[st.role].shirt.toString(16).padStart(6, '0')}"></div><div><b>${st.name}</b><span>${ROLES[st.role].name} · ${stars(st.skill)} · day ${st.days}</span><span>${usd(st.salary)}/day · yesterday <i class="${(st.last || 0) >= 0 ? 'up' : 'dn'}">${usd(st.last || 0)}</i>${st.desk == null ? ' · <i class="dn">no desk</i>' : ''}</span></div><div class="sb">${canPromote(st) ? `<button data-pr="${st.id}">Promote</button>` : ''}<button class="ghost" data-fire="${st.id}">Fire</button></div></div>`).join('')
        : '<p class="note">Nobody works here yet. Put down a desk, then hire someone.</p>';
    } else if (stab === 'hire') {
      html = candidates().map(c => `<div class="srow"><div class="av" style="background:#${ROLES[c.role].shirt.toString(16).padStart(6, '0')}"></div><div><b>${c.name}</b><span>${ROLES[c.role].name} · ${stars(c.skill)}</span><span>${usd(c.salary)}/day${c.fee ? ` · fee ${usd(c.fee)}` : ''}</span></div><div class="sb"><button data-hire="${c.id}">Hire</button></div></div>`).join('') +
        '<p class="note">New people apply every day. Interns are cheap and learn fast; employees bring steady income; brokers trade for you and can win or lose big.</p>';
    } else {
      const l = o.last;
      html = `<div class="cards"><div>Vibe<b>${Math.round(vibe())}/100</b></div><div>Work speed<b>${Math.round(productivity() * 100)}%</b></div><div>All-time<b class="${(o.total || 0) >= 0 ? 'up' : 'dn'}">${usd(o.total || 0)}</b></div></div>
        <div class="sec">WHAT MAKES THE VIBE</div><table class="tbl"><tr><td>Bare office</td><td>30</td></tr>${vibeParts().map(([n, v]) => `<tr><td>${n}</td><td>+${v}</td></tr>`).join('')}</table>
        <div class="sec">LAST NIGHT</div>${l ? `<table class="tbl"><tr><td>Office income</td><td class="up">${usd(l.revenue)}</td></tr><tr><td>Broker trading</td><td class="${l.brokers >= 0 ? 'up' : 'dn'}">${usd(l.brokers)}</td></tr><tr><td>Salaries</td><td class="dn">-${usd(l.salaries)}</td></tr><tr><td><b>Net</b></td><td class="${l.net >= 0 ? 'up' : 'dn'}"><b>${usd(l.net)}</b></td></tr></table>${[...l.lines, ...l.quit].map(t => `<p class="note">• ${t}</p>`).join('')}` : '<p class="note">Your first report comes tonight.</p>'}`;
    }
    $('ostaffBody').innerHTML = html;
    $('ostaffBody').querySelectorAll('[data-hire]').forEach(b => b.onclick = () => { const r = hire(+b.dataset.hire); if (!r.ok) toast('Can\'t hire', r.why); else toast('Hired', 'They start right away.'); drawStaff(); drawBar(); });
    $('ostaffBody').querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { promote(+b.dataset.pr); drawStaff(); });
    $('ostaffBody').querySelectorAll('[data-fire]').forEach(b => b.onclick = () => { fire(+b.dataset.fire); drawStaff(); drawBar(); });
  }
  document.querySelectorAll('#ostaff .tabs button').forEach(b => b.onclick = () => { stab = b.dataset.st; drawStaff(); });
  $('ostaffX').onclick = () => { $('ostaff').hidden = true; };
  $('oFurnish').onclick = () => $('otray').hidden ? openTray() : closeTray();
  $('oPeople').onclick = () => $('ostaff').hidden ? openStaff() : ($('ostaff').hidden = true);
  $('oDone').onclick = () => { exit(); flyTo(view([plan.cx, plan.cz], Math.max(220, plan.y * 2.4), 0.85, current().az, plan.y * 0.5), 2); };

  M.on((type, d) => {
    if (type === 'office') {
      CSUI.breaking('YOUR OFFICE · NIGHTLY REPORT', `${d.net >= 0 ? 'PROFIT' : 'LOSS'} ${usd(d.net)}`, `Income ${usd(d.revenue)}, brokers ${usd(d.brokers)}, salaries -${usd(d.salaries)}.${d.quit.length ? ' ' + d.quit.join('. ') + '.' : ''}`, d.net >= 0);
      drawItems(); drawBar(); drawStaff();
    }
    if (type === 'property') {
      const o = O();
      if (d.kind === 'bought' && (!o || o.g == null) && Property.isHere(d.id)) { const it = Property.info(Property.gOf(d.id)); if (it && /Office/.test(it.type)) setHQ(it.g); }
      if (d.kind === 'sold' && d.id === officeKey() && !M.state.props[d.id]) closeOffice('You sold the building your office was in.');
    }
    if (type === 'reset') { exit(); clearScene(); plan = null; }
  });

  function init(nyc) { NYC = nyc; if (O() && O().g != null) buildScene(); }
  return { init, enter, exit, tap, setHQ, hq: hereHQ, active: () => active, ITEMS, ROLES, vibe, hire, candidates, debug: () => ({ plan: plan && { cols: plan.cols, rows: plan.rows, ok: plan.ok.reduce((a, b) => a + b, 0), y: plan.y, cx: plan.cx, cz: plan.cz, a: plan.a, u0: plan.u0, v0: plan.v0, okList: [...plan.ok].map((v, i) => v ? i : -1).filter(i => i >= 0) }, hidden: hiddenThings.length }) };
})();
