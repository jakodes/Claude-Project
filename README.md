# 🧋 Boba Rush

A Papa's-style bubble tea shop game you can play solo or in **co-op with up to 6 friends**.
Take orders, brew the tea, pump the syrup, add toppings, nail the shake, and serve
before your customers run out of patience.

## Play

```bash
npm start
```

Then open <http://localhost:3000>. There are no dependencies to install; you only need Node 18+.

- **Play Solo** runs entirely in your browser.
- **Create Room** gives you a 4-letter code and an invite link. Friends join with the code,
  the host opens the shop, and everyone works the same counter together.

To play with friends outside your Wi-Fi, deploy the folder to any Node host
(Render, Railway, Fly.io, a VPS…) with `npm start` as the start command. The server
reads the `PORT` environment variable.

## How a shift works

| Station | What you do |
| --- | --- |
| 🧾 Counter | Take a customer's order. It becomes a ticket the whole team can see. |
| 🫖 Brew | Pick the tea, **hold** Pour, and release at the red fill line. |
| 🍯 Mix | Pump sweetness (25% per pump) and choose the ice level. |
| 🍡 Toppings | Add exactly what the ticket asks for. |
| 🥤 Shake & Serve | Stop the needle in the green zone, then serve the drink. |

Each drink is scored out of 100 (tea, fill, sweetness, ice, toppings, shake). Better drinks
served faster earn bigger tips. A day lasts 2½ minutes, and each new day brings more
customers, less patience, and new toppings (pudding and red bean on Day 2, cheese foam on Day 3).

## Upgrade Shop

At the end of each day the report screen has an **Upgrade Shop** button. Anyone on the team
can spend the shared bank between days, and upgrades last for the rest of the run:

| Upgrade | Effect |
| --- | --- |
| ⚡ Turbo Taps (3 levels) | Tea pours 30% faster per level. |
| 🎯 Smart Spout | Taps shut off by themselves right at the fill line. |
| 🤖 Mix-O-Matic | One button sets sweetness and ice to match your ticket. |
| 🌀 Pro Shaker (3 levels) | Bigger green zone and a calmer needle. |
| 💎 Premium Ingredients (3 levels) | Every drink sells for $1 more per level. |
| 🛋️ Comfy Lounge (2 levels) | Customers wait 15% longer per level. |

## Co-op

Tickets hang on a shared rail. Tap one to pick it up. Once a teammate is holding a ticket it
never switches on its own: tapping it sends them a **"Pass it over?"** prompt, and they decide.
Unanswered requests expire after 15 seconds, and if the holder leaves, the ticket goes to
whoever asked for it. You can only serve tickets that are yours or still open.

The dock shows which station each teammate is at, and the 💬 button sends emotes. 🔥

**Keys:** `1`-`5` switch stations, `Space` pours (hold) and stops the shaker.

## Project layout

```
shared/game.js     Game rules (orders, scoring, rooms). Runs on both server and browser.
server/server.js   Zero-dependency HTTP server: static files + rooms over Server-Sent Events.
public/            The game client (HTML, CSS, SVG art, UI).
test/              node:test suites for the rules and the multiplayer API.
```

Run the tests with `npm test`.
