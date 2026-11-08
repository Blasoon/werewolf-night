const app = document.getElementById("app");
const q = new URLSearchParams(location.search);
let code = (q.get("code") || "").toUpperCase();
let G = null, S = { name: "", show: false, msg: "", last: "" };
const store = (k, v) => v === undefined ? localStorage.getItem(`wn:${code}:${k}`) : localStorage.setItem(`wn:${code}:${k}`, v);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const card = h => `<div class="c">${h}</div>`;
async function api(body) {
  const r = await fetch("/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, hostToken: store("host"), pid: store("pid"), ...body }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
const plist = () => G.players.length ? G.players.map(p => `<span class="tag ${p.dead ? "dead" : ""}">${esc(p.name)}</span>`).join("") : `<p class="m">Nobody has joined yet.</p>`;
const detail = k => { const r = ROLES[k]; return `<p><span class="tag">${r.team}</span></p><p>${r.what}</p><p><b>Each night:</b> ${r.night}</p><p><b>Tip:</b> ${r.tip}</p>`; };
const refs = c => Object.keys(c).filter(k => c[k] > 0).map(k => `<details><summary><img class="mini" src="${ROLES[k].icon}" alt="">${ROLES[k].name} × ${c[k]}</summary>${detail(k)}</details>`).join("");

function roleCard(k) {
  const r = ROLES[k]; // colour only appears once the card is face up, so a hidden card gives nothing away
  return `<div class="c ${S.show ? "rc" : ""}" style="--rc:${r.color}"><img class="cardimg ${S.anim ? "fresh" : ""}" data-a="flip" src="${S.show ? r.img : BACK}" alt="">` + (S.show ? `<h2 style="text-align:center">${r.name}</h2>${detail(k)}<button class="g" data-a="hide">Hide my role</button>` : `<p class="m" style="text-align:center">Your role is hidden. Check nobody is peeking, then tap the card.</p>`) + `</div>`;
}
function hostView() {
  if (S.prev && G.roles[S.prev]) { // see exactly what that player's phone would show
    const pl = G.players.find(p => p.id === S.prev);
    return card(`<p class="m">Previewing ${esc(pl ? pl.name : "")}’s phone</p>`) + roleCard(G.roles[S.prev]) + `<button data-a="unprev">Exit preview</button>`;
  }
  const n = G.players.length, c = G.counts, keys = Object.keys(ROLES).filter(k => k !== "villager");
  const vill = n - keys.reduce((a, k) => a + (c[k] || 0), 0);
  const link = `${location.origin}/?code=${G.code}`;
  let h = card(`<p class="m" style="text-align:center">Game code</p><div class="code">${G.code}</div><p class="m" style="text-align:center">Friends visit <b>${esc(location.host)}</b> and enter it, or use the link.</p><button class="g" data-a="copy">Copy join link</button>`);
  if (G.status === "lobby") {
    h += card(`<h2>Lobby · ${n} joined</h2>` + G.players.map(p => `<div class="row"><span>${esc(p.name)}</span><button class="s g" data-a="kick" data-id="${p.id}">Remove</button></div>`).join("") + (n ? "" : `<p class="m">Waiting for players…</p>`) + `<button class="g" data-a="bots">Add 5 test players</button>`);
    h += card(`<h2>Roles</h2>` + keys.map(k => `<div class="row"><span><img class="mini" src="${ROLES[k].icon}" alt="">${ROLES[k].name}</span><span><button class="s" data-a="dec" data-k="${k}">−</button> <b>${c[k] || 0}</b> <button class="s" data-a="inc" data-k="${k}">+</button></span></div>`).join("") + `<div class="row"><span><img class="mini" src="${ROLES.villager.icon}" alt="">Villagers (the rest)</span><b>${Math.max(vill, 0)}</b></div><p class="m">Rule of thumb: about 1 wolf per 4 players.</p>${vill < 0 ? `<p class="err">More roles than players.</p>` : ""}<button data-a="deal" ${n < 3 || vill < 0 ? "disabled" : ""}>Deal roles</button>`);
  } else {
    h += card(`<h2>Narrator sheet</h2><p class="m">Tap a name to mark someone out or back in.</p>` + G.players.map(p => { const r = G.roles[p.id]; return `<div class="row" data-a="x" data-id="${p.id}" style="cursor:pointer"><span class="${p.dead ? "dead" : ""}">${esc(p.name)}</span><span>${r ? `<img class="mini" src="${ROLES[r].icon}" alt="">${ROLES[r].name}` : ""} <button class="s g" data-a="prev" data-id="${p.id}">Preview</button></span></div>`; }).join(""));
    h += card(`<h2>Night order</h2><p class="m">Everyone closes their eyes. Wake each role in turn:</p>` + NIGHT_ORDER.filter(k => G.counts[k] > 0).map(k => `<div class="row"><span><b>${ROLES[k].name}</b><br><span class="m">${ROLES[k].night}</span></span></div>`).join("") + `<p class="m">Then everyone wakes, the narrator announces who died, and the village debates and votes.</p>`);
    h += card(`<h2>Roles in play</h2>${refs(G.counts)}`);
    h += `<button data-a="again">Play again with the same players</button>`;
  }
  return h;
}
function playerView() {
  if (G.status === "lobby") return G.joined ? card(`<h2>You’re in!</h2><p class="m">Waiting for the host to deal roles.</p>${plist()}`) : card(`<h2>Join game ${G.code}</h2><input id="nm" placeholder="Your name" maxlength="20" value="${esc(S.name)}"><button data-a="join">Join</button>`);
  let h = "";
  if (G.myRole) h += roleCard(G.myRole);
  else h += card(`<p class="m">You weren’t dealt a role this game. Ask the host to play again.</p>`);
  return h + card(`<h2>Players</h2>${plist()}`) + card(`<h2>Roles in this game</h2>${refs(G.counts)}`);
}
function home() {
  return `<p class="lede">Deal secret roles to every phone and keep the night moving.</p>` + card(`<h2>Host a game</h2><p class="m">You narrate, friends play on their phones.</p><button data-a="create">New game</button>`) +
    card(`<h2>Join a game</h2><input id="cd" placeholder="Game code" maxlength="4" style="text-transform:uppercase" value="${esc(code)}"><button data-a="go">Continue</button>`);
}
function render() {
  const f = document.activeElement, id = f && f.id, pos = f && f.selectionStart;
  const dark = document.documentElement.dataset.theme !== "light";
  let h = `<div class="top"><img class="logo" src="${BACK}" alt=""><h1>Werewolf Night</h1><button class="theme" data-a="theme" aria-label="Switch light or dark theme">${dark ? "☀" : "☾"}</button></div>`;
  h += !code ? home() : !G ? card(`<p class="m">Loading…</p>`) : G.host ? hostView() : playerView();
  if (S.msg) h += `<p class="err">${esc(S.msg)}</p>`;
  if (code) h += `<button class="g" data-a="leave">Leave game</button>`;
  app.innerHTML = h;
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
  const a = b.dataset.a, k = b.dataset.k; S.msg = "";
  try {
    if (a === "create") { const r = await api({ action: "create" }); code = r.code; store("host", r.hostToken); history.replaceState(null, "", `/?code=${code}`); S.last = ""; await poll(); return; }
    if (a === "go") { code = document.getElementById("cd").value.trim().toUpperCase(); history.replaceState(null, "", `/?code=${code}`); S.last = ""; await poll(); return; }
    if (a === "leave") { code = ""; G = null; history.replaceState(null, "", "/"); render(); return; }
    if (a === "theme") { const t = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = t; localStorage.setItem("wn:theme", t); render(); return; }
    if (a === "flip") { S.show = !S.show; S.anim = true; render(); S.anim = false; return; }
    if (a === "hide") { S.show = false; render(); return; }
    if (a === "copy") { await navigator.clipboard.writeText(`${location.origin}/?code=${G.code}`); S.msg = ""; b.textContent = "Copied!"; return; }
    if (a === "join") { const r = await api({ action: "join", name: S.name }); store("pid", r.pid); }
    if (a === "inc" || a === "dec") await api({ action: "counts", counts: { ...G.counts, [k]: Math.max(0, (G.counts[k] || 0) + (a === "inc" ? 1 : -1)) } });
    if (a === "prev") { S.prev = b.dataset.id; S.show = false; render(); return; }
    if (a === "unprev") { S.prev = null; S.show = false; render(); return; }
    if (a === "bots") await api({ action: "bots" });
    if (a === "x") await api({ action: "toggle", id: b.dataset.id });
    if (a === "kick") await api({ action: "kick", id: b.dataset.id });
    if (a === "deal") await api({ action: "deal" });
    if (a === "again") { S.show = false; await api({ action: "again" }); }
    await poll();
  } catch (err) { S.msg = err.message; render(); }
});
render(); poll(); setInterval(poll, 2000);
