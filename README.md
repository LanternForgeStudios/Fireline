# Fireline — Helicopter Gunner

**[▶ Play live](https://lanternforgestudios.github.io/Fireline/)**

An arcade first-person rail shooter: you're the door gunner on an AI-piloted helicopter, clearing waves of hostiles until extraction. Built per the [design doc](docs/GDD.md) ([original .docx](docs/Helicopter_Gunner_GDD_v0.1.docx)) on React + TypeScript + Vite + Phaser 4.

## Status

**Phase 1 (Core Combat) done, Phase 2 (Mission System) in progress.** Three missions (Search & Destroy, Escort, Extraction), seven enemy types with PixelLab art, machine-gun heat management, aircraft health, and a login → menu → mission select → briefing → combat → results loop. Google/Email accounts with Firestore-backed progression (XP, credits, mission history, settings that hydrate on any device). See [docs/PROGRESS.md](docs/PROGRESS.md) for the detailed status log and [docs/ART_ASSETS.md](docs/ART_ASSETS.md) / [docs/AUDIO_AND_POLISH.md](docs/AUDIO_AND_POLISH.md) for asset and polish tracking.

See the [Recommended Development Phases](docs/GDD.md#recommended-development-phases) table in the GDD for what's still ahead: procedural mission generation (Phase 3) and server-side reward validation (Phase 4, partially done — auth/Firestore/App Check are live, Cloud Functions anti-cheat isn't).

## Stack

- **UI shell:** React + TypeScript, owns menus/briefing/results/settings and the state machine between them
- **Gameplay:** Phaser 4, owns the combat scene (rendering, enemy AI, hit detection) — dynamically imported only once a mission starts, to keep it out of the initial page load
- **Backend:** Firebase — Authentication (Google/Email), Firestore (player progression, source of truth for XP/credits/settings), App Check (reCAPTCHA v3, currently Monitor mode)
- **Bridge:** a small custom event emitter (`src/game/events.ts`) carries HUD state and mission-end results from Phaser to React
- **Build:** Vite

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
npm run lint       # oxlint
```

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages via `actions/deploy-pages` on every push to `main`. Live now at **https://lanternforgestudios.github.io/Fireline/** — this is the primary way to play and share the game while it's in development. `vite.config.ts` sets the `/Fireline/` base path for this. GitHub Pages will remain the host until the game is ready to port to iOS (and possibly Android) via Capacitor, per the GDD.

## How to play

Sign in (Google or email/password — required, progression is account-bound), pick a mission, then move the mouse to aim and hold the left mouse button to fire the door gun. On touch devices, the crosshair lifts above your finger so it isn't hidden by the hand aiming it. Watch the heat gauge — overheating locks the gun until it cools. Enemies that reach the helicopter, or that shoot back, damage the aircraft; keep it above zero health through every wave to complete the mission.

## Project layout

```
src/
  audio/                    # music/SFX playback, settings-driven volume
  firebase/                 # auth, Firestore player profile/settings/mission history
  game/
    scenes/CombatScene.ts   # the playable combat loop
    entities/                # Enemy, Weapon (heat management)
    data/                    # enemy stat table, mission definitions
    events.ts                # Phaser <-> React event bridge
    missionState.ts          # picked-mission handle shared between React and Phaser
    types.ts                 # shared types + event names
  ui/                        # React screens (login, menu, mission select, briefing, HUD, settings, credits, results)
  App.tsx                    # screen state machine
docs/
  GDD.md                     # design doc (markdown transcription)
  Helicopter_Gunner_GDD_v0.1.docx
  PROGRESS.md                # milestone/status log
  ART_ASSETS.md              # art asset tracker (PixelLab object IDs, what's left)
  AUDIO_AND_POLISH.md        # audio, VFX, and general polish tracker
```
