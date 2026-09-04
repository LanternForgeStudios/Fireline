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
| Commander | `commander.png` | `6a101b0e-f2ad-441f-9f02-872d938c359b` | source batch `cfda23fd-...`; batch had solo + squad-crowd variants, picked solo |

**Death animations — done.** All 7 types have a real `animate_object` death animation (v3 mode,
7 frames each including PixelLab's retained reference frame), registered as `${id}-death` in
`CombatScene.buildEnemyAnimations` and played via `Enemy.playDeath()` on kill, replacing the old
placeholder (scale up 1.3x and fade). Frame files: `public/enemies/${id}-death-{0..6}.png`.

| Type | Animation group | Notes |
| --- | --- | --- |
| Infantry | `e2e6651d-cfa4-42da-a18f-08ab2d3ac331` | collapses backward |
| Machine Gunner | `f693871a-6d79-47ec-af9c-04c64eb513e1` | falls back from the gun |
| Rocket Team | `e2758231-9fdf-4d45-91d5-dc090614e7b6` | collapses, drops launcher |
| Technical Vehicle | `90eed35c-97a9-436b-9918-1c90a682f760` | explodes into a burning wreck |
| Armored Vehicle | `9d137643-3107-4011-8487-c71681e1cc1c` | explodes into a burning wreck |
| Drone | `9f768ff1-3a47-4cb3-9ff2-bf69b2e7d38a` | sparks, spins out, falls |
| Commander | `e25e2543-9dbd-4977-9ac7-043f52295847` | falls backward |

**Not done:** a separate non-lethal "hit" flinch animation (still-alive reaction to being
damaged) — scoped out of this pass to keep it to one animation set per type; the existing
impact-spark VFX (`spawnSpark` in `CombatScene.ts`) still covers non-lethal hit feedback. Worth a
follow-up if it reads as needed once someone's actually played against it.

### Coastal boat reskins (`public/enemies/boat-*.png`, 64×64)

Ground vehicles/infantry standing on open water read wrong, so every non-aerial type gets a
boat/watercraft reskin swapped in when `theme.landscape === 'coastal'` (drones fly regardless of
landscape, so they're untouched). Purely a base-texture swap done in `CombatScene.ts`
(`COASTAL_BOAT_TYPES`/`enemyTextureKey`) — same stats, same `${id}-death` animation as the land
version; no new animations were generated for this pass.

| Type | File | Job ID | Notes |
| --- | --- | --- | --- |
| Infantry | `boat-infantry.png` | `65df629e-c250-43f7-ba77-bc2c6f177b73` | soldier on a tan inflatable skiff, rifle visible |
| Machine Gunner | `boat-gunner.png` | `48d9aede-87aa-4b60-94f1-31e6144504f5` | wooden boat with a mounted machine gun |
| Rocket Team | `boat-rocket.png` | `81275691-ca82-4ab3-aa22-1070c43460d5` | soldier aiming a launcher, high-contrast silhouette — first attempt (job `ad215bca-232d-4588-a60d-f41189b9efb6`) was too muddy to read at 64×64, regenerated |
| Technical Vehicle | `boat-technical.png` | `a077995d-485e-40d8-8dee-ef6530b33aa5` | rust-orange fast-attack/"go-fast" boat, bow-mounted gun |
| Armored Vehicle | `boat-armored.png` | `fe30d6a3-fc34-45c6-9564-9a47cc9f4030` | olive-green armored patrol gunboat with a turret |
| Commander | `boat-commander.png` | `363e434e-6fa1-4e80-833b-254eb4345d58` | larger gray/purple command boat with a radio mast |

## Environment / landscapes (`public/env/*.png`)

Four landscapes now exist — `MissionTheme.landscape` (`types.ts`) picks which one a mission uses,
independent of the weather/mood tint layered on top (`CombatScene.LANDSCAPE_GROUND_FILE`/
`LANDSCAPE_MOUNTAIN_FILE` map the id to files; texture keys are landscape-specific, e.g.
`ground-art-coastal`, since Phaser's texture cache is keyed globally and a fixed key would stick
to whichever landscape loaded first in a session). Hand-authored missions: Firebreak=desert,
Steel Convoy=urban, Nightfall=coastal, Green Hell=jungle. Procedural missions roll a landscape independently of the weather preset
(`generateMission.ts`) — the weather tint values were tuned against the desert art, so some
combinations (a warm sand-toned preset over coastal's blue water, say) read a bit muddier than a
hand-picked pairing; acceptable first-pass variance, not re-tuned per landscape.

| Landscape | Ground tile | Backdrop | Notes |
| --- | --- | --- | --- |
| Desert | `ground.png` | `mountains.png` | 64×64 tile via `create_tiles_pro` (id `ff5cabdb-8b77-4728-adf9-c50cef4f7fcb`, `tile_0` of 16); backdrop 400×68 via `create_image_pixflux` (job `2ac273b9-eaa8-47af-b561-ca80502bfd11`) |
| Coastal | `coastal-ground.png` | `coastal.png` | tile via `create_tiles_pro` (id `79195108-7ecc-48b0-bdb7-a332d8a56413`, `tile_2` of 16 — picked for the clearest wave-line texture when tiled); backdrop via `create_image_pixflux` (job `af41c91d-fbe0-4a89-8c18-84c9e07ccf6a`), sea horizon with rocky islands and a sun glow |
| Urban | `urban-ground.png` | `urban.png` | tile via `create_tiles_pro` (id `8617ee1a-6925-4946-85ae-aaed69c3bbce`, `tile_0` of 16 — cracked asphalt/rubble); backdrop via `create_image_pixflux` (job `596a7ca2-a5fb-4fec-a07b-a9d3b31c92b0`), ruined city skyline silhouette |
| Jungle | `jungle-ground.png` | `jungle.png` | tile via `create_tiles_pro` (id `7ab546fe-780b-4ada-9b65-4d3887c0e5a0`, `tile_0` of 16 — dense foliage with mud showing through); backdrop via `create_image_pixflux` (job `6b6e28d5-953d-4d03-b251-b19ff95251a6`), palm tree silhouette skyline with a sunset glow and birds |

All four backdrops replace the old procedural sun circle the same way the desert one did — each
bakes in its own light source (sun glow / smoke-lit skyline / jungle sunset).

**Not done:** gameplay-affecting weather (still visual-mood only, tracked in
[AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md)); a 5th+ landscape if more variety is wanted later.

## UI / Hero art (`public/ui/*.png`)

| Asset | File | Notes |
| --- | --- | --- |
| Helicopter hero | `helicopter-hero.png` | 256×256 via `create_1_direction_object` (id `a0ae0212-c277-4337-b9c5-328dd42937c3`), shown on the Main Menu. Asked for a side profile with door gunner visible; got a front-on Apache-style gunship instead — kept it, it reads well as hero art even though it doesn't literally match the brief |
| Upgrades icon | `icon-upgrades.png` | 64×64 via `create_image_pixflux` (job `3c24dd85-ee5b-4afe-bda7-c742c39e17e7`), wrench crossed over a gear, military stencil style |
| Settings icon | `icon-settings.png` | 64×64 via `create_image_pixflux` (job `97d171b2-e45f-4803-8339-479088e313f4`), plain gear cog |
| Credits icon | `icon-credits.png` | 64×64 via `create_image_pixflux` (job `cd6a5883-e335-4072-8b48-dfe598ac54da`), rank star/ribbon |

All three shown at 1.1rem inline next to their button label in the Main Menu icon row
(`.menu-icon` in `App.css`).

| Upgrade track icon | File | Notes |
| --- | --- | --- |
| Rounds (damage) | `icon-upgrade-damage.png` | 64×64 via `create_image_pixflux` (job `d981b515-d507-4337-b124-3d48a73506c4`), AP bullet round |
| Cooling | `icon-upgrade-cooling.png` | 64×64 via `create_image_pixflux` (job `262bf889-f4e8-430c-a572-44474191f7fa`), snowflake |
| Heat Capacity | `icon-upgrade-heatcapacity.png` | 64×64 via `create_image_pixflux` (job `51aaa0f4-5d16-47e4-86c5-ce29d98bf48c`), gauge dial on a shield plate |
| Fire Rate | `icon-upgrade-firerate.png` | 64×64 via `create_image_pixflux` (job `71d13ef7-fd39-496a-9a56-c0a32044b067`), lightning bolt — first attempt (crossed ammo rounds, job `ba32aacb-0b55-40cf-8434-665ccb3d10f7`) didn't read clearly as "rate", regenerated |

Shown at 2.6rem in each track's card on the Upgrades screen (`.upgrade-track-icon`), alongside a
per-track accent color on the card's left border (`TRACK_ACCENT` in `UpgradesScreen.tsx`) — a
gold border/tint replaces the accent once a track is maxed out.

| Mission icon | File | Notes |
| --- | --- | --- |
| Operation Firebreak | `icon-mission-firebreak.png` | 64×64 via `create_image_pixflux` (job `78a0fe07-b1be-441e-8948-6eb2be8ad73b`), crosshair over a desert dune |
| Operation Steel Convoy | `icon-mission-steelconvoy.png` | 64×64 via `create_image_pixflux` (job `34eaf4bc-e539-4ca2-8805-416ab40eadca`), shield protecting a convoy truck |
| Operation Green Hell | `icon-mission-greenhell.png` | 64×64 via `create_image_pixflux` (job `6bdc4410-aa1c-4f70-95ad-fc5ebb5b062d`), handheld distress beacon with a signal wave — first attempt (job `a0f86126-...`) came back as just a plain leaf, no beacon element, regenerated with the signal emphasized |
| Operation Nightfall | `icon-mission-nightfall.png` | 64×64 via `create_image_pixflux` (job `5caaea5f-c94e-473c-99dc-3571b8b1b123`), crescent moon with a rope ladder |
| Randomly Generated (procedural) | `icon-mission-random.png` | 64×64 via `create_image_pixflux` (job `d653ce51-270c-415c-9821-f809deb15800`), die with a question mark — one fixed icon regardless of the rolled mission type, since procedural missions have no fixed identity to hang a specific icon on |

Shown at 2.4rem on each Mission Select card (`.mission-list-icon`), same treatment as the
Upgrades screen's track icons.

**Not done:** mission-type icons for types with no hand-authored mission yet (Base Defense,
Reconnaissance), achievement/rank badges.

## Escort/support ground element (`public/env/escort-vehicle.png`)

96×96 via `create_image_pixflux` — a friendly canvas-covered supply truck, sandy tan/olive colors,
deliberately non-hostile-looking (no visible weapons) so it doesn't read as another enemy. Shown
for `mission.type === 'Escort'` missions only (currently just Operation Steel Convoy) — sits in
the mid-ground (`ESCORT_VEHICLE_Y = 460` in `CombatScene.ts`, above the enemy impact zone so it
doesn't visually compete with approaching contacts) with a gentle vertical bob plus a slower,
wider horizontal sway on a different tween period (so the two don't lock into an obvious
repeating diagonal loop) — it travels at the same pace as the helicopter, so it stays roughly
fixed on screen (with that idle wiggle) the same way the helicopter itself does, rather than
scrolling. Never added to `this.enemies`, so it's not targetable/damageable by design.

**Facing direction fix (2026-09-04):** the first version (job `54001409-...`) showed the truck's
cab/windshield toward the camera — read as driving *at* the helicopter rather than traveling
alongside it in the same direction. Regenerated facing away (job `d317a0e6-194b-4897-9f58-93c9503a8d26`,
rear/tailgate toward the viewer) so it reads as moving with the aircraft, not toward it. Checked
the enemy vehicle sprites (`technical.png`, `armored.png`, etc.) for the same issue — they're all
3/4-profile "hero shot" angles that don't make a strong directional claim either way, so no
mismatch there; the escort vehicle was the one asset with an actual facing problem.

## In-scene elements still procedural (not yet swapped for real art)

- Sky gradient + sun glow strip — left procedural; a flat gradient doesn't gain much from being
  rasterized, and the mountain art's baked-in sun already covers that beat.
- Helicopter door-sill/frame at the bottom of the combat view — it's a vector-masked trapezoid,
  not a rectangle, so a straight texture swap fights the geometry for little payoff. Revisit if a
  proper door/interior scene ever gets built (would need re-authoring the shape, not just texture).
- Crosshair — simple procedural reticle, works fine as-is.
- Hit-marker / muzzle flash / kill-burst VFX — done, but procedural (tweened circle sprites), not
  PixelLab art. See [AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md).

## Known follow-ups

- [ ] Regenerate `helicopter-hero.png` as a true side profile if the front-on look doesn't hold up
      once seen in context.
- [ ] Enemy hit/death animation frames.
- [ ] Muzzle flash + hit-spark VFX (currently just the health-bar-appears-on-damage feedback) — note
      this line predates the actual muzzle flash/hit-spark/kill-burst tween VFX shipped 2026-09-02
      (2), which are procedural, not PixelLab art; a real rotor-dust VFX pass is still open.
- [x] Menu icons (Upgrades/Settings/Credits) — done 2026-09-03.
