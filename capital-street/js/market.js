// Capital Street paper-trading market: fictional companies, a game clock, random events, orders and a portfolio.
// Pure logic, no drawing: the page reads Market.state and calls Market.step(realSeconds) every frame.
'use strict';
(function () {
  const OPEN = 9 * 60 + 30, CLOSE = 16 * 60, DAY = 1440, MIN_PER_DAY = CLOSE - OPEN;
  const RENT = 1850, RENT_EVERY = 7;

  // Big Apple Bank: one loan at a time; bigger loans unlock with a better credit score and more net worth
  const LOANS = [
    { id: 'starter', name: 'Starter Loan', amount: 1000, days: 7, minScore: 0, minWorth: 0 },
    { id: 'small', name: 'Small Trader Loan', amount: 5000, days: 10, minScore: 620, minWorth: 3000 },
    { id: 'line', name: 'Trader Credit Line', amount: 25000, days: 14, minScore: 680, minWorth: 15000 },
    { id: 'private', name: 'Private Banking Loan', amount: 100000, days: 21, minScore: 740, minWorth: 60000 },
    { id: 'street', name: 'Wall Street Credit', amount: 500000, days: 30, minScore: 800, minWorth: 300000 }
  ];

  // [ticker, name, sector, starting price, daily volatility, beta, shares outstanding (millions)]
  const COMPANIES = [
    ['HDSN', 'Hudson Hardware', 'Retail', 42.10, 0.022, 0.9, 180],
    ['BAGL', 'Brooklyn Bagel Co.', 'Food', 18.75, 0.028, 0.7, 95],
    ['NTXI', 'Neon Taxi', 'Transport', 9.40, 0.045, 1.3, 410],
    ['LBRT', 'Liberty Robotics', 'Tech', 131.20, 0.035, 1.4, 260],
    ['EMPR', 'Empire Energy', 'Energy', 64.05, 0.025, 0.8, 520],
    ['PGNA', 'Pigeon Air', 'Transport', 23.60, 0.040, 1.2, 300],
    ['HOOP', 'Harlem Hoops Apparel', 'Retail', 37.90, 0.030, 1.0, 140],
    ['BAPL', 'Big Apple Bank', 'Finance', 88.30, 0.020, 1.1, 640],
    ['QPZA', 'Quantum Pizza', 'Food', 12.20, 0.050, 1.1, 75],
    ['SKYL', 'Skyline Builders', 'Construction', 55.80, 0.030, 1.2, 210],
    ['MOON', 'Moonshot Crypto', 'Crypto', 4.15, 0.090, 1.8, 900],
    ['LEAF', 'Greenleaf Farms', 'Food', 27.45, 0.026, 0.6, 160],
    ['BDGA', 'Bodega Holdings', 'Retail', 15.10, 0.032, 0.9, 230],
    ['MDTN', 'Midtown Media', 'Tech', 71.50, 0.033, 1.3, 330],
    ['FISH', 'Fulton Fish Market', 'Food', 8.90, 0.035, 0.7, 60],
    ['WLST', 'Wall St. Capital', 'Finance', 212.40, 0.024, 1.2, 150]
  ].map(([t, name, sector, price, vol, beta, shares]) => ({ t, name, sector, price, vol, beta, shares }));
  const SECTORS = [...new Set(COMPANIES.map(c => c.sector))];

  const rnd = Math.random;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const company = t => COMPANIES.find(c => c.t === t);

  // ---------- events: anything can happen ----------
  // each returns a headline and effects: { who: 'all' | sector | ticker, jump (instant fraction), drift (per minute), mins, sticky (moves fair value too) }
  const EVENTS = [
    { w: 3, run() { const total = -(0.12 + rnd() * 0.18); return { kind: 'crash', title: 'MARKET CRASH', text: 'Panic on Wall Street: investors are dumping everything.', fx: [{ who: 'all', jump: total * 0.35, drift: total * 0.65 / 30, mins: 30, sticky: true }], halt: rnd() < 0.6 ? 15 : 0 }; } },
    { w: 3, run() { const total = 0.06 + rnd() * 0.1; return { kind: 'rally', title: 'STOCKS SOAR', text: 'Inflation cools and buyers pile back in.', fx: [{ who: 'all', jump: total * 0.3, drift: total * 0.7 / 40, mins: 40, sticky: true }] }; } },
    { w: 1, run() { return { kind: 'plane', title: 'PLANE CRASHES INTO A MIDTOWN TOWER', text: 'Trading is halted. Airlines plunge, builders jump on rebuilding hopes.', fx: [{ who: 'all', jump: -0.09, drift: -0.002, mins: 20, sticky: true }, { who: 'PGNA', jump: -0.35, sticky: true }, { who: 'Construction', jump: 0.12, sticky: true }], halt: 30, smoke: true }; } },
    { w: 1, run() { return { kind: 'blackout', title: 'CITYWIDE BLACKOUT', text: 'The exchange has closed for the rest of the day.', fx: [{ who: 'all', jump: -0.03, sticky: true }, { who: 'Energy', jump: -0.08, sticky: true }], closeDay: true }; } },
    { w: 2, run() { return { kind: 'fed', title: 'FED SURPRISES WITH A RATE HIKE', text: 'Banks rally, tech and crypto slide.', fx: [{ who: 'Finance', jump: 0.05, sticky: true }, { who: 'Tech', jump: -0.06, drift: -0.0008, mins: 30, sticky: true }, { who: 'Crypto', jump: -0.15, sticky: true }] }; } },
    { w: 4, run() { const c = pick(COMPANIES), d = 0.25 + rnd() * 0.3; return { kind: 'scandal', title: `${c.name.toUpperCase()} CEO ARRESTED`, text: `Fraud charges send ${c.t} into free fall.`, fx: [{ who: c.t, jump: -d * 0.6, drift: -d * 0.4 / 25, mins: 25, sticky: true }] }; } },
    { w: 6, run() { const c = pick(COMPANIES), good = rnd() < 0.55, d = (0.06 + rnd() * 0.18) * (good ? 1 : -1); return { kind: 'earnings', title: `${c.t} ${good ? 'SMASHES' : 'MISSES'} EARNINGS`, text: `${c.name} ${good ? 'beat every forecast' : 'came in far below forecasts'}.`, fx: [{ who: c.t, jump: d, sticky: true }] }; } },
    { w: 2, run() { const c = pick(COMPANIES.filter(x => x.price < 40) .concat([company('MOON')])), d = 0.5 + rnd() * 1.5; return { kind: 'squeeze', title: `${c.t} GOES VIRAL`, text: `Meme traders pile into ${c.name}. This can't last... can it?`, fx: [{ who: c.t, drift: Math.log(1 + d) / 30, mins: 30, sticky: false }] }; } },
    { w: 2, run() { const c = pick(COMPANIES), d = 0.2 + rnd() * 0.25; return { kind: 'merger', title: `${c.t} TO BE BOUGHT OUT`, text: `A rival offers a big premium for ${c.name}.`, fx: [{ who: c.t, jump: d, sticky: true }] }; } },
    { w: 1, run() { return { kind: 'hack', title: 'EXCHANGE HACKED', text: 'Trading is halted while the exchange investigates.', fx: [{ who: 'all', jump: -0.02, sticky: true }], halt: 20 }; } },
    { w: 2, run() { return { kind: 'storm', title: 'HURRICANE HEADS FOR NEW YORK', text: 'Energy and builders up, shops and taxis down.', fx: [{ who: 'Energy', jump: 0.07, sticky: true }, { who: 'Construction', jump: 0.06, sticky: true }, { who: 'Retail', jump: -0.05, sticky: true }, { who: 'Transport', jump: -0.06, sticky: true }] }; } },
    { w: 2, run() { const s = pick(SECTORS), good = rnd() < 0.5, d = (0.05 + rnd() * 0.08) * (good ? 1 : -1); return { kind: 'sector', title: `${s.toUpperCase()} ${good ? 'BOOM' : 'SLUMP'}`, text: `${good ? 'Money floods into' : 'Investors flee'} ${s.toLowerCase()} stocks.`, fx: [{ who: s, jump: d * 0.4, drift: d * 0.6 / 30, mins: 30, sticky: true }] }; } }
  ];
  const EVENT_W = EVENTS.reduce((s, e) => s + e.w, 0);

  // ---------- state ----------
  const SAVE_KEY = 'capital-street-market-v1';
  function fresh() {
    const s = {
      time: OPEN - 2, // Day 1, 09:28
      cash: 340 + 2000, // $340 in the bank plus the $2,000 envelope you found
      rentDue: 2 * DAY + CLOSE, // end of day 3
      rentPaid: 0, evicted: false, started: false,
      positions: {}, // ticker -> { shares, cost }
      orders: [], prints: [], news: [],
      halt: 0, closedToday: -1,
      loan: null, credit: 580, loansRepaid: 0, rateBump: 0,
      props: {}, reIndex: 1, rentIncome: 0,
      stocks: {}
    };
    for (const c of COMPANIES) s.stocks[c.t] = { price: c.price, fair: c.price, open: c.price, prevClose: c.price, hist: [], vol: 0 };
    // two days of history so the charts aren't empty
    const days = 2;
    for (const c of COMPANIES) {
      let p = c.price * Math.exp(gauss() * c.vol * 1.5);
      const h = [];
      for (let d = days; d > 0; d--) for (let m = OPEN; m < CLOSE; m++) {
        p *= Math.exp(gauss() * c.vol / Math.sqrt(MIN_PER_DAY) + 0.002 * Math.log(c.price / p));
        h.push({ t: (1 - d) * DAY + m, p: +p.toFixed(2), v: Math.round(rnd() * 900 + 100) });
      }
      const st = s.stocks[c.t];
      st.hist = h; st.price = st.open = st.prevClose = +p.toFixed(2); st.fair = c.price;
    }
    return s;
  }
  let S;
  try { S = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { S = null; }
  if (!S || !S.stocks || Object.keys(S.stocks).length !== COMPANIES.length) S = fresh();
  if (S.credit === undefined) Object.assign(S, { loan: null, credit: 580, loansRepaid: 0, rateBump: 0 }); // saves from before the bank opened
  if (!S.props) Object.assign(S, { props: {}, reIndex: 1, rentIncome: 0 }); // saves from before property
  const effects = []; // live event effects (not saved: they finish quickly)
  const listeners = [];
  const emit = (type, data) => { for (const f of listeners) f(type, data); };
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* private mode: progress lasts this visit */ } }

  const day = () => Math.floor(S.time / DAY) + 1;
  const minuteOfDay = () => ((S.time % DAY) + DAY) % DAY;
  const isOpen = () => minuteOfDay() >= OPEN && minuteOfDay() < CLOSE && S.closedToday !== day() && !S.evicted;
  const status = () => S.evicted ? 'EVICTED' : !isOpen() ? 'CLOSED' : S.halt > 0 ? 'HALTED' : 'OPEN';
  const priceOf = t => S.stocks[t].price;
  const holdings = () => Object.entries(S.positions).reduce((sum, [t, p]) => sum + p.shares * priceOf(t), 0);
  // ---------- property: whole buildings or single floors; values follow a citywide property index ----------
  const PROP_YIELD = 0.004, PROP_FEE = 0.06; // rent per floor per game day as a share of its value; selling costs 6%
  const floorValue = p => p.floorPrice * S.reIndex;
  const propValue = () => Object.values(S.props).reduce((sum, p) => sum + p.floors * floorValue(p), 0);
  function buyProperty(id, floors, info) { // info: { name, floorPrice, totalFloors, x, z, type, street }
    const have = S.props[id] ? S.props[id].floors : 0;
    floors = Math.min(Math.floor(floors), info.totalFloors - have);
    if (!(floors > 0)) return { ok: false, why: 'You already own every floor' };
    const whole = have === 0 && floors === info.totalFloors && floors > 1;
    const cost = +(floors * info.floorPrice * S.reIndex * (whole ? 0.95 : 1)).toFixed(2); // whole buildings get 5% off
    if (S.evicted) return { ok: false, why: 'You were evicted' };
    if (cost > S.cash) return { ok: false, why: `You need ${'$' + cost.toLocaleString('en-US', { maximumFractionDigits: 0 })} in cash` };
    S.cash = +(S.cash - cost).toFixed(2);
    const p = S.props[id] || (S.props[id] = Object.assign({ floors: 0, paid: 0, bought: S.time, earned: 0 }, info));
    p.floors += floors; p.paid += cost;
    emit('property', { kind: 'bought', id, floors, cost, first: Object.keys(S.props).length === 1 && have === 0 }); save();
    return { ok: true, cost };
  }
  function sellProperty(id, floors) {
    const p = S.props[id];
    if (!p) return { ok: false, why: 'You don\'t own this' };
    floors = Math.min(Math.floor(floors), p.floors);
    if (!(floors > 0)) return { ok: false, why: 'Choose how many floors' };
    const gets = +(floors * floorValue(p) * (1 - PROP_FEE)).toFixed(2);
    p.paid -= p.paid * floors / p.floors; p.floors -= floors;
    if (!p.floors) delete S.props[id];
    S.cash = +(S.cash + gets).toFixed(2);
    emit('property', { kind: 'sold', id, floors, gets }); save();
    return { ok: true, gets };
  }
  function propertyDay() { // each midnight: the index drifts and your tenants pay rent
    S.reIndex *= Math.exp(gauss() * 0.006 + 0.0006);
    let income = 0;
    for (const p of Object.values(S.props)) { const r = p.floors * floorValue(p) * PROP_YIELD; p.earned += r; income += r; }
    if (income > 0) { S.cash = +(S.cash + income).toFixed(2); S.rentIncome += income; emit('property', { kind: 'income', income }); }
  }
  const PROP_SHOCK = { crash: 0.95, rally: 1.02, plane: 0.92, blackout: 0.99, fed: 0.97, storm: 0.96, hack: 1 };

  // other parts of the game (the office) add their own nightly work and their own value
  const dayHooks = [], worthHooks = [];
  const extraWorth = () => worthHooks.reduce((sum, f) => sum + f(S), 0);
  const marketReturn = () => COMPANIES.reduce((sum, c) => sum + S.stocks[c.t].price / S.stocks[c.t].prevClose - 1, 0) / COMPANIES.length;
  function newDay() { const ret = marketReturn(); dayRollover(); propertyDay(); for (const f of dayHooks) f(S, ret); }
  const netWorth = () => S.cash + holdings() + propValue() + extraWorth() - (S.loan ? S.loan.balance : 0);

  // ---------- the bank ----------
  const clampScore = v => Math.max(300, Math.min(850, Math.round(v)));
  const dailyRate = () => (S.credit < 600 ? 0.012 : S.credit < 680 ? 0.008 : S.credit < 750 ? 0.005 : 0.003) + S.rateBump; // interest per game day
  function loanStatus(o) {
    if (S.evicted) return 'You were evicted';
    if (S.loan) return 'Repay your current loan first';
    if (S.credit < o.minScore) return `Needs a credit score of ${o.minScore}`;
    if (netWorth() < o.minWorth) return `Needs a net worth of $${o.minWorth.toLocaleString('en-US')}`;
    return '';
  }
  function borrow(id) {
    const o = LOANS.find(x => x.id === id), why = o ? loanStatus(o) : 'No such loan';
    if (why) return { ok: false, why };
    S.loan = { id, name: o.name, amount: o.amount, balance: o.amount, interest: 0, rate: dailyRate(), taken: S.time, due: S.time + o.days * DAY, late: 0 };
    S.cash = +(S.cash + o.amount).toFixed(2);
    emit('loan', { kind: 'taken', amount: o.amount }); save();
    return { ok: true };
  }
  function closeLoan(onTime) {
    const l = S.loan;
    S.loan = null;
    if (onTime) { S.credit = clampScore(S.credit + (l.late ? 15 : 45)); S.loansRepaid++; }
    emit('loan', { kind: 'repaid', name: l.name, onTime }); save();
  }
  function repay(amount) {
    const l = S.loan;
    if (!l) return { ok: false, why: 'You have no loan' };
    amount = Math.min(+amount || 0, l.balance, S.cash);
    if (!(amount > 0)) return { ok: false, why: S.cash <= 0 ? 'You have no cash' : 'Enter an amount' };
    S.cash = +(S.cash - amount).toFixed(2); l.balance = +(l.balance - amount).toFixed(2);
    if (l.balance < 0.01) closeLoan(true); else { emit('loan', { kind: 'paid', amount }); save(); }
    return { ok: true };
  }
  function sellToRaise(need) { // sell the biggest positions first until there is enough cash
    const held = Object.entries(S.positions).sort((a, b) => b[1].shares * priceOf(b[0]) - a[1].shares * priceOf(a[0]));
    for (const [t, p] of held) {
      if (S.cash >= need) break;
      fill('sell', t, Math.min(p.shares, Math.ceil((need - S.cash) / priceOf(t))), priceOf(t));
    }
    // still short: sell property, one floor at a time, cheapest floors first
    for (const [id, p] of Object.entries(S.props).sort((a, b) => a[1].floorPrice - b[1].floorPrice)) {
      while (S.cash < need && S.props[id]) sellProperty(id, 1);
      if (S.cash >= need) break;
    }
  }
  function accrue() { // interest grows every game minute
    const l = S.loan; if (!l) return;
    const add = l.balance * l.rate / DAY;
    l.balance += add; l.interest += add;
  }
  function checkLoan() {
    const l = S.loan;
    if (!l || S.time < l.due) return;
    // the bank collects: first your cash, then it sells your shares
    if (S.cash < l.balance) sellToRaise(l.balance);
    const paid = Math.min(S.cash, l.balance);
    S.cash = +(S.cash - paid).toFixed(2); l.balance = +(l.balance - paid).toFixed(2);
    if (l.balance < 0.01) { S.credit = clampScore(S.credit + 5); emit('loan', { kind: 'collected', name: l.name }); S.loan = null; save(); return; }
    if (!l.late) { // first miss: late fee, worse rate, three more days
      l.late = 1; l.balance = +(l.balance * 1.1).toFixed(2); l.rate *= 1.5; l.due = S.time + 3 * DAY;
      S.credit = clampScore(S.credit - 90);
      emit('loan', { kind: 'late', balance: l.balance }); save(); return;
    }
    // second miss: default. The bank writes the rest off and your credit is ruined
    S.credit = 300; S.loan = null;
    emit('loan', { kind: 'default', lost: l.balance }); save();
  }
  const matches = (who, c) => who === 'all' || who === c.t || who === c.sector;

  function applyEvent(ev) {
    for (const f of ev.fx) {
      for (const c of COMPANIES) if (matches(f.who, c)) {
        const st = S.stocks[c.t];
        if (f.jump) { st.price = Math.max(0.05, +(st.price * (1 + f.jump)).toFixed(2)); if (f.sticky) st.fair *= 1 + f.jump; }
      }
      if (f.drift) effects.push({ who: f.who, drift: f.drift, left: f.mins, sticky: f.sticky });
    }
    if (ev.halt) S.halt = Math.max(S.halt, ev.halt);
    if (PROP_SHOCK[ev.kind]) S.reIndex *= PROP_SHOCK[ev.kind]; // property prices feel it too
    if (ev.kind === 'fed') S.rateBump = +(S.rateBump + 0.001).toFixed(4); // new loans cost more after a rate hike
    if (ev.closeDay) S.closedToday = day();
    const item = { time: S.time, kind: ev.kind, title: ev.title, text: ev.text };
    S.news.unshift(item); S.news.length = Math.min(S.news.length, 60);
    emit('event', Object.assign({ smoke: !!ev.smoke }, item));
  }

  // one game minute of trading
  function minute() {
    if (S.halt > 0) { S.halt--; if (S.halt === 0) emit('resume'); return; }
    const m = gauss() * 0.011 / Math.sqrt(MIN_PER_DAY);
    const sec = {}; for (const s of SECTORS) sec[s] = gauss() * 0.008 / Math.sqrt(MIN_PER_DAY);
    for (const c of COMPANIES) {
      const st = S.stocks[c.t];
      let r = c.beta * m + sec[c.sector] + gauss() * c.vol / Math.sqrt(MIN_PER_DAY) + 0.0015 * Math.log(st.fair / st.price);
      for (const e of effects) if (matches(e.who, c)) { r += e.drift; if (e.sticky) st.fair *= Math.exp(e.drift); }
      st.price = Math.max(0.05, +(st.price * Math.exp(r)).toFixed(2));
      st.vol += Math.round((rnd() * 900 + 100) * (1 + Math.abs(r) * 400));
      st.hist.push({ t: S.time, p: st.price, v: Math.round(rnd() * 900 + 100) });
      if (st.hist.length > MIN_PER_DAY * 5) st.hist.splice(0, st.hist.length - MIN_PER_DAY * 5);
    }
    for (let i = effects.length - 1; i >= 0; i--) if (--effects[i].left <= 0) effects.splice(i, 1);
    // limit orders
    for (let i = S.orders.length - 1; i >= 0; i--) {
      const o = S.orders[i], p = priceOf(o.t);
      if ((o.side === 'buy' && p <= o.limit) || (o.side === 'sell' && p >= o.limit)) { S.orders.splice(i, 1); fill(o.side, o.t, o.shares, Math.min(p, o.side === 'buy' ? o.limit : Infinity) || p, true); }
    }
    // roughly three surprises a day
    if (rnd() < 3 / MIN_PER_DAY) { let r = rnd() * EVENT_W; applyEvent(EVENTS.find(e => (r -= e.w) < 0).run()); }
  }

  function fill(side, t, shares, price, fromLimit) {
    const total = +(shares * price).toFixed(2);
    const pos = S.positions[t] || (S.positions[t] = { shares: 0, cost: 0 });
    if (side === 'buy') {
      if (total > S.cash + 1e-6) { emit('reject', { t, why: 'Not enough cash' }); return false; }
      S.cash = +(S.cash - total).toFixed(2); pos.shares += shares; pos.cost += total;
    } else {
      if (shares > pos.shares) { emit('reject', { t, why: 'You don\'t own that many shares' }); return false; }
      const avg = pos.cost / pos.shares;
      S.cash = +(S.cash + total).toFixed(2); pos.cost -= avg * shares; pos.shares -= shares;
      if (!pos.shares) delete S.positions[t];
    }
    S.prints.unshift({ time: S.time, side, t, shares, price, total, limit: !!fromLimit });
    S.prints.length = Math.min(S.prints.length, 100);
    emit('fill', { side, t, shares, price, total });
    save();
    return true;
  }

  function placeOrder({ side, t, shares, type, limit }) {
    shares = Math.floor(shares);
    if (!(shares > 0)) return { ok: false, why: 'Enter how many shares' };
    if (status() === 'EVICTED') return { ok: false, why: 'You were evicted' };
    if (type === 'limit') {
      if (!(limit > 0)) return { ok: false, why: 'Set a limit price' };
      S.orders.push({ id: Date.now() + Math.random(), side, t, shares, limit, time: S.time });
      save(); emit('order');
      return { ok: true, queued: true };
    }
    if (status() !== 'OPEN') return { ok: false, why: status() === 'HALTED' ? 'Trading is halted' : 'The market is closed' };
    const px = priceOf(t) * (side === 'buy' ? 1.0005 : 0.9995); // a small spread
    return { ok: fill(side, t, shares, +px.toFixed(2)) };
  }
  function cancelOrder(id) { S.orders = S.orders.filter(o => o.id !== id); save(); emit('order'); }

  function dayRollover() {
    for (const c of COMPANIES) { const st = S.stocks[c.t]; st.prevClose = st.price; }
  }
  function marketOpens() {
    for (const c of COMPANIES) {
      const st = S.stocks[c.t];
      st.price = Math.max(0.05, +(st.price * Math.exp(gauss() * c.vol * 0.4)).toFixed(2)); // overnight gap
      st.open = st.price; st.vol = 0;
    }
    emit('open');
  }
  function checkRent() {
    if (S.time < S.rentDue || S.evicted) return;
    if (S.cash < RENT) sellToRaise(RENT);
    if (S.cash >= RENT) {
      S.cash = +(S.cash - RENT).toFixed(2); S.rentPaid++; S.rentDue += RENT_EVERY * DAY;
      emit('rent', { paid: true });
    } else { S.evicted = true; emit('rent', { paid: false }); }
    save();
  }

  // advance the clock: one game minute per real second while the market is open, faster overnight
  let acc = 0, saveT = 0;
  function step(realSeconds, speed = 1) {
    if (!S.started || S.evicted) return;
    acc += realSeconds * speed * (isOpen() ? 1 : 40);
    while (acc >= 1) {
      acc -= 1;
      const before = minuteOfDay(), d0 = day();
      S.time++;
      if (day() !== d0) newDay();
      if (before === OPEN - 1 && minuteOfDay() === OPEN && S.closedToday !== day()) marketOpens();
      if (isOpen()) minute();
      if (before === CLOSE - 1 && minuteOfDay() === CLOSE) emit('close');
      accrue();
      checkLoan();
      checkRent();
      emit('tick');
    }
    if ((saveT += realSeconds) > 5) { saveT = 0; save(); }
  }
  function skipToOpen() {
    if (isOpen()) return;
    const m = minuteOfDay();
    const target = m < OPEN ? S.time - m + OPEN : S.time - m + DAY + OPEN;
    while (S.time < target - 1) { const d0 = day(); S.time++; if (day() !== d0) newDay(); accrue(); checkLoan(); checkRent(); if (S.evicted) break; }
    acc = 1; step(0.0001, 1); // lands on 09:30 and opens the market
  }
  function reset() { S = fresh(); effects.length = 0; save(); emit('reset'); }

  window.Market = {
    COMPANIES, OPEN, CLOSE, DAY, RENT, LOANS, company, borrow, repay, loanStatus, dailyRate, holdings, buyProperty, sellProperty, propValue, floorValue, PROP_YIELD, PROP_FEE, step, placeOrder, cancelOrder, skipToOpen, reset, save,
    on: f => listeners.push(f), get state() { return S; }, day, minuteOfDay, isOpen, status, priceOf, netWorth,
    start() { S.started = true; save(); }, onDay: f => dayHooks.push(f), addWorth: f => worthHooks.push(f), emit, triggerEvent(kind) { const e = EVENTS.find(x => x.run().kind === kind); if (e) applyEvent(e.run()); }
  };
})();
