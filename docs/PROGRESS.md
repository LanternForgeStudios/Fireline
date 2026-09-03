# Fireline — Development Progress

Tracks where the project actually stands against the [GDD](GDD.md#recommended-development-phases)
phases. Update this at the end of each milestone (see the `push-and-deploy` skill). Newest entry
on top.

## Status by GDD phase

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Core Combat | **Done** — playable shooting prototype |
| 2 | Mission System | **Done** per the GDD's own deliverable ("complete extraction mission") — 3 missions (Search & Destroy, Escort, Extraction) with a select screen, each with distinct visual theming; loadout selection still doesn't exist (one fixed weapon) |
| 3 | Procedural Content | **Not started — next up.** Seeded random generation, encounter blocks, threat budgets, weather/time-of-day variety per the GDD. The per-mission visual theming added this session (sky/mountain/ground tint) is hand-authored per mission, not generated — a natural seam to build the real system against |
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
- [x] App Check enforced on both Cloud Functions (`enforceAppCheck: true`)
- [ ] App Check enforcement on Firestore/Auth themselves — requested, but this toggle has **no
      CLI/API path**; it's a Firebase Console-only action (Build → App Check → APIs tab). Handed
      back to the project owner rather than attempted via an improvised authenticated REST call
      against a security-sensitive production toggle, especially right after the unexplained
      black-screen incident below. Test in the app immediately after flipping it (sign in, play a
      mission, open Settings) — it's instantly reversible back to Monitor if anything breaks.

## Log

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
