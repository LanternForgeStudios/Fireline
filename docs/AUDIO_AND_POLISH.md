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

**Fixed a real hydration race (2026-09-04):** `audioSettings`/the menu-music `<audio>` element both
start at a hardcoded default volume (0.6), and menu music began playing on mount before the
player's real saved volume had loaded from Firestore — a returning player who'd set music to 0
would briefly hear it anyway, at the default level, during that async round-trip. Fixed by gating
`playMusic()` on the player profile actually being loaded (`App.tsx`'s music effect now depends on
`profile`, not just `screen`) — verified via debug logging that after a fresh sign-in with a saved
volume of 0, `playMusic` is called exactly once, already at volume 0, never at the stale default.

**Second music-volume bug found and fixed (2026-09-04):** the fix above didn't cover a report of
music still audible right after a mission finishes. Root cause was different: `mission_complete`/
`mission_failed` (played via `playUiSound` on the result screen) are musical-sounding synth stings
— "UI/synth_process_complete.wav" / "UI/synth_shut_down.wav" in the table above — but were
volume-gated by `sfxVolume`, not `musicVolume`. A player who'd muted music but left SFX volume up
(the default is 0.8) would still hear that sting at full SFX volume at exactly that transition —
technically correct per the SFX/music split, but not what a player experiences as "music is
muted." Reclassified those two sounds in `uiSound.ts` to respect `musicVolume` instead — every
other sound played through that function still uses `sfxVolume` as before.

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
- [x] Music files are large — re-encoded 2026-09-04. Both were Vorbis at ~500kbps (way more than
      needed for this style of track); re-encoded to 128kbps Vorbis (`ffmpeg-static`, an npm-
      installable portable binary, installed to a scratch dir and removed after — not a project
      dependency). `menu.ogg` 6.9MB → 2.0MB, `combat.ogg` 4.2MB → 1.1MB (~70-74% smaller), same
      duration to the millisecond. Verified by loading both through the real dev server into an
      `<audio>` element and confirming `loadedmetadata` fires with the correct duration (not just
      an ffmpeg-side decode check) before committing.
- [x] Combat music loops from the very start (intro included) rather than at a proper loop point —
      fixed 2026-09-04: plays the intro once, then loops only `[29.0s, end]` via the Web Audio
      API's native `loopStart`/`loopEnd` (see `CombatScene.playCombatMusic`/PROGRESS.md). The
      29.0s point is a best-guess from automated waveform analysis, not a verified-by-ear splice —
      the source pack's license PDF documents loop start/length for a dedicated "Loopable" file
      set, but that folder wasn't present in the copy pulled from, so there's no ground truth to
      confirm against. Worth a real listen; report back if the seam still sounds off so the
      timestamp can be nudged, or if it's worth sourcing the pack's actual Loopable export instead.
      **Follow-up bug, fixed 2026-09-04:** the new Web Audio node this introduced never actually
      got stopped on a real mission end — registered on the wrong Phaser scene-teardown event
      (`SHUTDOWN` instead of `DESTROY`), so it kept looping indefinitely after every mission,
      ignoring any later mute/volume change. See PROGRESS.md entry (37).
- [ ] A true military-themed SFX pack (actual automatic gunfire, rotor/engine loop, radio chatter)
      would read much better than the fantasy-pack placeholders currently in use

## Visual effects

- [x] Tracer line from the door gun to the aim point on every shot (`spawnTracer` in
      `CombatScene.ts`) — no actual travel-time projectile simulation, just a fast-fading streak
      along the shot's path, which reads fine at the gun's ~14 shots/sec rate
- [x] Muzzle flash at the crosshair on fire (procedural additive-blend sprite, tweened scale/alpha
      — `spawnSpark` in `CombatScene.ts`)
- [x] Hit-spark on a confirmed hit — staggered across the target's hit circle rather than always
      landing dead-center (`Enemy.randomImpactPoint()`, 2026-09-04). At high Fire Rate upgrade
      levels every shot landing on the exact same pixel read as a static laser dot instead of a
      stream of separate hits; now each spark lands at a random point within 65% of the hit
      radius, staying visually inside the sprite. Only the repeated non-lethal hit-spark needed
      this — the one-time kill-burst below stays centered as a deliberate "boom" payoff.
- [x] Kill burst + fade-out/scale-up on enemy destroy (the sprite no longer just vanishes)
- [x] Red damage vignette flash when the aircraft takes a hit, layered with the existing camera
      shake
- [x] Floating "+score" popup on kill (drift-up-and-fade text, `spawnScorePopup` in
      `CombatScene.ts`) — feedback beyond the HUD counter ticking
- [x] Per-mission visual theming — sky gradient, mountain tint, ground tint (`MissionDef.theme` in
      `types.ts`/`missions.ts`, applied in `buildBackground`). Previously all three missions looked
      identical apart from wave composition; this is hand-authored mood per mission, not generated
      — a natural seam for the real Phase 3 procedural weather/time-of-day system to build against
