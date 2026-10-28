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
    const l = s.loan;
    $('debtBox').hidden = !l;
    if (l) {
      const ll = l.due - s.time, ld = Math.floor(ll / 1440), lh = Math.floor((ll % 1440) / 60);
      $('debtV').textContent = `${usd(l.balance)} · ${ld ? ld + 'd ' : ''}${lh}h`;
      $('debtBox').classList.toggle('late', !!l.late || ll < 1440);
    }
    $('bankSt').textContent = `DAY ${M.day()} · ${hhmm(s.time)}`;
  }
  function drawTape() {
    const one = M.COMPANIES.map(c => { const ch = dayChange(c.t); return `<span><span class="co">${c.name}</span> ${usd(M.priceOf(c.t))} <i class="${cls(ch)}">${ch >= 0 ? '▲' : '▼'}${Math.abs(ch * 100).toFixed(1)}%</i></span>`; }).join('');
    $('tape').innerHTML = one + one;
  }

  // ---------- exchange panel ----------
  let tab = 'companies', sel = 'HDSN', range = '1D', ctype = 'line', side = 'buy', otype = 'market';
  const ex = $('ex');
  function openEx(t, which = 'companies') { $('bank').hidden = true; ex.hidden = false; setTab(which); if (t) choose(t); else drawAll(); }
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
      ${s.loan ? `<div class="cards" style="margin-top:8px"><div>Shares<b>${usd(M.holdings())}</b></div><div>Loan<b class="dn">-${usd(s.loan.balance)}</b></div><div>Credit<b>${s.credit}</b></div></div>` : ''}
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
      [['Look around', () => story(`<small>WAIT…</small><b>You found $2,000.</b><p>Taped under a loose floorboard: an envelope stuffed with cash. It covers the rent, but not much else. Unless you make it grow.</p>${facts([['Cash now', '$2,340'], ['Rent', usd(M.RENT, 0), true]])}<p>Your laptop has a paper-trading app with fictional New York companies. Prices move every minute, and anything can happen. Need more to trade with? Big Apple Bank on Wall Street gives small starter loans.</p>`,
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
    if (type === 'loan') {
      if (d.kind === 'taken') toast('Loan received', `${usd(d.amount, 0)} is in your account. Spend it wisely.`);
      if (d.kind === 'paid') toast('Payment made', `${usd(d.amount)} paid to Big Apple Bank.`);
      if (d.kind === 'repaid') breaking('BIG APPLE BANK', 'LOAN REPAID', d.onTime ? 'Paid on time. Your credit score went up.' : 'The loan is closed.', true);
      if (d.kind === 'collected') breaking('BIG APPLE BANK', 'LOAN COLLECTED', 'The due date came, so the bank took what you owed from your account.', true);
      if (d.kind === 'late') { ex.hidden = true; story(`<small>BIG APPLE BANK</small><b>Payment missed.</b><p>The bank sold what it could and you still owe money. A 10% late fee was added and your rate went up.</p>${facts([['You still owe', usd(d.balance)], ['New due date', 'in 3 days', true]])}<p>Miss it again and your credit is ruined.</p>`, [['Go to the bank', () => openBank()], ['Back to trading', () => openEx()]]); }
      if (d.kind === 'default') { ex.hidden = true; story(`<small>BIG APPLE BANK</small><b>Loan defaulted.</b><p>You missed the payment twice. The bank wrote off ${usd(d.lost)} and your credit score fell to 300. Only the starter loan is open to you now.</p>`, [['Back to trading', () => openEx()]]); }
      drawBank(true);
    }
    if (type === 'reset') drawAll();
  });


  // ---------- Big Apple Bank ----------
  const bank = $('bank');
  const scoreWord = v => v >= 750 ? ['Excellent', 'up'] : v >= 680 ? ['Good', 'up'] : v >= 600 ? ['Fair', ''] : ['Poor', 'dn'];
  const rateTxt = r => (r * 100).toFixed(1) + '% a day';
  function drawBank(keepInput) {
    if (bank.hidden) return;
    const s = S(), l = s.loan, [word, wc] = scoreWord(s.credit);
    const prev = keepInput && $('payAmt') && +$('payAmt').value > 0 ? (+$('payAmt').value).toFixed(2) : '';
    let html = `<div class="score"><div class="top"><div><div class="sec" style="margin:0 0 6px">CREDIT SCORE</div><b>${s.credit}</b></div><span class="${wc}">${word}</span></div>
      <div class="gauge"><i style="left:${(s.credit - 300) / 550 * 100}%"></i></div><div><span>300</span><span>${s.loansRepaid} loan${s.loansRepaid === 1 ? '' : 's'} repaid on time</span><span>850</span></div></div>`;
    if (l) {
      const left = l.due - s.time, d = Math.floor(left / 1440), h = Math.floor((left % 1440) / 60), done = 1 - Math.min(1, l.balance / (l.amount + l.interest || 1));
      html += `<div class="sec" style="margin:0">YOUR LOAN</div><div class="lcard active">
        <div class="row1"><b>${l.name}${l.late ? ' · <span class="dn">LATE</span>' : ''}</b><strong id="lBal">${usd(l.balance)}</strong></div>
        <div class="bar2"><i style="width:${done * 100}%"></i></div>
        <div class="terms"><div>Borrowed<b>${usd(l.amount, 0)}</b></div><div>Interest so far<b class="dn" id="lInt">${usd(l.interest)}</b></div><div>Due in<b class="${left < 1440 ? 'dn' : ''}" id="lDue">${d ? d + 'd ' : ''}${h}h</b></div></div>
        <div class="terms"><div>Rate<b>${rateTxt(l.rate)}</b></div><div>Due<b>Day ${dayOf(l.due)} ${hhmm(l.due)}</b></div><div>Your cash<b id="lCash">${usd(s.cash)}</b></div></div>
        <div class="fld"><label>Repay</label><div class="step"><button data-pa="-">−</button><input id="payAmt" inputmode="decimal" placeholder="0.00" value="${prev}"><button data-pa="+">+</button></div></div>
        <div class="pct"><button data-pp=".25">25%</button><button data-pp=".5">50%</button><button data-pp=".75">75%</button><button data-pp="1">ALL</button></div>
        <button class="main pay" id="payGo">Repay</button>
        <p class="why">Interest grows every minute, so paying early is cheaper. On the due date the bank takes your cash and sells your shares to collect. Miss it and you pay a 10% late fee and your score drops; miss it twice and your credit is ruined.</p>
      </div>`;
    }
    html += `<div class="sec" style="margin:0">LOANS${l ? '' : ' FOR YOU'}</div>` + M.LOANS.map(o => {
      const why = M.loanStatus(o), rate = M.dailyRate(), cost = o.amount * (Math.pow(1 + rate, o.days) - 1);
      return `<div class="lcard${why && why !== 'Repay your current loan first' ? ' locked' : ''}">
        <div class="row1"><b>${o.name}</b><strong>${usd(o.amount, 0)}</strong></div>
        <div class="terms"><div>Term<b>${o.days} days</b></div><div>Rate<b>${rateTxt(rate)}</b></div><div>Interest if held<b>~${usd(cost, 0)}</b></div></div>
        ${why ? `<p class="why">🔒 ${why}</p>` : ''}
        <button class="main" data-borrow="${o.id}" ${why ? 'disabled' : ''}>Borrow ${usd(o.amount, 0)}</button></div>`;
    }).join('') + `<p class="note">Better credit means bigger loans and lower rates. Repay on time to raise your score.</p>`;
    $('bankBody').innerHTML = html;
    $('bankBody').querySelectorAll('[data-borrow]').forEach(b => b.onclick = () => {
      const o = M.LOANS.find(x => x.id === b.dataset.borrow);
      story(`<small>BIG APPLE BANK</small><b>Borrow ${usd(o.amount, 0)}?</b><p>You'll owe it back in ${o.days} days, plus interest of ${rateTxt(M.dailyRate())}. If you can't pay, the bank sells your shares.</p>${facts([['You get', usd(o.amount, 0)], ['Due', `in ${o.days} days`, true]])}`,
        [['Sign the loan', () => { const r = M.borrow(o.id); if (!r.ok) toast('Loan refused', r.why); openBank(); }], ['Not now', () => openBank()]]);
    });
    const amt = $('payAmt');
    if (amt) {
      $('bankBody').querySelectorAll('[data-pp]').forEach(b => b.onclick = () => { const v = Math.min(l.balance * +b.dataset.pp, s.cash); amt.value = v > 0 ? (Math.ceil(v * 100) / 100).toFixed(2) : ''; });
      $('bankBody').querySelectorAll('[data-pa]').forEach(b => b.onclick = () => { amt.value = Math.max(0, (+amt.value || 0) + (b.dataset.pa === '+' ? 100 : -100)).toFixed(2); });
      $('payGo').onclick = () => { const r = M.repay(+amt.value); if (!r.ok) toast('Payment failed', r.why); amt.value = ''; drawBank(); };
    }
  }
  // every second only the live numbers change; the panel is rebuilt when the loan, score or offers change
  let bankKey = '';
  function tickBank() {
    if (bank.hidden) return;
    const s = S(), l = s.loan;
    const key = JSON.stringify([l && [l.id, l.late, l.due, l.rate], s.credit, s.loansRepaid, M.LOANS.map(o => M.loanStatus(o)), M.dailyRate()]);
    if (key !== bankKey) { bankKey = key; drawBank(true); return; }
    if (!l || !$('lBal')) return;
    const left = l.due - s.time, d = Math.floor(left / 1440), h = Math.floor((left % 1440) / 60);
    $('lBal').textContent = usd(l.balance); $('lInt').textContent = usd(l.interest); $('lDue').textContent = `${d ? d + 'd ' : ''}${h}h`; $('lCash').textContent = usd(s.cash);
  }
  let bankSeen = false;
  function openBank() {
    ex.hidden = true; bank.hidden = false; drawBank();
    if (!bankSeen && !S().loan && !S().loansRepaid) {
      bankSeen = true;
      story(`<small>BIG APPLE BANK · WALL STREET</small><b>"Thin file, huh?"</b><p>The loan officer looks at your bank statement: $340 and a lot of rent payments. "We can do a starter loan. Pay it back on time and we'll talk about bigger numbers."</p>${facts([['Starter loan', '$1,000'], ['Your score', String(S().credit), true]])}`, [['See the loans', () => drawBank()]]);
    }
  }
  $('bankX').onclick = () => { bank.hidden = true; };
  $('debtBox').onclick = () => openBank();
  function goToBank() {
    ex.hidden = true; bank.hidden = true;
    if (current().dist < 1500 && (controls.target.x - PLACE.bank[0]) ** 2 + (controls.target.z - PLACE.bank[1]) ** 2 < 600 ** 2) openBank();
    else flyTo(V.bank(), 2.6, openBank);
  }
  $('bBank').onclick = () => bank.hidden ? goToBank() : (bank.hidden = true);

  // ---------- dock ----------
  $('bExchange').onclick = () => { bank.hidden = true; ex.hidden ? openEx() : (ex.hidden = true); };
  $('bPortfolio').onclick = () => openEx(null, 'portfolio');
  $('bHome').onclick = () => { ex.hidden = true; bank.hidden = true; flyTo(V.home()); };

  // ---------- clock ----------
  let last = performance.now(), redraw = 0, early = false;
  function loop(now) {
    const dt = Math.min(0.25, (now - last) / 1000); last = now;
    M.step(dt, speed);
    // the first morning always brings some news, so you see that anything can happen
    if (!early && S().started && M.day() === 1 && M.minuteOfDay() >= M.OPEN + 25 && !S().news.length) { early = true; M.triggerEvent('earnings'); }
    if ((redraw += dt) > 1) { redraw = 0; drawBar(); drawTape(); tickBank(); if (!ex.hidden) { if (tab === 'companies') { drawList(); drawDetail(); const q = $('qty'); if (!q || document.activeElement !== q) drawTicket(true); } else drawAll(true); } }
    requestAnimationFrame(loop);
  }
  drawBar(); drawTape();
  requestAnimationFrame(loop);
  window.CSUI = { intro, openEx, openBank };
})();
