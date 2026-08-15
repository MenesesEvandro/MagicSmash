# Magic Smash

**[🕹️ Play Magic Smash online](https://menesesevandro.github.io/MagicSmash/)**

Press any key. Something delightful happens. That's the whole game.

Magic Smash is a keyboard playground for toddlers: no rules, no losing, no reading required. Every keypress (or tap, or click) triggers a big animated letter, a friendly sound, and a burst of themed characters flying across the screen.

## Why this exists

I work from home, and my son, almost 2 years old, always wants to "work" with me. He'd climb onto my lap and start smashing the keyboard, which is exactly what a toddler should do, just not always great for whatever I was typing.

I went looking for one of those keyboard-mashing toy websites to point him at instead, but the VPN I connect to for work blocks pretty much everything. So I built my own... Something that needed zero internet connection, would hold his attention.

## Features

- **Press anything** — letters, numbers, spacebar, arrow keys, all of it. There's no wrong key.
- **Moving the mouse, or dragging a finger, paints a trail of sparkles that feels the drag's speed** — a slow, lazy drag leaves big, lingering sparks, a fast one leaves small, quick ones — no aiming or precise taps required, a gentler kind of play for a toddler who hasn't got aimed taps down yet.
- **21 themes** — Vehicles, Bubbles, Music, Colors, Weather, Dinosaurs, Farm, Party, Space, Beach, Ocean, Lights, Toys, Bedtime, Safari, Robots, Garden, Seasons, Construction, Fantasy, and Polar. Each one has its own icon set, color palette, sound, and animation.
- **Sound and animation for every key** — a gentle themed tone (synthesized in the browser, no audio files), a floating letter, sparkles, and a themed character animation. A tap's tone also pans left or right to match where it landed on the screen — a touch in the corner sounds like it's coming from that corner; keyboard presses, with no on-screen position of their own, always play centred.
- **A living background** — icons drift lazily across the screen and pop when a key is pressed.
- **Optional kaleidoscope mode** — mirrors every effect around the centre of the screen for a radial, symmetric pattern, easing off automatically during a fast smash so it never overwhelms.
- **Optional colour-by-note mode** — every theme's tone is already snapped to a shared 5-note scale, and this ties each of those notes to one fixed colour on the key orb, always, no matter which theme is playing. Repeated across a session, that steady pairing gives a passive, wordless way to start noticing that a sound and a colour go together.
- **Leaning on a key does something, not everything at once.** A key held down (the keyboard's own repeat) grows a glowing ring out from the orb toward the edge of the screen instead of spamming a new burst dozens of times a second — a small, repeating reward for a toddler who leans on one letter, pulsing and starting over for as long as it's held, and a calmer screen for whoever's nearby.
- **The screen livens up if nobody's touched it in a while** — after about ten seconds of no keyboard, mouse, or touch input mid-session, the background drifts faster and sparkles a little more on its own. The next key or tap settles it right back down; it's a gentle "still here?" instead of a static screen for a toddler who wandered off or paused to stare.
- **Respects a system-wide request for less motion** (`prefers-reduced-motion`) — every animation's duration flattens, that on-its-own liveliness above never kicks in, and each key or tap spawns roughly half as many particles, for a calmer screen without turning the game off.
- **Session timer** — 3, 5, 10, 15 minutes, or no limit, ending in a friendly recap screen. Opening Settings or Stats mid-session pauses the clock, so checking on something doesn't eat into playtime.
- **A gentle wind-down instead of an abrupt stop** — for the last 15 seconds of a timed session, the play area dims smoothly, a soft descending chime plays once, and keys and taps stop producing new effects, so a toddler gets a moment to notice playtime is ending instead of the screen just changing all at once. Free play (no time limit) never winds down, since there's no end to notice.
- **The screen stays awake during play** — a toddler staring in fascination without touching anything won't get the screen dimming and locking on them mid-session (on browsers that support the Wake Lock API; the lock is released the moment the session ends).
- **Light and dark mode**, plus an optional high-contrast toggle that boosts either one — flat black-on-white with light, flat white-on-black with dark — without touching each theme's own colours. Also adjustable letter size, sound on/off, and optional vibration on each key on devices and browsers that support it (mostly Android).
- **A parent gate, on by default** — opening Settings or Stats mid-session takes a deliberate 2-second hold on the button (with a progress fill as feedback) instead of a tap, so a toddler's random smacks can't change settings or wander out of the game. Holding Enter or Space on the focused button works too, a second finger mashing nearby can't interrupt the hold, and the language selector locks while the gate stands so no top-bar control is left ungated. A blocked tap briefly shows a "hold to open" hint, the welcome screen stays ungated — the gate only stands while a session is actually running — and it can be turned off in Settings.
- **A screen-pinning how-to**, right under the parent gate setting — since no web page can lock the OS's own exit gestures, this walks through turning on iOS's Guided Access or Android's app pinning instead, the two platform features that actually can.
- **A one-tap way back into full screen** if the browser ever drops out of it mid-session — an accidental swipe or Esc, not anything the app does on its own — instead of quietly leaving the browser's own chrome exposed for the rest of the session.
- **Optional edge dead zone, with an adjustable size** — a toddler often grips the tablet by its edges to hold it steady, and those grip points land on the screen right along with intentional taps. Turning this setting on ignores touches within a margin of the play area's edges, so a bracing thumb along the side doesn't register as a tap and doesn't count toward a Super Smash either — only touches nearer the middle of the screen do. A small/medium/large slider tunes how wide that margin is, for hands of different sizes.
- **Optional palm rejection** — a forearm or the flat of a hand resting on the screen while the other hand plays doesn't register as a tap, and doesn't count toward a Super Smash either. Based on the touch's own contact size, so it doesn't need to know about any other finger currently down.
- **Local stats only** — total presses, unique keys, playtime, best streak, favourite key. Stored on the device, never sent anywhere.
- **An optional first name** for whoever's playing, saved locally.
- **6 languages** — Portuguese (Brazil), English, Spanish, French, German, and Italian, so parents and kids anywhere in the world can play in the words they use at home, not just mine. If this turns out to be useful beyond my own living room, more languages will probably show up over time (thank you, Google Translate, for the first draft of every one after Portuguese — contributions from actual speakers very welcome).
- **Works fully offline** — open `index.html` and play, no server, account, or install required.
- **Installable, and updates never happen behind your back.** When served over `https` (or `http://localhost` while developing — service workers require a secure context, so plain `http://` on a real host won't work) as opposed to opened straight from disk, it's a full PWA: a service worker caches the app shell after the first visit, so it keeps working with no connection, and it can be installed to a tablet's home screen like a native app, icon and all. It also stays on whatever version was installed — if a newer one is ever downloaded in the background, the app just shows a small "new version ready" note in Settings and waits. Nothing swaps out from under your kid mid-session; you decide when to update, the same way you'd decide to update any app. iOS never shows an install prompt on its own, so on an iPhone or iPad the welcome screen shows a small one-time tip pointing at Safari's Share → Add to Home Screen.

## Getting started

Just open `index.html` in a browser. That's it — no server, no build step, no dependencies to install. It works the same way whether you double-click the file or serve it over `http://`.

## Developing

The shipped `app.js` and `sw.js` are generated files — don't edit them directly. The real source lives in `src/`.

```bash
npm install     # installs Biome (lint + format), jsdom, and Playwright (tests)
npm run build   # lints, then rebuilds app.js and sw.js from src/
npm test        # rebuilds, then runs the fast tests against the built app.js
npm run test:e2e # rebuilds, then runs the real-browser tests (needs `npx playwright install chromium` once)
npm run lint    # check for problems without fixing
npm run format  # format the project
npm run check   # lint + format together, with fixes
```

`npm run build` fails if the linter finds anything, so `app.js`/`sw.js` are never regenerated from code that doesn't pass the checks. Tests come in two layers, both driving the real `index.html` plus the freshly built bundle: the fast suite (`test/`) runs inside [jsdom](https://github.com/jsdom/jsdom) and covers the broad state matrix, while the E2E suite (`e2e/`, [Playwright](https://playwright.dev/) on Chromium) proves the behaviours only a real browser can — native button activation by held keys, real pointer input, real `<dialog>`s. A behaviour is tested where it actually lives: logic and state transitions in jsdom, browser-native semantics in Playwright.

## How it's built

- **Vanilla JavaScript, no framework.** `src/` is a set of small ES modules (state, i18n, themes, audio, effects, game logic, UI, and wiring in `main.js`).
- **No bundler.** [`scripts/build.mjs`](scripts/build.mjs) is a small Node script (no dependencies) that resolves the module import graph, strips `import`/`export`, embeds every language from `src/languages/*.json`, and concatenates everything into a single classic `<script>` — the `app.js` at the project root. That's what makes opening `index.html` directly work: no CORS restrictions from ES modules, no `fetch` calls for translations, nothing that requires a server.
- **The service worker is generated too.** Its source is `src/sw.js`; the build fills in a cache name derived from a hash of everything it caches (`index.html`, `styles.css`, `manifest.webmanifest`, `app.js`) and writes the result to `sw.js` at the project root. That removes any "forgot to bump the version" failure mode — a real code or content change always gets a new cache automatically, and nothing else does.
- **[Biome](https://biomejs.dev/)** handles linting and formatting for JS, JSON, and CSS.
- **A GitHub Actions workflow** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) rebuilds `app.js`/`sw.js` from `src/` and deploys straight to GitHub Pages on every push to `main` that touches the app itself — so the [online version](https://menesesevandro.github.io/MagicSmash/) never depends on remembering to run `npm run build` before pushing. Docs-only changes (README, ROADMAP, LICENSE) don't trigger it.

## Project structure

- `index.html` — the app shell
- `styles.css` — all styling
- `app.js` — generated bundle (don't edit directly — run `npm run build`)
- `sw.js` — generated service worker (don't edit directly — its source is `src/sw.js`); caches the app shell for offline use once served over `https` (or `http://localhost`)
- `src/` — the source, as ES modules: `dom.js`, `state.js`, `themes.js`, `i18n.js`, `audio.js`, `effects.js`, `game.js`, `ui.js`, `pwa.js`, `main.js`
- `src/sw.js` — the service worker's source (see "How it's built"); not part of the `app.js` bundle, since it has to ship as its own file
- `src/languages/` — translation files and the language manifest
- `manifest.webmanifest` — the web app manifest (name, icons, colors) used for installing
- `icons/` — app icons (192, 512, a maskable 512, and an iOS `apple-touch-icon`)
- `scripts/build.mjs` — the build script
- `biome.json` — lint/format config
- `.github/workflows/deploy.yml` — builds and deploys to GitHub Pages on push to `main`

## Contributing

Most of the internet built for small children wants something back from them: an ad impression, a subscription, an email address, a behavioral profile. A two-year-old can't consent to any of that — and shouldn't have to. Magic Smash is a bet that we can do better: software for kids with **no ads, no tracking, no accounts, no data leaving the device, and no internet required at all**. A parent should be able to read every line of code their child touches. Here, they actually can.

That's what you'd be contributing to. Not just a repo — a small, safe corner of the digital world where the only thing a child's keystroke triggers is joy.

And you don't need to be a security expert to help:

- **Translate it.** Every new language in `src/languages/` means another family can use this in the words their child hears at home.
- **Add a theme.** Somewhere there's a toddler who would lose their mind over trains, or cats, or robots. Icon set in `src/themes.js`, colors in `styles.css`, a spot in both theme pickers in `index.html`.
- **Improve accessibility.** Kids with low vision, motor differences, or sensory sensitivities deserve this to work beautifully for them too.
- **Fix a bug, harden an edge case, simplify the code.** Simpler code is easier to audit — and auditable code is what keeps the "a parent can read all of it" promise true.

The workflow:

1. Fork the repo and clone it.
2. `npm install`
3. Edit files in `src/` (never `app.js` directly — it's generated).
4. `npm run build` to regenerate `app.js`/`sw.js` and confirm lint/format pass.
5. Open the app (`index.html`) and try the golden path plus whatever you changed.
6. Open a pull request describing what changed.

**One firm rule**: nothing that phones home. No analytics, no CDNs at runtime, no "just one little fetch". If a change would make the app need the internet or share anything about the child using it, it doesn't belong here — that constraint is the product.

Small PRs are easier to review than big ones, so feel free to open an issue first if you want to talk through an idea. Not sure what to work on? See [ROADMAP.md](ROADMAP.md) for ideas.

## License

[MIT](LICENSE) — do whatever you'd like with it.

---

Made with ❤️ by MenesesEvandro, for a toddler who just wants to help his dad at work.
