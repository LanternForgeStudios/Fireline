# Helicopter Gunner Game Design Document (Concept v0.1)

> Markdown transcription of `Helicopter_Gunner_GDD_v0.1.docx` for easy reading/diffing in-repo. The original file is the source of truth.

## Project Vision

A cross-platform arcade first-person helicopter gunner game built with Phaser 4, React, Firebase, and GitHub Pages, with future iOS deployment via Capacitor.

## Core Concept

Players act as the door gunner on an AI-piloted helicopter. Each mission is procedurally generated with varying objectives, threats, weather, and difficulty. The goal is to eliminate threats and keep the helicopter alive until extraction.

## Technology Stack

- **Frontend:** React + TypeScript + Vite
- **Gameplay:** Phaser 4
- **Backend:** Firebase Authentication, Firestore, Cloud Functions
- **Web Hosting:** GitHub Pages
- **Native Mobile:** Capacitor + Xcode (future)
- **Testing:** Desktop browsers and mobile devices

## Core Gameplay Loop

1. Receive mission briefing
2. Select loadout
3. Fly mission
4. Destroy threats
5. Protect helicopter
6. Complete objective
7. Earn XP, credits, upgrades
8. Repeat

## Mission Types

- Escort
- Extraction
- Rescue
- Search & Destroy
- Base Defense
- Reconnaissance

## Procedural Mission System

Use seeded random generation, encounter blocks, threat budgets, weather, time of day, and secondary objectives to create highly replayable missions.

## Player Systems

- Machine gun with heat management
- Reloads
- Aircraft health
- Countermeasures
- Limited abilities (repair, flares, scanner)
- Upgradeable weapons and helicopter

## Enemy Types

- Infantry
- Machine gunners
- Rocket teams
- Technical vehicles
- Armored vehicles
- Drones
- Commanders

## Architecture

- React owns menus, authentication, upgrades, settings, and leaderboards.
- Phaser owns combat, rendering, AI, missions, and gameplay.
- Firebase stores player progression and validates rewards.

## Platforms

- **Primary:** Web (GitHub Pages)
- **Future:** iOS using Capacitor
- **Future possibility:** Android with minimal additional work

## MVP Roadmap

1. Combat prototype
2. Mission prototype
3. Procedural generation
4. Firebase progression
5. Content expansion and polish

## Future Vision

- Daily missions
- Leaderboards
- Achievements
- Additional helicopters
- New biomes
- Seasonal events
- Expanded campaign

## Recommended Development Phases

| Phase | Goal | Deliverable |
| --- | --- | --- |
| 1 | Core Combat | Playable shooting prototype |
| 2 | Mission System | Complete extraction mission |
| 3 | Procedural Content | Randomized encounters |
| 4 | Backend | Player saves and progression |
| 5 | Release | Web launch then iOS |
