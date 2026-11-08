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
  await t("host can mark players out, then play again with same players", async () => {
    await post({ action: "toggle", code, hostToken, id: pids[1] });
    assert.equal((await st({ hostToken })).players.find(p => p.id === pids[1]).dead, true);
    await post({ action: "again", code, hostToken });
    const s = await st({ hostToken }); assert.equal(s.status, "lobby"); assert.equal(s.players.length, 8);
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
