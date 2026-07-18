# Magic Smash

**[🕹️ Play Magic Smash online](https://menesesevandro.github.io/MagicSmash/)**

Press any key. Something delightful happens. That's the whole game.

Magic Smash is a keyboard playground for toddlers: no rules, no losing, no reading required. Every keypress (or tap, or click) triggers a big animated letter, a friendly sound, and a burst of themed characters flying across the screen.

## Why this exists

I work from home, and my son, almost 2 years old, always wants to "work" with me. He'd climb onto my lap and start smashing the keyboard, which is exactly what a toddler should do, just not always great for whatever I was typing.

I went looking for one of those keyboard-mashing toy websites to point him at instead, but the VPN I connect to for work blocks pretty much everything. So I built my own... Something that needed zero internet connection, would hold his attention.

## Features

- **Press anything** — letters, numbers, spacebar, arrow keys, all of it. There's no wrong key.
- **14 themes** — Vehicles, Bubbles, Music, Colors, Weather, Dinosaurs, Farm, Party, Space, Beach, Ocean, Lights, Toys, and Bedtime. Each one has its own icon set, color palette, sound, and animation.
- **Sound and animation for every key** — a gentle themed tone (synthesized in the browser, no audio files), a floating letter, sparkles, and a themed character animation.
- **A living background** — icons drift lazily across the screen and pop when a key is pressed.
- **Session timer** — 3, 5, 10, 15 minutes, or no limit, ending in a friendly recap screen. Opening Settings or Stats mid-session pauses the clock, so checking on something doesn't eat into playtime.
- **The screen stays awake during play** — a toddler staring in fascination without touching anything won't get the screen dimming and locking on them mid-session (on browsers that support the Wake Lock API; the lock is released the moment the session ends).
- **Light and dark mode**, adjustable letter size, sound on/off, and optional vibration on each key on devices and browsers that support it (mostly Android).
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
npm install     # installs Biome (lint + format)
npm run build   # lints, then rebuilds app.js and sw.js from src/
npm run lint    # check for problems without fixing
npm run format  # format the project
npm run check   # lint + format together, with fixes
```

`npm run build` fails if the linter finds anything, so `app.js`/`sw.js` are never regenerated from code that doesn't pass the checks.

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
