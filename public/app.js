const app = document.getElementById("app");
const q = new URLSearchParams(location.search);
let code = (q.get("code") || "").toUpperCase();
let G = null, S = { name: "", show: false, anim: false, msg: "", last: "", pick: null, prev: null, seen: "" };
const store = (k, v) => v === undefined ? localStorage.getItem(`wn:${code}:${k}`) : localStorage.setItem(`wn:${code}:${k}`, v);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const card = h => `<div class="c">${h}</div>`;
async function api(body) {
  const r = await fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, hostToken: store("host"), pid: store("pid"), ...body }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
const who = id => G.players.find(p => p.id === id);
const icon = r => r ? `<img class="mini" src="${ROLES[r].icon}" alt="">` : `<span class="mini"></span>`;
const plist = () => G.players.length ? G.players.map(p => `<span class="tag ${p.dead ? "dead" : ""}">${esc(p.name)}</span>`).join("") : `<p class="m">Nobody has joined yet.</p>`;
const detail = k => { const r = ROLES[k]; return `<p><span class="tag">${r.team}</span></p><p>${r.what}</p><p><b>Each night:</b> ${r.night}</p><p><b>Tip:</b> ${r.tip}</p>`; };
const refs = c => Object.keys(c).filter(k => c[k] > 0).map(k => `<details><summary>${icon(k)}${ROLES[k].name} × ${c[k]}</summary>${detail(k)}</details>`).join("");
const fallen = () => { const d = G.players.filter(p => p.dead); return d.length ? card(`<h2>The fallen</h2>` + d.map(p => `<div class="row r2">${icon(p.role)}<span><b>${esc(p.name)}</b><br><span class="m">${ROLES[p.role].name} · ${CAUSES[p.cause]}</span></span></div>`).join("")) : ""; };

function roleCard(k) {
  const r = ROLES[k]; // colour only appears once the card is face up, so a hidden card gives nothing away
  return `<div class="c ${S.show ? "rc" : ""}" style="--rc:${r.color}"><img class="cardimg ${S.anim ? "fresh" : ""}" data-a="flip" src="${S.show ? r.img : BACK}" alt="">` + (S.show ? `<h2 style="text-align:center">${r.name}</h2>${detail(k)}<button class="g" data-a="hide">Hide my role</button>` : `<p class="m" style="text-align:center">Your role is hidden. Check nobody is peeking, then tap the card.</p>`) + `</div>`;
}
function deathCard(k, cause) {
  return `<div class="c" style="text-align:center"><img class="cardimg rip" src="${ROLES[k].img}" alt=""><h2>You’ve been eliminated</h2><p>${CAUSES[cause]}.</p><p class="m">You were the ${ROLES[k].name}. Stay quiet and keep a straight face: no hints and no reactions. Watch the rest of the game unfold.</p></div>`;
}
const phone = (k, cause) => cause ? deathCard(k, cause) : roleCard(k);
const pickBox = p => `<div class="pickbox">` + (p.dead
  ? `<p class="m">${CAUSES[p.cause]}.</p><button data-a="revive" data-id="${p.id}">Revive ${esc(p.name)} (undo)</button>`
  : `<p class="m">How did ${esc(p.name)} die?</p>` + Object.keys(CAUSES).map(k => `<button data-a="kill" data-id="${p.id}" data-k="${k}">${CAUSES[k]}</button>`).join("")) + `<button class="g" data-a="cancel">Cancel</button></div>`;

