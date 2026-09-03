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

- [ ] Add a credits/attribution screen (blocks public release, see above)
- [ ] Music files are large (menu.ogg ~6.9MB, combat.ogg ~4.2MB) — re-encode at a lower bitrate;
      no `ffmpeg`/re-encoding tool was available in this session to do it inline
- [ ] Combat music loops from the very start (intro included) rather than at a proper loop point —
      the source pack's license PDF documents loop start/length in seconds for a "Loopable" file
      set, but that folder wasn't present in the copy pulled from; full tracks were used as-is
- [ ] A true military-themed SFX pack (actual automatic gunfire, rotor/engine loop, radio chatter)
      would read much better than the fantasy-pack placeholders currently in use

## Visual effects — not started

- [ ] Muzzle flash at the crosshair on fire
- [ ] Hit-spark/impact VFX on a confirmed hit (currently only the enemy's health bar communicates
      a hit)
- [ ] Death/destroy VFX on enemy kill (currently the sprite just disappears)
- [ ] Screen damage vignette or red flash when the aircraft takes a hit (currently just a camera
      shake, see `applyAircraftDamage` in `CombatScene.ts`)
- [ ] Rotor blur / dust kickup around the helicopter frame for motion sell

## General polish — not started

- [ ] Loadout selection screen (GDD mentions "select loadout" in the core loop; currently skipped
      straight from briefing to combat with a fixed M134)
- [ ] Settings screen has no confirmation toast after saving (writes are fire-and-forget to
      Firestore; works, but no visible "saved" feedback)
- [ ] `resetPlayerProgress` resets the `players/{uid}` aggregate fields but does **not** delete the
      `missionResults` subcollection history (Firestore doesn't cascade-delete; would need a
      batched delete). Worth deciding if "reset" should wipe history too.
- [ ] JS bundle is ~2.15MB (591KB gzipped) per the build warning — Phaser + Firebase + React
      unsplit. Code-splitting (lazy-load Phaser only when entering combat) would help initial
      load time.
