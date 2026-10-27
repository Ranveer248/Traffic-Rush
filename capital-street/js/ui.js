// Capital Street trading UI: banner, ticker, share exchange, portfolio, news, story and rent.
// Panels follow the reference videos' style: dark, dense, green/red numbers, a yellow accent.
'use strict';
(function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const usd = (v, dp = 2) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const big$ = v => v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : usd(v, 0);
  const pct = v => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
  const cls = v => v >= 0 ? 'up' : 'dn';
  const hhmm = t => { const m = ((t % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const dayOf = t => Math.floor(t / 1440) + 1;
  const S = () => M.state;
  const dayChange = t => { const st = S().stocks[t]; return st.price / st.prevClose - 1; };

  // ---------- banner, money, ticker ----------
  const speeds = [1, 5, 20];
  let speed = 1;
  $('speed').onclick = () => { speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length]; $('speed').textContent = speed + '×'; };
  $('skip').onclick = () => M.skipToOpen();
  function drawBar() {
    const s = S(), st = M.status();
    $('clock').textContent = `NEW YORK · DAY ${M.day()} · ${hhmm(s.time)}`;
    const m = M.minuteOfDay();
    $('mstat').textContent = st === 'OPEN' ? 'MARKET OPEN' : st === 'HALTED' ? `HALTED ${s.halt}m` : st === 'EVICTED' ? 'EVICTED' : s.closedToday === M.day() ? 'CLOSED TODAY' : m < M.OPEN ? 'PRE-MARKET' : 'MARKET CLOSED';
    $('dot').className = 'dot ' + st.toLowerCase();
    $('skip').hidden = st !== 'CLOSED' || !s.started;
    $('cashV').textContent = usd(s.cash);
    const worth = M.netWorth();
    $('worthV').textContent = usd(worth);
    $('worthV').className = worth >= 2340 ? 'up' : 'dn';
    const left = s.rentDue - s.time, d = Math.floor(left / 1440), h = Math.floor((left % 1440) / 60);
    $('rentV').textContent = `${usd(M.RENT, 0)} in ${d ? d + 'd ' : ''}${h}h`;
    $('rentBox').classList.toggle('late', left < 1440 && s.cash < M.RENT);
    $('exSt').textContent = $('mstat').textContent + ' · ' + hhmm(s.time);
  }
  function drawTape() {
    const one = M.COMPANIES.map(c => { const ch = dayChange(c.t); return `<span><span class="co">${c.name}</span> ${usd(M.priceOf(c.t))} <i class="${cls(ch)}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch * 100).toFixed(1)}%</i></span>`; }).join('');
    $('tape').innerHTML = one + one;
  }

  // ---------- exchange panel ----------
  let tab = 'companies', sel = 'HDSN', range = '1D', ctype = 'line', side = 'buy', otype = 'market';
  const ex = $('ex');
  function openEx(t, which = 'companies') { ex.hidden = false; setTab(which); if (t) choose(t); else drawAll(); }
  $('exX').onclick = () => { ex.hidden = true; };
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.tab));
  function setTab(t) {
    tab = t;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    $('exBody').hidden = t !== 'companies'; $('pf').hidden = t !== 'portfolio'; $('nf').hidden = t !== 'news';
    drawAll();
  }
  function choose(t) { sel = t; $('exBody').classList.remove('pick'); drawAll(); $('exBody').scrollTop = 0; $('detail').scrollTop = 0; }

  function spark(canvas, pts) {
    const r = devicePixelRatio || 1, w = 52, h = 22;
    canvas.width = w * r; canvas.height = h * r;
    const g = canvas.getContext('2d'); g.scale(r, r);
    const ps = pts.map(p => p.p), lo = Math.min(...ps), hi = Math.max(...ps), up = ps[ps.length - 1] >= ps[0];
    g.strokeStyle = up ? '#22c55e' : '#ef4444'; g.lineWidth = 1.4; g.beginPath();
    ps.forEach((p, i) => { const x = i / (ps.length - 1) * w, y = h - 2 - (p - lo) / (hi - lo || 1) * (h - 4); i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
  }
  function drawList() {
    const el = $('list');
    el.innerHTML = M.COMPANIES.map(c => { const ch = dayChange(c.t); return `<div class="row${c.t === sel ? ' on' : ''}" data-t="${c.t}"><canvas></canvas><div><b>${c.t}</b><span>${c.name}</span></div><div class="px"><b>${usd(M.priceOf(c.t))}</b><span class="${cls(ch)}">${pct(ch)}</span></div></div>`; }).join('');
    el.querySelectorAll('.row').forEach(r => { r.onclick = () => choose(r.dataset.t); spark(r.querySelector('canvas'), S().stocks[r.dataset.t].hist.slice(-90)); });
  }
  function seriesFor(t) {
    const h = S().stocks[t].hist, n = { '1H': 60, '6H': 360, '1D': M.CLOSE - M.OPEN, '5D': h.length }[range];
    return h.slice(-n);
  }
  function drawChart() {
    const cv = $('chart'); if (!cv) return;
    const r = devicePixelRatio || 1, w = cv.clientWidth || 300, h = cv.clientHeight || 200;
    cv.width = w * r; cv.height = h * r;
    const g = cv.getContext('2d'); g.scale(r, r);
    const pts = seriesFor(sel); if (pts.length < 2) return;
    const pad = { l: 4, r: 54, t: 8, b: 16 };
    let buckets = null;
    if (ctype === 'candles') {
      const size = { '1H': 1, '6H': 5, '1D': 10, '5D': 30 }[range];
      buckets = [];
      for (let i = 0; i < pts.length; i += size) { const s = pts.slice(i, i + size).map(p => p.p); buckets.push({ o: s[0], c: s[s.length - 1], h: Math.max(...s), l: Math.min(...s) }); }
    }
    const vals = buckets ? buckets.flatMap(b => [b.h, b.l]) : pts.map(p => p.p);
    let lo = Math.min(...vals), hi = Math.max(...vals); const m = (hi - lo) * 0.08 || hi * 0.01; lo -= m; hi += m;
    const X = i => pad.l + i / ((buckets ? buckets.length : pts.length) - 1 || 1) * (w - pad.l - pad.r), Y = v => pad.t + (hi - v) / (hi - lo) * (h - pad.t - pad.b);
    g.font = '600 10px Inter, sans-serif'; g.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4, y = Y(v); g.strokeStyle = '#262a32'; g.lineWidth = 1; g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke(); g.fillStyle = '#6b7280'; g.fillText(usd(v), w - pad.r + 6, y); }
    const up = pts[pts.length - 1].p >= pts[0].p, col = up ? '#22c55e' : '#ef4444';
    if (buckets) {
      const bw = Math.max(1.5, (w - pad.l - pad.r) / buckets.length * 0.6);
      buckets.forEach((b, i) => { const c = b.c >= b.o ? '#22c55e' : '#ef4444', x = X(i); g.strokeStyle = g.fillStyle = c; g.beginPath(); g.moveTo(x, Y(b.h)); g.lineTo(x, Y(b.l)); g.stroke(); const y0 = Y(Math.max(b.o, b.c)), y1 = Y(Math.min(b.o, b.c)); g.fillRect(x - bw / 2, y0, bw, Math.max(1, y1 - y0)); });
    } else {
      const grad = g.createLinearGradient(0, pad.t, 0, h - pad.b); grad.addColorStop(0, up ? 'rgba(34,197,94,.28)' : 'rgba(239,68,68,.28)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(i), Y(p.p)) : g.moveTo(X(i), Y(p.p)));
      g.strokeStyle = col; g.lineWidth = 1.6; g.stroke();
      g.lineTo(X(pts.length - 1), h - pad.b); g.lineTo(X(0), h - pad.b); g.closePath(); g.fillStyle = grad; g.fill();
    }
    const last = M.priceOf(sel), y = Y(last);
    g.setLineDash([3, 3]); g.strokeStyle = col; g.beginPath(); g.moveTo(pad.l, y); g.lineTo(w - pad.r, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = col; g.fillRect(w - pad.r + 2, y - 8, pad.r - 2, 16); g.fillStyle = '#05140a'; g.font = '800 10px Inter, sans-serif'; g.fillText(usd(last), w - pad.r + 5, y);
    g.fillStyle = '#6b7280'; g.font = '600 9px Inter, sans-serif'; g.textBaseline = 'alphabetic';
    g.fillText(`Day ${dayOf(pts[0].t)} ${hhmm(pts[0].t)}`, pad.l, h - 3);
    const endLabel = `Day ${dayOf(pts[pts.length - 1].t)} ${hhmm(pts[pts.length - 1].t)}`; g.fillText(endLabel, w - pad.r - g.measureText(endLabel).width, h - 3);
  }
  function drawDetail() {
    const c = M.company(sel), st = S().stocks[sel], s = S(), ch = dayChange(sel);
    const today = st.hist.filter(p => dayOf(p.t) === M.day() && M.minuteOfDay() >= M.OPEN);
    const hi = today.length ? Math.max(...today.map(p => p.p)) : st.price, lo = today.length ? Math.min(...today.map(p => p.p)) : st.price;
    const five = st.hist[0] ? st.price / st.hist[0].p - 1 : 0;
    const pos = s.positions[sel];
    $('detail').innerHTML = `
      <button class="back" id="back">‹ All companies</button>
      <div class="dh"><span class="sym">${c.t}</span><span class="nm">${c.name} · ${c.sector}</span><span class="big">${usd(st.price)}</span><span class="${cls(ch)}">${usd(st.price - st.prevClose)} (${pct(ch)}) today</span></div>
      <div class="stats">
        <div>Market cap<b>${big$(st.price * c.shares * 1e6)}</b></div><div>Prev close<b>${usd(st.prevClose)}</b></div><div>Day high<b>${usd(hi)}</b></div><div>Day low<b>${usd(lo)}</b></div>
        <div>Volume<b>${st.vol.toLocaleString('en-US')}</b></div><div>Shares out<b>${c.shares}M</b></div><div>5-day<b class="${cls(five)}">${pct(five)}</b></div><div>You own<b>${pos ? pos.shares : 0}</b></div>
      </div>
      <div class="chartbox"><div class="chartctl">${['1H', '6H', '1D', '5D'].map(r => `<button data-r="${r}" class="${r === range ? 'on' : ''}">${r}</button>`).join('')}<button data-c="line" class="${ctype === 'line' ? 'on' : ''}">LINE</button><button data-c="candles" class="${ctype === 'candles' ? 'on' : ''}">CANDLES</button></div><canvas id="chart"></canvas></div>
      <div class="sec">YOUR POSITIONS</div>${positionsTable(true)}`;
    $('back').onclick = () => { $('exBody').classList.add('pick'); drawAll(); };
    $('detail').querySelectorAll('[data-r]').forEach(b => b.onclick = () => { range = b.dataset.r; drawDetail(); });
    $('detail').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { ctype = b.dataset.c; drawDetail(); });
    bindPosRows($('detail'));
    drawChart();
  }
  function positionsTable(compact) {
    const s = S(), rows = Object.entries(s.positions);
    if (!rows.length) return '<p class="note">No shares yet. Buy something on the right.</p>';
    return `<table class="tbl"><tr><th>Symbol</th><th>Shares</th><th>Avg cost</th>${compact ? '' : '<th>Price</th>'}<th>Value</th><th>P&amp;L</th></tr>${rows.map(([t, p]) => {
      const px = M.priceOf(t), val = p.shares * px, pl = val - p.cost;
      return `<tr data-t="${t}"><td><b>${t}</b></td><td>${p.shares}</td><td>${usd(p.cost / p.shares)}</td>${compact ? '' : `<td>${usd(px)}</td>`}<td>${usd(val)}</td><td class="${cls(pl)}">${usd(pl)} (${pct(pl / p.cost)})</td></tr>`;
    }).join('')}</table>`;
  }
  function bindPosRows(root) { root.querySelectorAll('tr[data-t]').forEach(r => r.onclick = () => { setTab('companies'); choose(r.dataset.t); }); }
  function drawTicket(keepInputs) {
    const c = M.company(sel), px = M.priceOf(sel), s = S(), pos = s.positions[sel];
    const prevShares = keepInputs && $('qty') && +$('qty').value > 0 ? String(Math.floor(+$('qty').value)) : '';
    const prevLimit = keepInputs && $('lim') && +$('lim').value > 0 ? (+$('lim').value).toFixed(2) : '';
    const tick = Math.max(0.01, +(px * 0.0005).toFixed(2));
    let book = '';
    for (let i = 5; i >= 1; i--) book += `<span class="a">${usd(px + tick * i)}</span><span class="q">${Math.round(40 + Math.random() * 900)}</span>`;
    for (let i = 1; i <= 5; i++) book += `<span class="b">${usd(px - tick * i)}</span><span class="q">${Math.round(40 + Math.random() * 900)}</span>`;
    $('ticket').innerHTML = `
      <div class="sec" style="margin-top:0">ORDER BOOK</div><div class="book">${book}</div>
      <div class="tk">
        <div class="seg"><button class="buy ${side === 'buy' ? 'on' : ''}" data-side="buy">BUY</button><button class="sell ${side === 'sell' ? 'on' : ''}" data-side="sell">SELL</button></div>
        <div class="seg"><button class="plain ${otype === 'market' ? 'on' : ''}" data-ot="market">MARKET</button><button class="plain ${otype === 'limit' ? 'on' : ''}" data-ot="limit">LIMIT</button></div>
        ${otype === 'limit' ? `<div class="fld"><label>Limit price</label><div class="step"><button data-l="-">−</button><input id="lim" inputmode="decimal" value="${prevLimit || px.toFixed(2)}"><button data-l="+">+</button></div></div>` : ''}
        <div class="fld"><label>Shares</label><div class="step"><button data-q="-">−</button><input id="qty" inputmode="numeric" placeholder="0" value="${prevShares}"><button data-q="+">+</button></div></div>
        <div class="pct"><button data-p=".25">25%</button><button data-p=".5">50%</button><button data-p=".75">75%</button><button data-p="1">MAX</button></div>
        <div class="est"><span>Estimated total</span><b id="estV">$0.00</b></div>
        <div class="est"><span>${side === 'buy' ? 'Cash available' : 'Shares you own'}</span><b>${side === 'buy' ? usd(s.cash) : (pos ? pos.shares : 0)}</b></div>
        <button id="go" class="${side}">${side === 'buy' ? 'Buy' : 'Sell'} ${c.t}</button>
        <p class="note">${M.status() === 'OPEN' ? 'Market orders fill right away.' : otype === 'limit' ? 'Limit orders wait until the price is reached.' : 'The market is ' + M.status().toLowerCase() + '. Use a limit order or wait for the open.'}</p>
      </div>`;
    const qty = $('qty'), lim = $('lim');
    const price = () => otype === 'limit' ? (+lim.value || px) : px;
    const upd = () => { $('estV').textContent = usd((+qty.value || 0) * price()); };
    upd();
    qty.oninput = upd; if (lim) lim.oninput = upd;
    $('ticket').querySelectorAll('[data-side]').forEach(b => b.onclick = () => { side = b.dataset.side; drawTicket(true); });
    $('ticket').querySelectorAll('[data-ot]').forEach(b => b.onclick = () => { otype = b.dataset.ot; drawTicket(true); });
    $('ticket').querySelectorAll('[data-q]').forEach(b => b.onclick = () => { qty.value = Math.max(0, (+qty.value || 0) + (b.dataset.q === '+' ? 1 : -1)); upd(); });
    $('ticket').querySelectorAll('[data-l]').forEach(b => b.onclick = () => { lim.value = Math.max(0.01, (+lim.value || px) + (b.dataset.l === '+' ? tick : -tick)).toFixed(2); upd(); });
    $('ticket').querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const f = +b.dataset.p;
      qty.value = side === 'buy' ? Math.floor(S().cash * f / (price() * 1.0005)) : Math.floor((pos ? pos.shares : 0) * f);
      upd();
    });
    $('go').onclick = () => {
      const r = M.placeOrder({ side, t: sel, shares: +qty.value, type: otype, limit: lim ? +lim.value : 0 });
      if (!r.ok) toast('Order rejected', r.why);
      else if (r.queued) toast('Limit order placed', `${side === 'buy' ? 'Buy' : 'Sell'} ${qty.value} ${sel} at ${usd(+lim.value)}`);
      qty.value = ''; drawAll(true);
    };
  }
  function drawPortfolio() {
    const s = S(), worth = M.netWorth(), pl = worth - 2340;
    $('posN').textContent = Object.keys(s.positions).length || '';
    $('pf').innerHTML = `
      <div class="cards"><div>Net worth<b>${usd(worth)}</b></div><div>Cash<b>${usd(s.cash)}</b></div><div>Profit<b class="${cls(pl)}">${usd(pl)}</b></div></div>
      <div class="sec">POSITIONS</div>${positionsTable(false)}
      <div class="sec">OPEN ORDERS</div>${s.orders.length ? `<table class="tbl"><tr><th>Order</th><th>Shares</th><th>Limit</th><th></th></tr>${s.orders.map(o => `<tr><td class="${o.side === 'buy' ? 'up' : 'dn'}">${o.side.toUpperCase()} ${o.t}</td><td>${o.shares}</td><td>${usd(o.limit)}</td><td><button class="mini" data-cancel="${o.id}">Cancel</button></td></tr>`).join('')}</table>` : '<p class="note">None.</p>'}
      <div class="sec">TRADE HISTORY</div>${s.prints.length ? `<table class="tbl"><tr><th>When</th><th>Trade</th><th>Price</th><th>Total</th></tr>${s.prints.slice(0, 30).map(p => `<tr><td>D${dayOf(p.time)} ${hhmm(p.time)}</td><td class="${p.side === 'buy' ? 'up' : 'dn'}">${p.side.toUpperCase()} ${p.shares} ${p.t}</td><td>${usd(p.price)}</td><td>${usd(p.total)}</td></tr>`).join('')}</table>` : '<p class="note">No trades yet.</p>'}
      <div class="sec">GAME</div><button class="mini" id="newGame">Start a new game</button>`;
    bindPosRows($('pf'));
    $('pf').querySelectorAll('[data-cancel]').forEach(b => b.onclick = () => M.cancelOrder(+b.dataset.cancel));
    $('newGame').onclick = () => { if (confirm('Start over from Day 1? Your trades will be lost.')) { M.reset(); location.reload(); } };
  }
  function drawNews() {
    const n = S().news;
    $('nf').innerHTML = n.length ? n.map(x => `<div class="news"><small>DAY ${dayOf(x.time)} · ${hhmm(x.time)}</small><b>${x.title}</b><span>${x.text}</span></div>`).join('') : '<p class="note">Quiet so far. Anything can happen.</p>';
  }
  function drawAll(keepInputs) {
    drawBar();
    if (ex.hidden) return;
    if (tab === 'companies') { drawList(); drawDetail(); drawTicket(keepInputs); }
    if (tab === 'portfolio') drawPortfolio();
    if (tab === 'news') drawNews();
    $('posN').textContent = Object.keys(S().positions).length || '';
  }

  // ---------- breaking news, story, rent ----------
  let brkT = 0;
  function breaking(kicker, title, body, good, look) {
    $('brkK').textContent = kicker; $('brkT').textContent = title; $('brkB').textContent = body;
    $('breaking').classList.toggle('good', !!good); $('breaking').classList.add('on');
    $('brkGo').hidden = !look; $('brkGo').onclick = look || null;
    clearTimeout(brkT); brkT = setTimeout(() => $('breaking').classList.remove('on'), look ? 12000 : 7000);
  }
  function story(html, buttons) {
    $('storyBox').innerHTML = html + buttons.map((b, i) => `<button data-i="${i}">${b[0]}</button>`).join('');
    $('storyBox').querySelectorAll('button').forEach(b => b.onclick = () => { $('story').hidden = true; buttons[+b.dataset.i][1](); });
    $('story').hidden = false;
  }
  const facts = list => `<div class="facts">${list.map(([k, v, warn]) => `<div class="${warn ? 'warn' : ''}">${k}<b>${v}</b></div>`).join('')}</div>`;
  function intro() {
    if (S().started) { toast('Welcome back', `Day ${M.day()}: you have ${usd(M.netWorth())}.`); return; }
    story(`<small>DAY 1 · YOUR APARTMENT</small><b>Rent is due.</b><p>Just you, a mattress, a laptop and a stack of bills. The landlord wants ${usd(M.RENT, 0)} by the end of day 3.</p>${facts([['Bank account', '$340'], ['Rent due', usd(M.RENT, 0) + ' · 3 days', true]])}`,
      [['Look around', () => story(`<small>WAIT…</small><b>You found $2,000.</b><p>Taped under a loose floorboard: an envelope stuffed with cash. It covers the rent, but not much else. Unless you make it grow.</p>${facts([['Cash now', '$2,340'], ['Rent', usd(M.RENT, 0), true]])}<p>Your laptop has a paper-trading app with fictional New York companies. Prices move every minute, and anything can happen.</p>`,
        [['Open the trading app', () => { M.start(); openEx(null, 'companies'); }]])]]);
  }
  M.on((type, d) => {
    if (type === 'event') {
      const good = ['rally', 'merger', 'squeeze'].includes(d.kind) || (d.kind === 'earnings' && d.title.includes('SMASHES'));
      let look = null;
      if (d.smoke && window.CS && CS.smoke) { const at = CS.smoke(); look = () => { $('breaking').classList.remove('on'); ex.hidden = true; flyTo(view(at, 900, 0.9, current().az)); }; }
      breaking('BREAKING NEWS · ' + hhmm(d.time), d.title, d.text, good, look);
    }
    if (type === 'open') toast('Market open', 'The opening bell rings on Wall Street.');
    if (type === 'close') toast('Market closed', 'Trading resumes tomorrow at 9:30.');
    if (type === 'resume') breaking('MARKET UPDATE', 'TRADING RESUMES', 'The halt is over. Prices are moving again.', true);
    if (type === 'fill') { toast(`${d.side === 'buy' ? 'Bought' : 'Sold'} ${d.shares} ${d.t}`, `at ${usd(d.price)} · total ${usd(d.total)}`); drawAll(true); }
    if (type === 'reject') toast('Order rejected', d.why);
    if (type === 'order') drawAll(true);
    if (type === 'rent') {
      ex.hidden = true;
      if (d.paid) story(`<small>RENT DAY</small><b>Rent paid.</b><p>The landlord nods and takes ${usd(M.RENT, 0)}. You get to keep your apartment, for another week.</p>${facts([['Cash left', usd(S().cash)], ['Next rent', 'in 7 days', true]])}<p>Keep growing your money. Your dream: an office on Wall Street.</p>`, [['Back to trading', () => openEx()]]);
      else story(`<small>RENT DAY</small><b>Evicted.</b><p>You couldn't cover the rent. The landlord changed the locks.</p>${facts([['You had', usd(M.netWorth())], ['Rent was', usd(M.RENT, 0), true]])}`, [['Start over', () => { M.reset(); location.reload(); }]]);
    }
    if (type === 'reset') drawAll();
  });

  // ---------- dock ----------
  $('bExchange').onclick = () => ex.hidden ? openEx() : (ex.hidden = true);
  $('bPortfolio').onclick = () => openEx(null, 'portfolio');
  $('bNews').onclick = () => openEx(null, 'news');
  $('bHome').onclick = () => { ex.hidden = true; flyTo(V.home()); };

  // ---------- clock ----------
  let last = performance.now(), redraw = 0, early = false;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    M.step(dt, speed);
    // the first morning always brings some news, so you see that anything can happen
    if (!early && S().started && M.day() === 1 && M.minuteOfDay() >= M.OPEN + 25 && !S().news.length) { early = true; M.triggerEvent('earnings'); }
    if ((redraw += dt) > 1) { redraw = 0; drawBar(); drawTape(); if (!ex.hidden) { if (tab === 'companies') { drawList(); drawDetail(); const q = $('qty'); if (!q || document.activeElement !== q) drawTicket(true); } else drawAll(true); } }
    requestAnimationFrame(loop);
  }
  drawBar(); drawTape();
  requestAnimationFrame(loop);
  window.CSUI = { intro, openEx };
})();
