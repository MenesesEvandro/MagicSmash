# Roadmap

Ideas for where Magic Smash could go next. None of this is promised or scheduled — it's a starting point for discussion, and a place to point contributors who want to help but aren't sure where to start. If one of these sounds fun to build, open an issue first so we can talk it through, then see [Contributing](README.md#contributing) in the README.

## Multiple children

- **Named profiles.** `data.profile` today holds a single name. Families with more than one toddler probably want separate profiles — name, favourite theme, and stats kept independent per child, switched the same way themes are switched now. Everything stays local; this is just structuring the existing data model to hold a list instead of one entry.
- **Export / import stats and settings** as a downloaded `.json` file, so a profile can move to a second device (a grandparent's tablet, say) without a server in between.

## Accessibility

- **High-contrast mode**, as an alternative to light/dark.
- **A more thorough `prefers-reduced-motion` story** — today it shortens animation durations; it could also cut down the number of particles spawned per keypress for kids sensitive to visual clutter.
- **A parent gate** on the settings/exit controls — something like a held two-finger long-press or a short sequence — so a toddler can't accidentally change settings or back out of the app. Not a real password (there's nothing worth protecting behind it), just enough friction that a two-year-old's hands don't trigger it by accident.

## More to press and see

- **More themes** — safari, robots, garden/insects, seasons. Same pattern as the existing ones: an icon set, a color palette, a sound, and a spot in both theme pickers.
- **Haptic feedback** (Vibration API) on touch devices, as an extra sensory layer alongside sound and animation.
- **An on-screen keyboard that lights up** the physical key just pressed, to help a toddler connect the key under their finger with what happened on screen.

## Explicitly not planned

Some things will probably never be added, on purpose:

- Analytics, crash reporting, or any telemetry.
- Cloud sync or accounts of any kind.
- Ads, in-app purchases, or third-party SDKs.
- Anything that requires an internet connection to function.

If a proposed feature needs a network call to work, it's the wrong feature for this app — see the "one firm rule" in [Contributing](README.md#contributing).
