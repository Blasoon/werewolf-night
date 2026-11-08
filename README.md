# Werewolf Night

A small web app for running Werewolf with friends. The host narrates and deals; each player opens the site on their phone, joins with a game code, and gets a secret card that explains their role and what to do each night.

No dependencies and no build step. Needs Node 18 or newer.

```
npm start          # or: node server.js
```

Then open http://localhost:3000. Set `PORT` to change the port.

## How a game goes
1. Host taps **New game** and shares the 4-letter code or join link.
2. Players enter their name. The host sets role counts (Villagers fill the rest) and taps **Deal roles**.
3. Players tap their card to reveal it. The host gets a narrator sheet with every role, the night order, and tap-to-mark-dead.
4. **Play again** keeps the same players and goes back to the role screen.

## Testing without players
- **In the app:** in the lobby tap **Add 5 test players**, deal, then use **Preview** next to any name on the narrator sheet to see exactly what that player's phone shows (the flip card included).
- **Real devices:** open the join link in a private window or a second phone to go through the real join flow.
- **Automated:** `npm test` starts a temporary server and plays through a game, checking dealing, secrecy of roles, host-only actions and play-again.

## Deaths and victory
In the narrator sheet, tap a player to record how they died (werewolves, voted out, the witch, the hunter). They get a death screen on their phone and their role is revealed to everyone. Victory is checked automatically after every change: the village wins when no werewolves are left, the werewolves win when they equal everyone else, and a Dunce who is voted out wins alone. A mistaken death can be undone with Revive, which also undoes a victory.

## The Thief
Add a Thief in the lobby (the limit is one). Two extra villager cards join the deck; after dealing, the two cards left over sit in the middle. The Thief is always dealt to a player, and at least one werewolf always goes to a player. On the narrator sheet, tap **Wake the Thief** to show them the two middle cards on their phone. They can swap for one (and become that role for the rest of the game) or keep the Thief card and decide on a later night. If both middle cards are werewolves, they must swap. With test players, you can act for a fake Thief from the narrator sheet.

## Customising
- `public/roles.js`: role text, teams, night order.
- `public/cards/`: full card art (`back.png`, plus one `<role>.png` each). `public/icons/`: small round icons, one per role, used in lists.
- Role accent colours are set per role in `roles.js`. The app is dark by default, with a light theme behind the toggle in the header.
- `public/style.css`: look and feel.
- The Dunce card and icon (`cards/dunce.png`, `icons/dunce.png`) are placeholders. Replace them with your own art.
- Death causes and victory messages are in `roles.js` (`CAUSES`, `WINS`); the matching win rules are in `winner()` in `server.js`.
- Adding a role: add it to `roles.js`, drop in `cards/<key>.png`, and add the key to `ROLE_KEYS` in `server.js`.

## Deploying as a website
This is a Node server with live game state, so it needs a host that runs Node (static hosts like GitHub Pages won't work). Push the repo to GitHub, then connect it to a platform such as Render, Railway or Fly.io (the `Dockerfile` works for Fly):
- Start command: `npm start` (no build step). The app reads the `PORT` the platform provides.
- Run a single instance only. Games live in memory, so scaling out or restarting ends games in progress.
- Platforms give you HTTPS and a free subdomain; add a custom domain if you want one.
- Free tiers change and some put idle apps to sleep. Players polling during a game keeps it awake, but the first load after a quiet spell can be slow, so open it a few minutes before guests arrive.

## Hosting
Games are kept in memory, so a server restart ends them. That is fine for game nights. Run it anywhere Node runs (a small VPS, Fly, Railway, Render, a Raspberry Pi), or use the included `Dockerfile`. Put it behind HTTPS if you host it publicly. On the same Wi‑Fi you can also just share your computer's local IP and port.
