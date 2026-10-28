// Capital Street world: city markers on the map and globe, each city's card, opening branches and travelling.
// Travelling saves the game and reloads the page around the new city (goCity in cities.js).
'use strict';
window.World = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const open = id => !!M.state.cities[id];
  if (!open(CITY.id)) { goCity('nyc'); return {}; } // a city you haven't opened yet: back to New York

  function drawMarkers() {
    for (const l of cityMarkers) {
      const here = l.city === CITY.id, ok = open(l.city);
      l.el.classList.toggle('here', here); l.el.classList.toggle('locked', !ok);
      l.el.querySelector('.badge').textContent = here ? '●' : ok ? '✓' : '🔒';
      l.el.onclick = () => { if (!fly && $('title').hidden) card(l.city); };
    }
  }
  function card(id) {
    const c = CITIES[id], s = M.state, ok = open(id), here = id === CITY.id, worth = M.netWorth();
    const cos = M.COMPANIES.filter(x => x.city === id);
    const bar = (v, need) => `<div class="bar2"><i style="width:${Math.min(100, v / need * 100)}%"></i></div>`;
    $('cityCard').innerHTML = `
      <div class="lsh"><b>${c.flag} ${c.name.toUpperCase()}</b><button id="ccX" aria-label="Close">✕</button></div>
      <div class="lbody">
        <p class="cblurb">${c.blurb}</p>
        ${ok ? `<div class="tag2 ${here ? 'here' : ''}">${here ? 'You are here' : 'Branch open'}</div>` : `
          <div class="need"><span>Net worth</span><b class="${worth >= c.need ? 'up' : ''}">${usd(worth)} / ${usd(c.need)}</b></div>${bar(worth, c.need)}
          <div class="need"><span>Opening fee (cash)</span><b class="${s.cash >= c.fee ? 'up' : ''}">${usd(s.cash)} / ${usd(c.fee)}</b></div>${bar(s.cash, c.fee)}`}
        ${cos.length ? `<div class="sec">${ok ? 'LISTED ON YOUR EXCHANGE' : 'UNLOCKS THESE COMPANIES'}</div><div class="cos">${cos.map(x => `<span><b>${x.t}</b> ${x.name}</span>`).join('')}</div>` : ''}
        <div class="lbtns">
          ${here ? '<button class="buy" id="ccGo">Fly into the city</button>' : ok ? `<button class="buy" id="ccGo">Fly to ${c.name}</button>` : `<button class="buy" id="ccOpen" ${worth >= c.need && s.cash >= c.fee ? '' : 'disabled'}>Open a branch · ${usd(c.fee)}</button>`}
        </div>
        ${ok || here ? '' : '<p class="note">Grow your net worth by trading, property and your office. Each city has real streets and buildings, its own property market and its own companies.</p>'}
      </div>`;
    $('cityCard').hidden = false;
    ['ex', 'bank', 'props', 'listing'].forEach(x => $(x).hidden = true);
    $('ccX').onclick = () => { $('cityCard').hidden = true; };
    if ($('ccGo')) $('ccGo').onclick = () => { $('cityCard').hidden = true; here ? flyTo(V.city(), 3) : travel(id); };
    if ($('ccOpen')) $('ccOpen').onclick = () => {
      const r = M.unlockCity(id);
      if (!r.ok) { toast('Not yet', r.why); return; }
      CSUI.story(`<small>NEW BRANCH</small><b>${c.flag} Capital Street ${c.name}</b><p>You signed the lease. ${cos.length} ${c.name} companies are now on your exchange, and every building in the city is yours to buy.</p>`, [[`Fly to ${c.name}`, () => travel(id)], ['Later', () => {}]]);
      drawMarkers();
    };
  }
  function travel(id) {
    M.save();
    ['ex', 'bank', 'props', 'listing', 'cityCard'].forEach(x => $(x).hidden = true);
    if (window.Office && Office.active()) Office.exit();
    flyTo(V.world(), 2.2, () => {
      $('loadMsg').textContent = `Flying to ${CITIES[id].name}`;
      $('load').firstChild.textContent = `${CITIES[id].flag} ${CITIES[id].name}…`;
      $('load').hidden = false;
      goCity(id, true);
    });
  }
  M.on(type => { if (type === 'city' || type === 'tick') drawMarkers(); });

  // when the page has finished building the city
  const ready = setInterval(() => {
    if (!window.CS || !$('load').hidden) return;
    clearInterval(ready);
    drawMarkers();
    $('load').firstChild.textContent = 'Loading…';
    const arrive = () => {
      $('title').hidden = true; $('hud').hidden = false; M.start();
      place(view(PLACE.manhattan, 6.5e6, 0.02, 0));
      flyTo(V.city(), 4.5, () => shout(`${CITY.flag} ${CITY.name.toUpperCase()}`));
    };
    if (CITY.id !== 'nyc') {
      $('play').onclick = arrive;
      document.querySelector('#title .over').textContent = `${CITY.flag} ${CITY.name.toUpperCase()} BRANCH`;
      $('bHome').onclick = () => { toast('Home', 'Flying back to your apartment in New York.'); travel('nyc'); };
    }
    let flyIn = false;
    try { flyIn = sessionStorage.getItem('cs-arrive') === '1'; sessionStorage.removeItem('cs-arrive'); } catch (e) { /* storage blocked */ }
    if (flyIn) arrive();
  }, 100);
  return { travel, card, open };
})();
