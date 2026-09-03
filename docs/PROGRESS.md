# Fireline — Development Progress

Tracks where the project actually stands against the [GDD](GDD.md#recommended-development-phases)
phases. Update this at the end of each milestone (see the `push-and-deploy` skill). Newest entry
on top.

## Status by GDD phase

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Core Combat | **Done** — playable shooting prototype |
| 2 | Mission System | **In progress** — 3 hand-authored missions (Search & Destroy, Escort, Extraction) with a mission-select screen; still one fixed loadout, no procedural variety |
| 3 | Procedural Content | Not started |
| 4 | Backend | **In progress** — see below |
| 5 | Release | Not started (web live on GitHub Pages; iOS/Capacitor future) |

## Backend (Phase 4) detail

- [x] Firebase project (`fireline-lf`) created
- [x] Firebase Authentication — Google + Email/Password sign-in, gates play
- [x] Firestore — `players/{uid}` profile (xp, credits, missionsCompleted/Failed, bestScore,
      unlockedUpgrades) + `players/{uid}/missionResults/{id}` history, live-synced to the UI
- [x] Firestore security rules — per-player read/write isolation (`firestore.rules`)
- [x] App Check (reCAPTCHA v3) on Firestore/Auth, currently in **Monitor** mode
- [x] Player settings (music/SFX volume, difficulty) stored in Firestore, hydrate on any device
- [ ] Flip App Check to **Enforce** once monitoring shows clean traffic
- [ ] Server-side reward validation (Cloud Functions re-deriving XP/credits from the mission
      definition instead of trusting the client-submitted `MissionResult`) — closes the gap App
      Check doesn't cover; a signed-in player can still tamper with client-side score today

## Log

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
- **Ops:** `.github/workflows/deploy.yml` — changed `cancel-in-progress` to `false`. Reported
  symptom: the Pages workflow shows a successful build but the deploy silently doesn't take effect
  until manually re-run via `workflow_dispatch`. Likely cause: a new push cancelling an in-flight
  deploy mid-way leaves the Pages environment in a bad state for the next automatic run. Not fully
  confirmed (no repro captured with full logs) — flag if it recurs

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
