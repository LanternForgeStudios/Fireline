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
- [ ] Rotor blur / dust kickup around the helicopter frame for motion sell
- [ ] Enemy hit/death sprite *animation* frames (the VFX above is procedural overlay, not new
      PixelLab animation frames — still tracked in [ART_ASSETS.md](ART_ASSETS.md))

## General polish

- [ ] Loadout selection screen (GDD mentions "select loadout" in the core loop; currently skipped
      straight from briefing to combat with a fixed M134)
- [x] Settings screen has an autosave note (not a toast per change — simpler, avoids timing/spam
      issues from continuous slider drags; revisit if it doesn't read clearly enough in practice)
- [x] `resetPlayerProgress` now also deletes the `missionResults` subcollection (batched, loops
      past Firestore's 500-op cap) instead of only resetting the aggregate fields
- [x] JS bundle code-split — Phaser now loads only when a mission starts (`GameCanvas.tsx` dynamic
      `import()`), cutting the initial bundle from ~2.16MB to ~783KB. Required replacing
      `Phaser.Events.EventEmitter` in `game/events.ts` with a small custom emitter so the React app
      shell doesn't statically pull in Phaser just for pub/sub.
- [x] **Mobile touch aim — virtual trackpad.** Two iterations: first tried lifting the crosshair
      above the touch point (still direct-position aiming), but the user didn't like it in
      practice. Replaced with a fixed-position virtual trackpad (bottom-left corner, drag-to-steer
      like an analog stick — rate-based, not absolute position) that also holds-to-fire while
      engaged. The pad sits away from where enemies/the crosshair actually appear, so the aiming
      thumb never covers the target regardless of where the player is currently aiming. Mouse
      input is unchanged (still direct absolute positioning). See `TOUCH_PAD_*` constants and
      `buildTouchPad`/`engagePad`/`updatePadDrag` in `CombatScene.ts`. Only tested logically, not
      on a physical device this session — worth a real-device pass; `TOUCH_PAD_MAX_SPEED` (steering
      rate) and the pad's screen position/size may want tuning once tried on an actual phone.
