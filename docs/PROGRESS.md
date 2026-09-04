# Fireline — Development Progress

Tracks where the project actually stands against the [GDD](GDD.md#recommended-development-phases)
phases. Update this at the end of each milestone (see the `push-and-deploy` skill). Newest entry
on top.

## Status by GDD phase

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Core Combat | **Done** — playable shooting prototype |
| 2 | Mission System | **Done** per the GDD's own deliverable ("complete extraction mission") — 3 missions (Search & Destroy, Escort, Extraction) with a select screen, each with distinct visual theming, plus loadout selection via the weapon upgrade system (see Phase 4) |
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
- [x] Player settings (music/SFX volume, difficulty, mobile control side) stored in Firestore,
      hydrate on any device
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

## Log

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