function thiefCard() {
  const t = G.thief; if (!t) return "";
  const p = who(t.id), must = t.center.every(r => r === "werewolf"), bot = p && p.bot;
  const mids = t.center.map(r => `<span class="tag">${ROLES[r].name}</span>`).join("");
  if (t.done) return card(`<h2>The Thief</h2><p class="m">${esc(p ? p.name : "")} swapped and is now the ${ROLES[G.roles[t.id]].name}.</p>`);
  return card(`<h2>The Thief</h2><p class="m">${esc(p ? p.name : "")} holds the Thief card. Middle cards: ${mids}${must ? " (both werewolves, so they must swap)" : ""}</p><button data-a="thiefwake">${t.open ? "Put the Thief back to sleep" : "Wake the Thief"}</button><p class="m">${t.open ? "The Thief can now see the two middle cards on their phone." : "Wake the Thief first on night one. They may also swap on a later night."}</p>` +
    (bot && t.open ? t.center.map((r, i) => `<button class="g" data-a="thiefpick" data-k="${i}">Test: swap for ${ROLES[r].name}</button>`).join("") + (must ? "" : `<button class="g" data-a="thiefpick" data-k="keep">Test: keep the Thief card</button>`) : ""));
}
const thiefOptions = () => card(`<h2>Wake up, Thief</h2><p class="m">These are the two cards in the middle. You may swap your Thief card for one of them.${G.must ? " Both are werewolves, so you must swap." : ""}</p><div class="opts">` + G.options.map((r, i) => `<div class="opt"><img class="cardimg" src="${ROLES[r].img}" alt=""><b>${ROLES[r].name}</b><button data-a="thiefpick" data-k="${i}">Swap for this</button></div>`).join("") + `</div>` + (G.must ? "" : `<button class="g" data-a="thiefpick" data-k="keep">Keep the Thief card for now</button>`));
function hostView() {
  if (S.prev && G.roles[S.prev]) { // exactly what that player's phone would show
    const pl = who(S.prev);
    return card(`<p class="m">Previewing ${esc(pl ? pl.name : "")}’s phone</p>`) + phone(G.roles[S.prev], pl && pl.cause) + card(`<button data-a="unprev">Exit preview</button>`);
  }
  const n = G.players.length, c = G.counts, keys = Object.keys(ROLES).filter(k => k !== "villager");
  const vill = n - keys.reduce((a, k) => a + (c[k] || 0), 0);
  let h = card(`<p class="m" style="text-align:center">Game code</p><div class="code">${G.code}</div><p class="m" style="text-align:center">Friends visit <b>${esc(location.host)}</b> and enter it, or use the link.</p><button class="g" data-a="copy">Copy join link</button>`);
  if (G.status === "lobby") {
    h += card(`<h2>Lobby · ${n} joined</h2>` + G.players.map(p => `<div class="row"><span>${esc(p.name)}</span><button class="s g" data-a="kick" data-id="${p.id}">Remove</button></div>`).join("") + (n ? "" : `<p class="m">Waiting for players…</p>`) + `<button class="g" data-a="bots">Add 5 test players</button>`);
    h += card(`<h2>Roles</h2>` + keys.map(k => `<div class="row r3">${icon(k)}<span>${ROLES[k].name}</span><span class="step"><button class="s" data-a="dec" data-k="${k}">−</button><b>${c[k] || 0}</b><button class="s" data-a="inc" data-k="${k}">+</button></span></div>`).join("") + `<div class="row r3">${icon("villager")}<span>Villagers (the rest)</span><span class="step"><b>${Math.max(vill, 0)}</b></span></div><p class="m">Rule of thumb: about 1 wolf per 4 players.</p>${c.thief ? `<p class="m">The Thief adds two extra villager cards to the deck. The two cards left over become the Thief’s options.</p>${c.werewolf ? "" : `<p class="err">The Thief needs at least one werewolf.</p>`}` : ""}${vill < 0 ? `<p class="err">More roles than players.</p>` : ""}<button data-a="deal" ${n < 3 || vill < 0 || (c.thief && !c.werewolf) ? "disabled" : ""}>Deal roles</button>`);
  } else {
    if (!G.winner && G.players.some(p => p.dead && p.role === "hunter") && !G.players.some(p => p.cause === "hunter"))
      h += card(`<h2>The Hunter takes a shot</h2><p class="m">The Hunter died. They choose one player to shoot: tap that player below and choose “Shot by the hunter”.</p>`);
    h += thiefCard();
    h += card(`<h2>Narrator sheet</h2><p class="m">Tap a player to record a death. ${G.players.filter(p => !p.dead).length} of ${n} alive.</p>` + G.players.map(p => { const r = G.roles[p.id]; return `<div class="row r3 pick" data-a="pick" data-id="${p.id}">${icon(r)}<span><b class="${p.dead ? "dead" : ""}">${esc(p.name)}</b><br><span class="m">${r ? ROLES[r].name : "No role"}${G.thief && G.thief.done && p.id === G.thief.id ? " (was Thief)" : ""}${p.dead ? " · " + CAUSES[p.cause] : ""}</span></span><button class="s g" data-a="prev" data-id="${p.id}">Preview</button></div>` + (S.pick === p.id ? pickBox(p) : ""); }).join(""));
    h += card(`<h2>Night order</h2><p class="m">Everyone closes their eyes. Wake each role in turn:</p>` + NIGHT_ORDER.filter(k => Object.values(G.roles).includes(k)).map(k => `<div class="row"><span><b>${ROLES[k].name}</b><br><span class="m">${ROLES[k].night}</span></span></div>`).join("") + `<p class="m">Then everyone wakes, the narrator announces who died, and the village debates and votes.</p>`);
    h += card(`<h2>Roles in play</h2>${refs(G.counts)}`) + card(`<button data-a="again">Play again with the same players</button>`);
  }
  return h;
}
function playerView() {
  if (G.status === "lobby") return G.joined ? card(`<h2>You’re in!</h2><p class="m">Waiting for the host to deal roles.</p>${plist()}`) : card(`<h2>Join game ${G.code}</h2><input id="nm" placeholder="Your name" maxlength="20" value="${esc(S.name)}"><button data-a="join">Join</button>`);
  const me = who(store("pid"));
  const h = (G.options ? thiefOptions() : "") + (G.myRole ? phone(G.myRole, me && me.cause) : card(`<p class="m">You weren’t dealt a role this game. Ask the host to play again.</p>`)) + (G.swapped ? card(`<p class="m">You started as the Thief and swapped cards.</p>`) : "");
  return h + card(`<h2>Players</h2>${plist()}`) + fallen() + card(`<h2>Roles in this game</h2>${refs(G.counts)}`);
}
function overlay() {
  if (!G || !G.winner || S.seen === `${G.code}:${G.round}:${G.winner}`) return "";
  const w = WINS[G.winner];
  return `<div class="ov"><div class="ovb"><img class="ovicon" src="${ROLES[w.role].icon}" alt=""><h2>${w.title}</h2><p>${w.text}</p>` + G.players.map(p => `<div class="row r2">${icon(p.role)}<span><b class="${p.dead ? "dead" : ""}">${esc(p.name)}</b><br><span class="m">${p.role ? ROLES[p.role].name : ""}</span></span></div>`).join("") + `<button data-a="close">Close</button>` + (G.host ? `<button class="g" data-a="again">Play again</button>` : "") + `</div></div>`;
}
const home = () => `<p class="lede">Deal secret roles to every phone and keep the night moving.</p>` +
  card(`<h2>Host a game</h2><p class="m">You narrate, friends play on their phones.</p><button data-a="create">New game</button>`) +
  card(`<h2>Join a game</h2><input id="cd" placeholder="Game code" maxlength="4" style="text-transform:uppercase" value="${esc(code)}"><button data-a="go">Continue</button>`);
