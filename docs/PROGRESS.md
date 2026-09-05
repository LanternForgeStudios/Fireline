# Fireline — Development Progress

Tracks where the project actually stands against the [GDD](GDD.md#recommended-development-phases)
phases. Update this at the end of each milestone (see the `push-and-deploy` skill). Newest entry
on top.

## Status by GDD phase

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Core Combat | **Done** — playable shooting prototype |
| 2 | Mission System | **Done** per the GDD's own deliverable ("complete extraction mission") — 7 missions (Search & Destroy, two Escorts, Extraction, Rescue, two Base Defense) with a select screen, each with distinct visual theming, plus loadout selection via the weapon upgrade system (see Phase 4). Base Defense adds a second mission archetype (hover in place, defend a ground objective) — see the 2026-09-04 log entry |
| 3 | Procedural Content | **Done** per the GDD's own list — seeded generation, encounter blocks, threat budgets, weather/time-of-day variety, and secondary objectives, all shipped. Weather stays visual-mood only, not gameplay-affecting — a deliberate scope call, not a gap |
| 4 | Backend | **Done** — see below |
| 5 | Release | Not started (web live on GitHub Pages; iOS/Capacitor future) |

## Backend (Phase 4) detail

- [x] Firebase project (`fireline-lf`) created
- [x] Firebase Authentication — Google + Email/Password sign-in, gates play
- [x] Firestore — `players/{uid}` profile (xp, credits, missionsCompleted/Failed, bestScore,
      unlockedUpgrades) + `players/{uid}/missionResults/{id}` history, live-synced to the UI
- [x] Firestore security rules — per-player read/write isolation (`firestore.rules`)
- [x] App Check (reCAPTCHA Enterprise) **enforced** on Firestore/Auth (owner flipped it in Console
      2026-09-04, after the provider/project-mismatch fixes below made App Check actually work end
      to end). Verified live immediately after: fresh sign-in, Firestore player-profile read, and a
      full mission launch all succeeded with zero Firestore/Auth/App Check errors.
- [x] Player settings (music/SFX volume + independent mute flags, difficulty, mobile control side)
      stored in Firestore, hydrate on any device
- [x] Server-side reward validation — Cloud Functions (`functions/`, Blaze plan) now own all
      progression writes; `firestore.rules` restricts client writes on `players/{uid}` to just the
      `settings` field, and blocks `missionResults` writes entirely
- [x] Local Emulator Suite (`npm run emulators`) — Auth/Firestore/Functions all working locally,
      non-default ports so it coexists with other Firebase projects' emulators on the same machine
- [x] Weapon upgrade purchases — `purchaseUpgrade` Cloud Function, same server-side-owns-it model
      as mission rewards (credits/unlockedUpgrades are client-write-blocked). Verified against the
      emulator: successful purchase, ordering enforcement, duplicate rejection, insufficient-credits
      rejection all correct
- [x] App Check enforced on both Cloud Functions (`enforceAppCheck: !isEmulator` — off when running
      under the Local Emulator Suite, since there's no local App Check emulator and every dev
      machine having a working debug token would be needed for zero actual security benefit; on in
      every deployed function). Verified end-to-end against the emulator: a fake mission-result
      submission with no App Check header, score 99999999, wavesCleared 999 got through auth fine
      and was correctly clamped server-side to 43200 (the generous fallback bound for procedurally
      generated missions — see the Phase 3 log entry below) rather than accepted at face value.
- [x] Per-operation lifetime stats — `players/{uid}/missionStats/{missionId}` (`completions`,
      `highestDifficulty`), server-maintained inside `submitMissionResult`'s existing transaction.
      Read-only to the client, same model as `missionResults`.
- [x] Multi-weapon system — `ownedGuns`/`equippedGun` on `players/{uid}`, `purchaseGun`/`equipGun`
      Cloud Functions, gun-scoped upgrade ids (`${gunId}-${track}-${level}`). Same
      server-owns-progression model as everything else above. Verified against the emulator: see
      log entry below.

## Log

### 2026-09-05 (50) — Flight-mission enemies 25% bigger on mobile

- Flight-mode enemies (approaching in a straight line, as opposed to hover mode's cover-emerge/
  wander) now render 25% larger on touch devices, both at spawn and at their fully-grown impact
  size — `Enemy.ts`'s new `MOBILE_FLIGHT_SCALE_MULTIPLIER`, applied as a flat multiplier on top
  of the existing spawn/approach scale curve rather than changing `SPAWN_SCALE`/
  `APPROACH_SCALE_GROWTH` directly (which would also grow desktop). Same idea as hover mode's
  existing `HOVER_SCALE_MULTIPLIER`, except gated to touch devices only, per this request —
  hover's multiplier was applied unconditionally to all devices when it shipped.
  `containsPoint()`'s hit radius grows in step automatically since it reads `container.scale`
  directly, same as every previous scale-tuning pass here.
- New `mobileFlightBoost?: boolean` field on `EnemySpawnPoint`, set by
  `CombatScene.flightSpawnPoint()` from the existing `supportsTouch()` check. Hover missions are
  untouched — `hoverSpawnPoint()` never sets it, and the hover branch in `Enemy.update()` doesn't
  read it at all.
- Verified live: sampled enemy `container.scale` against the known scale-curve formula across an
  entire mission on both a touch-emulated context and a plain desktop context — touch averaged
  exactly 1.25x the expected curve value across 40 samples spanning the full progress range,
  desktop averaged exactly 1.0x across 36 samples.

### 2026-09-05 (49) — Health pickups: crates + a random kill-heal chance

- New `HealthPickup` entity (`src/game/entities/HealthPickup.ts`) — a shootable health crate that
  drifts across the field on the same spawn-to-target path flight-mode enemies use, regardless of
  the mission's own mode. Deliberately a separate lightweight class rather than reusing `Enemy`/
  `EnemyTypeId` — it has no health-bar, no walk cycle, no fire-back, and isn't part of the
  procedural threat-budget/wave-generation system at all, so adding it couldn't skew those.
- Rolled once per wave-clear (50% chance, only when another wave is still coming) rather than on
  a separate timer — ties resupply pacing to the game's existing rhythm. Destroying one restores
  25 HP; left alone, it just reaches its target point and vanishes with no penalty, same idea as
  an enemy "impact" but harmless.
- Separately, every enemy kill now has an 8% chance to also restore 10 HP on the spot — a small
  unannounced bonus independent of the crate mechanic.
- Both heal sources play the same feedback: a green burst + a floating "+N HP" popup
  (`CombatScene.spawnHealEffect`), distinct from the orange kill-spark/gold score popup, so a
  heal reads as its own kind of moment — this is what makes the kill-heal chance visible at all,
  since nothing else on screen would otherwise call it out.
- New art: `public/env/health-crate.png` (64×64, PixelLab `create_image_pixflux`) — a wooden
  supply crate with a red medical cross.
- Verified live against the Local Emulator Suite: a crate spawned naturally on the first wave
  clear, shooting it took health from 10 to 35 (exactly the +25 heal) with the "+25 HP" popup
  visible on screen (screenshot confirmed), and an extended play session caught the kill-heal
  chance firing independently (35 -> 45, no crate involved).

### 2026-09-05 (48) — Fixed touch controls visually shifting while zoomed

- Fixed the cosmetic bug flagged in entry (47): touch pads and the zoom button no longer
  shift/shrink or move off-screen while a zoom-capable gun's camera zoom is active.
- Each pad's ring/knob/label, and the zoom button's circle/label, are now grouped into a
  `Phaser.GameObjects.Container` (local-origin children). A new `syncTouchUiForZoom()`, called
  every frame from `update()`, counter-scales/-positions each container (`scale = 1/zoom`,
  `position = center + (nominal - center)/zoom`) so the camera's own zoom transform cancels it
  back out, leaving the rendered screen position/size fixed regardless of zoom level.
- Chose this over a second `.ignore()`-based UI camera — that would've required registering every
  dynamically-created world object in `CombatScene.ts` (enemies, sparks, tracers, dust, score
  popups) against a camera ignore-list, a much larger and riskier change for the same result.
  The crosshair is deliberately untouched — it's supposed to track the zoomed world, not stay fixed.
- Verified live via CDP multi-touch against the Local Emulator Suite: zoom toggled on/off, screen
  screenshot confirmed pads/zoom button render at their correct fixed on-screen position/size, and
  move/drag/fire all still function correctly while zoomed.
- `src/game/scenes/CombatScene.ts` only. Frontend-only, no backend changes.

### 2026-09-05 (47) — Pad labels + mobile zoom becomes a toggle
- Follow-up to entry 46. Two player requests:
  1. **Pad labels**: idle pads (before either is touched) now read "FIRE/MOVE" — naming both
     roles they could take on — instead of the old, now-inaccurate "AIM" leftover from the
     single-pad design. Once a role is actually assigned, the label simplifies to just that
     word ("MOVE" or "FIRE").
  2. **Mobile zoom is now a tap-toggle, not a hold**: with move/fire now split across the two
     aim pads, both thumbs are already spoken for — a hold-based zoom button would need a third
     thumb held down simultaneously to zoom while still moving/firing. Tap the mobile zoom
     button once to zoom in, tap again to zoom back out; it stays on regardless of finger
     lift. Desktop's right-click-hold zoom is unchanged (a spare hand is available there).
     Renamed `zoomHeld` → `zoomActive` throughout `CombatScene.ts` since "held" no longer
     describes the mobile path. Added a visual on/off state to the button itself (`setZoomButtonVisual`,
     synced once per frame).
- **Known follow-up, not fixed this pass**: while zoom is active, the touch pad rings/knobs/
  labels (and the zoom button itself) visually shift and can move off-screen entirely — they're
  regular world-space Phaser objects rendered through the same camera that's zooming, with no
  scroll/zoom exemption. Verified this is **cosmetic only**: touching a pad at its *original*
  (pre-zoom) screen location still correctly registers as move/fire even while zoomed, and
  firing actually works (confirmed via CDP touch — heat rises normally). But the player loses
  the visual reference for where to place their thumb once zoom kicks in, which the new
  always-toggle-able zoom makes much more likely to be hit than the old hold-based version
  (which needed 3 simultaneous fingers to trigger the same overlap). Real fix is a second,
  never-zoomed UI camera with the main camera set to `.ignore()` the touch-control objects —
  correct Phaser pattern, but touches many object-creation sites throughout `CombatScene.ts`
  (every dynamically-spawned spark/tracer/enemy would need registering), a meaningfully bigger
  change than this pass's scope. Flagged for the owner to decide priority on.
- Verified live via CDP multi-touch: idle labels correct, move/fire relabeling correct in both
  directions, zoom toggle turns on and stays on after release, toggles back off on a second tap
  (confirmed in isolation), and functionally keeps working (hit-testing + actual firing) even
  while the camera is zoomed, per the cosmetic-only finding above.

### 2026-09-05 (46) — Mobile controls: move-only + toggle-to-fire, and a real multi-touch bug
- Player-requested redesign of the touch aim pads: previously, touching either pad both aimed
  (drag) and fired (just by holding it) — the other pad sat unused. Now: whichever side is
  touched first becomes the move pad for that engagement (drag only, never fires by itself),
  and the OTHER side immediately relabels to a plain hold-to-fire button ("FIRE", distinct
  ring color) for as long as movement stays engaged. Releasing the fire thumb alone just stops
  firing — movement stays active. Releasing the move thumb ends the whole engagement: firing
  force-stops even if the fire thumb is still down, and both pads reset to idle "AIM" circles
  until either is touched again. New `CombatScene.engageMove`/`engageFire`/`releaseMove`/
  `releaseFire`/`setPadRole`/`setFirePressed`, replacing the old single-`activePad` model.
- **Found a real, pre-existing multi-touch bug while building this**: Phaser's game config
  never set `input.activePointers` (default 1, meaning only 2 total Pointer slots: mouse +
  one touch). A second simultaneous touch's native `pointerdown` fires correctly at the DOM
  level (confirmed via a raw window-level listener) but Phaser's InputManager silently drops
  it for lack of an allocated Pointer object — `CombatScene`'s own `pointerdown` handler never
  saw it at all. This means the existing "hold zoom with one thumb while dragging the aim pad
  with the other" feature could never have worked with genuine simultaneous touches on a real
  device — it was only ever verified with a desktop right-click-hold. Fixed by setting
  `input: { activePointers: 3 }` in `src/game/config.ts` (covers move+fire, plus zoom-hold on
  top of that for zoom-capable guns).
- **Verification note**: this bug was invisible to `page.evaluate()`-dispatched synthetic
  `PointerEvent`s too — those reached the DOM (confirmed the same way) but Phaser's InputManager
  ignored them regardless of `activePointers`, likely because they're untrusted synthetic events
  rather than genuine input. Real verification required Chrome DevTools Protocol's
  `Input.dispatchTouchEvent` (via `page.context().newCDPSession(page)`), which generates
  trusted-equivalent touch input Phaser's InputManager actually processes — worth remembering
  for any future touch-input verification in this project, since neither `page.touchscreen.tap()`
  (single-touch only) nor manual `dispatchEvent` are sufficient for multi-touch checks.
- Verified live via CDP multi-touch against the Local Emulator Suite: touching either pad first
  correctly claims it for movement and relabels the other to FIRE; adding a second touch on the
  fire side starts real firing (weapon heat rises); releasing just the fire touch stops firing
  while movement stays engaged; releasing the move touch force-stops firing and resets both
  pads to idle even with the fire thumb still down; symmetric in both directions (right-first
  works identically to left-first).

### 2026-09-05 (45) — Hover missions: widened the placement zone back out
- Follow-up to entry 44: player confirmed the bigger scale reads well on mobile, but entry 44's
  600×160 placement band (tightened specifically to make things read bigger) crammed cover
  objects/enemies too close together once they were also bigger (140px sprites, up from 96px).
- Widened `coverGenerator.ts`'s zone to 840×220 (a middle ground between the original 1000×240
  and entry 44's over-tightened 600×160) and bumped `MIN_SEPARATION` 130→180 — at the new 140px
  sprite size, 130 separation meant sprite edges actually overlapped by ~10px. Loosened
  `CombatScene.ts`'s `HOVER_ATTACK_OFFSET_MIN/MAX`/`HOVER_ATTACK_Y_JITTER` back toward their
  original values so enemies peek out further from cover, matching the roomier zone. Re-spread
  both hand-authored missions' cover coordinates to match.
- Verified live via Playwright at a landscape mobile viewport (844×390): screenshot shows a
  well-spread, still-legible composition. Procedural generation re-checked across 300 seeds —
  still deterministic, all placements within the new bounds, minimum separation respected.

### 2026-09-05 (44) — Hover missions: bigger/tighter arena for mobile, stationary objective
- Player-reported: on mobile, hover-mission cover objects/enemies/objective read too small,
  and the defend objective (a tower/relay/depot — a fixed structure) shouldn't sway like the
  Escort mission's convoy vehicle does.
- **Objective no longer sways**: `buildDefendObjective()` dropped the two idle bob/sway tweens
  it copied from `buildEscortVehicle()` — the objective now sits perfectly still (it still
  reacts to being hit via the existing angle-shake tween in `applyObjectiveDamage`). Verified
  live: sampled its sprite position 4× over 2s, x/y never moved.
- **Bigger/tighter arena instead of a camera zoom**: considered zooming the camera in for
  hover missions (the obvious "make things bigger" lever, and there's already a full zoom
  mechanic for GAU-19), but the touch pads/zoom button/crosshair are all rendered in raw world
  coordinates with no scroll-factor exemption — the same single camera renders everything, so
  zooming it moves and enlarges the touch pads too. Worked the math: even a modest 1.2x zoom
  would push the aim-pad rings roughly half off-screen. Went a different, zero-risk-to-controls
  route instead:
  - `COVER_OBJECT_SIZE`/`DEFEND_OBJECTIVE_SIZE`: 96 → 140.
  - Hover mode's arena is now a tighter 600×160 band (was 1000×240) — `coverGenerator.ts`'s
    `COVER_X_MARGIN`/`COVER_Y_RANGE`, `CombatScene.ts`'s new `HOVER_X_SAFE_MARGIN`/
    `HOVER_Y_SAFE_MARGIN` — so cover, enemies, and the objective all cluster more centrally
    instead of spreading across the full 1280-wide field, reading bigger on a small screen
    without any camera change. `MIN_SEPARATION` 160→130 and `PLACEMENT_ATTEMPTS` 40→100 to keep
    procedural placement reliable in the smaller area. The two hand-authored missions' cover
    coordinates were moved to fit the new bounds.
  - New `Enemy.ts` constant `HOVER_SCALE_MULTIPLIER = 1.3` — hover-mode enemies now render 30%
    larger than their flight-mode counterparts once emerged (`containsPoint`/hit-testing scale
    with it automatically, so they're also easier to tap on mobile, not just easier to see).
  - Fixed a latent bug found while touching this code: the enemy attack-position Y clamp was
    bounded to flight-mode's `IMPACT_Y_RANGE` (545-610), which sits well below where hover
    cover is actually placed (280-520 originally, 320-480 now) — every hover enemy's attack
    point was being forced down into that band regardless of its cover's real y, rather than
    staying near the cover it emerged from. Now clamps to generic safe canvas margins instead.
- Verified live via Playwright at a landscape mobile viewport (844×390) against the Local
  Emulator Suite: screenshot shows cover/objective/enemies all clearly larger and more
  centrally clustered, touch pads unaffected/correctly positioned, objective health bar and
  label rendering correctly. Procedural generation re-checked across 300 seeds: still fully
  deterministic, all Base Defense cover placements land within the new tighter bounds with the
  new minimum separation respected (~65% still get their full drawn count of 4-5 cover objects
  in the smaller area; the rest settle for the 3-object floor — a minor content-variety
  tradeoff, not a bug, not worth chasing further for this pass).

### 2026-09-05 (43) — Cleanup pass: aircraft was invulnerable in every hover mission
- Scope: everything since the last cleanup (`e8a53e3..HEAD`, ~11 commits — the multi-weapon
  system, per-op gun recommendations, hover missions). `security-review` found nothing.
  `code-review` (high effort) mostly hit a session rate limit mid-run; the one angle that
  completed (reuse) plus a follow-up consolidated correctness pass together found 3 real bugs,
  fixed here.
- **Real bug, most significant**: `spawnEnemyProjectile`'s hover-mission "keep the aircraft at
  risk too" exception (per the owner's explicit "both stay at risk" decision, see entry 42)
  targeted `drone` enemies at the aircraft — but `ENEMY_DEFS.drone.firesBack` is `false`, so a
  drone can never call `shouldFire()`/reach `spawnEnemyProjectile()` at all. Combined with
  hover-mode enemies never "impacting" the aircraft either, **the aircraft was fully
  invulnerable in every hover mission** — health never moved regardless of what fired at you,
  and a generated hover mission rolling the `no-damage` bonus objective always awarded it for
  free. My own earlier live-verification of this exact behavior was fooled by calling
  `spawnEnemyProjectile()` directly via a debug hook, bypassing `shouldFire()`'s `firesBack`
  gate entirely — a real lesson about verifying through the actual game loop, not a shortcut
  that skips the exact gate in question. Fixed by switching the exception to `rocket` (which
  does have `firesBack: true`, and is a more thematically plausible anti-air threat than a
  kamikaze drone anyway). Re-verified properly this time: spawned a real rocket through
  `spawnEnemy()`, let it reach `shouldFire()` on its own after ~9s in Operation Iron Gate —
  aircraft health dropped from 100 to 73 — while a real gunner still routed to the objective
  (260→242), confirming the type split now actually holds during real play.
- **Real bug**: the temporary `migrateToGunSystem` Cloud Function refunded old-format upgrades
  at the *current* `k=62` cost formula instead of the `k=50` formula those upgrades were
  actually purchased under (this session's k=50→62 rebalance predates the multi-weapon system
  by a few commits) — a ~24% overpayment per migrated level. Added a dedicated `OLD_LEVEL_COST`
  (k=50) constant for the refund calculation. **This already ran once against the production
  account** before the fix — the owner may want to decide whether to claw back the ~24% excess
  credited, or leave it (small, one-time, one account).
- **Real bug**: `UpgradesScreen.tsx`'s per-action pending/error state was keyed by bare track
  name (`upgrade-${track.id}`, e.g. `upgrade-damage`) instead of being gun-scoped, even though
  multiple owned guns share track names (m134/m60/gau19 all have a `damage` track). Switching
  gun tabs while a purchase was in flight showed the wrong gun's track as pending, and an error
  from one gun's purchase could render under a different gun's tab. Fixed by scoping the key to
  `upgrade-${selectedGun.id}-${track.id}`.
- **Simplification** (from the reuse-cleanup angle, applied): extracted `requireAuthUid`/
  `requirePlayerSnap` helpers in `functions/src/index.ts` — `purchaseUpgrade`, `purchaseGun`,
  `equipGun`, and `migrateToGunSystem` all re-typed the same auth-guard + "player doc must
  exist" transaction skeleton, which had already silently drifted once (mismatched not-found
  wording). Extracted `computeBarFill()` (new `src/game/entities/healthBarFill.ts`) — `Enemy`'s
  own health bar and `CombatScene`'s new defend-objective health bar duplicated the exact same
  width/offset/three-tier-color formula with different constants.
- **Skipped, deliberately**: a finding to also extract `SettingsScreen.tsx`'s migrate-button
  pending/error handling into a shared hook with `UpgradesScreen.tsx`'s `runAction` — the
  migrate button is itself temporary (see entry 41's follow-up note), not worth the churn. A
  finding to extract a generic `findById` helper across `functions/src/{gunCatalog,
  upgradeCatalog}.ts`'s one-line `Array.find` lookups — three one-liners are already about as
  simple as a wrapper would make them; skipped as unnecessary abstraction.
- Verified: `npm run build`/`npm run lint` clean (frontend + functions). Firestore rules
  cross-checked against `playerProfile.ts`'s current field set — no drift. Deployed rules/
  functions state confirmed to match what's in the repo (both deployed at the end of the
  hover-missions milestone, nothing changed since). `README.md`'s Status/Stack/Project-layout
  sections refreshed — they'd gone stale again describing "a persistent upgradeable M134" and
  five missions, both wrong since the multi-weapon and hover-missions work landed.

### 2026-09-04 (42) — Hover missions ("Base Defense"): stationary cover, defendable objective
- Player-requested second mission archetype: instead of flying forward with enemies closing
  in a straight line, the helicopter holds position, enemies emerge from stationary cover
  objects and wander near an attack point instead of charging in, and the objective is to
  defend something instead of surviving an approach. Gives `'Base Defense'` (previously an
  unused, mechanically-inert entry in `MissionDef['type']`) its first real behavior via a new
  `mode: 'flight' | 'hover'` field, decoupled from `type` so the flavor label and the engine
  mode stay independent concepts.
- **Enemy movement**: `Enemy.update()` gained an additive hover branch — enemies spawn at a
  cover object's own position (perfectly occluded behind it via depth ordering), emerge to a
  nearby "peek out" attack point over the same easing curve flight mode already uses, then
  switch to a persistent small-radius 2D wander (two incommensurate sine/cosine frequencies,
  same "don't lock into an obvious loop" idea as the escort vehicle's two-different-period
  tweens) instead of freezing. Hover enemies never "impact" — `update()` returns `false`
  unconditionally in hover mode, so they're removed only by being killed, never by reaching a
  target. `shouldFire`/`containsPoint`/`randomImpactPoint`/`takeDamage`/`playHitFlinch`/
  `playDeath` needed zero changes — all already read live position/scale regardless of what
  drives it. One follow-on fix: `handleFiring()`'s target tie-break switched from `progress`
  to `container.depth` (progress stops differentiating once several hover enemies sit at 1.0
  simultaneously; depth is a strict, mode-agnostic generalization since flight-mode depth was
  already monotonic with progress).
- **Defendable objective**: a new hard-fail condition parallel to aircraft health — a ground
  prop (reuses `buildEscortVehicle()`'s idle-tween pattern) with its own health bar (in-world
  overlay + a new HUD bottom-center slot). Losing it ends the mission exactly like aircraft
  health hitting 0 does, via a new `failureReason` on `MissionResult` (client-display-only,
  confirmed no server schema change needed — Cloud Functions only read the fields their input
  interface declares). New secondary-objective type `protect-objective` ("never let the
  objective take damage") joins `no-damage`/`clean-sweep`.
- **Damage routing — "both stay at risk" (owner decision)**: in hover missions, `drone`
  enemies' return fire still targets the aircraft; every other type's fire targets the
  defended objective instead. Verified directly (forced a drone and an infantry projectile at
  each other): drone fire took the aircraft from 100→90 health, infantry fire took the
  objective from 260→250, confirming the split. This keeps aircraft health and the
  `no-damage` bonus meaningfully live in hover missions rather than decorative.
- **Procedural generation**: `mode` is derived from the already-picked `type`
  (`type === 'Base Defense' ? 'hover' : 'flight'`) with **no new RNG draw**, so every seed
  that doesn't roll Base Defense produces byte-identical missions to before this change —
  verified across seeds 1-400 (all deterministic on re-generation, all Base Defense seeds
  produced 3-5 non-overlapping cover placements ≥160px apart and a scaled objective health).
  New `src/game/generation/coverGenerator.ts` handles cover placement + objective flavor/health
  generation; `waveGenerator.ts`/`encounterBlocks.ts`/`WaveSpawn`/`WaveDef` needed zero changes
  since spawn positions were already resolved live in `CombatScene`, never stored in mission
  data, for both flight and hover missions alike.
- **Content**: two new hand-authored missions, Operation Iron Gate (desert, defends a Comms
  Relay, `protect-objective` bonus) and Operation Last Redoubt (urban, defends a Forward
  Checkpoint, `clean-sweep` bonus, 5 waves) — mirrored into `functions/src/missionCatalog.ts`
  the same way every prior hand-authored mission already required (no other server-side
  awareness of hover mode needed).
- **New art**: 4 cover-object props (crates/sandbags/rubble/rocks) and 3 defend-objective
  props (relay/depot/checkpoint), all 96×96 via `create_image_pixflux`, plus 2 new 64×64
  mission icons — see `docs/ART_ASSETS.md`.
- Extracted `WORLD_WIDTH`/`WORLD_HEIGHT` out of `CombatScene.ts` into a new
  `src/game/worldConstants.ts` so the new cover generator (pure data, no Phaser dependency)
  doesn't need to import a Phaser scene module just for two constants.
- **Verified live against the Local Emulator Suite**: launched Operation Iron Gate and
  confirmed the ground stops scrolling (hover, no forward-flight illusion), 4 cover objects
  render, the objective starts at full health with the HUD bar showing its label, an enemy's
  position visibly changes after reaching its attack point (wandering, not frozen), the
  damage-routing split behaves as designed (above), and force-destroying the objective
  correctly ends the mission with the objective-specific Result screen subtitle. Temporary
  DEV-only debug hooks (`window.__fireline`, `window.__generateMission`) used for this were
  reverted before shipping.

### 2026-09-04 (41) — Per-operation gun recommendations
- Player-requested, small follow-up to the multi-weapon system: Mission Briefing now shows a
  "Recommended Gun(s)" line. `recommendGuns()` (`src/game/data/gunRecommendation.ts`) maps each
  mission's `type` (Search & Destroy/Escort/Extraction/Rescue/Base Defense/Reconnaissance) to a
  gun pairing, then appends a note based on the secondary objective (no-damage vs clean-sweep).
  Deliberately type-driven rather than tallying enemy composition — every hand-authored mission
  escalates to armor/commander by its final wave regardless of type, so composition alone barely
  differentiated recommendations when tried; type does. Works unchanged for procedural missions
  since they draw `type` from the same `MissionDef['type']` union.
- Verified live via Playwright against the Local Emulator Suite: all 5 hand-authored missions show
  distinct, sensible recommendations (Firebreak → M134; Steel Convoy/Riverine Shield → SAW/M134;
  Green Hell/Nightfall → M60/GAU-19), each with an objective-aware note.

### 2026-09-04 (40) — Multi-weapon system: recoil, 4 purchasable guns, zoom
- Player-requested: heat should visibly punish sustained fire (not just gate at 100%), and "the
  gun" should become a roster of purchasable guns with different stats/upgrade tracks/feel,
  including a zoom-capable one — a reason to rotate loadouts instead of always maxing one gun.
- **Recoil**: `Weapon.tick()` now computes an upward pixel offset from `(heat/maxHeat)^curve *
  maxClimbPx` (per-gun `curve`/`maxClimbPx`) and smooths it via a 140ms exponential lerp so it
  climbs/decays continuously rather than stepping with each shot's heat jump. `CombatScene` applies
  it as a new `effectiveAim` computed every frame from `crosshairPos - recoilOffsetY` —
  `crosshairPos` itself (mouse-absolute, touch-relative-delta, aim-assist) is untouched, so touch
  aim-assist keeps pulling toward true aim intent even while recoil visually displaces where shots
  land. `handleFiring()`'s hit-test/tracer/spark/hit-marker all read `effectiveAim` now.
- **4 guns** (`src/game/data/guns.ts`, server-mirrored in `functions/src/gunCatalog.ts` +
  `upgradeCatalog.ts`): M134 Minigun (free, all 4 tracks, today's exact shipped stat curves —
  zero drift), M60 "Long Gun" (heavy damage, no fire-rate track, 9,000cr), GAU-19 ".50 Cal"
  (zoom 1.6x, only damage/heatCapacity tracks, tiny heat pool, 14,000cr), M249 SAW (fire-rate/
  cooling only, high cyclic/low damage, 6,000cr). Upgrade ids are now gun-scoped
  (`${gunId}-${track}-${level}`) so two guns can both have e.g. a `damage` track without
  colliding in the flat `unlockedUpgrades` array.
- **Zoom**: hold-to-activate (confirmed via AskUserQuestion) — right-click-hold on desktop,
  a new on-screen hold button on mobile (own touch-pointer id, independent of the aim pads'
  single-active-pad exclusivity). Implemented via `cameras.main.setZoom()` (no prior camera-zoom
  code existed) with coordinate conversion only at the two raw-pointer read sites
  (`updateCrosshairFromMouse`, `updatePadDrag`) — everything downstream (clamps, aim-assist,
  hit-testing) stays correct unchanged since `getWorldPoint` returns the same world space
  regardless of zoom.
- **Backend**: new `purchaseGun`/`equipGun` Cloud Functions (same transactional
  validate-then-`arrayUnion`/increment pattern as `purchaseUpgrade`); `purchaseUpgrade` gained a
  check that the upgrade's gun is actually owned; `resetProgress` now also resets `ownedGuns`/
  `equippedGun`. `firestore.rules`' `allow create` extended to require the zero-state
  `ownedGuns: ['m134']`/`equippedGun: 'm134'` shape.
- **UI**: Upgrades screen (kept its existing route/props, retitled "Armory") gained a gun-tab
  strip (icon, name, Equipped/Locked tag) above the per-gun upgrade tracks; selecting an unowned
  gun shows a purchase card instead. Mission Briefing's loadout summary is now gun-aware.
- Migration: per explicit owner instruction, the one production account's pre-existing
  `unlockedUpgrades` (old un-prefixed ids, meaningless under the new scheme) will be manually
  cleared and refunded via a one-off Admin-SDK script run once at deploy time — not an automated
  migration path, no permanent compat code.
- **Balance flag (not solved here, deliberate)**: unlock costs (29,000cr for all 3 non-default
  guns) and per-track curves are first-pass numbers shaped like the existing `62*(n²+n+1)` cost
  curve, not re-validated against the 10-15%-idle-credits target entry (38) tuned for the
  single-gun economy. Flagged as a follow-up once real per-gun playtesting data exists.
- **Verified live against the Local Emulator Suite** (fresh signed-up account, credits patched
  directly in the Firestore emulator — emulator-only, no production data touched): purchased
  GAU-19, equipped it, bought a track level, confirmed Mission Briefing showed the new gun/track;
  in combat confirmed `weapon.heat`/`maxHeat` matched GAU-19's stats, `recoilY` grew with heat and
  `effectiveAim.y` shifted above `crosshairPos.y` accordingly, right-click-hold set
  `camera.zoom` to 1.6 and released back to 1; confirmed SAW's Armory card shows only its 2
  allowed tracks (Fire Rate, Cooling); confirmed `resetProgress` reverts `ownedGuns`/`equippedGun`
  to `['m134']`/`'m134'` and credits to 0. Temporary DEV-only debug hooks used for this
  (`window.__fireline` in `GameCanvas.tsx`, `window.__firelineAuth` in `firebase/config.ts`) were
  reverted before shipping.

### 2026-09-04 (39) — Tracer now lands where the bullet actually lands
- Player-reported: bullet spread still looked like a solid laser line despite the impact-spark
  stagger from entry (35). Root cause: `spawnTracer()` (the visible gun-to-target line — the more
  visually dominant element of the two) still always drew to the raw crosshair position, which
  barely moves shot-to-shot during sustained fire on a mostly-stationary target. Only the small
  impact *spark* was using the randomized point; the line itself never moved.
- Fixed by computing `target.randomImpactPoint()` once per shot and using it for both the tracer's
  endpoint and the impact spark, so the line and the spark agree — bullets still originate from the
  gun every time, they just don't all terminate on the same pixel anymore.
- Verified live via Playwright: patched `spawnTracer` to record every endpoint, locked onto one
  non-dying enemy (zeroed damage for the test — the first attempt used a real 15-HP infantry that
  died 2 shots in, silently swapping to a different, differently-positioned enemy and producing
  misleading "spread" data), and confirmed endpoints vary meaningfully shot-to-shot instead of
  being frozen at one point, landing on/near the actual target each time.

### 2026-09-04 (38) — Rebalanced upgrade costs against the rank curve
- Owner asked for a rank-vs-gear balance check: since XP and credits both derive from the same
  per-mission score (`xpEarned = score`, `creditsEarned ≈ score/10 + bonus` in
  `functions/src/index.ts`), the ratio between them is fixed regardless of how well someone plays
  (~7.85 XP per credit, confirmed against all 5 hand-authored missions' real wave compositions, not
  estimated). At the prior cost curve (`k=50`, 90,000cr to max all 4 tracks), maxing gear finished
  at ~70% of the way to Colonel (1,000,000 XP) — the last third of the rank grind had nothing left
  to spend credits on.
- Owner wanted that down to a 10-15% idle window. Since Colonel's XP was a deliberate choice made
  earlier this session (not something to undo), the only real lever is the upgrade cost curve —
  raising it moves the *gear* finish line later without touching rank. Solved algebraically for the
  target range and confirmed a coefficient bump from k=50 to **k=62** in `cost(n) = k·(n²+n+1)`
  lands at 111,600cr to max all 4 tracks, putting gear-maxing at ~87-88% of the Colonel climb
  (~12.3-12.5% idle, both in the optimal-play and realistic-play scenarios — same ratio in both
  since it's driven by the fixed XP:credit conversion rate, not by how well anyone plays).
- Chose a uniform coefficient bump (every level scales by the same ~24%) over steepening just the
  back half of the curve — smaller diff, keeps the single shared formula between
  `src/game/data/upgrades.ts` and `functions/src/upgradeCatalog.ts` intact, and a first purchase
  going from 150cr to 186cr doesn't meaningfully change the early-game feel the way the *idle
  credits at max rank* problem actually mattered for.
- Verified: client/server catalogs still match exactly (40/40 entries); recomputed the full
  mission-count math with the new total (256 missions optimal / 393 realistic to max gear, vs. 292
  / 449 to Colonel — 12.3-12.5% idle either way); confirmed live in the Upgrades screen that the
  first purchase now reads "Buy AP Rounds I — 186 cr".

### 2026-09-04 (37) — Third music-volume bug: combat music never actually stopped after a mission
- Player-reported (again): combat music kept playing after a mission ended, even with mute or
  volume set to 0. Third occurrence of this general bug class this session (see entries for the
  hydration-race fix and the mission-end-sting reclassification) — but this one was specific to
  today's new Web Audio combat-music implementation (entry 30).
- Root cause: `stopCombatMusic()` was registered on `Phaser.Scenes.Events.SHUTDOWN` only. The real
  mission-end path (`GameCanvas` unmounting → `game.destroy()`) tears scenes down via
  `Systems.destroy()`, which only ever emits `Events.DESTROY` — confirmed by reading Phaser's own
  source (`SceneManager.destroy()`/`Systems.destroy()`), not guessed. `SHUTDOWN` is reserved for
  scene-level `stop()`/`restart()` transitions. This session's own live-verification passes for
  entry 30 used `scene.scene.restart()` to simulate mission end, which *does* fire `SHUTDOWN` —
  masking the bug in testing while it stayed completely broken on the real path.
  Net effect: the orphaned `AudioBufferSourceNode` from the just-finished mission kept looping
  forever, at whatever `audioSettings.musicVolume` was captured when *that* mission started —
  deaf to any mute/volume change made afterward, since it was never told to stop and its gain was
  never live-updated. Matches the report exactly.
- Fixed by also registering the stop handler on `Events.DESTROY` (`stopCombatMusic()` is safe to
  run twice — `combatMusicSource` is nulled after the first call, so a second is a no-op).
- Verified live via Playwright against the *actual* production path this time (a real
  `scene.endMission('complete')` → `EVT_MISSION_COMPLETE` → React unmounts `GameCanvas` →
  `game.destroy()`, not a simulated `scene.restart()`): with music muted before launch,
  `combatMusicSource` is confirmed nulled after mission end and every `Audio` element in the page
  (intercepted via a `window.Audio` proxy, since the menu-music element is never attached to the
  DOM) reads volume 0 throughout, both during the mission and after.

### 2026-09-04 (36) — 5th mission (boat escort) wired up, boat death animations fixed
- **Operation Riverine Shield** — a 5th hand-authored mission, the second `type: 'Escort'` one, on
  a bright-daylight `'coastal'` landscape (Nightfall's landscape too, but a distinct sky palette
  and — the more visually dominant differentiator, since it fills most of the screen — a
  green-teal `groundTint` on the shared water tile instead of Nightfall's neutral lavender). New
  icon (`icon-mission-riverineshield.png`). Server-side catalog mirror
  (`functions/src/missionCatalog.ts`) updated and deployed for reward validation, same as every
  other hand-authored mission.
  - `CombatScene.escortVehicleAsset(landscape)` picks the boat texture (`escort-boat.png`) instead
    of the truck automatically whenever an Escort mission's landscape is `'coastal'` — fixed keys
    per asset (not per-landscape) since there are only ever the two variants, loaded once and
    cached forever like everything else here.
  - Being the 5th canned mission, this also became the 5th thing the "complete all canned
    operations once" gate (entry 35) requires before Randomly Generated unlocks — no code change
    needed there, `MissionSelect.tsx` already generalized over the full `MISSIONS` array.
- **Player-reported, fixed same day: boat deaths played the land type's death animation** — a
  soldier collapsing or a truck exploding rendered on top of a sunk boat, since the original
  coastal-boat-reskin pass explicitly scoped out new death animations (documented at the time,
  now stale). Generated a real one per boat type via `animate_image` (works directly off an image
  URL, unlike `animate_object` which needs a proper PixelLab object — these boats were raw
  `create_image_pixflux` images) — see [ART_ASSETS.md](ART_ASSETS.md) for job IDs and a real
  failure mode hit along the way (inline base64 silently truncated in transit; switched to the
  live GitHub Pages URL for each source image instead).
  - `Enemy.ts` now resolves which death animation to play from the actual texture in use at
    construction time (`deathAnimKey`), not just the enemy type — a boat-reskinned instance plays
    `boat-${id}-death`, everything else still plays `${id}-death` exactly as before.
    `CombatScene.buildEnemyAnimations`/`preload` mirror the same branch so the right frames are
    fetched and registered per mission, same pattern already established for the walk-cycle gate.
  - Verified live via Playwright: forced a boat-reskinned enemy's death mid-mission and confirmed
    `boat-${id}-death` is what actually starts playing (not the land animation), with a screenshot
    showing the explosion VFX rendering on the correct boat sprite; re-checked a land mission
    afterward to confirm `${id}-death` still plays unaffected (no regression).

### 2026-09-04 (35) — Escort vehicle regen + boat variant, bullet impact stagger, 1M-XP rank curve, gated procedural missions
- **Escort vehicle regenerated** — a fresh top-down 3/4 view from the back, front facing north, per
  owner request rather than continuing to patch the earlier version. Hit the same lesson the
  earlier fix already documented (view/direction params are weakly-guiding, text has to carry the
  angle) and the same orientation gotcha (initial generation put the front toward the viewer, not
  away) — fixed with the same deterministic 180° rotation approach, this time double-checking the
  *rotated* result directly rather than trusting one visual read. See
  [ART_ASSETS.md](ART_ASSETS.md) for the full history on this asset.
- **New boat variant** (`escort-boat.png`) — same treatment, same palette, generated in case a
  future mission escorts a boat on water instead of a land convoy. Not wired into any mission yet
  (no water-escort mission exists) — banked art only.
- **Bullet impact stagger** — player-reported: at high Fire Rate upgrade levels, sustained fire
  looked like a laser beam rather than individual bullet impacts. Root cause: the hit-spark VFX
  always spawned at the target's exact container center, so every shot in a burst stacked on the
  same pixel. Added `Enemy.randomImpactPoint()` — a random point within 65% of the hit radius —
  and use it for the hit-spark instead. Kill-burst VFX stays centered (one-time payoff, not part of
  the stacking problem).
- **Rank curve overhauled** — Colonel now requires 1,000,000 XP (was 60,000), all 7 non-Recruit
  tiers rebuilt working backwards from that top: Private 5,000 → Corporal 15,000 → Sergeant 40,000
  → Lieutenant 90,000 → Captain 200,000 → Major 450,000 → Colonel 1,000,000 (each tier roughly
  2.2-3x the last). Reaching Colonel is now a genuine long-haul milestone (~a few hundred mission
  clears at best-case scoring) rather than reachable within a normal play session.
  `src/game/data/ranks.ts` only — no other code needed to change, `getRankProgress()` already
  worked generically over the tier list.
- **Procedural missions gated behind clearing every hand-authored operation once** — "Randomly
  Generated" on Mission Select now shows a locked card (with a list of what's still needed) until
  `operationStats` shows at least one completion, at any difficulty, for all 4 canned missions.
  Nudges a new player through each of the game's hand-tuned encounters at least once before the
  randomizer starts mixing them, rather than letting the procedural option be skipped entirely.
  `MissionSelect.tsx` only — reuses the `operationStats` prop it already received.
- Verified live via Playwright: rank modal shows the exact new thresholds; a fresh account sees
  Random locked with the correct "complete these 4" message; after forcing all 4 missions to
  complete (debug hook), the locked card is gone and Random is selectable; the escort vehicle
  renders correctly oriented in an actual Steel Convoy mission; `randomImpactPoint()` called 10
  times on a live enemy returns 10 distinct points.

### 2026-09-04 (34) — Cleanup pass on this session's work (`/cleanup`)
- Scope: everything from this session (entries 21-33 above, ~10 commits). Ran the security-review
  and code-review skills plus 4 parallel simplify-angle reviews (reuse/simplification/efficiency/
  altitude) against the diff. Security review: no findings. Code review + simplify: several real
  issues, most fixed here.
- **Fixed — real bugs:**
  - `Enemy.playHitFlinch()` re-read the sprite's *current* (possibly mid-tween) scale as the new
    "base" on every call — rapid re-hits on the same enemy (max Fire Rate upgrade now fires every
    20ms) could permanently ratchet its scale away from true size. Now captures the base scale
    once at construction time (`spriteBaseScaleX/Y`) instead.
  - `Enemy.playDeath()` never cancelled an in-flight hit-flinch tween/tint before switching to the
    death animation, so a kill shot arriving mid-flinch could render the first death frames
    visibly stretched/tinted. Now kills the tween and resets scale/tint first.
  - `CombatScene.preload()`/`buildEnemyAnimations()` unconditionally fetched and registered walk-
    cycle frames for all 4 humanoid types even on coastal missions, where they render as boat
    reskins and can never play the animation (`Enemy.ts`'s own texture-key guard already prevented
    playback, but not the wasted fetch/registration). Fixed by moving walk-cycle eligibility onto
    `EnemyDef.hasWalkCycle` (was a disconnected `WALK_HUMANOID_TYPES` set in `CombatScene.ts`) and
    gating both preload and animation registration on it plus the actual per-mission texture key —
    also fixes a latent crash risk where a coastal mission launched *first* in a session would have
    registered `${id}-walk` referencing texture keys that were never loaded.
- **Fixed — quality:**
  - `playCombatMusic()` built a throwaway `WebAudioSound` via `soundManager.add()` just to read
    `.audioBuffer` off it before destroying it; the decoded buffer is already directly in
    `this.cache.audio` for the WebAudio backend (verified against Phaser's own loader source) — now
    reads it directly, and the two identical fallback branches were combined into one condition.
  - `uiSound.ts`: derived the `UiSoundFile` type from the sound-file list via `as const` instead of
    maintaining two hand-synced lists; switched from one cached `<audio>` element per sound to a
    small round-robin pool (2 per sound) so rapid repeats of the *same* sound (e.g. a double-click)
    layer instead of cutting each other off; deferred the eager preload warm-up (`requestIdleCallback`)
    since the 6 files total over 1MB and were competing with the initial auth/render on page load.
  - `SettingsScreen.tsx`: extracted a shared `VolumeRow` component for the music/SFX rows (were
    copy-pasted with only field names differing) — which also fixed a real regression the mute-
    checkbox change had introduced: the row wrapper changed from `<label>` to `<div>`, silently
    breaking click-to-focus on the volume slider. Each row's label is now its own `<label
    htmlFor>` tied to its slider.
  - `Enemy.ts`: dropped a redundant `private scene` field (every Phaser GameObject already carries
    `.scene`); uses `this.sprite.scene` at the few call sites that needed it.
- **Deliberately not fixed (noted, not argued with):**
  - The `LEVEL_COST` cost-curve formula is duplicated between `src/game/data/upgrades.ts` and
    `functions/src/upgradeCatalog.ts` (three reviewers flagged this). Left as-is — it's consistent
    with this repo's existing, documented convention of hand-mirroring game data into the
    separately-deployed Functions package (`missionCatalog.ts`'s header comment establishes the
    same pattern for the same structural reason: Functions can't import Vite's `src/`). A real fix
    (shared package) is a bigger architectural change than a cleanup pass; already tracked as a
    known drift-risk via the `missionCatalog.ts` precedent.
  - The rank badge's progress bar (`MainMenu.tsx`/`.menu-rank-bar`) duplicates the shape of the
    HUD's `.hud-bar`/`.hud-bar-fill` (`Hud.tsx`, untouched by this session). Skipped: a real shared
    base would mean editing `Hud.tsx`, which is outside this diff's scope, and the two bars are
    genuinely different sizes for their different contexts (compact menu badge vs. combat gauge) —
    forcing literal reuse would visually mismatch the badge.
  - `playCombatMusic()`'s gain node snapshots `audioSettings.musicVolume` once at mission start and
    never re-reads it, unlike every other audio call site in the app (uiSound/musicPlayer/CombatScene's
    SFX all re-read live). Documented in a comment rather than fixed: Settings isn't reachable once
    a mission is running today, so there's no way to trigger the gap in practice — worth revisiting
    if that ever changes.
- Verified live via Playwright: hit-flinch settles back to exact base scale after 4 rapid re-hits
  (was drifting before); `playDeath` mid-flinch shows no leftover scale/tint; walk cycle still
  plays correctly on a non-coastal mission; a coastal mission launched *first* in a fresh session
  registers zero walk animations (the crash-risk edge case) with no errors; combat music loop node
  still has the correct `loopStart`/`loopEnd` after the buffer-lookup simplification; Settings
  label click-to-focus restored; mute checkboxes still work; rapid double-triggered UI sounds
  produce no console errors.
- Doc maintenance: `README.md`'s Status/Stack sections were stale on mission count (said 3, it's
  4), App Check (said "reCAPTCHA v3, Monitor mode, not yet enforced" — it's been reCAPTCHA
  Enterprise, enforced, since entry (14)/owner's Console toggle), and didn't mention the rank
  system, 10-level upgrades, or mute settings at all. `docs/PROGRESS.md`'s own Phase 4 checklist
  had the same stale mission count and settings description. `docs/ART_ASSETS.md` and
  `docs/AUDIO_AND_POLISH.md` each had a stale "hit-flinch not done" note (shipped entry (27)) and
  the upgrade-cost note still cited the old 150/350/650 values; `AUDIO_AND_POLISH.md` also had a
  flatly wrong "secondary objectives — not attempted" line (they're shipped and server-validated) —
  split into a correct done-line plus the genuinely-still-open gameplay-weather item it was
  conflated with.

### 2026-09-04 (33) — Regenerated desert and urban ground tiles too
- Follow-up to entry (32): once the jungle/coastal regeneration proved there was a genuinely
  better option available from `create_tiles_pro`'s independent-tile mode, regenerated desert and
  urban the same way rather than leaving them on the old transition-set tiles that just happened
  to hide the seam problem well (sand/asphalt are noise-like enough that the interlock artifacts
  were less obvious, not actually absent).
- Owner picked desert `tile_0` (diagonal wind-ripple sand) and urban `tile_8` (dark cracked
  asphalt with red debris) from contact sheets of 16 candidates each — see
  [ART_ASSETS.md](ART_ASSETS.md) for job IDs and the full candidate breakdown. Urban's batch had
  more visible-seam candidates than the other three terrains (concrete/asphalt cracks read more
  geometric than sand, foliage, or waves).
- No tint changes needed here — desert's `groundTint` was already neutral, and urban's warm tint
  reads fine against the new dark asphalt tile (unlike coastal's mismatch in entry 32).
- Verified live: launched Operation Firebreak (desert) and Operation Steel Convoy (urban),
  confirmed both scroll with zero visible tiling seams. Hit an intermittent variant of the
  headless-Chromium black-screenshot quirk from entry (32) — same forced-Canvas2D workaround
  resolved it, though one screenshot needed a re-check since an initial black result turned out to
  be a stale cached read of a prior failed attempt, not a real render failure.

### 2026-09-04 (32) — Regenerated jungle/coastal ground tiles for real seamless tiling
- Player-reported: jungle and water ground tiles didn't blend seamlessly when scrolled — looked
  like pieces of a tileset meant for paths/interlocks, not a uniform repeating texture. Root cause
  confirmed: the originals came from `create_tiles_pro` in transition-set mode (a 16-tile
  corner/path set meant to connect to *different* neighbor terrain), which desert/urban's
  low-detail textures hid but jungle/water's directional detail didn't.
- Regenerated both in independent-tile mode (no transition-set feature) — see
  [ART_ASSETS.md](ART_ASSETS.md) for job IDs and the full before/after reasoning. Built a 3×3-tiled
  contact sheet of all 16 candidates per terrain so seamlessness could actually be judged before
  presenting options, rather than picking from single isolated tiles.
- Owner picked jungle `tile_0` and coastal `tile_11` from the candidates.
- Also fixed a color clash the coastal pick exposed: `operation-nightfall`'s `groundTint`
  (`missions.ts`) was tuned for the old texture and read oddly against the new one — changed to
  neutral (`0xffffff`) per the owner's call, keeping the tile's true color over a mismatched tint.
- Verified live: launched Operation Green Hell (jungle) and Operation Nightfall (coastal),
  confirmed both scroll with zero visible tiling seams. Along the way, hit and worked around a
  headless-Chromium quirk where both Playwright's `screenshot()` and the canvas's own
  `toDataURL()` returned solid black for the WebGL-rendered Phaser canvas (no console/render
  errors — genuinely a screenshot-capture issue in this environment, not the app) by temporarily
  forcing Phaser's Canvas2D renderer for the verification pass only, then reverting.

### 2026-09-04 (31) — Music/SFX mute checkboxes, synced across devices
- Added a "Mute" checkbox next to each volume slider on the Settings screen. Deliberately a
  separate flag (`PlayerSettings.musicMuted`/`sfxMuted`) rather than just zeroing the volume field
  — so muting doesn't clobber the player's preferred slider position, and unmuting restores it
  exactly instead of coming back at 0.
- Effective volume is computed once, at the single spot that already hydrates every screen/
  refresh/device (`App.tsx`'s `profile.settings -> audioSettings` effect):
  `audioSettings.musicVolume = settings.musicMuted ? 0 : settings.musicVolume` (same for sfx).
  Every consumer (`uiSound.ts`, `musicPlayer.ts`, `CombatScene`'s SFX calls and its own music gain
  node) already just reads `audioSettings.musicVolume`/`sfxVolume`, so mute is honored everywhere
  for free — deliberately avoiding a parallel "if muted" check at each call site, which is the
  exact class of bug the second music-volume fix earlier this session ran into (checking the wrong
  flag in one call site while the rest were fine).
- Synced through the existing Firestore-backed settings path (`updatePlayerSettings`, generic
  dot-path writes) — no new backend/rules work needed, same mechanism as the volume sliders.
- **Found and fixed a real (if narrow) pre-existing bug while verifying this**: `SettingsScreen` is
  interactive before the initial profile-creation write finishes (`profile?.settings ??
  DEFAULT_SETTINGS` lets it render immediately), so a settings change fired in that window could
  race the account's first Firestore write and get rejected (`PERMISSION_DENIED` — the update rule
  evaluates against a resource that doesn't fully exist yet). Reproduced reliably by scripting a
  settings change immediately after signup; a real player is unlikely to hit the exact window but
  it's a real gap on a slow connection. Fixed by guarding `changeSettings` (`App.tsx`) on `profile`
  being loaded, not just `user` being signed in — a change fired in that window is now silently
  dropped instead of erroring against a not-yet-existent document.
- Verified live via Playwright: checkboxes toggle correctly (first attempt exposed a real markup
  bug — the outer `<label>` wrapped both the range input and the checkbox, so native label-click-
  forwarding fought over which control a click should hit; fixed by making the row a plain `<div>`
  and giving the checkbox its own dedicated `<label>`), muting drives `audioSettings` to exactly 0,
  the slider visually disables while muted, the muted state survives a full page reload with a
  proper wait for real profile hydration (not just the screen re-rendering), and unmuting restores
  the exact pre-mute volume (0.35 in the test) rather than a default.

### 2026-09-04 (30) — Combat music: play the intro once, loop only the body
- combat.ogg previously looped the entire 73.37s file from 0, intro included, via Phaser's
  `sound.play({ loop: true })` — every ~73s the player heard the same intro flourish restart.
  Ran two automated waveform analyses (exact-repeat cross-correlation; energy-envelope scan for a
  structural intro/body boundary) trying to find a confident splice point in the actual audio;
  neither found a strong signal, which points to this file being the pack's "full preview" render
  rather than the dedicated loop-optimized export its license PDF documents (that file isn't in
  this project's copy of the pack — see the existing note above). Picked user option: ship a
  best-guess loop point now rather than block on sourcing the real file.
- `COMBAT_MUSIC_LOOP_START_SEC = 29.0` in `CombatScene.ts`, the least-weak candidate from the
  correlation pass — a best guess, not a verified splice.
- Implemented via the raw Web Audio API's `AudioBufferSourceNode.loopStart`/`loopEnd` (the native,
  sample-accurate tool for exactly "play once, then loop only a subrange") rather than Phaser's
  `sound.play({ loop: true })`, which always loops the whole buffer back to 0 with no way to offset
  just the repeat passes. Reuses Phaser's own decoded buffer (`sound.add(key).audioBuffer` — NOT
  `this.cache.audio`, which doesn't hold the decoded WebAudio-backend buffer) and Phaser's existing
  AudioContext, so this doesn't spin up a second audio graph. Falls back to Phaser's normal
  whole-buffer loop if the WebAudio backend isn't active.
- Verified live via Playwright: confirmed `combatMusicSource.{loop,loopStart,loopEnd}` are correct
  on a fresh mission launch (not just after Phaser's own asset cache warms up — the first check
  hit a test-harness timing gotcha, not a real bug: `window.__fireline` becomes available at
  `Phaser.Game` construction, well before the async preload that fetches/decodes combat.ogg
  finishes, so the test needed to wait for the actual signal instead of a fixed delay) and again
  after a scene restart (fresh node, same loop config, old node stopped cleanly on `SHUTDOWN`).
  Could not verify by ear whether 29.0s actually sounds seamless — that needs a real listen.

### 2026-09-04 (29) — Fixed laggy UI click sounds
- Player-reported: UI SFX (button clicks etc.) sometimes played noticeably late relative to the
  click. Root cause: `playUiSound()` (`src/audio/uiSound.ts`) called `new Audio(src)` followed
  immediately by `.play()` on *every single call* — building a fresh `HTMLAudioElement` forces the
  browser to fetch and decode the file from scratch before playback can start, paying that latency
  on every click, not just the first.
- Fixed by pre-creating and preloading one cached `Audio` element per sound file at module load
  (`preload = 'auto'`), so the fetch/decode happens up front during idle time; `playUiSound()` now
  just resets `currentTime` to 0 on the cached element and plays.
- Verified live via Playwright: instrumented the real `Audio` constructor to time from `.play()`
  call to the `playing` event actually firing (audible-frame latency, not just call overhead) —
  every play, including the first "cold" one, now fires within ~1ms, down from paying a full
  fetch+decode on each click before.

### 2026-09-04 (28) — Clickable rank list modal, weapon upgrades expanded to 10 levels/track
- The rank badge on the Main Menu is now clickable, opening a modal listing all 8 rank tiers
  (icon, name, XP threshold) with the player's current tier highlighted and marked "YOU" — a
  reference for where they stand and what's still ahead, not just the single current badge.
  Closes on backdrop click or the ✕ button (`RankListModal` in `MainMenu.tsx`).
- Expanded all 4 weapon upgrade tracks (Rounds, Cooling, Heat Capacity, Fire Rate) from 3 levels to
  10. The original 3 hand-picked values per track were already a near-exact fit for a formula —
  cost(n) = 50·(n²+n+1) for credits, and each stat's own ~1.2-1.25x-per-level geometric ratio for
  its effect — so levels 4-10 continue those same formulas rather than inventing new curves. Costs
  now run 150cr (L1) up to 5,550cr (L10); maxing one track costs 22,500cr total, all four costs
  90,000cr. See `src/game/data/upgrades.ts` for the exact per-level values.
- Updated the server-side mirror (`functions/src/upgradeCatalog.ts`, same cost formula) and
  redeployed Cloud Functions — `purchaseUpgrade`'s validation logic already walked `levels[]`
  generically (no track-length assumption), so this was a pure data change, no logic change.
- Verified live end-to-end via Playwright against the local emulator suite: rank modal opens with
  all 8 rows and exactly one "YOU" marker on the correct current tier, closes on backdrop click;
  Upgrades screen renders 10 dots per track cleanly at a 375px mobile viewport with no overflow;
  a real purchase (via a debug-hook-forced mission completion for test credits, then buying Rounds
  level 1) went through the actual rebuilt Cloud Function, deducted the right cost, filled the
  first dot, and updated the button to the level 2 price — confirming client/server catalogs agree
  end to end, not just that they match on paper.

### 2026-09-04 (27) — Hit-flinch reaction on non-lethal hits
- Enemies previously gave zero visual feedback on a hit that didn't kill them — nothing happened
  until the health bar ticked down, unlike the death animation's clear payoff on a kill. Added a
  brief flinch reaction (`Enemy.playHitFlinch()`): a white flash via Phaser 4's `setTint(0xffffff)
  .setTintMode(TintModes.FILL)` (the documented way to flash a sprite white on a hit) plus a quick
  scale "punch" tween on the sprite.
- Purely procedural, no new art — applied uniformly to every enemy type/texture (humanoid,
  vehicle, drone, coastal boat reskin alike), unlike the walk cycle which only exists for the 4
  humanoid types.
- The punch tween runs on `sprite.scaleX/Y`, never on `container.scale` — the container's scale is
  rewritten every frame by `update()` from the enemy's approach progress, so a tween on it would
  just get overwritten the next tick. Runs independently of the walk-cycle animation (tint/scale
  vs. `sprite.play()`), so a flinch mid-walk doesn't interrupt the walk loop.
- Verified live end-to-end via Playwright against a real signed-up account on the local emulator
  suite (this session didn't have the `pw-verify` live-site credentials — see prior entry): loaded
  a mission, called `playHitFlinch()` on a live enemy, and confirmed via `sprite.isTinted`
  (`false` → `true`, `tintMode: 1`/FILL) plus a direct before/after screenshot that the sprite
  visibly flashes solid white. Also confirmed the scale punch returns cleanly to baseline after
  the tween (0.4375 → 0.516 → 0.4375) and that a humanoid's walk animation keeps playing
  uninterrupted through a flinch.

### 2026-09-04 (26) — Rank badge system (8 tiers, XP-based)
- Added an 8-tier military rank system (Recruit → Private → Corporal → Sergeant → Lieutenant →
  Captain → Major → Colonel), driven by the `xp` field already tracked on `PlayerProfile` — no
  backend changes needed, this is purely a new client-side display over existing data.
- Thresholds (`src/game/data/ranks.ts`) are spaced against the real reward math (`xpEarned ===
  score` server-side): a full mission clear nets roughly 1,000-4,500 XP depending on the
  operation, so early tiers clear in a handful of missions and later tiers take many more.
- Generated 8 PixelLab insignia icons following real military rank progression (blank patch →
  chevrons → bars → oak leaf → eagle) so each tier reads as a clear step up from the last — see
  [ART_ASSETS.md](ART_ASSETS.md) for the full table and job IDs.
- Shown on the Main Menu (`RankBadge` in `MainMenu.tsx`): icon, rank name, and a progress bar with
  "N XP to [next rank]", or just the badge once Colonel (max tier) is reached.
- Verified the threshold/progress math at every tier boundary via a scratch script (all correct)
  and confirmed all 8 icons are valid 64×64 PNGs that load through the dev server. Did **not**
  verify the live on-screen layout against a signed-in account — this session didn't have the
  `pw-verify` test account's credentials on hand. Worth a quick look next time the site's open.

### 2026-09-04 (25) — Character API walk-cycle prototype, rolled out to 4 humanoid enemy types
- Prototyped the PixelLab **Character API** (`create_character` v3 mode, using each enemy's
  existing sprite as a reference image) on infantry first, to evaluate quality/cost before
  committing further — per an earlier open design question about Character API vs Object API.
  Quality was excellent (faithfully preserved the original design) and cost was low (~9
  generations per type for a full 8-direction character + 8-direction walk cycle).
- Decided against full 8-direction rollout: enemies close in almost straight toward the viewer in
  this game, so 7 of 8 generated directions would rarely be seen — not worth the extra cost/
  complexity. Rolled out a **south-only looping walk cycle** instead, replacing the single static
  frame enemies previously sat on for their entire approach.
- Applied to the 4 **humanoid** enemy types only (infantry, gunner, rocket, commander) — the
  Character API doesn't support vehicles/aircraft, so technical/armored/drone keep their existing
  static Object API sprites (fine, since those don't need a walk cycle the way a soldier does).
- Verified live: walk animation confirmed actively playing during approach, cleanly interrupted by
  the existing death animation on kill, and confirmed **not** applied to coastal boat-reskinned
  enemies (which reuse these same 4 type IDs but render as boats — the walk frames are soldier
  art, so `Enemy.ts` gates playback on the actual texture key in use, not just the enemy type).
  See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (24) — Music re-encode, escort vehicle orientation correction
- Music tracks re-encoded 128kbps (from ~500kbps): `menu.ogg` 6.9MB → 2.0MB, `combat.ogg` 4.2MB →
  1.1MB, same duration to the millisecond. Used `ffmpeg-static` (npm-installable, scratch-installed
  and removed after — not a project dependency), verified by loading both through the real dev
  server into an `<audio>` element rather than trusting ffmpeg's own decode check alone. See
  [AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md).
- Escort vehicle was actually facing backwards after the aerial-angle regeneration — the cab sat
  toward the bottom of the frame (south/toward the viewer), a misjudgment when reviewing that
  generation, not the intended fix. Corrected with a deterministic 180° rotation (`sharp`, same
  scratch-install-and-remove pattern) rather than another AI re-roll, since the needed fix was an
  exact transform. See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (23) — Mission-end sting respects music volume, bigger enemies again, escort vehicle aerial angle
- **Real bug found and fixed:** the earlier music-hydration-race fix didn't cover the reported
  "music still plays after an operation finishes" case — traced with debug logging through the
  full mission-completion flow and found the actual source: `mission_complete`/`mission_failed`
  (musical-sounding synth stings, played via `playUiSound` on the result screen) were volume-gated
  by `sfxVolume`, not `musicVolume`. A player who muted music but left SFX volume up would still
  hear that sting at full SFX volume right at mission end — technically "honoring settings"
  (SFX volume was respected), but not matching what a player experiences as "music." Reclassified
  those two sounds to respect `musicVolume` instead, in `uiSound.ts`. Verified via debug logging:
  `playUiSound mission_complete appliedVolume= 0` with music muted, even with SFX volume left at
  its default 0.8.
- Enemies spawn another 50% larger again (`SPAWN_SCALE` 0.525 → 0.7875 in `Enemy.ts`), same
  unchanged growth-as-it-approaches curve as before, so impact size grows too, not just spawn
  size. Second bump on top of the earlier +50% (0.35 → 0.525 → 0.7875 total).
- **Escort vehicle art fixed again:** the previous regeneration fixed the *facing* direction but
  came out as a flat, straight-on rear-elevation shot rather than the aerial/top-down angle the
  rest of the game's ground objects use. Regenerated with `view="high top-down"` (more overhead
  than the `"low top-down"` used elsewhere, since the text description alone wasn't pulling the
  angle overhead enough on the prior attempt) — now shows the roof and cargo bed from above,
  matching "flying over the top of it." See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (22) — Main Menu: sign-out confirmation, subtler Credits link
- Sign out is now a `.btn-danger` (red-outlined) button that requires confirmation — click shows
  "Sign out of your account?" with Cancel/Confirm, matching the existing confirm-before-destructive-
  action pattern already used for Settings' "Reset progress." Previously a single click signed out
  immediately with no confirmation.
- Credits (the attribution screen, not the player's in-game currency shown in the stats line) is
  now a small underlined text link below the Sign Out button instead of a full icon+button in the
  Upgrades/Settings row — de-emphasized since it's a low-priority, legally-required-but-not-primary
  nav item.

### 2026-09-04 (21) — Fourth hand-authored mission (jungle), Mission Select icons
- **Operation Green Hell** — a Rescue-type mission using the jungle landscape, closing the gap
  where jungle only existed for procedural missions. 4 waves (Undergrowth Contact → Flanking
  Patrol → River Crossing → LZ Secure), `no-damage` secondary objective (+95 credits), warm dusk
  sky tint chosen to pair with the jungle backdrop's own baked-in sunset. Added to both
  `src/game/data/missions.ts` (client) and `functions/src/missionCatalog.ts` (server-side reward
  bounds — required, or `submitMissionResult` would reject it as an unknown mission). Verified
  live against the emulator: mission completes, records correctly, bonus objective credits land.
- **Mission Select icons:** each of the 4 hand-authored missions now shows a PixelLab icon
  (crosshair/dunes, shield/truck, distress beacon, moon/ladder — one per operation's theme), plus
  a fixed die-with-question-mark icon on the procedural mission card. Same visual treatment as the
  Upgrades screen's track icons. See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (20) — Fix mobile-landscape canvas mis-centering
- **Real bug found and fixed:** on mobile landscape (any phone aspect wider than the game's fixed
  16:9 world — most of them), the combat canvas wasn't centered — noticeably more black space on
  the left than the right. Root cause: `.game-canvas`'s CSS (`display: flex; align-items: center;
  justify-content: center`) and Phaser's own `Scale.FIT` + `CENTER_BOTH` centering (an inline
  margin on the `<canvas>` element) were both trying to center the canvas at once — the flexbox
  re-centered the canvas's already-margined box, landing it off-center. Invisible on a ~16:9
  desktop viewport (Phaser's own margin is ~0 there, so there's nothing for the flexbox to
  conflict with) — only shows up when Phaser actually needs a real centering margin, i.e. mobile
  landscape. **Not a regression from this session's portrait/landscape work** — traced via
  `git log -S` to the original scaffold commit (`23c3bec`); it just never got exercised by real
  mobile-landscape testing until now. Fixed by removing the redundant flex-centering from
  `.game-canvas` — Phaser's own centering is sufficient on its own. Verified via Playwright on an
  844×390 landscape viewport: canvas is now symmetrically centered (75px black bar each side,
  matching the expected FIT-letterbox math exactly) instead of the previous 112.8px/37.9px split.
- Some letterboxing on the sides is still inherent to keeping a fixed 16:9 world on phone aspect
  ratios wider than that (most of them) — this fix corrects the *centering*, not the remaining
  gap itself. Eliminating that entirely would mean a bigger change (dynamic world width, or
  `Scale.ENVELOP` with its own crop-vs-HUD tradeoffs) — not attempted here, flagged as a possible
  follow-up if it's still wanted after seeing the corrected centering in person.

### 2026-09-04 (19) — Music volume hydration race, escort vehicle facing + movement
- **Real bug fixed:** menu music could briefly play at the default volume (0.6) on load even for a
  returning player who'd saved it at 0 — `playMusic()` fired on mount before the real setting had
  hydrated from Firestore. Fixed by gating it on the player profile actually being loaded
  (`App.tsx`'s music effect now depends on `profile`, not just `screen`). See
  [AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md).
- **Escort vehicle facing fixed:** the truck showed its cab/windshield toward the camera, reading
  as driving at the helicopter instead of traveling alongside it. Regenerated facing away
  (rear/tailgate toward the viewer). Checked the enemy vehicle sprites for the same class of
  issue — they're 3/4-profile shots that don't make a directional claim either way, so no
  mismatch there. See [ART_ASSETS.md](ART_ASSETS.md).
- Escort vehicle now also sways side to side (on a different tween period than its existing
  vertical bob) so it reads as doing something rather than sitting totally still.

### 2026-09-04 (18) — Larger enemy targets (mobile + desktop)
- Enemies now spawn 50% larger (`SPAWN_SCALE` 0.35 → 0.525 in `Enemy.ts`) and still grow the same
  amount on top of that as they approach (`APPROACH_SCALE_GROWTH` unchanged at 1.55) — player
  feedback that targets were hard to track/hit, especially on mobile. Hit-detection radius
  (`Enemy.containsPoint`) and the touch aim-assist radius (`CombatScene.applyTouchAimAssist`) both
  read `container.scale` directly rather than a hardcoded constant, so both grew in step
  automatically — no separate tuning needed there.

### 2026-09-04 (17) — Fourth landscape: jungle
- Added `jungle` as a 4th `LandscapeId` — ground tile + backdrop via PixelLab (dense foliage tile,
  palm-silhouette sunset skyline with birds), wired into `CombatScene`'s
  `LANDSCAPE_GROUND_FILE`/`LANDSCAPE_MOUNTAIN_FILE` maps and `generateMission.ts`'s `LANDSCAPES`
  pool. Procedural-only for now — no hand-authored mission uses it yet (Firebreak/Steel
  Convoy/Nightfall keep their existing desert/urban/coastal assignments). See
  [ART_ASSETS.md](ART_ASSETS.md).
- Confirmed the procedural generator already rolls a landscape independently of weather/mission
  type for every generated mission (`rng.pick(LANDSCAPES)` in `generateMission.ts`, unchanged
  logic, just a longer pool now) — this was already correct, not a new bug fix.
- Verified live: rerolled Mission Select until landing on jungle (using a temporary debug log to
  confirm which landscape a given reroll produced, removed before committing), launched it,
  confirmed the backdrop/ground/enemies all render correctly with zero missing-asset errors.

### 2026-09-04 (16) — Upgrade screen visual pass, coastal boat enemies, Escort ground vehicle
- **Upgrades screen:** each track now shows a PixelLab icon (bullet/snowflake/gauge/lightning bolt
  for Rounds/Cooling/Heat Capacity/Fire Rate) plus a per-track accent color on the card's left
  border, replacing the plain text list. A maxed-out track gets a gold border/tint instead of its
  normal accent. See [ART_ASSETS.md](ART_ASSETS.md).
- **Coastal boat reskins:** ground vehicles/infantry standing on open water read wrong, so every
  non-aerial enemy type (all but Drone) now gets a boat/watercraft texture swap on coastal
  missions (`COASTAL_BOAT_TYPES`/`enemyTextureKey` in `CombatScene.ts`) — same stats, same death
  animation as the land version, just the base sprite differs. Verified live on Operation
  Nightfall: multiple distinct boats visible on the water, zero missing-texture placeholders.
- **Escort ground vehicle:** `mission.type === 'Escort'` missions (Operation Steel Convoy today)
  now show a friendly, non-hostile-looking supply truck sitting in the mid-ground — sells the
  "you're escorting this convoy" premise instead of empty terrain. Purely decorative: never added
  to `this.enemies`, so it can't be targeted or damaged. Held roughly fixed on screen with a
  gentle bob (not a scroll), same reasoning the helicopter itself doesn't move on screen.
- **Process note:** a background subagent tasked with *only* generating the boat images went out
  of scope and also wrote the texture-swap logic into `CombatScene.ts` on its own initiative,
  colliding with the same code I was writing concurrently (`COASTAL_BOAT_TYPES` declared twice —
  a Vite parse error, caught immediately via a live Playwright check). Redirected the agent to
  images-only and removed its code; no lasting damage, but worth remembering that "just generate
  these assets" instructions don't reliably stop a capable agent from also wiring them up.

### 2026-09-04 (15) — Per-operation completion stats (times completed, highest difficulty)
- Added `players/{uid}/missionStats/{missionId}` — a small per-mission doc tracking
  `completions` and `highestDifficulty`, maintained server-side inside `submitMissionResult`'s
  existing transaction (only a `'complete'` outcome moves either field; a failed attempt at a
  higher difficulty doesn't retroactively claim it). `MissionResult` gained a `difficulty` field
  (sourced from `audioSettings.difficulty`) so the server has something to compare against.
- The Function now returns the operation's updated `completions`/`highestDifficulty` in its
  response, so the result screen can show them immediately without a second read racing the
  write. `recordMissionResult` (client) returns that; `loadAllMissionStats` bulk-fetches the whole
  `missionStats` collection once per sign-in (a handful of small docs — cheaper than N per-mission
  listeners) for Mission Select's per-card display.
- Shown on **both** the result screen ("This operation: completed 2× · highest difficulty
  Normal") and Mission Select (a line under each hand-authored mission's blurb) — the random
  mission doesn't get one, since it gets a fresh id every reroll and has no persistent identity to
  accumulate history against.
- `resetProgress` now also wipes `missionStats` alongside `missionResults`, so "reset my save"
  doesn't leave stale completion counts behind. Extracted the batched-delete-a-collection loop
  into a shared `deleteAllDocs` helper (previously inlined, now used twice).
- **Verified against the Local Emulator Suite**: forced two `endMission('complete')` calls and one
  `endMission('failed')` via a temporary debug hook (reverted after) — completions correctly went
  0→1→2, highest difficulty tracked correctly, and the failed run left both fields unchanged.
  Confirmed live on both the result screen and Mission Select. Caught and fixed a real gotcha in
  the process: the Functions emulator was silently serving a **stale compiled `functions/lib/`**
  (only watches for file changes, doesn't run `tsc` itself) — `npm run build` inside `functions/`
  is required after editing `functions/src/*.ts` for local testing to reflect the real change.

### 2026-09-04 (14) — Second half of the App Check fix: wrong GCP project for the site key
- The provider swap in the entry below fixed the client/Console *provider* mismatch (confirmed by
  the exchange call correctly switching to `exchangeRecaptchaEnterpriseToken`), but live
  verification turned up a **second, independent bug**: the exchange now failed with `"Unable to
  call the reCAPTCHA Enterprise CreateAssessment method; ensure that the reCAPTCHA Enterprise API
  is enabled and that the site key is from the same project as the one containing this app."`
- **Root cause:** the reCAPTCHA Enterprise key lived under a completely different, unrelated
  Google Cloud project (`fireline-507502`) than the actual Firebase project (`fireline-lf`,
  project number `643236089836` — confirmed via `firebase projects:list`, which doesn't list
  `fireline-507502` at all). App Check's `CreateAssessment` call requires the key to be in the
  *same* GCP project as the Firebase app; a key from any other project fails outright regardless
  of whether the reCAPTCHA Enterprise API is enabled there. Likely cause of the mixup: Cloud
  Console's project switcher had two entries both display-named "fireline" (only distinguishable
  by the Project ID field), and Cloud Console's raw navigation kept defaulting to the wrong one.
- **Fix:** created a new reCAPTCHA Enterprise key directly under `fireline-lf` (via a
  `?project=fireline-lf`-scoped Console link to force past the project-switcher ambiguity),
  domain `lanternforgestudios.github.io`, score-based. Swapped the new key into
  `RECAPTCHA_ENTERPRISE_SITE_KEY` in `src/firebase/config.ts`.
- **Verified live, end to end:** the App Check exchange now returns `200` with a valid token
  (`"provider":"recaptcha_enterprise"`, correct project audience, 1hr TTL) — confirmed via a
  direct network-response check against the deployed site. Player-confirmed after: completed a
  mission on the live site and credits/XP landed correctly. This also unblocks `resetProgress` and
  `purchaseUpgrade`, which were failing for the same underlying reason.
- **Unrelated, same-session cleanup:** also bumped the deploy workflow's pinned GitHub Actions
  (`checkout` v4→v7, `setup-node` v4→v7, `configure-pages` v5→v6, `upload-pages-artifact` v3→v5,
  `deploy-pages` v4→v5) to clear a "Node.js 20 actions are deprecated" warning — all had already
  migrated to the Node 24 runtime in their latest majors (GitHub is removing Node 20 support
  2026-09-23). No behavior change for this workflow's simple usage of each.

### 2026-09-03 (13) — Fix App Check provider mismatch breaking all progression on the live site
- **Real, live-site-breaking bug found and fixed.** Reported symptom: "completed a mission,
  earned no credits" — investigation showed it was much bigger than credits: App Check's
  reCAPTCHA token exchange was failing on the live site
  (`content-firebaseappcheck.googleapis.com/.../exchangeRecaptchaV3Token` → 400 `"App not
  registered: 1:643236089836:web:81b5e92d625b0096c53ac9."`), and since deployed Cloud Functions
  enforce App Check (`enforceAppCheck: !isEmulator` — see the Backend detail table above), that
  meant **every** call to `submitMissionResult`, `resetProgress`, and `purchaseUpgrade` was being
  silently rejected in production, for every player, since Functions started enforcing it. The
  client swallows the failure with `.catch(console.error)` (`App.tsx`), so nothing ever surfaced
  it — no error toast, nothing. Not new from this session's changes; this had already been
  live-broken.
- **Root cause:** the client was initializing App Check with `ReCaptchaV3Provider`, but the app
  is registered in Firebase Console -> App Check -> Apps under **reCAPTCHA Enterprise**, not the
  (now-deprecated) v3 provider — a provider/registration mismatch fails token exchange outright.
  Firebase requires the client SDK provider to match what's registered for the app: v3 talks to
  `exchangeRecaptchaV3Token`, Enterprise to `exchangeRecaptchaEnterpriseToken`, and Console only
  accepts tokens from the one actually registered.
- **Fix:** `src/firebase/config.ts` now uses `ReCaptchaEnterpriseProvider` in place of
  `ReCaptchaV3Provider` (same site key — `firebase/app-check`'s Enterprise provider takes an
  Enterprise score-based site key with the same `6L...` shape, and Console confirmed this one is
  registered as Enterprise). Couldn't fully reproduce the fix locally (dev mode routes through the
  App Check *debug*-token exchange instead of the real reCAPTCHA flow, and the Enterprise site
  key's domain allowlist likely only covers the production domain anyway) — verify live after
  deploy: sign in on the live site, complete or fail a mission, confirm credits/XP actually land
  in the player profile.

### 2026-09-03 (12) — Easy-mode difficulty tuning, desktop touch-pad visibility, mobile portrait fix
- Easy mode now also boosts aircraft max health (130 instead of 100) and slows enemy return fire
  (`fireIntervalMult`) — previously only enemy health/damage were softened, and player feedback
  was that even easy felt punishing. `DIFFICULTY_MULTIPLIERS` gained `fireIntervalMult` and
  `aircraftHealthMult` alongside the existing `health`/`damage` factors.
- Touch pads are functionally touch-only already (`engagePad` only fires for touch pointers) —
  they're now also visually hidden on devices with no touch support (`supportsTouch()` check in
  `CombatScene.buildPadSide`), instead of sitting idle over a mouse player's view.
- **Mobile portrait fix:** the combat view is a fixed 1280×720 (16:9) world with `Scale.FIT` —
  on a tall/narrow phone held in portrait, FIT's scale is capped by the *width*, so the canvas
  shrank to a small strip with huge empty space above/below (exactly the reported "battle screen
  much smaller in portrait" symptom). Rather than re-tuning every gameplay position constant
  (`HORIZON_Y`, `IMPACT_Y_RANGE`, `GUN_ORIGIN`, `TOUCH_PAD_Y`, etc.) to a dynamic aspect ratio,
  touch devices held in portrait during combat now get a "Rotate your device to landscape to fly"
  overlay (`GameCanvas.tsx`), with the Phaser scene paused underneath (`game.scene.pause`) until
  they rotate back — matches the genre convention for landscape-only mobile games, and avoids
  touching the many already-tuned position constants. Verified via Playwright with iPhone 13
  device emulation: prompt shows in portrait, scene pauses; rotating to landscape resumes and the
  canvas fills the viewport properly (thin top/bottom bars from the aspect mismatch, not the
  previous large empty strip).
- **Local dev note (not a shipped bug):** while investigating a "no credits earned" report, found
  the Local Emulator Suite's Cloud Functions emulator can fail to load function definitions on
  boot (`Cannot determine backend specification. Timeout after 10000ms` — an intermittent
  discovery-timeout flake, not a code issue; the compiled `functions/lib/index.js` loads fine
  standalone). When that happens, `submitMissionResult` never registers, so every mission-complete
  call to it fails — silently, since `App.tsx`'s `recordMissionResult(...).catch(console.error)`
  has no user-facing surface for that failure. Restarting the emulator suite clears it. Doesn't
  affect the deployed production Functions. Worth revisiting whether that catch should surface
  something to the player (a toast, a retry) rather than failing invisibly, even for the rarer
  real-world case (e.g. a dropped connection) — not done here since it's speculative UX scope
  beyond this session's reported bug.

### 2026-09-03 (11) — Enemy death animations + landscape variety (coastal, urban)
- Replaced the placeholder scale-up-and-fade death effect with real PixelLab animations for all 7
  enemy types (`animate_object`, 7 frames each — see [ART_ASSETS.md](ART_ASSETS.md)). Required
  converting each enemy's visual from a Phaser `Image` to a `Sprite` (`Enemy.ts`) so it can play an
  animation, and registering each `${id}-death` AnimationManager entry once per texture load
  (`CombatScene.buildEnemyAnimations`, guarded with `this.anims.exists()` since the
  AnimationManager is shared/global across scene restarts, not per-scene).
- Added 2 new landscapes (coastal, urban) alongside desert — each with its own ground tile
  (`create_tiles_pro`) and backdrop (`create_image_pixflux`). `landscape` is now its own field on
  `MissionTheme`, independently rolled from weather for procedural missions
  (`generateMission.ts`), and hand-picked per hand-authored mission to match its narrative (desert
  for Firebreak, urban for Steel Convoy, coastal for Nightfall).
- Caught and fixed a real bug before it shipped: initially planned to keep the ground/mountain
  texture keys fixed and just repoint `preload()` at a different file per mission — would have
  silently broken, since Phaser's texture cache skips reloading an already-existing key across
  scene restarts. Fixed by making the keys landscape-specific
  (`` `ground-art-${landscape}` ``/`` `mountains-art-${landscape}` ``).
- **Verification note:** after deploying, a live Playwright sweep-and-fire test repeatedly
  registered 0 kills, which initially looked like a real regression from the Image→Sprite swap.
  Root-caused with a targeted diagnostic instead (a temporary `window.__fireline` debug hook in a
  local dev build, calling `handleFiring()` with the crosshair forced exactly onto a live enemy
  and damage forced lethal) — the kill path (`containsPoint` → `takeDamage` → removal →
  score/`enemiesDestroyed`) fired correctly on the first try. The 0-kill sweep results were an
  artifact of the automated test's blind mouse-sweep aiming against small, fast-moving targets,
  not a code bug. No production code changed as a result; the debug hook was reverted after use.

### 2026-09-03 (10) — Enemy return-fire projectiles + touch aim assist
- Enemies that already fired back (gunner, rocket, technical, armored, commander) now launch a
  visible tracer bolt (`spawnEnemyProjectile`, distinct red/orange tint and additive blend from the
  player's own pale-yellow tracer) that travels from the enemy to the gun mount and applies damage
  on arrival rather than instantly on trigger — gives the player a beat to react/reposition instead
  of taking unavoidable instant damage.
- Added touch-only aim assist: while dragging the touch pad, the crosshair gets pulled toward the
  nearest enemy within a small bonus radius (`applyTouchAimAssist`, `AIM_ASSIST_RADIUS_BONUS` /
  `AIM_ASSIST_STRENGTH`), addressing reported difficulty tracking fast-closing targets on mobile.
  Mouse aiming is untouched (still direct 1:1 cursor position).

### 2026-09-03 (9) — Menu icons + rotor flicker / dust kickup VFX
- Added PixelLab-generated icons to the Main Menu's Upgrades/Settings/Credits buttons.
- Added rotor-blade flicker and ground dust kickup VFX to combat (both procedural, no new art) —
  live-verified in an actual mission via Playwright.

### 2026-09-03 (8) — Playwright self-verification, 4 real mobile bugs found and fixed
- Added `playwright` as a devDependency and a real test account
  (`pw-verify@lanternforgestudios.dev`) on the live Firebase project, purpose-built for
  screenshot-based self-verification instead of relying on hand-checking every change. Running it
  against the **live GitHub Pages site** (not a local `vite preview`, which turned out to silently
  mis-serve `/Fireline/`-base-path assets and isn't representative of the real deploy — see the
  scratch investigation notes in this session if that ever needs revisiting) at a 375×667 mobile
  viewport immediately paid for itself: found 4 real, previously-unverified UI bugs in one pass:
  1. `.title` ("FIRELINE") was a fixed `4.5rem` — wider than a phone screen, dragging the whole
     Main Menu into horizontal overflow. Fixed with `clamp(2.5rem, 11vw, 4.5rem)`.
  2. `.menu-icon-row` (Upgrades/Settings/Credits buttons) had no wrap, contributing to the same
     overflow. Added `flex-wrap: wrap; justify-content: center;`.
  3. `.upgrade-track-list` had its own nested `max-height: 22rem; overflow-y: auto` *inside* the
     already-scrolling `.screen` — a double-scroll container that clipped the last upgrade card
     with no visible indicator there was more below. Removed the inner scroll; one is enough.
  4. Mission Select's "Randomly Generated · <type>" header text was colliding with the wave count
     on wrap. Changed `.mission-list-header` to `align-items: flex-start` with a dedicated flexible
     `.briefing-type` and non-shrinking `.hud-label`, and glued the separator dot to "Generated"
     with a non-breaking space so it doesn't end up alone on its own line.
  Also found and fixed a 5th, non-CSS bug: the procedural mission name generator's word pool still
  included `Firebreak`/`Steel Convoy`/`Nightfall` — the exact names of the 3 hand-authored missions
  — so it could (and did) generate a mission literally called "Operation Nightfall" with unrelated
  content. Removed those 3 words from `NAME_WORDS` in `briefingTemplates.ts`.
- **Verified against production** (all screenshots taken against the live site after each deploy,
  not assumed from reading the CSS): confirmed `document.documentElement.scrollWidth ===
  clientWidth` (no horizontal overflow) on Main Menu, Upgrades, and Mission Select at 375px width;
  confirmed the Upgrades list's last card and its scroll-to-bottom content are both fully visible;
  confirmed generated mission names no longer collide with the hand-authored 3.

### 2026-09-03 (7) — Secondary objectives (closes GDD Phase 3)
- Every mission — the 3 hand-authored and every procedurally generated one — now has a
  `secondaryObjective`: `no-damage` (finish without the aircraft taking any damage) or
  `clean-sweep` (destroy every enemy spawned, let none reach the helicopter), paying a credit
  bonus on top of the normal reward. Only awarded on a `complete` outcome — a failed mission
  doesn't get partial credit for "would have kept the streak."
- `CombatScene` tracks it live (`noDamageTaken`/`totalEnemiesSpawned`) and reports
  `secondaryObjectiveComplete` in the `MissionResult`. `submitMissionResult` re-checks this
  server-side against its own bounds catalog rather than trusting the client's flag — same model
  as everything else progression-related. Generated missions get a bonus scaled to the mission's
  real max score (~20% of a hypothetical full-clear's credits); the server-side fallback for
  `random-*` ids uses the same generous ceiling the rest of that validation already relies on.
- Mission Briefing shows the objective before launch; Result Screen shows whether it was met and
  what it paid.
- **Verification note:** confirmed via two clean `tsc` compiles (frontend and functions) and a
  clean predeploy build at actual deploy time, but **not** via a live emulator round-trip test —
  unlike `submitMissionResult`'s and `purchaseUpgrade`'s original verification, both of which were
  exercised end-to-end against the Local Emulator Suite. The system was under heavy, sustained I/O
  load this session (git, npm, even PowerShell process queries were all taking 10-100x longer than
  normal) and the Functions emulator's 10-second discovery timeout failed twice in a row before
  the user reasonably suggested backing off rather than keep retrying against a struggling machine
  — this is a real gap versus the confidence level of the prior two features, not a formality. The
  change is small and additive (new fields on already-verified functions, same patterns) rather
  than new logic shape, which is why it shipped anyway rather than blocking on re-verification —
  but a live check (buy the objective in a real mission, confirm the bonus lands) is worth doing
  when convenient.

### 2026-09-03 (6) — Dual touch pads, mobile layout fixes
- Touch aim pad now exists on **both** screen edges simultaneously instead of a single side chosen
  via a settings toggle — only one is ever live (touching one while the other's engaged is
  ignored), so the player switches sides just by using the other thumb, no menu trip. Removed
  `settings.controlSide` entirely (was the previous session's answer to the same underlying need).
- Fixed two real mobile layout bugs: `body { overflow: hidden }` with no scroll container anywhere
  meant tall screens (Mission Select, with 4 mission cards) just clipped with no way to reach the
  rest; and `100vw`/`100vh` on `.app-root` (a known mobile-browser over-reporting trap) was pushing
  content past the real screen edges. See docs/AUDIO_AND_POLISH.md for the full fix detail — both
  reasoned through from the CSS, not verified on a physical device this session.

### 2026-09-03 (5) — Weapon upgrades (loadout system)
- Closed the gap noted since the first Firebase pass: `unlockedUpgrades` existed in the data model
  from the start but nothing ever wrote to it, and credits earned had nowhere to spend.
- `src/game/data/upgrades.ts` — 4 tracks (damage, cooling, heat capacity, fire rate) × 3 levels,
  `computeWeaponStats(unlockedUpgrades)` derives the effective weapon stats. `Weapon.ts` now takes
  a `WeaponStats` constructor arg instead of hardcoded constants.
- `functions/src/upgradeCatalog.ts` + `purchaseUpgrade` callable — same server-owns-progression
  model as `submitMissionResult`: validates cost, in-track level ordering, and current credits
  against the player's actual Firestore state inside a transaction (so a double-click can't spend
  the same credits twice). **Verified end-to-end against the emulator** with 5 scenarios (buy
  successfully, skip-ahead rejected, duplicate rejected, afford-check rejected on a second
  purchase) — all matched expected balances and error messages exactly.
- New `src/game/playerLoadout.ts` (same live-mirror-for-Phaser pattern as `missionState`/
  `audioSettings`) and a Main Menu → Upgrades screen. Mission Briefing's loadout line now reflects
  what's actually owned instead of a static "Door Gun (M134)" string.
- Deliberately built as permanent account-level upgrades to one persistent M134, not a "choose
  between different guns" system — matches the GDD's "select loadout" + "upgradeable weapons"
  language more directly than adding weapon variety would have, and reuses the mission-reward
  security model instead of inventing a new one.
- Not balanced against real play — see docs/AUDIO_AND_POLISH.md.

### 2026-09-03 (4) — Procedural mission generation (GDD Phase 3, first pass)
- **New `src/game/generation/` module:**
  - `rng.ts` — seeded PRNG (mulberry32); a given seed always produces the same mission
  - `threatCost.ts` — per-enemy-type budget cost (derived from scoreValue, kept separate so budget
    tuning can diverge from score tuning)
  - `encounterBlocks.ts` — ~10 small composable enemy-group patterns ("Drone Swarm", "Armor Push",
    "Commander Detail", etc.), each with a threat cost and a `minWaveIndex` gate so heavy blocks
    only show up in later waves — this is the GDD's "encounter blocks"
  - `waveGenerator.ts` — assembles blocks into a wave until its threat budget (ramping per wave
    index, GDD's "threat budgets") is spent; wave *names* only get picked from options that match
    what's actually in the wave (no more "Commander Sighted" on a wave with no commander)
  - `weatherThemes.ts` — 5 sky/mountain/ground presets (Clear, Dust Haze, Dusk, Dawn, Overcast),
    same `MissionTheme` shape the 3 hand-authored missions use. Visual/mood only this pass, not
    gameplay-affecting — a real "weather affects visibility/spawn rate" system is a follow-up
  - `briefingTemplates.ts` / `generateMission.ts` — picks a mission type (now actually using
    Rescue/Base Defense/Reconnaissance, previously unused — only 3 of the GDD's 6 types had
    hand-authored missions), briefing text, wave count (4-6), and assembles the above into a
    `MissionDef` with id `random-<seed>`
- **Tuning note:** first generated batch had a wave with 20 enemies (vs. 7 max in any
  hand-authored wave) — cheap blocks could stack past any reasonable budget. Added a
  `MAX_SPAWNS_PER_WAVE` cap (12) and eased the budget growth curve; re-tested, enemy counts landed
  in the 16-40 total range (hand-authored Firebreak is 28). Only logic-tested via a throwaway
  script, not actually played — pacing/difficulty will likely want another tuning pass once
  someone's actually played a few generated missions.
- **MissionSelect** now has a 4th "Randomly Generated" card alongside the 3 hand-authored missions,
  with a reroll button. Picking it flows through the exact same `missionState`/briefing/combat path
  as any other mission — no special-casing needed elsewhere.
- **Server-side validation gap closed:** `submitMissionResult`'s bounds check only knew about the 3
  static mission ids — every procedurally generated mission would have been rejected outright as
  "Unknown mission." Added a fallback in `functions/src/missionCatalog.ts`: for any `random-*` id,
  a generous-but-finite ceiling derived from the generator's own caps (6 waves × 12 enemies × the
  highest-value enemy type = 43200), rather than porting the whole seeded generator into the
  Functions package as a second implementation that could drift from the client's. **Verified
  end-to-end against the emulator** (see the Cloud Functions log entry above) — a fake submission
  claiming score 99999999 got clamped to exactly 43200, confirming the math and the wiring both
  work, not just that they compile.
- Per user request: made both Cloud Functions skip `enforceAppCheck` specifically when running
  under the Local Emulator Suite (`FUNCTIONS_EMULATOR` env var, set automatically, never true in a
  deployed function) — there's no local App Check emulator, so enforcing it locally would only
  mean every dev machine needs a working, registered debug token for no real security benefit.

### 2026-09-03 (3) — Trackpad rework, control-side setting, local emulators, functions App Check
- **Touch aim reworked again**, per direct feedback that the rate-based virtual-stick pad (v1 of
  the pad, previous entry) still felt imprecise/chaotic. Rebuilt to behave like a laptop trackpad
  instead: crosshair moves by the finger's *movement* (delta) each frame, scaled by
  `TOUCH_PAD_SENSITIVITY`, not by how far the finger sits from a center point — movement stops the
  instant the finger stops, and there's no "still deflected so still drifting" fight for precise
  placement. See `TOUCH_PAD_SENSITIVITY`/`updatePadDrag` in `CombatScene.ts`.
- Added `settings.controlSide` ('left'/'right') so the pad can sit on whichever side the player's
  aiming thumb actually is — Settings screen, Firestore-backed like every other setting.
- **Set up the Firebase Local Emulator Suite** (`npm run emulators`, `firebase.json`
  `emulators` block, `src/firebase/config.ts` connects to it in `import.meta.env.DEV`). Hit and
  fixed two real problems getting there, worth remembering:
  - Default emulator ports (9099/8080/4000/etc.) collided with a **different** project's
    (`forgotten-wilds`) emulator already running on this machine — moved Fireline's to non-default
    ports (9199/8180/5101/4100/4410/4510) rather than touching that unrelated process.
  - The Functions emulator failed to load our functions at all ("Cannot determine backend
    specification. Timeout after 10000") — `firebase-functions@6.6.0` was too far behind the
    installed `firebase-tools@15.22.4` CLI's discovery protocol. Upgraded to
    `firebase-functions@^7.3.2` / `firebase-admin@^13.10.0` (not the very latest `firebase-admin@14`,
    which requires Node ≥22 — we're targeting Node 20 for the deployed functions runtime).
    Re-deployed to production afterward to confirm the upgrade didn't break the live functions too.
- Enforced App Check on `submitMissionResult`/`resetProgress` (`enforceAppCheck: true`, deployed).
  Firestore/Auth-level enforcement is still Monitor mode — see the backend checklist above.
- Per-mission theming (previous entry): confirmed it's genuinely GDD Phase 2 polish, not Phase 3 —
  hand-authored per-mission mood, not generated. Phase 3 (procedural) is still the next real
  milestone.

### 2026-09-03 (2) — Per-mission visual theming, score popups, boot-hang hardening
- Each mission now has a `theme` (sky gradient, mountain/ground tint) — previously all three
  looked identical apart from wave composition. Firebreak stays the baseline midday look, Steel
  Convoy is hazier/dustier, Nightfall is a dusk palette matching its name. Mission Select shows
  each mission's mood as a left-border accent color.
- Added floating "+score" popups on enemy kill (drift-up-and-fade text) — more combat feedback
  beyond the HUD counter ticking.
- **Reported a live "black screen" after a successful deploy** — resolved on its own on retry
  (glad it wasn't stuck), but the underlying UX gap is real: `App.tsx`'s `!authChecked` guard
  rendered a bare empty `<div>` with zero feedback while waiting on Firebase Auth's initial state
  resolution, which depends on a network round-trip (and, with App Check involved, a reCAPTCHA
  token fetch). If that hangs for any reason, the player just sees nothing, indefinitely, with no
  way to tell "loading" from "broken." Added a visible loading state plus a 10s timeout that shows
  a reload prompt instead of hanging forever. **Root cause not confirmed** — App Check enforcement
  was verified still in Monitor mode (never touched via API), most likely a transient CDN/network
  delay on first load. Worth watching for recurrence.

### 2026-09-03 (1) — Server-side reward validation (Cloud Functions)
Firebase Blaze plan is set up, unblocking this. Closes the tampering gap noted in every earlier
entry below: previously a signed-in player could open devtools and call the client SDK directly
with an inflated `MissionResult`, since rewards were computed and written entirely client-side.

- `functions/` (new Firebase Functions v2 TypeScript project) — `submitMissionResult` and
  `resetProgress`, both callable, both deriving `uid` from the caller's auth token (never a
  client-supplied value)
- `submitMissionResult` validates the submitted mission id against a server-side mission/enemy
  catalog (`functions/src/missionCatalog.ts` — hand-kept in sync with
  `src/game/data/missions.ts`/`enemyTypes.ts`, not shared code, since Functions deploy as a
  separate package from the Vite frontend) and **clamps** (not hard-rejects) score/waves/enemies
  to that mission's real bounds before computing XP/credits and writing — clamping rather than
  rejecting so a legitimate run that hits an edge the catalog didn't anticipate still gets
  recorded, just capped, instead of silently dropping a real player's result
- `resetProgress` replaces the old client-side reset (zeroes progression + batch-deletes mission
  history, same as before, just server-side now)
- `firestore.rules`: `players/{uid}` create is only allowed with all progression fields at zero
  (can't plant an inflated starting profile), update is restricted to the `settings` field only,
  and `missionResults` is client-read-only, write blocked entirely — Cloud Functions write via the
  Admin SDK, which isn't subject to these rules
- Settings screen: resetting progress now requires typing the account's email to confirm
  (previously just a two-click confirm) — this is a real "delete my data" action now that it's
  backed by a Function, not just a client zeroing its own doc
- Deployed: `firebase deploy --only functions,firestore:rules,firestore:indexes`, plus
  `firebase functions:artifacts:setpolicy` (1-day image retention, otherwise container images from
  every future functions deploy accumulate storage cost indefinitely)
- **Not done yet:** the callable functions aren't App Check-enforced (`enforceAppCheck` unset) —
  matches the app's current Monitor-mode posture everywhere else, but means this is a good next
  target once App Check enforcement gets turned on generally
- **Not done yet:** `functions/src/missionCatalog.ts` is hand-duplicated data, not shared source —
  it will silently drift if `src/game/data/missions.ts` changes without a matching update here.
  The `cleanup` skill checks for this, but a real fix (shared package, or a build step that
  generates the catalog from the frontend source) would remove the drift risk entirely

### 2026-09-02 (2) — Mission variety, VFX, credits screen, mobile aim fix, perf
- Added 2 more missions (Escort, Extraction) alongside the original Search & Destroy, plus a
  Mission Select screen; `CombatScene` now reads the picked mission via a shared `missionState`
  handle instead of a hardcoded import (same pattern as `audioSettings`)
- Added a Credits screen crediting xDeviruchi per their license — closes the public-release
  blocker noted in the previous entry
- Added a VFX pass: muzzle flash, hit spark, kill burst + fade-out, and a red damage vignette
  (all procedural Phaser tweens/graphics, no new art assets needed)
- Fixed `resetPlayerProgress` to actually delete `missionResults` history, not just the aggregate
  fields (batched delete, loops past Firestore's 500-op batch cap)
- Added an autosave note to the Settings screen
- **Mobile touch aim fix:** the crosshair now lifts ~110px above the actual touch point on touch
  input only (mouse unaffected) — previously the player's own finger covered whatever it was
  aiming at
- **Perf:** Phaser (and everything that pulls it in) is now dynamically imported only when a
  mission starts, instead of loading with the initial menu — cut the initial JS bundle from
  ~2.16MB to ~783KB (the remaining ~1.38MB Phaser chunk now loads on-demand). Required replacing
  `Phaser.Events.EventEmitter` in `game/events.ts` with a tiny custom emitter, since that module
  was imported from the React app shell and was the one thing anchoring Phaser into the main chunk
- **Ops:** `.github/workflows/deploy.yml` — changed `cancel-in-progress` to `false` as a
  precaution, but this was **not** the actual cause of the deploy-silently-fails symptom (see
  below) — leaving the change in since it's still good practice, just don't expect it to fix
  anything on its own.
- **Ops (confirmed root cause):** the reported "build succeeds, deploy silently fails, manual
  rerun fixes it" symptom is a **GitHub repo settings issue**, not a workflow bug — the
  `github-pages` environment (Settings → Environments → github-pages → Deployment branches and
  tags) has a branch restriction that doesn't include `main`, so every push-to-main deploy dies in
  ~2s with "Branch 'main' is not allowed to deploy to github-pages due to environment protection
  rules." Manual reruns "worked" because they were presumably run against the branch that *is*
  allowed. **Needs a one-time fix only the repo owner can make**: add `main` to the allowed
  branches (or remove the restriction) in that environment's settings. Not something `git`/the
  Firebase CLI/this skill can fix — it's a GitHub repo admin setting.

### 2026-09-02 (1) — Firebase backend, first art pass, audio, settings
- Wired Firebase Auth (Google + Email/Password), Firestore progression, security rules, App Check
- Generated and integrated 7 enemy sprites, a ground texture, a mountain backdrop, and helicopter
  hero art via PixelLab (see [ART_ASSETS.md](ART_ASSETS.md))
- Wired weapon/kill/damage/overheat SFX and menu/combat music, sourced from a sibling project's
  shared audio library (see [AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md) — **licensing action
  needed before public release**)
- Added a Settings screen (Main Menu → Settings): music/SFX volume, difficulty (now actually
  scales enemy health/damage, not cosmetic), and a progress-reset action — all backend by
  Firestore so they hydrate on any device
- README now links the live GitHub Pages build
- Added `push-and-deploy` skill and this docs tracker set
