// Capital Street multiplayer (Goal 11): accounts, one shared world and chat, on Supabase.
// The database (server/schema.sql) decides who owns which building, so two players can never own the same one.
// Without a server set in js/net-config.js, or while signed out, the game plays alone exactly as before.
'use strict';
window.Net = (function () {
  const M = window.Market, $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const usd = v => '$' + Math.round(v).toLocaleString('en-US');
  const col = c => /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#4c8dff'; // colours from other players' games are checked before use
  const cfg = window.CS_NET || {};
  const configured = !!(cfg.url && cfg.key && window.supabase && supabase.createClient);
  const sb = configured ? supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cs-auth' } }) : null;
  const COLORS = ['#4c8dff', '#f5b83d', '#e05d5d', '#a970ff', '#2fd0c0', '#ff8fb1', '#9be15d', '#ff9f43'];
  const NAME_OK = /^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$/;

  let user = null, me = null, status = configured ? 'connecting' : 'off'; // off | connecting | signed-out | no-player | online | error
  const owners = new Map();   // building key, as the save stores it -> { owner, name, color, floors }
  const players = new Map();  // player id -> { name, color }
  let online = [];            // who is playing right now: [{ id, name, city, color }]
  const msgs = [];            // recent chat, both rooms
  let room = 'global';
  const listeners = [];
  const emit = (t, d) => { for (const f of listeners) try { f(t, d); } catch (e) { console.error(e); } };
  const err = e => (e && (e.message || e.error_description)) || 'Something went wrong. Try again.';

  // ---------- signing in ----------
  async function afterAuth() {
    me = null;
    if (!user) { status = 'signed-out'; emit('me'); return; }
    const { data, error } = await sb.from('cs_players').select('*').eq('id', user.id).maybeSingle();
    if (error) { status = 'error'; emit('me'); return; }
    me = data; status = me ? 'online' : 'no-player';
    if (me) { players.set(me.id, { name: me.name, color: me.color }); await syncSave(); track(); report(); }
    emit('me');
  }
  const guest = async () => { const { error } = await sb.auth.signInAnonymously(); return error ? { ok: false, why: /anonymous/i.test(err(error)) ? 'Guest play is switched off on this server. Sign in with an email instead.' : err(error) } : { ok: true }; };
  const signIn = async (email, password) => { const { error } = await sb.auth.signInWithPassword({ email, password }); return error ? { ok: false, why: err(error) } : { ok: true }; };
  const signUp = async (email, password) => {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { ok: false, why: err(error) };
    return { ok: true, confirm: !data.session }; // some servers ask you to confirm your email first
  };
  const saveEmail = async (email, password) => { const { error } = await sb.auth.updateUser({ email, password }); return error ? { ok: false, why: err(error) } : { ok: true }; };
  const signOut = async () => { untrack(); await sb.auth.signOut(); };
  async function createPlayer(name, color) {
    name = name.trim();
    if (!NAME_OK.test(name)) return { ok: false, why: '3 to 20 letters, numbers, spaces, dots, dashes or underscores, starting and ending with a letter or number' };
    const { data, error } = await sb.from('cs_players').insert({ id: user.id, name, color, city: CITY.id }).select().single();
    if (error) return { ok: false, why: /cs_players_name|duplicate/.test(error.message) ? `${name} is taken. Try another name.` : err(error) };
    me = data; status = 'online'; players.set(me.id, { name: me.name, color: me.color });
    await syncSave(); track(); report(); emit('me');
    return { ok: true };
  }
  async function deleteMe() {
    const { error } = await sb.rpc('cs_delete_me');
    if (error) return { ok: false, why: err(error) };
    for (const [k, o] of owners) if (me && o.owner === me.id) owners.delete(k);
    emit('owners'); await signOut();
    return { ok: true };
  }

  // ---------- the shared world: who owns which building in this city ----------
  async function loadOwners() {
    owners.clear();
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('cs_buildings').select('building, owner, floors, name, cs_players(name, color)').eq('city', CITY.id).range(from, from + 999);
      if (error) return;
      for (const r of data) {
        if (r.cs_players) players.set(r.owner, r.cs_players);
        owners.set(r.building, { owner: r.owner, floors: r.floors, name: (r.cs_players || {}).name || 'a player', color: (r.cs_players || {}).color || '#4c8dff' });
      }
      if (data.length < 1000) break;
    }
    emit('owners');
  }
  async function playerOf(id) {
    if (players.has(id)) return players.get(id);
    const { data } = await sb.from('cs_players').select('name, color').eq('id', id).maybeSingle();
    const p = data || { name: 'a player', color: '#4c8dff' }; players.set(id, p); return p;
  }
  const ownerOf = k => { const o = owners.get(k); return o && !(me && o.owner === me.id) ? o : null; }; // someone else's
  // claim before paying: the server refuses if another player got there first
  async function claim(k, floors, name) {
    if (status !== 'online') return { ok: true, local: true };
    const { data, error } = await sb.rpc('cs_claim_building', { p_city: CITY.id, p_building: k, p_floors: floors, p_name: name || '' });
    if (error) return { ok: false, why: /Another player/.test(error.message) ? 'Another player just bought this building.' : err(error) };
    owners.set(k, { owner: me.id, floors: data.floors, name: me.name, color: me.color }); emit('owners');
    return { ok: true };
  }
  async function release(k) {
    if (status !== 'online') return;
    await sb.rpc('cs_release_building', { p_city: CITY.id, p_building: k });
    owners.delete(k); emit('owners');
  }
  // your save and the shared world must agree: claim what you bought while playing alone; if someone else got a
  // building first, you get your money back in full
  async function syncSave() {
    if (!me) return;
    const here = Object.entries(M.state.props).filter(([k]) => window.Property ? Property.isHere(k) : true);
    for (const [k, p] of here) {
      const o = owners.get(k);
      if (o && o.owner !== me.id) {
        const r = M.sellProperty(k, p.floors);
        if (r.ok) { M.state.cash = +(M.state.cash + r.gets / (1 - M.PROP_FEE) * M.PROP_FEE).toFixed(2); M.save(); }
        toast('Building returned', `${o.name} owns ${p.name || 'a building you had'} in the shared world. You got your money back in full.`);
      } else if (!o || o.floors !== p.floors) await claim(k, p.floors, p.name);
    }
  }
  M.on((type, d) => { // sales of any kind (yours, or forced by the bank) give the building back to the world
    if (type !== 'property' || d.kind !== 'sold' || status !== 'online') return;
    const p = M.state.props[d.id];
    if (p) claim(d.id, p.floors, p.name); else release(d.id);
  });

  // ---------- who's online, and your entry on the rich list ----------
  let presence = null;
  function track() {
    if (!me || presence) return;
    presence = sb.channel('cs-online', { config: { presence: { key: me.id } } });
    presence.on('presence', { event: 'sync' }, () => {
      online = Object.values(presence.presenceState()).map(a => a[0]).filter(Boolean);
      emit('online');
    }).subscribe(st => { if (st === 'SUBSCRIBED') presence.track({ id: me.id, name: me.name, color: me.color, city: CITY.id }); });
  }
  function untrack() { if (presence) { sb.removeChannel(presence); presence = null; online = []; emit('online'); } }
  function report() { // your city and net worth, for the rich list (reported by your game until the economy runs on the server)
    if (status !== 'online') return;
    sb.from('cs_players').update({ city: CITY.id, net_worth: Math.round(M.netWorth()), last_seen: new Date().toISOString() }).eq('id', me.id).then(() => {});
  }
  setInterval(report, 60000);
  async function richList() {
    if (!sb) return [];
    const { data } = await sb.from('cs_players').select('name, color, net_worth, city').order('net_worth', { ascending: false }).limit(10);
    return data || [];
  }

  // ---------- chat: the whole world, or just this city ----------
  async function loadChat() {
    const { data } = await sb.from('cs_chat').select('id, room, name, body, created_at').in('room', ['global', CITY.id]).order('id', { ascending: false }).limit(100);
    msgs.length = 0; if (data) msgs.push(...data.reverse());
    emit('chat');
  }
  async function send(text) {
    text = text.trim();
    if (!text) return { ok: false, why: '' };
    if (status !== 'online') return { ok: false, why: 'Sign in and pick a name to chat.' };
    const { error } = await sb.from('cs_chat').insert({ room: room === 'city' ? CITY.id : 'global', body: text.slice(0, 280) });
    return error ? { ok: false, why: err(error) } : { ok: true };
  }

  // ---------- the panel: chat, players, your account ----------
  const panel = document.createElement('div');
  panel.id = 'net'; panel.hidden = true;
  panel.innerHTML = '<div class="exh"><b>ONLINE</b><span class="st" id="netSt"></span><button id="netX" aria-label="Close">✕</button></div><div class="tabs"><button data-nt="chat" class="on">Chat</button><button data-nt="players">Players</button><button data-nt="account">Account</button></div><div id="netBody"></div>';
  document.body.appendChild(panel);
  let tab = 'chat', richCache = [], delArm = 0;
  const swatches = cur => `<div class="swatches">${COLORS.map(c => `<button data-c="${c}" style="background:${c}" class="${c === cur ? 'on' : ''}" aria-label="Colour ${c}"></button>`).join('')}</div>`;
  function line(m) {
    const p = [...players.values()].find(x => x.name === m.name), t = new Date(m.created_at);
    return `<div class="msg"><span class="mt">${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}</span><b style="color:${p ? col(p.color) : '#9aa6b8'}">${esc(m.name)}</b> ${esc(m.body)}</div>`;
  }
  function draw() {
    panel.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.nt === tab));
    $('netSt').textContent = status === 'online' ? `${online.length} ONLINE` : status === 'off' ? 'NOT SET UP' : '';
    const body = $('netBody');
    if (status === 'off') {
      body.innerHTML = '<div class="netp"><b>Multiplayer is coming</b><p>This copy of the game isn\'t connected to a server yet, so you\'re playing alone. Your progress is saved on this device.</p></div>';
      return;
    }
    if (tab === 'chat') {
      const list = msgs.filter(m => room === 'city' ? m.room === CITY.id : m.room === 'global');
      body.innerHTML = `<div class="rooms"><button data-r="global" class="${room === 'global' ? 'on' : ''}">World</button><button data-r="city" class="${room === 'city' ? 'on' : ''}">${esc(CITY.name)}</button></div>
        <div class="msgs" id="netMsgs">${list.length ? list.map(line).join('') : '<p class="note">No messages yet. Say hello.</p>'}</div>
        ${status === 'online' ? '<form id="netForm" class="say"><input id="netIn" maxlength="280" autocomplete="off" placeholder="Message" aria-label="Message"><button>Send</button></form>' : '<p class="note">Sign in and pick a name to chat. <button class="lnk" data-go="account">Account</button></p>'}`;
      const box = $('netMsgs'); box.scrollTop = box.scrollHeight;
      body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { room = b.dataset.r; draw(); });
      if ($('netForm')) $('netForm').onsubmit = async e => {
        e.preventDefault(); const inp = $('netIn'), v = inp.value; inp.value = '';
        const r = await send(v); if (!r.ok && r.why) { toast('Not sent', r.why); inp.value = v; }
      };
    } else if (tab === 'players') {
      body.innerHTML = `<div class="netp"><small>ONLINE NOW · ${online.length}</small>${online.length ? online.map(p => `<div class="prow"><i style="background:${col(p.color)}"></i><b>${esc(p.name)}</b><span>${esc((CITIES[p.city] || {}).name || '')}</span></div>`).join('') : '<p class="note">Nobody else is here right now.</p>'}
        <small>RICHEST PLAYERS</small>${richCache.map((p, i) => `<div class="prow"><span class="rk">${i + 1}</span><i style="background:${col(p.color)}"></i><b>${esc(p.name)}</b><span>${usd(p.net_worth)}</span></div>`).join('') || '<p class="note">No players yet.</p>'}
        <p class="note">Net worth is reported by each player's game for now. It becomes official when the economy moves to the server.</p></div>`;
      richList().then(r => { const was = JSON.stringify(richCache); richCache = r; if (tab === 'players' && !panel.hidden && JSON.stringify(r) !== was) draw(); });
    } else if (status === 'signed-out' || status === 'error' || status === 'connecting') {
      body.innerHTML = `<div class="netp"><b>Play online</b><p>Share one world with everyone: see who owns which building, and chat. Your buildings are kept safe on the server.</p>
        <button class="btn pri wide" id="netGuest">PLAY ONLINE AS A GUEST</button>
        <form id="netLogin" class="cols"><small>OR USE AN EMAIL (KEEPS YOUR ACCOUNT ON EVERY DEVICE)</small><input id="netEm" type="email" autocomplete="email" placeholder="Email" aria-label="Email" required><input id="netPw" type="password" autocomplete="current-password" placeholder="Password (8+ characters)" aria-label="Password" minlength="8" required>
        <div class="row2"><button class="btn" id="netIn2" type="submit">SIGN IN</button><button class="btn" id="netUp" type="button">CREATE ACCOUNT</button></div></form>
        <p class="note">By playing online you agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a>. See the <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> for what's stored.</p></div>`;
      $('netGuest').onclick = async () => { const r = await guest(); if (!r.ok) toast('Can\'t sign in', r.why); };
      $('netLogin').onsubmit = async e => { e.preventDefault(); const r = await signIn($('netEm').value, $('netPw').value); if (!r.ok) toast('Can\'t sign in', r.why); };
      $('netUp').onclick = async () => {
        if (!$('netLogin').reportValidity()) return;
        const r = await signUp($('netEm').value, $('netPw').value);
        if (!r.ok) toast('Can\'t create the account', r.why); else if (r.confirm) toast('Check your email', 'Open the link we sent you, then sign in.');
      };
    } else if (status === 'no-player') {
      let col = COLORS[Math.floor(Math.random() * COLORS.length)];
      body.innerHTML = `<div class="netp"><b>Pick your name</b><p>Everyone sees it on your buildings and in chat.</p>
        <form id="netName" class="cols"><input id="netNm" maxlength="20" placeholder="Your name" aria-label="Player name" required>${swatches(col)}<button class="btn pri wide">START</button></form></div>`;
      body.querySelectorAll('.swatches button').forEach(b => b.onclick = e => { e.preventDefault(); col = b.dataset.c; body.querySelectorAll('.swatches button').forEach(x => x.classList.toggle('on', x === b)); });
      $('netName').onsubmit = async e => { e.preventDefault(); const r = await createPlayer($('netNm').value, col); if (!r.ok) toast('Pick another name', r.why); };
    } else {
      const anon = user && user.is_anonymous, mineHere = [...owners.values()].filter(o => o.owner === me.id).length;
      body.innerHTML = `<div class="netp"><div class="prow big"><i style="background:${col(me.color)}"></i><b>${esc(me.name)}</b><span>${anon ? 'Guest' : esc(user.email || '')}</span></div>
        <p class="note">${mineHere} building${mineHere === 1 ? '' : 's'} in ${esc(CITY.name)} registered to you.</p>
        ${anon ? `<form id="netSave" class="cols"><small>KEEP THIS ACCOUNT: ADD AN EMAIL AND PASSWORD</small><input id="netEm" type="email" autocomplete="email" placeholder="Email" aria-label="Email" required><input id="netPw" type="password" autocomplete="new-password" placeholder="Password (8+ characters)" aria-label="Password" minlength="8" required><button class="btn">SAVE MY ACCOUNT</button></form>` : ''}
        <div class="row2"><button class="btn" id="netOut">SIGN OUT</button><button class="btn danger" id="netDel">DELETE MY ACCOUNT</button></div></div>`;
      if ($('netSave')) $('netSave').onsubmit = async e => { e.preventDefault(); const r = await saveEmail($('netEm').value, $('netPw').value); toast(r.ok ? 'Check your email' : 'Can\'t save', r.ok ? 'Confirm the address to finish saving your account.' : r.why); };
      $('netOut').onclick = signOut;
      $('netDel').onclick = async () => {
        if (Date.now() - delArm > 4000) { delArm = Date.now(); $('netDel').textContent = 'CLICK AGAIN TO DELETE'; return; }
        const r = await deleteMe(); toast(r.ok ? 'Account deleted' : 'Can\'t delete', r.ok ? 'Your player, buildings and messages are gone from the server.' : r.why);
      };
    }
    body.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { tab = b.dataset.go; draw(); });
  }
  panel.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.nt; draw(); });
  $('netX').onclick = () => { panel.hidden = true; };
  function open(which) { if (which) tab = which; for (const id of ['ex', 'bank', 'props', 'listing']) if ($(id)) $(id).hidden = true; panel.hidden = false; draw(); if (tab === 'chat' && $('netIn')) $('netIn').focus(); }
  function chip() {
    const el = $('netV'); if (!el) return;
    el.parentElement.onclick = () => open(status === 'online' ? 'chat' : 'account');
    el.textContent = status === 'online' ? `${online.length} online` : status === 'off' ? 'Solo' : status === 'connecting' ? '…' : 'Sign in';
    el.parentElement.classList.toggle('on', status === 'online');
  }
  listeners.push(t => {
    chip();
    if (!panel.hidden && (t !== 'chat' || tab === 'chat')) { const typing = document.activeElement && document.activeElement.id === 'netIn' ? $('netIn').value : null; draw(); if (typing != null && $('netIn')) { $('netIn').value = typing; $('netIn').focus(); } }
  });

  // ---------- start ----------
  async function boot() {
    chip();
    if (!configured) return;
    sb.auth.onAuthStateChange((ev, session) => {
      const u = session ? session.user : null;
      if ((u && u.id) !== (user && user.id)) { user = u; if (!u) untrack(); setTimeout(afterAuth, 0); } else user = u;
    });
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    await loadOwners();
    await afterAuth();
    await loadChat();
    sb.channel('cs-' + CITY.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cs_buildings', filter: 'city=eq.' + CITY.id }, async p => {
        if (p.eventType === 'DELETE') { owners.delete(p.old.building); emit('owners'); return; }
        const r = p.new, pl = await playerOf(r.owner);
        owners.set(r.building, { owner: r.owner, floors: r.floors, name: pl.name, color: pl.color }); emit('owners');
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cs_chat', filter: `room=in.(global,${CITY.id})` }, p => {
        msgs.push(p.new); if (msgs.length > 200) msgs.shift(); emit('chat', p.new);
      })
      .subscribe();
  }
  const ready = setInterval(() => { if (window.CS && $('load').hidden) { clearInterval(ready); boot().catch(e => { status = 'error'; console.error(e); emit('me'); }); } }, 200);

  return {
    get status() { return status; }, get me() { return me; }, get online() { return online; }, configured,
    on: f => listeners.push(f), ownerOf, owners, claim, release, open, send, guest, signIn, signUp, signOut, createPlayer, deleteMe,
  };
})();
