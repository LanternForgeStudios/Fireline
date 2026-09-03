# Fireline — Development Progress

Tracks where the project actually stands against the [GDD](GDD.md#recommended-development-phases)
phases. Update this at the end of each milestone (see the `push-and-deploy` skill). Newest entry
on top.

## Status by GDD phase

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Core Combat | **Done** — playable shooting prototype |
| 2 | Mission System | **Done** per the GDD's own deliverable ("complete extraction mission") — 3 missions (Search & Destroy, Escort, Extraction) with a select screen, each with distinct visual theming, plus loadout selection via the weapon upgrade system (see Phase 4) |
| 3 | Procedural Content | **First pass done** — seeded generation, encounter blocks, threat budgets, and weather/time-of-day variety, per the GDD's own list. "Randomly Generated" option in Mission Select alongside the 3 hand-authored missions. Secondary objectives (also GDD Phase 3) and gameplay-affecting weather (currently visual-only) are follow-ups, not attempted this pass |
| 4 | Backend | **Mostly done** — see below; only App Check enforcement is outstanding |
| 5 | Release | Not started (web live on GitHub Pages; iOS/Capacitor future) |

## Backend (Phase 4) detail

- [x] Firebase project (`fireline-lf`) created
- [x] Firebase Authentication — Google + Email/Password sign-in, gates play
- [x] Firestore — `players/{uid}` profile (xp, credits, missionsCompleted/Failed, bestScore,
      unlockedUpgrades) + `players/{uid}/missionResults/{id}` history, live-synced to the UI
- [x] Firestore security rules — per-player read/write isolation (`firestore.rules`)
- [x] App Check (reCAPTCHA v3) on Firestore/Auth, currently in **Monitor** mode
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
- [ ] App Check enforcement on Firestore/Auth themselves — requested, but this toggle has **no
      CLI/API path**; it's a Firebase Console-only action (Build → App Check → APIs tab). Handed
      back to the project owner rather than attempted via an improvised authenticated REST call
      against a security-sensitive production toggle, especially right after the unexplained
      black-screen incident below. Test in the app immediately after flipping it (sign in, play a
      mission, open Settings) — it's instantly reversible back to Monitor if anything breaks.

## Log

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
