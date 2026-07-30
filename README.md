# Fireline — Helicopter Gunner

An arcade first-person rail shooter: you're the door gunner on an AI-piloted helicopter, clearing waves of hostiles until extraction. Built per the [design doc](docs/GDD.md) ([original .docx](docs/Helicopter_Gunner_GDD_v0.1.docx)) on React + TypeScript + Vite + Phaser 4.

## Status

**MVP Phase 1 — Core Combat prototype.** One hand-authored mission ("Operation Firebreak"), five waves, seven enemy types, machine-gun heat management, aircraft health, and a menu → briefing → combat → results loop.

See the [Recommended Development Phases](docs/GDD.md#recommended-development-phases) table in the GDD for what comes after this: mission variety (Phase 2), procedural generation (Phase 3), and Firebase-backed progression (Phase 4).

## Stack

- **UI shell:** React + TypeScript, owns menus/briefing/results and the state machine between them
- **Gameplay:** Phaser 4, owns the combat scene (rendering, enemy AI, hit detection)
- **Bridge:** a small `Phaser.Events.EventEmitter` (`src/game/events.ts`) carries HUD state and mission-end results from Phaser to React
- **Build:** Vite

Firebase (auth/progression) and Capacitor (iOS) are future-phase work per the GDD and aren't wired up yet.

## Running it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production build
npm run lint       # oxlint
```

## How to play

Move the mouse to aim, hold the left mouse button to fire the door gun. Watch the heat gauge — overheating locks the gun until it cools. Enemies that reach the helicopter, or that shoot back, damage the aircraft; keep it above zero health through all five waves to complete the mission.

## Project layout

```
src/
  game/
    scenes/CombatScene.ts   # the playable combat loop
    entities/                # Enemy, Weapon (heat management)
    data/                    # enemy stat table, mission/wave definitions
    events.ts                # Phaser <-> React event bridge
    types.ts                 # shared types + event names
  ui/                        # React screens (menu, briefing, HUD, results)
  App.tsx                    # screen state machine
docs/
  GDD.md                     # design doc (markdown transcription)
  Helicopter_Gunner_GDD_v0.1.docx
```
