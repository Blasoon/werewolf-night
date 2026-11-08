// Zero-dependency server. Games live in memory and expire after 12 hours.
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const PUB = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
// Keep in sync with public/roles.js (villager is "everyone else", so it isn't listed)
const ROLE_KEYS = ["werewolf", "defender", "hunter", "seer", "witch"];
const games = new Map();
const rid = () => crypto.randomBytes(8).toString("hex");
const fail = (m, s = 400) => Object.assign(new Error(m), { status: s });
function newCode() {
  let c;
  do c = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[crypto.randomInt(24)]).join("");
  while (games.has(c));
  return c;
}
function view(g, b, host) {
  const out = {
    code: g.code, status: g.status, counts: g.counts, host,
    players: g.players.map(p => ({ id: p.id, name: p.name, dead: g.dead.includes(p.id), bot: !!p.bot })),
    joined: g.players.some(p => p.id === b.pid),
  };
  if (host) out.roles = g.roles;
  else if (out.joined) out.myRole = g.roles[b.pid] || null;
  return out;
}
function act(b) {
  if (b.action === "create") {
    const g = { code: newCode(), hostToken: rid(), status: "lobby", counts: { werewolf: 1, seer: 1 }, players: [], dead: [], roles: {}, made: Date.now() };
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
      for (const n of ["Claire", "Kaustubh", "Harks", "Ross", "Ellie", "Russel", "Miggie", "Molly", "Trey", "Lucy"]) {
        if (added >= 5 || g.players.length >= 20) break;
        if (g.players.some(p => p.name === `${n} (test)`)) continue;
        g.players.push({ id: rid(), name: `${n} (test)`, bot: true }); added++;
      }
      return {};
    }
    case "counts": {
      needHost();
      const c = {};
      for (const k of ROLE_KEYS) c[k] = Math.max(0, Math.min(20, parseInt(b.counts && b.counts[k]) || 0));
      g.counts = c;
      return {};
    }
    case "deal": {
      needHost();
      const list = [];
      for (const k of ROLE_KEYS) for (let i = 0; i < (g.counts[k] || 0); i++) list.push(k);
      if (g.players.length < 3) throw fail("Need at least 3 players");
      if (list.length > g.players.length) throw fail("More roles than players");
      while (list.length < g.players.length) list.push("villager");
      for (let i = list.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [list[i], list[j]] = [list[j], list[i]]; }
      g.roles = {}; g.players.forEach((p, i) => g.roles[p.id] = list[i]);
      g.counts = {}; list.forEach(r => g.counts[r] = (g.counts[r] || 0) + 1);
      g.dead = []; g.status = "playing";
      return {};
    }
    case "toggle": {
      needHost();
      const i = g.dead.indexOf(b.id);
      i < 0 ? g.dead.push(b.id) : g.dead.splice(i, 1);
      return {};
    }
    case "again": { // same players, fresh deal
      needHost();
      g.status = "lobby"; g.roles = {}; g.dead = [];
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
