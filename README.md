# Fireline — Helicopter Gunner

**[▶ Play live](https://lanternforgestudios.github.io/Fireline/)**

An arcade first-person rail shooter: you're the door gunner on an AI-piloted helicopter, clearing waves of hostiles until extraction. Built per the [design doc](docs/GDD.md) ([original .docx](docs/Helicopter_Gunner_GDD_v0.1.docx)) on React + TypeScript + Vite + Phaser 4.

## Status

**Phases 1-3 done** per the GDD's own deliverables, plus a second mission archetype layered on
top since. Seven hand-authored missions across two styles — flying forward (Search & Destroy,
two Escorts — a land convoy and a boat — Extraction, a jungle Rescue) and holding position to
defend a ground objective (two Base Defense operations, enemies emerging from stationary cover)
— plus a "Randomly Generated" option covering both styles, locked until every hand-authored
mission has been cleared at least once (seeded generation, encounter blocks, threat budgets,
weather/time-of-day variety, secondary objectives, procedural cover-object placement for Base
Defense — see `src/game/generation/`). Seven enemy types with PixelLab art (four with a looping
approach walk cycle, plus boat reskins for coastal missions). Four purchasable guns (M134
default/free, M60, GAU-19, SAW), each with its own stats, upgrade tracks, and heat-driven
recoil — GAU-19 also has a hold-to-zoom mode — bought and equipped via the Armory (Main Menu →
Armory). An 8-tier XP-based rank system, aircraft health (plus a separate defendable-objective
health bar in Base Defense missions), and a login → menu → mission select → briefing → combat →
results loop. Google/Email accounts with Firestore-backed progression (XP, credits, owned/
equipped guns, mission history, settings — including independent music/SFX mute — that hydrate
on any device); rewards and purchases both run server-side via Cloud Functions. See
[docs/PROGRESS.md](docs/PROGRESS.md) for the detailed status log and
[docs/ART_ASSETS.md](docs/ART_ASSETS.md) / [docs/AUDIO_AND_POLISH.md](docs/AUDIO_AND_POLISH.md)
for asset and polish tracking.

See the [Recommended Development Phases](docs/GDD.md#recommended-development-phases) table in the GDD for what's still ahead: gameplay-affecting weather (currently visual-mood only), and the asset/VFX/audio polish backlog in docs/AUDIO_AND_POLISH.md. App Check enforcement (below) is done — enabled in Console 2026-09-04.

## Stack

- **UI shell:** React + TypeScript, owns menus/briefing/results/settings and the state machine between them
- **Gameplay:** Phaser 4, owns the combat scene (rendering, enemy AI, hit detection) — dynamically imported only once a mission starts, to keep it out of the initial page load
- **Backend:** Firebase — Authentication (Google/Email), Firestore (player progression, source of truth for XP/credits/owned guns/settings), Cloud Functions (owns all reward/purchase writes — mission rewards, gun/upgrade purchases), App Check (reCAPTCHA Enterprise, **enforced** on Firestore/Auth and Cloud Functions)
- **Bridge:** a small custom event emitter (`src/game/events.ts`) carries HUD state and mission-end results from Phaser to React
- **Build:** Vite

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
npm run lint       # oxlint
```

`npm run dev` talks to the **Firebase Local Emulator Suite**, not the live backend — start it first in a
separate terminal:

```bash
npm run emulators   # Auth :9199, Firestore :8180, Functions :5101, UI at http://127.0.0.1:4100
```

(Ports are non-default — deliberately offset from Firebase's defaults so this can run alongside
another Firebase project's emulators on the same machine without colliding.) State persists
between runs in `.emulator-data/` (gitignored). The emulator reloads functions from
`functions/lib/`, the compiled output — after editing `functions/src/*.ts`, run
`cd functions && npm run build` to pick the change up (`firebase deploy`'s `predeploy` build hook
doesn't apply to `emulators:start`).

## Deployment

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages via `actions/deploy-pages` on every push to `main`. Live now at **https://lanternforgestudios.github.io/Fireline/** — this is the primary way to play and share the game while it's in development. `vite.config.ts` sets the `/Fireline/` base path for this. GitHub Pages will remain the host until the game is ready to port to iOS (and possibly Android) via Capacitor, per the GDD.

## How to play

Sign in (Google or email/password — required, progression is account-bound), pick a mission, then move the mouse to aim and hold the left mouse button to fire the door gun. On touch devices, the crosshair lifts above your finger so it isn't hidden by the hand aiming it. Watch the heat gauge — overheating locks the gun until it cools, and sustained fire pushes your aim off-target too. In flight missions, enemies that reach the helicopter, or that shoot back, damage the aircraft; keep it above zero health through every wave to complete the mission. In Base Defense missions the helicopter holds position instead — enemies emerge from cover and mostly attack a defendable ground objective instead of the aircraft, so protect it (some contacts still shoot at the aircraft too) until every wave is cleared.

## Project layout

```
src/
  audio/                    # music/SFX playback, settings-driven volume
  firebase/                 # auth, Firestore player profile/settings/mission history
  game/
    scenes/CombatScene.ts   # the playable combat loop (flight + hover/Base Defense modes)
    entities/                # Enemy, Weapon (heat + recoil), shared health-bar-fill math
    data/                    # enemy stats, gun catalog, mission definitions, gun recommendations
    generation/               # procedural mission generation (waves, cover objects, briefing text)
    playerLoadout.ts          # live equipped-gun/upgrades handle shared between React and Phaser
    worldConstants.ts         # WORLD_WIDTH/HEIGHT, shared by the scene and the generator
    events.ts                # Phaser <-> React event bridge
    missionState.ts          # picked-mission handle shared between React and Phaser
    types.ts                 # shared types + event names
  ui/                        # React screens (login, menu, mission select, briefing, HUD, armory, settings, credits, results)
  App.tsx                    # screen state machine
docs/
  GDD.md                     # design doc (markdown transcription)
  Helicopter_Gunner_GDD_v0.1.docx
  PROGRESS.md                # milestone/status log
  ART_ASSETS.md              # art asset tracker (PixelLab object IDs, what's left)
  AUDIO_AND_POLISH.md        # audio, VFX, and general polish tracker
```
