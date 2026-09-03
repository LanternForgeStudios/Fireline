# Fireline — Audio, VFX & Polish Tracker

## Audio — done

Source: `forgotten-wilds/public/assets/audio/library` (a sibling project's shared asset library —
fantasy-themed packs, not a military-specific library, so these are functional placeholders, not
a final thematic fit). Copied (not symlinked) into `public/audio/`.

| Use | File | Source | Volume control |
| --- | --- | --- | --- |
| Weapon fire (per shot) | `sfx/shot.wav` | `Weapons/shot_muffled.wav` | `settings.sfxVolume` |
| Enemy killed | `sfx/kill.wav` | `Retro/explosion_small.wav` | `settings.sfxVolume` |
| Aircraft takes damage | `sfx/aircraft_damage.wav` | `Weapons/harsh_thud.wav` | `settings.sfxVolume` |
| Weapon overheated | `sfx/overheat.wav` | `UI/synth_warning.wav` | `settings.sfxVolume` |
| Menu select/hover | `sfx/ui_select.wav` | `UI/sci_fi_select.wav` | `settings.sfxVolume` |
| Menu confirm (launch, etc.) | `sfx/ui_confirm.wav` | `UI/sci_fi_confirm.wav` | `settings.sfxVolume` |
| Toggle on/off (settings) | `sfx/toggle_on.wav` / `toggle_off.wav` | `UI/toggle_on.wav` / `toggle_off.wav` | `settings.sfxVolume` |
| Mission complete sting | `sfx/mission_complete.wav` | `UI/synth_process_complete.wav` | `settings.sfxVolume` |
| Mission failed sting | `sfx/mission_failed.wav` | `UI/synth_shut_down.wav` | `settings.sfxVolume` |
| Menu/briefing/results music | `music/menu.ogg` | xDeviruchi — "Title Theme" | `settings.musicVolume` |
| Combat music | `music/combat.ogg` | xDeviruchi — "Battle 1" | `settings.musicVolume` |

Both volumes and difficulty live in Firestore (`players/{uid}.settings`) and hydrate on any
device/browser the player signs into — see the Settings screen (Main Menu → Settings).

**Downloaded but not wired in yet:** `sfx/hit.wav` (`Materials/metal_clang.wav`) — skipped to
avoid audio clutter layered on top of the per-shot `shot.wav` at the gun's ~14 shots/sec rate.
Available if a distinct "confirmed hit" cue is wanted later (e.g. only on the killing blow, or
gated to feel less busy).

### Licensing — action needed before a public release

The xDeviruchi tracks (`music/menu.ogg`, `music/combat.ogg`) are free-with-attribution, not
public domain: commercial use is allowed, but the pack's license requires crediting
**"Original music by Marllon Silva (xDeviruchi)"** (ideally with a link to their YouTube channel)
somewhere reachable from the game — an in-game credits screen or the README would satisfy it.
**No credits screen exists yet** — add one before shipping past the prototype stage. Full terms:
`forgotten-wilds/public/assets/audio/library/music/xDeviruchi/DOCUMENTATION & LICENSE.pdf`.
The `sfx/` files came from generic asset-pack folders without an equivalent license doc found
alongside them — worth double-checking their source/license before a public release too.

### Known follow-ups

- [x] Add a credits/attribution screen (blocks public release, see above) — Main Menu → Credits,
      credits Marllon Silva (xDeviruchi) per license terms
- [ ] Music files are large (menu.ogg ~6.9MB, combat.ogg ~4.2MB) — re-encode at a lower bitrate;
      no `ffmpeg`/re-encoding tool was available in this session to do it inline
- [ ] Combat music loops from the very start (intro included) rather than at a proper loop point —
      the source pack's license PDF documents loop start/length in seconds for a "Loopable" file
      set, but that folder wasn't present in the copy pulled from; full tracks were used as-is
- [ ] A true military-themed SFX pack (actual automatic gunfire, rotor/engine loop, radio chatter)
      would read much better than the fantasy-pack placeholders currently in use

## Visual effects

- [x] Tracer line from the door gun to the aim point on every shot (`spawnTracer` in
      `CombatScene.ts`) — no actual travel-time projectile simulation, just a fast-fading streak
      along the shot's path, which reads fine at the gun's ~14 shots/sec rate
- [x] Muzzle flash at the crosshair on fire (procedural additive-blend sprite, tweened scale/alpha
      — `spawnSpark` in `CombatScene.ts`)
