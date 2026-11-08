// Automated check: starts the server on port 3999 and plays through a game. Run with: npm test
const { spawn } = require("child_process"), assert = require("assert");
const PORT = 3999, URL = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["server.js"], { env: { ...process.env, PORT }, stdio: "ignore" });
const post = async b => { const r = await fetch(`${URL}/api`, { method: "POST", body: JSON.stringify(b) }); return { status: r.status, ...(await r.json()) }; };
let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log("ok   " + name); } catch (e) { failed++; console.log("FAIL " + name + " - " + e.message); } };
(async () => {
  await new Promise(r => setTimeout(r, 700));
  let code, hostToken; const pids = [];
  const st = (extra = {}) => post({ action: "state", code, ...extra });
  await t("serves page, card art, blocks path traversal", async () => {
    assert.equal((await fetch(URL)).status, 200);
    assert.equal((await fetch(`${URL}/cards/seer.png`)).status, 200);
    assert.equal((await fetch(`${URL}/icons/seer.png`)).status, 200);
    assert((await fetch(`${URL}/..%2fserver.js`)).status >= 400);
  });
  await t("creates a game with a 4-letter code", async () => { const r = await post({ action: "create" }); ({ code, hostToken } = r); assert.equal(code.length, 4); });
  await t("players join; blank name is rejected", async () => {
    for (const name of ["Mo", "Sam", "Kit"]) pids.push((await post({ action: "join", code, name })).pid);
    assert.equal((await post({ action: "join", code, name: "  " })).status, 400);
  });
  await t("host can add test players", async () => { await post({ action: "bots", code, hostToken }); assert.equal((await st({ hostToken })).players.length, 8); });
  await t("non-host cannot change counts or deal", async () => {
    assert.equal((await post({ action: "deal", code, pid: pids[0] })).status, 403);
    assert.equal((await post({ action: "counts", code, counts: { werewolf: 5 } })).status, 403);
  });
  await t("deals the requested roles, villagers fill the rest", async () => {
    const counts = { werewolf: 2, seer: 1, witch: 1, defender: 1, hunter: 1 };
    await post({ action: "counts", code, hostToken, counts });
    assert.equal((await post({ action: "deal", code, hostToken })).status, 200);
    const roles = Object.values((await st({ hostToken })).roles).sort();
    assert.deepEqual(roles, ["defender", "hunter", "seer", "villager", "villager", "werewolf", "werewolf", "witch"]);
  });
  await t("a player sees only their own role", async () => {
    const s = await st({ pid: pids[0] });
    assert.equal(typeof s.myRole, "string"); assert.equal(s.roles, undefined);
  });
  const mk = async (n, counts) => {
    const g = await post({ action: "create" }); g.ids = [];
    for (let i = 0; i < n; i++) g.ids.push((await post({ action: "join", code: g.code, name: "p" + i })).pid);
    await post({ action: "counts", code: g.code, hostToken: g.hostToken, counts });
    await post({ action: "deal", code: g.code, hostToken: g.hostToken });
    g.roles = (await post({ action: "state", code: g.code, hostToken: g.hostToken })).roles; return g;
  };
  const host = g => post({ action: "state", code: g.code, hostToken: g.hostToken });
  const kill = (g, id, cause) => post({ action: "kill", code: g.code, hostToken: g.hostToken, id, cause });
  const of = (g, r) => g.ids.filter(id => g.roles[id] === r);
  await t("a death records its cause and reveals only that role", async () => {
    const g = await mk(5, { werewolf: 1, seer: 1 }); const [v, ...others] = of(g, "villager");
    assert.equal((await kill(g, v, "bogus")).status, 400);
    await kill(g, v, "werewolves");
    const s = await post({ action: "state", code: g.code, pid: others[0] });
    const dead = s.players.find(p => p.id === v), alive = s.players.find(p => p.id === others[0]);
    assert.equal(dead.cause, "werewolves"); assert.equal(dead.role, "villager"); assert.equal(alive.role, undefined);
  });
  await t("village wins when the last werewolf dies; reviving undoes it", async () => {
    const g = await mk(4, { werewolf: 1 }); const w = of(g, "werewolf")[0];
    assert.equal((await host(g)).winner, null);
    await kill(g, w, "vote");
    const s = await post({ action: "state", code: g.code, pid: g.ids.find(i => i !== w) });
    assert.equal(s.winner, "village"); assert(s.players.every(p => p.role));
    await post({ action: "revive", code: g.code, hostToken: g.hostToken, id: w });
    assert.equal((await host(g)).winner, null);
  });
  await t("werewolves win when they equal the villagers", async () => {
    const g = await mk(4, { werewolf: 1 }); const [a, b] = of(g, "villager");
    await kill(g, a, "werewolves"); assert.equal((await host(g)).winner, null);
    await kill(g, b, "vote"); assert.equal((await host(g)).winner, "wolves");
  });
  await t("a Dunce voted out wins alone; being eaten does not", async () => {
    const g = await mk(5, { werewolf: 1, dunce: 1 }); const d = of(g, "dunce")[0];
    await kill(g, d, "werewolves"); assert.equal((await host(g)).winner, null);
    await post({ action: "revive", code: g.code, hostToken: g.hostToken, id: d });
    await kill(g, d, "vote"); assert.equal((await host(g)).winner, "dunce");
    await post({ action: "again", code: g.code, hostToken: g.hostToken });
    const s = await host(g); assert.equal(s.status, "lobby"); assert.equal(s.winner, null); assert.equal(s.players.length, 5);
  });
  await t("with a Thief, the Thief and a werewolf always go to players", async () => {
    for (let i = 0; i < 25; i++) { const g = await mk(4, { werewolf: 1, thief: 1 }); const r = Object.values(g.roles); assert.equal(r.length, 4); assert(r.includes("werewolf") && r.includes("thief")); assert.equal((await host(g)).thief.center.length, 2); }
    const g = await post({ action: "create" });
    for (const x of ["a", "b", "c"]) await post({ action: "join", code: g.code, name: x });
    await post({ action: "counts", code: g.code, hostToken: g.hostToken, counts: { thief: 1 } });
    assert.equal((await post({ action: "deal", code: g.code, hostToken: g.hostToken })).status, 400);
  });
  await t("the Thief sees the middle cards only once woken, and can swap", async () => {
    const g = await mk(6, { werewolf: 1, seer: 1, thief: 1 }); const th = of(g, "thief")[0], other = g.ids.find(i => i !== th);
    const peek = () => post({ action: "state", code: g.code, pid: th });
    assert.equal((await peek()).options, undefined);
    assert.equal((await post({ action: "thiefpick", code: g.code, pid: th, choice: "0" })).status, 400);
    await post({ action: "thiefwake", code: g.code, hostToken: g.hostToken });
    const o = (await peek()).options; assert.equal(o.length, 2);
    assert.equal((await post({ action: "state", code: g.code, pid: other })).options, undefined);
    assert.equal((await post({ action: "thiefpick", code: g.code, pid: other, choice: "0" })).status, 403);
    assert.equal((await post({ action: "thiefpick", code: g.code, pid: th, choice: "1" })).status, 200);
    const after = await host(g); assert.equal(after.roles[th], o[1]); assert.equal(after.thief.done, true);
    assert.equal((await post({ action: "state", code: g.code, pid: th })).myRole, o[1]);
  });
  await t("the Thief must swap when both middle cards are werewolves", async () => {
    let g, found = false;
    for (let i = 0; i < 150 && !found; i++) { g = await mk(5, { werewolf: 3, thief: 1 }); found = (await host(g)).thief.center.every(r => r === "werewolf"); }
    assert(found, "never dealt two werewolves to the middle");
    const th = of(g, "thief")[0];
    await post({ action: "thiefwake", code: g.code, hostToken: g.hostToken });
    assert.equal((await post({ action: "thiefpick", code: g.code, pid: th, choice: "keep" })).status, 400);
    assert.equal((await post({ action: "thiefpick", code: g.code, pid: th, choice: "0" })).status, 200);
  });
  await t("rejects more roles than players and tiny games", async () => {
    const g = await post({ action: "create" });
    for (const n of ["a", "b"]) await post({ action: "join", code: g.code, name: n });
    assert.equal((await post({ action: "deal", code: g.code, hostToken: g.hostToken })).status, 400);
    await post({ action: "join", code: g.code, name: "c" });
    await post({ action: "counts", code: g.code, hostToken: g.hostToken, counts: { werewolf: 5 } });
    assert.equal((await post({ action: "deal", code: g.code, hostToken: g.hostToken })).status, 400);
  });
  await t("unknown game code gives 404", async () => assert.equal((await post({ action: "state", code: "ZZZZ" })).status, 404));
  srv.kill(); console.log(failed ? `\n${failed} failed` : "\nAll checks passed"); process.exit(failed ? 1 : 0);
})();
