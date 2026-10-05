# 🧋 Boba Rush

A Papa's-style bubble tea shop game you can play solo, in **co-op with up to 6 friends**, or in a
head-to-head **Showdown**. Take orders, brew the tea, pump the syrup, drizzle, add toppings, nail
the shake, and serve before your customers run out of patience.

## Play

```bash
npm start
```

Then open <http://localhost:3000>. There are no dependencies to install; you only need Node 18+.

- **Play Solo** runs entirely in your browser.
- **Create Room** gives you a 4-letter code and an invite link. Friends join with the code,
  the host picks **Co-op** or **Showdown**, then opens the shop.

To play with friends outside your Wi-Fi, deploy the folder to any Node host
(Render, Railway, Fly.io, a VPS…) with `npm start` as the start command. The server
reads the `PORT` environment variable. `DAY_LENGTH_MS` shortens the day for testing.

The whole game fits the screen on phones, tablets and desktops (portrait or landscape) with no
page scrolling. The ⛶ button (or `F`) toggles fullscreen, and the page can be added to a
phone's home screen to launch fullscreen.

## How a shift works

| Station | What you do |
| --- | --- |
| 🧾 Counter | Take a customer's order. It becomes a ticket on the rail. |
| 🫖 Brew | Pick the tea, **hold** Pour, and release at the red fill line. |
| 🍯 Mix | Pump sweetness (25% per pump), scoop the ice and pick a drizzle. |
| 🍡 Toppings | Scoop exactly what the ticket asks for (up to 3). |
| 🥤 Shake & Serve | Stop the needle in the green zone, then serve the drink. |

Each drink is scored out of 100 (tea, fill, sweetness, ice, toppings and drizzle, shake). Better
drinks served faster earn bigger tips. A day lasts 2½ minutes, and each new day brings more
customers, less patience and new ingredients:

| Day | New on the menu |
| --- | --- |
| 1 | Classic, Matcha, Taro, Thai, Strawberry, Mango · Pearls, Popping Boba, Lychee Jelly |
| 2 | Brown Sugar Milk, Honeydew · Egg Pudding, Red Bean · Brown Sugar and Caramel drizzles |
| 3 | Coconut Milk, Butterfly Pea · Cheese Foam, Crystal Boba, Aloe Vera · Chocolate and Honey drizzles |
| 4 | Grass Jelly, Cookie Crumble · orders with up to 3 toppings |

## Shop

At the end of each day the report screen has a **Shop** button with two tabs.

**Upgrades** last for the rest of the run:

| Upgrade | Effect |
| --- | --- |
| ⚡ Turbo Taps (3 levels) | Tea pours 30% faster per level. |
| 🎯 Smart Spout | Taps shut off by themselves right at the fill line. |
| 🤖 Mix-O-Matic | One tap sets sweetness, ice and drizzle to match your ticket. |
| 🦾 Topping Bot | One tap scoops every topping on your ticket. |
| 🌀 Pro Shaker (3 levels) | Bigger green zone and a calmer needle. |
| 💎 Premium Ingredients (3 levels) | Every drink sells for $1 more per level. |
| 🫙 Tip Jar (3 levels) | Tips are 25% bigger per level. |
| ✨ Golden Straws (2 levels) | Perfect 3-star drinks earn $1.50 extra per level. |
| 🛋️ Comfy Lounge (2 levels) | Customers wait 15% longer per level. |

**Secret recipes** put a special on your menu. Customers start ordering it by name and pay extra:

| Recipe | What's in it | Extra per cup |
| --- | --- | --- |
| 🐯 Tiger Sugar | Classic, 75% sweet, less ice, pearls, brown sugar drizzle | $2.50 |
| ☁️ Taro Cloud | Taro, 50%, less ice, egg pudding, cheese foam | $3.00 |
| 🍵 Matcha Zen | Matcha, 25%, no ice, red bean, cheese foam, honey | $3.00 |
| 🌅 Mango Sunrise | Mango, 75%, regular ice, lychee, popping boba, aloe | $3.50 |
| 🌌 Galaxy Fizz | Butterfly pea, 50%, regular ice, popping and crystal boba, honey | $4.00 |
| 🍪 Cookies & Cream | Coconut, 75%, less ice, cookie crumble, pearls, chocolate | $4.50 |

## Co-op

One shop, one bank. Tickets hang on a shared rail. Tap one to pick it up. Once a teammate is
holding a ticket it never switches on its own: tapping it sends them a **"Pass it over?"** prompt,
and they decide. Unanswered requests expire after 15 seconds, and if the holder leaves, the ticket
goes to whoever asked for it. Anyone can spend the team bank between days, and the host opens the
next day.

## Showdown

Everyone serves the **same line of customers**, but each player runs their own shop with their own
wallet, upgrades and recipes. Most money by the end of the day wins.

- **One customer at a time.** You can't take a new order until you've served the one you have,
  so nobody can hoard tickets. Your customers are yours: no handoffs, no stealing.
- **Race bar.** A live leaderboard under the clock shows everyone's takings, their station, their
  hot streak and how far ahead or behind you are. Lead changes get a big banner.
- **Hot streaks.** Three 2-star-or-better drinks in a row pay a $1 bonus per drink, five or more
  pay $2. A walk-out or a bad drink resets it.
- **Final Rush.** The last 30 seconds pay ×1.25 on every drink.
- **Podium bonus.** The day's top three get bonus cash (1st: $10 + $2 × day, 2nd: $5 + day,
  3rd: $2 + day) to spend on upgrades sooner.
- **Ready up.** Between days everyone shops on their own, and the next day opens only when every
  player has hit Ready.
- Secret recipes: customers order a special if any player owns it, but only shops that know the
  recipe get the extra money for it.

The dock shows which station each player is at, and the 💬 button sends emotes. 🔥

**Keys:** `1`-`5` switch stations, `Space` pours (hold) and stops the shaker, `F` toggles fullscreen.

## Project layout

```
shared/game.js     Game rules (orders, scoring, rooms, both modes). Runs on both server and browser.
server/server.js   Zero-dependency HTTP server: static files + rooms over Server-Sent Events.
public/            The game client (HTML, CSS, SVG art, UI).
test/              node:test suites for the rules and the multiplayer API.
```

Run the tests with `npm test`.