- [x] Hit-spark on a confirmed hit
- [x] Kill burst + fade-out/scale-up on enemy destroy (the sprite no longer just vanishes)
- [x] Red damage vignette flash when the aircraft takes a hit, layered with the existing camera
      shake
- [x] Floating "+score" popup on kill (drift-up-and-fade text, `spawnScorePopup` in
      `CombatScene.ts`) — feedback beyond the HUD counter ticking
- [x] Per-mission visual theming — sky gradient, mountain tint, ground tint (`MissionDef.theme` in
      `types.ts`/`missions.ts`, applied in `buildBackground`). Previously all three missions looked
      identical apart from wave composition; this is hand-authored mood per mission, not generated
      — a natural seam for the real Phase 3 procedural weather/time-of-day system to build against
- [ ] Rotor blur / dust kickup around the helicopter frame for motion sell
- [ ] Enemy hit/death sprite *animation* frames (the VFX above is procedural overlay, not new
      PixelLab animation frames — still tracked in [ART_ASSETS.md](ART_ASSETS.md))

## General polish

- [x] Weapon upgrades — Main Menu → Upgrades. 4 tracks (damage, cooling, heat capacity, fire rate)
      × 3 levels, bought with credits (previously earned but had nowhere to spend). Server-side
      (`purchaseUpgrade` Cloud Function) for the same reason mission rewards are — verified
      end-to-end against the emulator (successful purchase, ordering enforcement, duplicate
      rejection, insufficient-credits rejection, all correct). `Weapon.ts` now takes its stats from
      `computeWeaponStats(unlockedUpgrades)` instead of hardcoded constants; Mission Briefing's
      loadout line reflects what's actually owned. Not a "select between different guns" system —
      one persistent, upgradeable M134, which fits the GDD's "select loadout" + "upgradeable
      weapons" language better than adding weapon variety would have.
- [ ] Upgrade costs/values (150/350/650 credits per level) are a first guess, not balanced against
      actual play — a generated mission's credits-per-clear varies a lot by luck of the draw, so
      whether 3-4 tracks maxed out feels like a reasonable arc or takes forever needs real
      playtesting to know.
- [x] Settings screen has an autosave note (not a toast per change — simpler, avoids timing/spam
      issues from continuous slider drags; revisit if it doesn't read clearly enough in practice)
- [x] `resetPlayerProgress` now also deletes the `missionResults` subcollection (batched, loops
      past Firestore's 500-op cap) instead of only resetting the aggregate fields
- [x] JS bundle code-split — Phaser now loads only when a mission starts (`GameCanvas.tsx` dynamic
      `import()`), cutting the initial bundle from ~2.16MB to ~783KB. Required replacing
      `Phaser.Events.EventEmitter` in `game/events.ts` with a small custom emitter so the React app
      shell doesn't statically pull in Phaser just for pub/sub.
- [x] **Mobile touch aim — trackpad, delta-based.** Three iterations: (1) lift the crosshair above
      the touch point — still direct-position aiming, didn't feel right; (2) a fixed-position
      virtual joystick — drag-to-steer, rate-based (distance from center = speed) — felt imprecise
      for aiming, since it keeps drifting as long as any offset is held; (3) current: a real
      trackpad model — crosshair moves by the finger's *movement* each frame
      (`TOUCH_PAD_SENSITIVITY`), stops the instant the finger stops, same as a laptop trackpad or
      mouse. Also added `settings.controlSide` ('left'/'right', Firestore-backed) so the pad can
      sit on whichever side the player's thumb actually is. See `TOUCH_PAD_*` constants and
      `buildTouchPad`/`engagePad`/`updatePadDrag`/`updatePadKnobVisual` in `CombatScene.ts`. Mouse
      input is unaffected throughout (still direct absolute positioning). Only tested logically,
      not on a physical device this session — worth a real-device pass; `TOUCH_PAD_SENSITIVITY`
      and the pad's screen position/size may want tuning once tried on an actual phone.
- [ ] Procedurally generated missions (`src/game/generation/`) are logic-tested only (a throwaway
      script printing wave compositions) — nobody's actually played one yet. Threat budget/pacing
      constants (`BASE_BUDGET`, `BUDGET_GROWTH`, `MAX_SPAWNS_PER_WAVE`) will likely want another
      pass once someone has.
- [ ] Secondary objectives (GDD Phase 3) — not attempted. Weather in the generator
      (`weatherThemes.ts`) is visual-mood only; making it gameplay-affecting (visibility, spawn
      rate) is a separate follow-up.