function render() {
  const f = document.activeElement, id = f && f.id, pos = f && f.selectionStart;
  const dark = document.documentElement.dataset.theme !== "light";
  let h = `<div class="top"><img class="logo" src="${BACK}" alt=""><h1>Werewolf Night</h1><button class="theme" data-a="theme" aria-label="Switch light or dark theme">${dark ? "☀" : "☾"}</button></div>`;
  h += !code ? home() : !G ? card(`<p class="m">Loading…</p>`) : G.host ? hostView() : playerView();
  if (S.msg) h += `<div class="c err">${esc(S.msg)}</div>`;
  if (code) h += card(`<button class="g" data-a="leave">Leave game</button>`);
  app.innerHTML = h + overlay();
  if (id) { const e = document.getElementById(id); if (e) { e.focus(); try { e.setSelectionRange(pos, pos); } catch (_) {} } }
}
async function poll() {
  if (!code) return;
  try { const s = await api({ action: "state" }); const j = JSON.stringify(s); if (j !== S.last) { S.last = j; G = s; render(); } }
  catch (e) { if (/not found/i.test(e.message)) { S.msg = "That game no longer exists."; code = ""; G = null; history.replaceState(null, "", "/"); render(); } }
}
app.addEventListener("input", e => { if (e.target.id === "nm") S.name = e.target.value; });
app.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, k = b.dataset.k, id = b.dataset.id; S.msg = "";
  try {
    if (a === "create") { const r = await api({ action: "create" }); code = r.code; store("host", r.hostToken); history.replaceState(null, "", `/?code=${code}`); S.last = ""; await poll(); return; }
    if (a === "go") { code = document.getElementById("cd").value.trim().toUpperCase(); history.replaceState(null, "", `/?code=${code}`); S.last = ""; await poll(); return; }
    if (a === "leave") { code = ""; G = null; history.replaceState(null, "", "/"); render(); return; }
    if (a === "theme") { const t = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = t; localStorage.setItem("wn:theme", t); render(); return; }
    if (a === "flip") { S.show = !S.show; S.anim = true; render(); S.anim = false; return; }
    if (a === "hide") { S.show = false; render(); return; }
    if (a === "copy") { await navigator.clipboard.writeText(`${location.origin}/?code=${G.code}`); b.textContent = "Copied!"; return; }
    if (a === "prev") { S.prev = id; S.show = false; render(); return; }
    if (a === "unprev") { S.prev = null; S.show = false; render(); return; }
    if (a === "pick") { S.pick = S.pick === id ? null : id; render(); return; }
    if (a === "cancel") { S.pick = null; render(); return; }
    if (a === "close") { S.seen = `${G.code}:${G.round}:${G.winner}`; render(); return; }
    if (a === "join") { const r = await api({ action: "join", name: S.name }); store("pid", r.pid); }
    if (a === "inc" || a === "dec") await api({ action: "counts", counts: { ...G.counts, [k]: Math.max(0, (G.counts[k] || 0) + (a === "inc" ? 1 : -1)) } });
    if (a === "kill") { await api({ action: "kill", id, cause: k }); S.pick = null; }
    if (a === "revive") { await api({ action: "revive", id }); S.pick = null; }
    if (a === "thiefwake") await api({ action: "thiefwake" });
    if (a === "thiefpick") await api({ action: "thiefpick", choice: k });
    if (a === "kick") await api({ action: "kick", id });
    if (a === "bots") await api({ action: "bots" });
    if (a === "deal") await api({ action: "deal" });
    if (a === "again") { S.show = false; S.pick = null; await api({ action: "again" }); }
    await poll();
  } catch (err) { S.msg = err.message; render(); }
});
render(); poll(); setInterval(poll, 2000);
