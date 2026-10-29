// Capital Street on PC (Goal 10), from the Figma file "Capital Street — PC UI": the main menu over a slowly turning city,
// the pause menu, Settings (graphics and controls), keyboard camera controls and shortcuts, a frame-rate counter and
// automatic resolution that keeps the game near 60 fps. Phones get the same menus; the keyboard parts never fire there.
'use strict';
(function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US');
  const hhmm = t => { const m = ((t % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const PANELS = ['net', 'listing', 'cityCard', 'ostaff', 'otray', 'props', 'bank', 'ex']; // closed in this order by Esc
  const DRAWERS = ['ex', 'bank', 'props', 'listing', 'cityCard', 'ostaff', 'net'];
  const shown = id => $(id) && !$(id).hidden;
  const inGame = () => $('title').hidden && !$('hud').hidden;

  // ---------- graphics settings (GFX, pixelRatio and dynScale live in index.html, read before the renderer was made) ----------
  const PRESETS = {
    low: { cap: 1, scale: 0.7, shadows: 'off', detail: 'low', aa: false },
    medium: { cap: 1.5, scale: 0.85, shadows: 'low', detail: 'high', aa: true },
    high: { cap: 2, scale: 1, shadows: 'high', detail: 'high', aa: true },
    ultra: { cap: 3, scale: 1, shadows: 'high', detail: 'high', aa: true },
  };
  const aaAtStart = GFX.aa;
  function applyGfx() {
    renderer.setPixelRatio(pixelRatio());
    const on = GFX.shadows !== 'off', size = GFX.shadows === 'low' ? 2048 : 4096;
    if (renderer.shadowMap.enabled !== on) { // materials compile shadows in or out, so they have to be rebuilt
      renderer.shadowMap.enabled = on;
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    if (sunLight.shadow.mapSize.x !== size) { sunLight.shadow.mapSize.setScalar(size); if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; } }
    $('fps').hidden = !GFX.showFps;
    try { localStorage.setItem('cs-gfx', JSON.stringify(GFX)); } catch (e) { /* storage blocked: settings last this visit */ }
  }

  // ---------- frame rate, and automatic resolution: drop it 10% after 2 slow seconds, raise it 5% after 5 smooth ones ----------
  let frames = 0, acc = 0, lastT = performance.now(), slow = 0, fast = 0;
  frameHooks.push(() => {
    const now = performance.now(); acc += now - lastT; lastT = now; frames++;
    if (acc < 1000) return;
    const fps = frames * 1000 / acc; frames = 0; acc = 0;
    const el = $('fps');
    el.textContent = Math.round(fps) + ' FPS' + (dynScale < 1 ? ` · ${Math.round(dynScale * 100)}% resolution` : '');
    el.className = fps >= 50 ? '' : fps >= 28 ? 'mid' : 'low';
    if (!GFX.auto || document.hidden) { if (!GFX.auto && dynScale !== 1) { dynScale = 1; renderer.setPixelRatio(pixelRatio()); } return; }
    const target = Math.min(60, GFX.fpsCap || 60);
    if (fps < target * 0.85) { fast = 0; if (++slow >= 2 && dynScale > 0.5) { dynScale = Math.max(0.5, dynScale - 0.1); slow = 0; renderer.setPixelRatio(pixelRatio()); } }
    else if (fps > target * 0.95) { slow = 0; if (++fast >= 5 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.05); fast = 0; renderer.setPixelRatio(pixelRatio()); } }
    else slow = fast = 0;
  });

  // ---------- time stands still while a menu is open ----------
  let holds = 0, wasPaused = false;
  const hold = () => { if (holds++ === 0 && window.CSUI) { wasPaused = CSUI.paused(); CSUI.setPaused(true); } };
  const release = () => { if (holds > 0 && --holds === 0 && window.CSUI) CSUI.setPaused(wasPaused); };

  // ---------- Settings ----------
  const sets = document.createElement('div');
  sets.id = 'settings'; sets.className = 'ov2'; sets.hidden = true;
  sets.innerHTML = '<div class="smodal glass2" role="dialog" aria-label="Settings"><nav class="stabs"><h2>SETTINGS</h2><button data-t="graphics" class="on">Graphics</button><button data-t="controls">Controls</button></nav><div class="sbody" id="sBody"></div></div>';
  document.body.appendChild(sets);
  let sTab = 'graphics';
  const seg = (key, opts, cur) => `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = (key, on, label) => `<button class="tog" data-k="${key}" aria-pressed="${on}" aria-label="${label}"></button>`;
  const row = (label, help, ctl) => `<div class="srow"><div><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div>${ctl}</div>`;
  const K = (...ks) => ks.map(k => `<kbd>${k}</kbd>`).join('');
  const foot = reset => `<div class="sfoot"><span>${K('Esc')} Back</span><div>${reset ? '<button class="btn" id="sReset">RESET TO DEFAULTS</button>' : ''}<button class="btn pri" id="sDone">DONE</button></div></div>`;
  function drawSettings() {
    sets.querySelectorAll('.stabs button').forEach(b => b.classList.toggle('on', b.dataset.t === sTab));
    const body = $('sBody');
    if (sTab === 'graphics') {
      const pct = Math.round(GFX.scale * 100);
      body.innerHTML = `<h3>Graphics</h3><p>Pick a preset, or tune each option. Changes apply right away.</p>
        ${row('Quality preset', GFX.preset === 'custom' ? 'Custom: you changed an option below' : 'High suits most gaming PCs', seg('preset', [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], GFX.preset))}
        ${row('Resolution scale', 'Lower is faster, higher is sharper', `<div class="rng"><input type="range" id="sScale" min="50" max="100" step="5" value="${pct}" aria-label="Resolution scale"><b id="sScaleV">${pct}%</b></div>`)}
        ${row('Keep 60 fps automatically', 'Lowers the resolution a little when the city gets busy', tog('auto', GFX.auto, 'Keep 60 fps automatically'))}
        ${row('Frame rate limit', null, seg('fpsCap', [[30, '30'], [60, '60'], [120, '120'], [0, 'Max']], GFX.fpsCap))}
        ${row('Sun shadows', null, seg('shadows', [['off', 'Off'], ['low', 'Low'], ['high', 'High']], GFX.shadows))}
        ${row('Anti-aliasing', GFX.aa !== aaAtStart ? '<span class="note2">Takes effect when you reload the game</span>' : 'Smooths jagged edges', tog('aa', GFX.aa, 'Anti-aliasing'))}
        ${row('Building detail', 'Attics, chimneys, domes, solar panels and trees', seg('detail', [['low', 'Low'], ['high', 'High']], GFX.detail))}
        ${row('Show frame rate', `Or press ${K('F3')}`, tog('showFps', GFX.showFps, 'Show frame rate'))}
        ${foot(true)}`;
    } else {
      body.innerHTML = `<h3>Controls</h3><p>Mouse: drag to move, right-drag to turn, the wheel to zoom, click a building to see it.</p>
        <div class="keylist">
          <span>${K('W', 'A', 'S', 'D')} or arrows</span><span>Move the camera (hold ${K('Shift')} to go faster)</span>
          <span>${K('Q', 'E')}</span><span>Turn</span>
          <span>${K('R', 'F')}</span><span>Zoom in and out</span>
          <span>${K('Space')}</span><span>Pause or resume time</span>
          <span>${K('1', '2', '3')}</span><span>Game speed 1×, 5×, 20×</span>
          <span>${K('B')}</span><span>Bank</span>
          <span>${K('X')}</span><span>Share exchange</span>
          <span>${K('H')}</span><span>Fly home</span>
          <span>${K('P')}</span><span>Property</span>
          <span>${K('O')}</span><span>Your office</span>
          <span>${K('M')}</span><span>World map</span>
          <span>${K('Esc')}</span><span>Close a panel, or open the pause menu</span>
          <span>${K('F10')}</span><span>Settings</span>
          <span>${K('F3')}</span><span>Frame rate</span>
          <span>${K('?')}</span><span>This list</span>
        </div>${foot(false)}`;
    }
    body.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.k, v = k === 'fpsCap' ? Number(b.dataset.v) : b.dataset.v;
      if (k === 'preset') Object.assign(GFX, PRESETS[v], { preset: v });
      else { GFX[k] = v; if (k !== 'fpsCap') GFX.preset = 'custom'; }
      applyGfx(); drawSettings();
    });
    body.querySelectorAll('.tog').forEach(b => b.onclick = () => {
      const k = b.dataset.k; GFX[k] = !GFX[k]; if (k === 'aa') GFX.preset = 'custom';
      applyGfx(); drawSettings();
    });
    const r = $('sScale');
    if (r) r.oninput = () => { GFX.scale = r.value / 100; GFX.preset = 'custom'; $('sScaleV').textContent = r.value + '%'; applyGfx(); };
    if (r) r.onchange = () => drawSettings();
    if ($('sReset')) $('sReset').onclick = () => { Object.assign(GFX, GFX_DEFAULT); applyGfx(); drawSettings(); };
    $('sDone').onclick = closeSettings;
  }
  sets.querySelectorAll('.stabs button').forEach(b => b.onclick = () => { sTab = b.dataset.t; drawSettings(); });
  sets.onclick = e => { if (e.target === sets) closeSettings(); };
  function openSettings(tab = 'graphics') { if (!sets.hidden) { sTab = tab; drawSettings(); return; } sTab = tab; sets.hidden = false; hold(); drawSettings(); }
  function closeSettings() { if (sets.hidden) return; sets.hidden = true; release(); }

  // ---------- pause menu ----------
  const item = (id, label, key, detail) => `<button class="mi" id="${id}"><span class="mk"></span><span class="mt"><b>${label}</b>${detail ? `<small>${detail}</small>` : ''}</span><kbd>${key}</kbd></button>`;
  const pause = document.createElement('div');
  pause.id = 'pause'; pause.className = 'ov2'; pause.hidden = true;
  pause.innerHTML = `<div class="pcard glass2" role="dialog" aria-label="Paused"><h2>PAUSED</h2><p id="pauseD"></p><nav class="menu">
    ${item('pResume', 'Resume', 'Esc')}${item('pSettings', 'Settings', 'S')}${item('pWorld', 'World map', 'M')}${item('pQuit', 'Save and quit to menu', 'Q', 'Your game is saved on this device')}</nav>
    <nav class="legal"><a href="terms.html" target="_blank" rel="noopener">Terms</a><a href="privacy.html" target="_blank" rel="noopener">Privacy</a><a href="credits.html" target="_blank" rel="noopener">Credits</a></nav></div>`;
  document.body.appendChild(pause);
  function openPause() {
    if (!inGame() || !pause.hidden) return;
    $('pauseD').textContent = `Day ${M.day()}, ${hhmm(M.state.time)} · the market waits for you`;
    pause.hidden = false; hold(); select(pause, 0);
  }
  function closePause() { if (pause.hidden) return; pause.hidden = true; release(); }
  function closePanels() {
    for (const id of PANELS) if (shown(id)) $(id).hidden = true;
    if (window.Office && Office.active()) Office.exit();
  }
  function toWorld() { closePanels(); flyTo(current().dist > 1e6 ? V.city() : V.world(), 3); }
  function quitToMenu() {
    M.save(); closePause(); closePanels();
    $('hud').hidden = true; $('title').hidden = false;
    refreshMenu(); select($('title'), 0);
    flyTo(titleView(current().az), 3);
  }
  $('pResume').onclick = closePause;
  $('pSettings').onclick = () => openSettings();
  $('pWorld').onclick = () => { closePause(); toWorld(); };
  $('pQuit').onclick = quitToMenu;
  pause.onclick = e => { if (e.target === pause) closePause(); };

  // ---------- main menu ----------
  const centre = () => CITY.id === 'nyc' ? ll(40.7527, -73.9800) : PLACE.manhattan; // New York: Midtown's towers
  const titleView = az => view(centre(), CITY.id === 'nyc' ? 2400 : 1500, 1.02, az == null ? -0.6 : az, 40);
  frameHooks.push(dt => { // the city turns slowly behind the menu
    if ($('title').hidden || fly || !window.CS) return;
    const c = current();
    place(view([c.t.x, c.t.z], c.dist, c.polar, c.az + dt * 0.035, c.t.y));
  });
  function refreshMenu() {
    const s = M.state, started = s.started, st = M.status();
    $('playT').textContent = started ? 'Continue' : 'Play';
    $('playD').textContent = started ? `Day ${M.day()} · ${CITY.name} · ${usd(M.netWorth())} net worth` : CITY.id === 'nyc' ? 'Rent is due in 3 days' : `Your ${CITY.name} branch`;
    $('mNew').hidden = !started;
    const open = Object.keys(CITIES).filter(k => s.cities[k]), locked = Object.keys(CITIES).length - open.length;
    $('worldD').textContent = open.map(k => CITIES[k].name).join(', ') + (locked ? ` · ${locked} more ${locked === 1 ? 'city' : 'cities'} to unlock` : '');
    $('mstatusT').textContent = `${CITY.name.toUpperCase()} · ${st === 'OPEN' ? 'MARKET OPEN' : 'MARKET CLOSED'} · ${hhmm(s.time)}`;
    const ns = window.Net ? Net.status : 'off';
    $('onlineD').textContent = ns === 'off' ? 'Not set up yet: playing solo' : ns === 'online' ? `Signed in as ${Net.me.name} · ${Net.online.length} online` : ns === 'connecting' ? 'Connecting…' : ns === 'no-player' ? 'Pick your player name' : 'Share the world with everyone and chat';
    $('empire').hidden = !started;
    if (started) {
      $('empW').textContent = usd(M.netWorth());
      $('empD').textContent = `${CITY.flag} ${CITY.name} · day ${M.day()}`;
      $('empC').textContent = usd(s.cash);
      $('empB').textContent = Object.keys(s.props).length;
      $('empS').textContent = s.office ? s.office.staff.length : 0;
    }
  }
  let newArm = 0;
  $('mNew').onclick = () => { // twice to erase a save
    if (Date.now() - newArm < 4000) { M.reset(); goCity('nyc'); return; }
    newArm = Date.now(); $('mNew').classList.add('warn'); $('newD').textContent = 'Click again to erase your save and start over';
    setTimeout(() => { $('mNew').classList.remove('warn'); $('newD').textContent = 'Start over from day 1'; }, 4000);
  };
  $('mWorld').onclick = () => CS.startGame(V.world(), '');
  $('mSettings').onclick = () => openSettings();
  $('mOnline').onclick = () => window.Net && Net.open('account');
  // keyboard and mouse share one highlighted item
  const items = root => [...root.querySelectorAll('.mi')].filter(b => !b.hidden);
  function select(root, i) { const list = items(root); list.forEach((b, j) => b.classList.toggle('sel', j === i)); }
  const selected = root => items(root).findIndex(b => b.classList.contains('sel'));
  for (const root of [$('title'), pause]) root.addEventListener('mouseover', e => { const b = e.target.closest('.mi'); if (b) select(root, items(root).indexOf(b)); });
  function menuKeys(root, k, e) {
    const list = items(root), i = selected(root);
    if (k === 'ArrowDown' || k === 'ArrowUp') { select(root, (Math.max(0, i) + (k === 'ArrowDown' ? 1 : list.length - 1)) % list.length); e.preventDefault(); return true; }
    if (k === 'Enter' && list[i]) { list[i].click(); e.preventDefault(); return true; }
    return false;
  }

  // ---------- HUD: system buttons, the World button, drawers ----------
  $('bSettings').onclick = () => openSettings();
  $('bPause').onclick = openPause;
  $('bMenu').onclick = openPause;
  $('bWorld').onclick = toWorld;
  setInterval(() => { // panels dock on the right on PCs: keep the dock centred in the city that's still visible
    let w = 0;
    for (const id of DRAWERS) if (shown(id)) w = Math.max(w, $(id).getBoundingClientRect().width);
    document.body.classList.toggle('drawer', w > 0);
    document.body.style.setProperty('--drawer-w', (w ? w + 24 : 0) + 'px');
    for (const [b, p] of [['bExchange', 'ex'], ['bBank', 'bank'], ['bProps', 'props']]) $(b).classList.toggle('on', shown(p));
    if (!$('title').hidden) refreshMenu();
  }, 250);
  let playing = 0; // the keys hint fades after a minute of play
  setInterval(() => { if (inGame() && ++playing === 60) $('keys').style.opacity = 0; }, 1000);

  // ---------- keyboard ----------
  const held = new Set();
  let shift = false;
  const MOVE = new Set(['w', 'a', 's', 'd', 'q', 'e', 'r', 'f', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  const DOCK = { b: 'bBank', x: 'bExchange', h: 'bHome', p: 'bProps', o: 'bOffice', m: 'bWorld' };
  const typing = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
  addEventListener('keydown', e => {
    shift = e.shiftKey;
    if (typing(e) && e.key === 'Escape') { e.target.blur(); if (shown('net')) $('net').hidden = true; return; } // leave the chat box
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey || $('load').hidden === false) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'F10') { e.preventDefault(); sets.hidden ? openSettings() : closeSettings(); return; }
    if (k === 'F3') { e.preventDefault(); GFX.showFps = !GFX.showFps; applyGfx(); if (!sets.hidden) drawSettings(); return; }
    if (!sets.hidden) { if (k === 'Escape') { e.preventDefault(); closeSettings(); } return; }
    if (k === '?') { openSettings('controls'); return; }
    if (!pause.hidden) {
      if (menuKeys(pause, k, e)) return;
      const act = { Escape: closePause, s: () => openSettings(), m: () => { closePause(); toWorld(); }, q: quitToMenu }[k];
      if (act) { e.preventDefault(); act(); }
      return;
    }
    if (!$('title').hidden) {
      if (menuKeys($('title'), k, e)) return;
      const act = { n: 'mNew', m: 'mWorld', o: 'mOnline', s: 'mSettings', c: 'mCredits' }[k];
      if (act && !$(act).hidden) { e.preventDefault(); $(act).click(); }
      return;
    }
    if (!inGame() || shown('story')) return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur(); // so Space never presses the last button clicked
    if (k === 'Escape') {
      e.preventDefault();
      const top = PANELS.find(shown);
      if (top) $(top).hidden = true; else if (window.Office && Office.active()) $('oDone').click(); else openPause();
      return;
    }
    if (k === ' ') { e.preventDefault(); CSUI.setPaused(!CSUI.paused()); return; }
    if (k === '1' || k === '2' || k === '3') { CSUI.setSpeed(CSUI.speeds[+k - 1]); return; }
    if ((k === 't' || k === 'Enter') && window.Net) { e.preventDefault(); Net.open('chat'); return; } // chat, like most PC games
    if (DOCK[k] && !fly) { $(DOCK[k]).click(); return; }
    if (MOVE.has(k)) { held.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', e => { shift = e.shiftKey; held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
  addEventListener('blur', () => held.clear());
  // the camera, moved by keys: along the ground in the direction you're looking, at a speed that suits the height
  const UP = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(), side = new THREE.Vector3(), off = new THREE.Vector3();
  frameHooks.push(dt => {
    if (!held.size || fly || !controls.enabled || !inGame() || !pause.hidden || !sets.hidden) return;
    const has = k => held.has(k), t = controls.target, cam = camera.position;
    off.copy(cam).sub(t);
    const dist = off.length();
    fwd.set(-off.x, 0, -off.z);
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); // straight down: "forward" is up the screen
    fwd.normalize(); side.set(-fwd.z, 0, fwd.x);
    const v = Math.min(dist, 2e6) * 0.9 * (shift ? 3 : 1) * dt;
    const f = (has('w') || has('ArrowUp') ? 1 : 0) - (has('s') || has('ArrowDown') ? 1 : 0), r = (has('d') || has('ArrowRight') ? 1 : 0) - (has('a') || has('ArrowLeft') ? 1 : 0);
    if (f || r) { fwd.multiplyScalar(f * v).addScaledVector(side, r * v); t.add(fwd); cam.add(fwd); }
    const turn = (has('q') ? 1 : 0) - (has('e') ? 1 : 0);
    if (turn) { off.applyAxisAngle(UP, turn * 1.4 * dt); cam.copy(t).add(off); }
    const z = (has('f') ? 1 : 0) - (has('r') ? 1 : 0);
    if (z) { off.setLength(Math.min(controls.maxDistance, Math.max(controls.minDistance, dist * Math.exp(z * 1.6 * dt)))); cam.copy(t).add(off); }
  });

  // ---------- once the city has loaded: fly in from the globe to the menu's view ----------
  const ready = setInterval(() => {
    if (!window.CS || !$('load').hidden) return;
    clearInterval(ready);
    applyGfx(); refreshMenu();
    setTimeout(() => { if (!$('title').hidden && !fly) flyTo(titleView(), 4.5); }, 250); // js/world.js may have flown you straight into a city
  }, 100);
  window.PC = { openSettings, closeSettings, openPause, closePause, quitToMenu, applyGfx, refreshMenu };
})();
