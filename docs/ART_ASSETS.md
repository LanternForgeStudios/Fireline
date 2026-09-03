# Fireline — Art Asset Tracker

All generated art comes from PixelLab (`mcp__pixellab__*` tools). Object/tile IDs are recorded
here so a piece can be regenerated or its alternate candidates revisited without re-prompting
from scratch — `get_object`/`get_tiles_pro` on these IDs still works.

## Enemies (`public/enemies/*.png`, 64×64)

All seven GDD enemy types are done — a first pass, one candidate picked per type from a 16-frame
review batch. Style reads as low-oblique (matches the combat camera), not strict top-down.

| Type | File | PixelLab object ID | Notes |
| --- | --- | --- | --- |
| Infantry | `infantry.png` | `b5062609-b52f-49ab-99b7-82849cc061b9` | source batch `b48cd568-...` |
| Machine Gunner | `gunner.png` | `a2e62d65-307a-483a-87f3-3c5130b8f682` | source batch `069c7d8c-...` |
| Rocket Team | `rocket.png` | `b2cdb48b-f902-447e-9f8d-67b5f2340a33` | source batch `b0ea721a-...` |
| Technical Vehicle | `technical.png` | `5fed39be-2735-4002-bb8f-d926040fd85b` | source batch `87b026cb-...` |
| Armored Vehicle | `armored.png` | `7f7b60c9-9a84-4f37-937d-cfccbee0bf58` | source batch `0900f762-...`; batch mixed wheeled/tank variants, picked wheeled to match the others |
| Drone | `drone.png` | `32db53cb-90f0-4af3-b490-31596d231354` | source batch `9fe408f1-...` |
| Commander | `6a101b0e-f2ad-441f-9f02-872d938c359b` | `commander.png` | source batch `cfda23fd-...`; batch had solo + squad-crowd variants, picked solo |

**Not done:** hit/death animation frames (currently a static sprite scales up as it approaches;
no impact flash or death frame). `animate_object` on any of the above IDs would add motion.

## Environment (`public/env/*.png`)

| Asset | File | Notes |
| --- | --- | --- |
| Ground tile | `ground.png` | 64×64 seamless tile via `create_tiles_pro` (id `ff5cabdb-8b77-4728-adf9-c50cef4f7fcb`, `tile_0` of 16 candidates), replaces the old procedural pebble pattern, scrolls via `tilePositionX/Y` |
| Mountain range | `mountains.png` | 400×68 via `create_image_pixflux` (job `2ac273b9-eaa8-47af-b561-ca80502bfd11`), single static image stretched to full width rather than tiled (freeform art can't guarantee seamless edges the way a dedicated tile tool can); bakes in its own sun glow, so the old procedural sun circle was removed |

**Not done:** any weather/time-of-day variation (GDD mentions both as part of procedural missions,
Phase 3 — no art needed until that's built).

## UI / Hero art (`public/ui/*.png`)

| Asset | File | Notes |
| --- | --- | --- |
| Helicopter hero | `helicopter-hero.png` | 256×256 via `create_1_direction_object` (id `a0ae0212-c277-4337-b9c5-328dd42937c3`), shown on the Main Menu. Asked for a side profile with door gunner visible; got a front-on Apache-style gunship instead — kept it, it reads well as hero art even though it doesn't literally match the brief |

**Not done:** loadout/upgrade icons, mission-type icons (Escort/Rescue/etc. — moot until Phase 2
adds more than one mission), achievement/rank badges.

## In-scene elements still procedural (not yet swapped for real art)

- Sky gradient + sun glow strip — left procedural; a flat gradient doesn't gain much from being
  rasterized, and the mountain art's baked-in sun already covers that beat.
- Helicopter door-sill/frame at the bottom of the combat view — it's a vector-masked trapezoid,
  not a rectangle, so a straight texture swap fights the geometry for little payoff. Revisit if a
  proper door/interior scene ever gets built (would need re-authoring the shape, not just texture).
- Crosshair — simple procedural reticle, works fine as-is.
- Hit-marker / muzzle flash VFX — none yet, tracked in the polish backlog below.

## Known follow-ups

- [ ] Regenerate `helicopter-hero.png` as a true side profile if the front-on look doesn't hold up
      once seen in context.
- [ ] Enemy hit/death animation frames.
- [ ] Muzzle flash + hit-spark VFX (currently just the health-bar-appears-on-damage feedback).
