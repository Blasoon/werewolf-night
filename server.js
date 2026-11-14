// Zero-dependency server. Games live in memory and expire after 12 hours.
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
// Keep in sync with public/roles.js (villager is "everyone else", so it isn't listed)
const ROLE_KEYS = ["werewolf", "defender", "hunter", "seer", "witch", "dunce", "thief"];
const NIGHT = ["werewolves", "witch"]; // deaths that happen at night; vote and hunter count as daytime
const CAUSES = ["werewolves", "vote", "witch", "hunter"]; // keep in sync with CAUSES in public/roles.js
const games = new Map();
const rid = () => crypto.randomBytes(8).toString("hex");
const fail = (m, s = 400) => Object.assign(new Error(m), { status: s });
function newCode() {
  let c;
  do c = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[crypto.randomInt(24)]).join("");
  while (games.has(c));
  return c;
}
// Victory is derived from the current deaths, so reviving someone (to fix a mistake) undoes a win.
function winner(g) {
  if (g.status !== "playing") return null;
  const ids = g.players.map(p => p.id).filter(id => g.roles[id]);
  if (ids.some(id => g.roles[id] === "dunce" && g.deaths[id] === "vote")) return "dunce";
  if (!ids.some(id => g.roles[id] === "werewolf")) return null;
  const alive = ids.filter(id => !g.deaths[id]);
  const wolves = alive.filter(id => g.roles[id] === "werewolf").length;
  if (wolves === 0) return "village";
  if (wolves >= alive.length - wolves) return "wolves";
  return null;
}
function view(g, b, host) {
  const win = winner(g);
  const out = {
    code: g.code, status: g.status, counts: g.counts, host, winner: win, round: g.round, reveal: g.reveal,
    // a dead player's role is public only if the host's reveal setting covers how they died; everyone's once the game is won
    players: g.players.map(p => { const c = g.deaths[p.id]; return { id: p.id, name: p.name, bot: !!p.bot, dead: !!c, cause: c || null, role: win || (c && g.reveal[NIGHT.includes(c) ? "night" : "day"]) ? g.roles[p.id] : undefined }; }),
    joined: g.players.some(p => p.id === b.pid),
  };
  if (host) { out.roles = g.roles; out.thief = g.thief && { ...g.thief, center: g.center }; }
  else if (out.joined) {
    out.myRole = g.roles[b.pid] || null;
    const t = g.thief; // the middle cards are only ever sent to the Thief, and only while the host has woken them
    if (t && b.pid === t.id) {
      out.swapped = t.done;
      if (t.open && !t.done && !g.deaths[b.pid]) { out.options = g.center; out.must = g.center.every(r => r === "werewolf"); }
    }
  }
  return out;
}
function act(b) {
  if (b.action === "create") {
    const g = { code: newCode(), hostToken: rid(), status: "lobby", counts: { werewolf: 1, seer: 1 }, players: [], deaths: {}, round: 0, roles: {}, center: [], thief: null, reveal: { night: true, day: true }, made: Date.now() };
    games.set(g.code, g);
    return { code: g.code, hostToken: g.hostToken };
  }
  const g = games.get(String(b.code || "").toUpperCase());
  if (!g) throw fail("Game not found", 404);
  const host = !!b.hostToken && b.hostToken === g.hostToken;
  const needHost = () => { if (!host) throw fail("Host only", 403); };
  switch (b.action) {
    case "state": return view(g, b, host);
    case "join": {
      const name = String(b.name || "").trim().slice(0, 20);
      if (!name) throw fail("Enter a name");
      if (g.status !== "lobby") throw fail("This game has already started");
      const p = { id: rid(), name };
      g.players.push(p);
      return { pid: p.id };
    }
    case "bots": { // test helper: adds fake players so you can try a game solo
      needHost();
      if (g.status !== "lobby") throw fail("Only in the lobby");
      let added = 0;
      for (const n of ["Claire", "Kaustubh", "Harks", "Ross", "Ellie", "Russel", "Miguel", "Molly", "Trey", "Lucy", "Sonny", "Dixie", "Ollie", "Lewis", "Nina", "Beau", "Ben", "Alice", "Michael", "Sam" ]) {
        if (added >= 5 || g.players.length >= 20) break;
        if (g.players.some(p => p.name === `${n} (test)`)) continue;
        g.players.push({ id: rid(), name: `${n} (test)`, bot: true }); added++;
      }
      return {};
    }
    case "counts": {
      needHost();
      const c = {};
      for (const k of ROLE_KEYS) c[k] = Math.max(0, Math.min(k === "thief" ? 1 : 20, parseInt(b.counts && b.counts[k]) || 0));
      g.counts = c;
      return {};
    }
    case "deal": {
      needHost();
      const n = g.players.length, nominal = [];
      for (const k of ROLE_KEYS) for (let i = 0; i < (g.counts[k] || 0); i++) nominal.push(k);
      if (n < 3) throw fail("Need at least 3 players");
      if (nominal.length > n) throw fail("More roles than players");
      const thief = (g.counts.thief || 0) > 0;
      if (thief && !g.counts.werewolf) throw fail("The Thief needs at least one werewolf in the game");
      while (nominal.length < n) nominal.push("villager");
      // With a Thief, two extra villagers join the deck. After dealing, the two left over sit in the middle.
      const deck = thief ? [...nominal, "villager", "villager"] : nominal.slice();
      for (let tries = 0; ; tries++) {
        for (let i = deck.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        const hands = deck.slice(0, n);
        // fairness: the Thief must be a player, and at least one werewolf must go to a player
        if (!thief || (hands.includes("thief") && hands.includes("werewolf"))) break;
        if (tries > 500) throw fail("Could not deal a fair game. Add more werewolves.");
      }
      g.roles = {}; g.players.forEach((pl, i) => g.roles[pl.id] = deck[i]);
      g.center = thief ? deck.slice(n) : [];
      g.thief = thief ? { id: g.players[deck.indexOf("thief")].id, open: false, done: false } : null;
      g.counts = {}; nominal.forEach(r => g.counts[r] = (g.counts[r] || 0) + 1);
      g.deaths = {}; g.round++; g.status = "playing";
      return {};
    }
    case "thiefwake": {
      needHost();
      if (!g.thief || g.thief.done) throw fail("There is no Thief to wake");
      g.thief.open = !g.thief.open;
      return {};
    }
    case "thiefpick": {
      const t = g.thief;
      const bot = host && t && g.players.some(pl => pl.id === t.id && pl.bot); // lets the host test with a fake Thief
      if (!t || (!bot && b.pid !== t.id)) throw fail("Only the Thief can do that", 403);
      if (!t.open || t.done || g.deaths[t.id]) throw fail("It isn’t the Thief’s turn");
      const must = g.center.every(r => r === "werewolf");
      if (b.choice === "keep") { if (must) throw fail("Both cards are werewolves, so the Thief must swap"); t.open = false; return {}; }
      const i = parseInt(b.choice);
      if (i !== 0 && i !== 1) throw fail("Pick a card");
      g.roles[t.id] = g.center[i]; g.center[i] = "thief"; t.done = true; t.open = false;
      return {};
    }
    case "reveal": {
      needHost();
      if (g.status !== "lobby") throw fail("Change this in the lobby");
      g.reveal = { night: !!b.night, day: !!b.day };
      return {};
    }
    case "kill": {
      needHost();
      if (!CAUSES.includes(b.cause) || !g.roles[b.id]) throw fail("Bad request");
      g.deaths[b.id] = b.cause;
      return {};
    }
    case "revive": { needHost(); delete g.deaths[b.id]; return {}; }
    case "again": { // same players, fresh deal
      needHost();
      g.status = "lobby"; g.roles = {}; g.deaths = {}; g.center = []; g.thief = null;
      g.counts = Object.fromEntries(Object.entries(g.counts).filter(([k]) => k !== "villager"));
      return {};
    }
    case "kick": { needHost(); g.players = g.players.filter(p => p.id !== b.id); return {}; }
  }
  throw fail("Unknown action");
}
http.createServer((req, res) => {
  const send = (s, body, type = "application/json") => { res.writeHead(s, { "Content-Type": type, "Cache-Control": "no-store" }); res.end(body); };
  if (req.method === "POST" && req.url === "/api") {
    let data = "";
    req.on("data", d => { data += d; if (data.length > 10000) req.destroy(); });
    req.on("end", () => {
      try { send(200, JSON.stringify(act(JSON.parse(data || "{}")))); }
      catch (e) { send(e.status || 400, JSON.stringify({ error: e.message })); }
    });
    return;
  }
  const url = new URL(req.url, "http://x").pathname;
  const file = path.normalize(path.join(PUB, url === "/" ? "index.html" : url));
  if (!file.startsWith(PUB)) return send(403, "Forbidden", "text/plain");
  fs.readFile(file, (err, buf) => err ? send(404, "Not found", "text/plain") : send(200, buf, MIME[path.extname(file)] || "application/octet-stream"));
}).listen(PORT, () => console.log(`Werewolf Night running on http://localhost:${PORT}`));
setInterval(() => { for (const [c, g] of games) if (Date.now() - g.made > 12 * 3600e3) games.delete(c); }, 600e3);