- [x] Rotor blur / dust kickup — a full-screen dark overlay (`rotorFlicker`) briefly pulses to
      ~0.07 alpha on an uneven ~160-260ms interval (`updateRotorFlicker`), reading as an overhead
      rotor blade sweeping past (the cabin itself isn't in view from a door-gunner POV, so this
      sells "under a spinning rotor" without needing new art of an actual rotor). Separately, small
      tan dust puffs (`spawnDustPuff`/`updateDustKickup`, reusing the shared `spark-tex`, tinted to
      the mission's own `theme.groundTint`) drift up from near the door sill every ~220-420ms.
      Verified mid-combat against the live site via Playwright — dust puffs visible drifting/fading
      near the ground line across several frames of an actual mission, no console/page errors.
- [x] Enemy death sprite animation frames — real PixelLab frames per type, done (see
      [ART_ASSETS.md](ART_ASSETS.md)). Non-lethal hit reaction shipped 2026-09-04 as a procedural
      white-flash + scale-punch instead of new animation frames, applying uniformly across every
      type rather than needing dedicated art per type.
- [x] Enemy return fire is now a real traveling bolt (`spawnEnemyProjectile`) from the shooter to
      the gun mount, tinted distinctly from the player's own tracer (orange-red vs. pale yellow),
      instead of an instant invisible damage tick. Damage lands on arrival, not on launch — travel
      time scales with distance (`ENEMY_PROJECTILE_SPEED`, clamped 220-650ms), so there's now a
      real, visible window to kill a shooter before its *next* volley. Applies automatically to
      every enemy type with `firesBack: true` (gunner, rocket team, technical vehicle, armored
      vehicle, commander) — no data model change needed, this was purely a missing visual for
      behavior the enemies already had.

## General polish

- [x] Weapon upgrades — Main Menu → Upgrades (now "Armory"). 4 tracks (damage, cooling, heat
      capacity, fire rate) × 10 levels (expanded from 3 on 2026-09-04), bought with credits
      (previously earned but had nowhere to spend). Server-side (`purchaseUpgrade` Cloud Function)
      for the same reason mission rewards are — verified end-to-end against the emulator
      (successful purchase, ordering enforcement, duplicate rejection, insufficient-credits
      rejection, all correct). `Weapon.ts` takes its stats from `computeGunStats(gun,
      unlockedUpgrades)`; Mission Briefing's loadout line reflects what's actually owned/equipped.
      **Superseded 2026-09-04** by a real multi-gun system (`src/game/data/guns.ts`) — 4 purchasable
      guns, each with its own stat curves and a subset of the 4 tracks, upgrade ids now gun-scoped
      (`${gunId}-${track}-${level}`); see the PROGRESS.md log entry for the full design (recoil,
      zoom, per-gun tracks).
- [ ] Upgrade costs (`cost(n) = 62·(n²+n+1)`, 186cr for level 1 up to 6,882cr for level 10 per
      track, 111,600cr to max the M134's 4 tracks — raised from k=50/90,000cr 2026-09-04, see
      PROGRESS.md) were re-derived against the rank curve's math for the *single-gun* economy, but
      still aren't validated against actual play — a generated mission's credits-per-clear varies a
      lot by luck of the draw, so whether the full climb feels like a reasonable arc or takes
      forever needs real playtesting to know. Now compounded by the 3 new guns' unlock costs
      (29,000cr total) and track curves, which are first-pass numbers shaped like the existing cost
      curve but not re-solved against any idle-credit target — a full multi-gun economy rebalance
      is a deliberate, explicit follow-up once real per-gun playtesting data exists.
- [ ] **Temporary cleanup pending**: `migrateToGunSystem` (Cloud Function), its client wrapper
      (`src/firebase/playerProfile.ts`), and the "Sync loadout to new gun system" button on the
      Settings screen exist only to backfill `ownedGuns`/`equippedGun` and refund+clear pre-gun-
      system `unlockedUpgrades` on accounts that existed before 2026-09-04. Already run
      successfully on the primary production account. Owner asked to leave it live for a while
      longer in case other production accounts still need it — remove the button, the wrapper, and
      the Cloud Function (redeploy after) once the owner confirms it's no longer needed.
- [x] Settings screen has an autosave note (not a toast per change — simpler, avoids timing/spam
      issues from continuous slider drags; revisit if it doesn't read clearly enough in practice)
- [x] `resetPlayerProgress` now also deletes the `missionResults` subcollection (batched, loops
      past Firestore's 500-op cap) instead of only resetting the aggregate fields
- [x] JS bundle code-split — Phaser now loads only when a mission starts (`GameCanvas.tsx` dynamic
      `import()`), cutting the initial bundle from ~2.16MB to ~783KB. Required replacing
      `Phaser.Events.EventEmitter` in `game/events.ts` with a small custom emitter so the React app
      shell doesn't statically pull in Phaser just for pub/sub.
- [x] **Mobile touch aim — trackpad, delta-based, both sides at once.** Four iterations: (1) lift
      the crosshair above the touch point — still direct-position aiming, didn't feel right; (2) a
      fixed-position virtual joystick — drag-to-steer, rate-based (distance from center = speed) —
      felt imprecise for aiming, since it keeps drifting as long as any offset is held; (3) a
      trackpad model with a `settings.controlSide` ('left'/'right') picker — crosshair moves by the
      finger's *movement* each frame (`TOUCH_PAD_SENSITIVITY`), stops the instant the finger stops,
      same as a laptop trackpad or mouse; (4) current: dropped the side setting entirely — **both a
      left and a right pad exist simultaneously**, so the player just uses whichever thumb suits a
      given target without a menu trip. Only one is ever live: touching one while the other is
      already engaged is ignored outright (`this.activePad` gate in `engagePad`), so there's no way
      to drive both at once; releasing frees the other back up. See `TOUCH_PAD_*` constants,
      `TouchPad`/`buildPadSide`/`engagePad`/`updatePadDrag`/`updatePadKnobVisual` in
      `CombatScene.ts`. Mouse input is unaffected throughout (still direct absolute positioning).
      Only tested logically, not on a physical device this session — worth a real-device pass;
      `TOUCH_PAD_SENSITIVITY` and the pads' screen position/size may want tuning once tried on an
      actual phone.
- [x] **Touch aim assist.** Direct feedback that touch aiming is meaningfully harder than mouse —
      a smaller screen, less precise input, and fast/large approaching enemies can close the gap
      before a drag lands exactly on them. `applyTouchAimAssist` (touch input only, not mouse —
      mouse aiming wasn't the reported problem, and unrequested assist on an already-precise input
      device would just feel like it's fighting the player) nudges the crosshair toward whichever
      enemy it's already nearest, once within that enemy's own hit radius plus `AIM_ASSIST_RADIUS_
      BONUS` (34px) slack — a soft pull on final approach (`AIM_ASSIST_STRENGTH = 0.16` lerp per
      drag update), not a hard lock; continuing to drag away still overpowers it. `baseRadius *
      scale` grows as an enemy gets closer, so the assist radius naturally grows too, right where
      the "flies by too fast" problem is worst. Untuned against a real device — the strength/radius
      constants are a first guess and are the first thing to adjust if it either doesn't help enough
      or feels like it's fighting deliberate aim.
- [x] **Mobile layout: no scroll, horizontal cutoff.** `body { overflow: hidden }` with no scroll
      container anywhere meant any screen with content taller than the viewport (Mission Select
      being the obvious one, with 3 hand-authored missions + a 4th random one) just clipped with no
      way to reach the rest. Separately, `.app-root` used `100vw`/`100vh` — a known mobile-browser
      trap where those units can over-report the true visible width/height (address bar chrome,
      etc.), which was pushing content past the real screen edges. Fixed: `.app-root` now sized in
      `%` cascaded from `html`/`body` instead of `vw`/`vh`; `.screen` (the shared wrapper every UI
      screen but gameplay uses) now has `overflow-y: auto` plus `align-items: safe center` (falls
      back to plain `center` in unsupporting browsers — CSS ignores the second declaration if the
      value isn't recognized, so this is a safe two-line progressive enhancement, not a fallback
      hack) so the *start* of overflowing content stays reachable by scrolling instead of centered
      off both edges unreachably. `.briefing-content`'s `max-width: 90vw` became `max-width: 100%`
      for the same vw-avoidance reason, relying on `.screen`'s own padding instead. Gameplay
      (`.play-screen`) doesn't use the `.screen` class, so this doesn't add scroll/rubber-banding
      during combat. Reasoned through, not verified on a real device.
- [ ] Procedurally generated missions (`src/game/generation/`) are logic-tested only (a throwaway
      script printing wave compositions) — nobody's actually played one yet. Threat budget/pacing
      constants (`BASE_BUDGET`, `BUDGET_GROWTH`, `MAX_SPAWNS_PER_WAVE`) will likely want another
      pass once someone has.
- [x] Secondary objectives (GDD Phase 3) — done, both hand-authored and procedural missions each
      carry one (`no-damage` or `clean-sweep`, bonus credits on success), server-validated in
      `submitMissionResult`. This line was stale — see `MissionDef.secondaryObjective` in
      `missions.ts`.
- [ ] Weather in the generator (`weatherThemes.ts`) is visual-mood only; making it gameplay-affecting
      (visibility, spawn rate) is a separate follow-up, still open.
