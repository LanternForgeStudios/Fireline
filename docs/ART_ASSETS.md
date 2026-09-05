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

**Done:** non-lethal hit reaction shipped 2026-09-04 — see `docs/PROGRESS.md` entry (27). Went
procedural (`Enemy.playHitFlinch`: white flash + scale punch) rather than a new PixelLab animation
set, applying uniformly across every enemy type/texture instead of needing dedicated frames per
type the way death/walk do.

### Approach walk cycle — humanoid types only (`public/enemies/${id}-walk-{0..7}.png`, 64×64)

Enemies previously sat on a single static frame the whole way in, only animating on death. Added
a looping 8-frame walk cycle for the four **humanoid** enemy types (infantry, gunner, rocket,
commander) via the **PixelLab Character API** (`create_character`, mode `v3` with each type's
existing sprite as `reference_image_url` — rotates the exact existing design into a full 8-direction
character rather than redesigning it) + `animate_character` (`walking-8-frames` template,
**south direction only**).

Why south-only, and why not the other 3 enemy types: prototyped full 8-direction rotations +
walk cycles on infantry first (quality was excellent, faithfully preserved the original design —
see the prototype character `536e1727-4783-424e-b203-c98f3be69a35` in the PixelLab project if it's
still there) before committing to a wider rollout. Two findings shaped the final scope:
- Enemies in this game close in almost straight toward the viewer (only minor lateral jitter, see
  `Enemy.update()`) — so 7 of the 8 generated directions would rarely if ever actually be seen.
  Not worth the extra generations or the direction-switching logic to use them.
- The Character API only supports humanoid/quadruped bodies, not vehicles or aircraft — so
  `technical`, `armored`, and `drone` can't get this treatment at all and keep their existing
  static Object API sprites (which is fine — a truck or drone doesn't need a walk cycle the way a
  soldier does).

| Type | Character ID | Animation group | Notes |
| --- | --- | --- | --- |
| Infantry | `536e1727-4783-424e-b203-c98f3be69a35` | `f57141d0-ebb6-429e-a0df-3bd7d07b157b` (south) | the prototype character, reused as production |
| Machine Gunner | `ad7c7503-4ccc-4d6b-981c-d64929201896` | `66e2ddae-8795-4024-b084-88a3eb37b159` (south) | |
| Rocket Team | `75c2ac9b-eab4-4cef-aa7e-378711313872` | `5b254610-886d-46a1-b59a-a5bec96e2d18` (south) | |
| Commander | `962ddda1-beb9-4285-9d7c-387b21b42e52` | `b2641699-d303-4370-b678-a2cf52c11f02` (south) | |

Registered as `${id}-walk` (`repeat: -1`, `CombatScene.buildEnemyAnimations`) and played on spawn
(`Enemy`'s constructor) — `Enemy.playDeath()` still switches the same sprite over to the existing
`${id}-death` animation on kill, same as before the walk cycle existed; `sprite.play()` cleanly
interrupts whatever's currently playing, no special handling needed. **Gated on the actual
texture key, not just the enemy type**: on a coastal mission these same 4 types render as boats
(see below) instead of soldiers, and the walk frames were generated from the soldier art — so
`Enemy.ts` only plays the walk animation when `textureKey === 'enemy-${id}'` specifically, never
over a `boat-${id}` reskin. Verified live: `infantry-walk` confirmed actively playing during
approach, correctly switches to `infantry-death` on a forced kill, and confirmed *not* playing at
all for boat-textured enemies on a coastal mission (Operation Nightfall).

### Coastal boat reskins (`public/enemies/boat-*.png`, 64×64)

Ground vehicles/infantry standing on open water read wrong, so every non-aerial type gets a
boat/watercraft reskin swapped in when `theme.landscape === 'coastal'` (drones fly regardless of
landscape, so they're untouched). Purely a base-texture swap done in `CombatScene.ts`
(`COASTAL_BOAT_TYPES`/`enemyTextureKey`) — same stats as the land version.

| Type | File | Job ID | Notes |
| --- | --- | --- | --- |
| Infantry | `boat-infantry.png` | `65df629e-c250-43f7-ba77-bc2c6f177b73` | soldier on a tan inflatable skiff, rifle visible |
| Machine Gunner | `boat-gunner.png` | `48d9aede-87aa-4b60-94f1-31e6144504f5` | wooden boat with a mounted machine gun |
| Rocket Team | `boat-rocket.png` | `81275691-ca82-4ab3-aa22-1070c43460d5` | soldier aiming a launcher, high-contrast silhouette — first attempt (job `ad215bca-232d-4588-a60d-f41189b9efb6`) was too muddy to read at 64×64, regenerated |
| Technical Vehicle | `boat-technical.png` | `a077995d-485e-40d8-8dee-ef6530b33aa5` | rust-orange fast-attack/"go-fast" boat, bow-mounted gun |
| Armored Vehicle | `boat-armored.png` | `fe30d6a3-fc34-45c6-9564-9a47cc9f4030` | olive-green armored patrol gunboat with a turret |
| Commander | `boat-commander.png` | `363e434e-6fa1-4e80-833b-254eb4345d58` | larger gray/purple command boat with a radio mast |

**Boat death animations (`public/enemies/boat-${id}-death-{0..8}.png`, 64×64, 2026-09-04):**
player-reported: boat deaths played the *land* type's death animation — a soldier collapsing or a
truck exploding rendered on top of a sunk boat, since the original boat-reskin pass explicitly
didn't generate new animations (see the note this replaces, above). Generated a real one per boat
type via `animate_image` (not `animate_object` — these boats were raw `create_image_pixflux`
images, not wrapped PixelLab objects with an `object_id`, and `animate_image` works directly off
any image URL/base64 without that wrapping step). Used the live GitHub Pages URL for each
`boat-*.png` as `first_frame_url` after an inline-base64 attempt got silently truncated in
transit — a real, reproducible failure mode worth remembering: prefer the URL form for anything
non-trivial in size. `frame_count=8` → 9 stored frames (index 0 is the boat's own unedited art,
frames 1-8 are the generated sinking/exploding sequence) — a different frame count from the land
types' animate_object-based 7, tracked as `BOAT_DEATH_FRAME_COUNT` in `CombatScene.ts` alongside
the existing `DEATH_FRAME_COUNT`.

| Type | Job ID | Notes |
| --- | --- | --- |
| Infantry | `5bcf50ce-f59c-4ce6-bfb3-b82772cfdd5c` | capsizes and sinks |
| Machine Gunner | `f258c657-fdac-498b-8203-ae57bfc0a549` | capsizes and sinks |
| Rocket Team | `e8c83500-9c09-4957-aded-00c27cf22187` | explodes |
| Technical Vehicle | `12df8dcf-9bcf-4d6f-b3d3-44f9a9d98ddf` | explodes into a burning wreck |
| Armored Vehicle | `5e3cdfdb-41a0-4799-80f7-2b098dfa5015` | explodes into a burning wreck |
| Commander | `ae9309e4-cc5e-4286-b840-2f3fae6735df` | explodes into a burning wreck |

`Enemy.ts` resolves which death animation to play (`deathAnimKey`) from the actual texture in use
at construction time, not just `def.id` — a boat-reskinned instance plays `boat-${id}-death`, a
land instance plays `${id}-death`. `CombatScene.buildEnemyAnimations`/`preload` mirror the same
`key.startsWith('boat-')` branch so the right frames are fetched and registered per mission.
Verified live via Playwright: forced a boat-reskinned enemy's death mid-mission and confirmed
`boat-${id}-death` is what actually starts playing (not the land animation), plus a screenshot
showing the explosion VFX on the correct boat sprite; re-checked a land mission afterward to
confirm `${id}-death` still plays unaffected.

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
| Desert | `ground.png` | `mountains.png` | ground tile regenerated 2026-09-04, see below; backdrop 400×68 via `create_image_pixflux` (job `2ac273b9-eaa8-47af-b561-ca80502bfd11`) |
| Coastal | `coastal-ground.png` | `coastal.png` | ground tile regenerated 2026-09-04, see below; backdrop via `create_image_pixflux` (job `af41c91d-fbe0-4a89-8c18-84c9e07ccf6a`), sea horizon with rocky islands and a sun glow |
| Urban | `urban-ground.png` | `urban.png` | ground tile regenerated 2026-09-04, see below; backdrop via `create_image_pixflux` (job `596a7ca2-a5fb-4fec-a07b-a9d3b31c92b0`), ruined city skyline silhouette |
| Jungle | `jungle-ground.png` | `jungle.png` | ground tile regenerated 2026-09-04, see below; backdrop via `create_image_pixflux` (job `6b6e28d5-953d-4d03-b251-b19ff95251a6`), palm tree silhouette skyline with a sunset glow and birds |

All four backdrops replace the old procedural sun circle the same way the desert one did — each
bakes in its own light source (sun glow / smoke-lit skyline / jungle sunset).

### Ground tile regeneration — all four landscapes (2026-09-04)

The original ground tiles for all four landscapes came from `create_tiles_pro` with
`tile_feature: 'tileset'` — a 16-tile **corner/transition set** meant for tiles that connect to
*different* neighboring terrain (a path through grass, a shoreline meeting a jungle), not for
repeating one tile uniformly. Reported first against jungle/water, whose foliage clumps and
wave-lines are directional/asymmetric enough that the interlock seams were clearly visible —
"part of a tile set that wants to make a path." Desert sand and cracked urban asphalt are more
noise-like, which hid the same underlying problem well enough that they weren't flagged in the
first pass, but a side-by-side contact-sheet comparison showed the same seam artifacts once
regenerating jungle/coastal proved there was a real, better option available — so all four got
redone the same way, not just the two originally reported.

Regenerated via `create_tiles_pro` *without* `tile_feature` (independent single-terrain tile
variations, not a transition set), `square_topdown`/`top-down` view, 64×64, `outline_mode:
'segmentation'`. Verified the fix by tiling each of the 16 candidates 3×3 into a contact sheet per
terrain and inspecting for visible repeats before presenting options — most candidates in each
batch were genuinely seamless (a real difference from the old tileset-mode tiles, not just a style
change), though the urban batch had more visible-seam candidates than the other three (asphalt/
concrete cracks read as more geometric than sand, foliage, or waves).

| Landscape | Job | Picked | Notes |
| --- | --- | --- | --- |
| Jungle | `c72eff3e-1149-4eb6-85c2-c038099311f0` | `tile_0` | dense leafy canopy |
| Coastal | `eefa9c86-17ce-4e6d-9f8a-f60637e48675` | `tile_11` | deep-blue wave texture — came out lavender/purple rather than blue; see the tint note below |
| Desert | `d3f0fcea-f682-4ecb-a805-d4e023712f7d` | `tile_0` | diagonal wind-ripple sand |
| Urban | `74f751f3-5e13-4942-89a5-6583d253c67a` | `tile_8` | dark cracked asphalt with red debris |

All four picked by the owner from each terrain's contact sheet of candidates, not chosen
unilaterally.

**Coastal tint note**: `operation-nightfall`'s `groundTint` (`missions.ts`) was `0xa9836e` (a warm
tan multiply tuned for the *old* coastal texture), which read oddly against the new lavender-blue
tile — changed to `0xffffff` (neutral, same as Firebreak's) per the owner's call: keep the tile's
actual color rather than fight it with a tint built for different art. `coastal` is only used by
this one mission, so this was a fully-contained change; desert's and urban's own `groundTint`
values weren't touched (desert was already neutral, urban's warm tint reads fine against the new
dark asphalt tile).

Verified live: launched all four missions and confirmed the ground scrolls with no visible seams
in any of them (screenshots taken via canvas capture — Playwright's page-level `screenshot()` and
`canvas.toDataURL()` both intermittently returned solid black for the WebGL-rendered canvas in
this headless environment, a known headless-Chromium/WebGL timing quirk rather than a real
rendering bug; forcing Phaser's Canvas2D renderer for the verification pass, then reverting, got
reliable real screenshots).

**Not done:** gameplay-affecting weather (still visual-mood only, tracked in
[AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md)); a 5th+ landscape if more variety is wanted later.

## UI / Hero art (`public/ui/*.png`)

| Asset | File | Notes |
| --- | --- | --- |
| Favicon | `public/favicon.png` | 64×64 via `create_image_pixflux` (job `a8035600-caed-4aae-8bad-99d74007068c`), bold helicopter gunship silhouette, flat shading/low detail so it stays readable at browser-tab size. Replaces the default Vite/scaffold `favicon.svg`, which was never swapped for real branding — `index.html`'s `<link rel="icon">` updated to `type="image/png"` accordingly. |
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

| Gun icon | File | Notes |
| --- | --- | --- |
| M134 Minigun | `icon-gun-m134.png` | 64×64 via `create_image_pixflux` (job `f5d90481-6deb-4d3b-836d-6e5a40aa97e9`), rotary gatling barrel cluster |
| M60 "Long Gun" | `icon-gun-m60.png` | 64×64 via `create_image_pixflux` (job `6380a89f-889e-4cd5-a556-dcc51a12d10d`), belt-fed machine gun side profile |
| GAU-19 ".50 Cal" | `icon-gun-gau19.png` | 64×64 via `create_image_pixflux` (job `31d4597c-728f-474a-a632-69356d52e83d`), sniper scope crosshair — the zoom-capable gun |
| M249 SAW | `icon-gun-saw.png` | 64×64 via `create_image_pixflux` (job `c5819092-4e1c-4371-876b-ba47aa3e755d`), light machine gun with box magazine |

Shown at 2.2rem in the Armory (Upgrades) screen's gun-tab strip (`.gun-tab-icon`) — see the
2026-09-04 multi-weapon-system log entry in `docs/PROGRESS.md`.

| Mission icon | File | Notes |
| --- | --- | --- |
| Operation Firebreak | `icon-mission-firebreak.png` | 64×64 via `create_image_pixflux` (job `78a0fe07-b1be-441e-8948-6eb2be8ad73b`), crosshair over a desert dune |
| Operation Steel Convoy | `icon-mission-steelconvoy.png` | 64×64 via `create_image_pixflux` (job `34eaf4bc-e539-4ca2-8805-416ab40eadca`), shield protecting a convoy truck |
| Operation Green Hell | `icon-mission-greenhell.png` | 64×64 via `create_image_pixflux` (job `6bdc4410-aa1c-4f70-95ad-fc5ebb5b062d`), handheld distress beacon with a signal wave — first attempt (job `a0f86126-...`) came back as just a plain leaf, no beacon element, regenerated with the signal emphasized |
| Operation Nightfall | `icon-mission-nightfall.png` | 64×64 via `create_image_pixflux` (job `5caaea5f-c94e-473c-99dc-3571b8b1b123`), crescent moon with a rope ladder |
| Operation Riverine Shield | `icon-mission-riverineshield.png` | 64×64 via `create_image_pixflux` (job `64b986c6-b9fe-46af-b29c-331cfeb14335`), boat silhouette with a protective shield behind it |
| Operation Iron Gate | `icon-mission-irongate.png` | 64×64 via `create_image_pixflux` (job `c9e8d33d-31af-4880-90dc-c48d47c21d53`), radio antenna tower with a shield behind it |
| Operation Last Redoubt | `icon-mission-lastredoubt.png` | 64×64 via `create_image_pixflux` (job `9a94bf4d-073c-492a-94f6-1fe397786939`), sandbag bunker with a shield |
| Randomly Generated (procedural) | `icon-mission-random.png` | 64×64 via `create_image_pixflux` (job `d653ce51-270c-415c-9821-f809deb15800`), die with a question mark — one fixed icon regardless of the rolled mission type, since procedural missions have no fixed identity to hang a specific icon on |

Shown at 2.4rem on each Mission Select card (`.mission-list-icon`), same treatment as the
Upgrades screen's track icons.

**Not done:** a mission-type icon for Reconnaissance (still no hand-authored mission of that type).

### Hover-mission ground props (`public/env/cover-*.png`, `public/env/objective-*.png`, 96×96)

Added 2026-09-04 for the "Base Defense" hover-mission archetype (see `docs/PROGRESS.md`) —
stationary terrain cover enemies emerge from, and the defendable ground objective. Both sets
follow the same `create_image_pixflux` "bird's eye aerial view straight down from directly
overhead, as if photographed from a helicopter flying above" prompting the escort vehicle's
regeneration established (view/direction params alone aren't reliable — the text description has
to carry the camera angle).

| Cover variant | File | Notes |
| --- | --- | --- |
| Crates | `cover-crates.png` | job `3c1eeca8-a611-4d73-b2f3-b94243b04acd`, stacked wooden supply crates |
| Sandbags | `cover-sandbags.png` | job `4180d525-d926-4e24-bd08-cb95145db8b7`, sandbag wall fortification |
| Rubble | `cover-rubble.png` | job `9ca09914-1a77-4de3-81cf-56d2168458cc`, collapsed-building debris pile |
| Rocks | `cover-rocks.png` | job `72d74dc4-f220-4bde-9537-f1a71884c6bb`, boulder cluster |

| Defend-objective variant | File | Notes |
| --- | --- | --- |
| Comms Relay | `objective-relay.png` | job `a89f414e-d759-468c-a531-7f77f6cedf25`, radio antenna tower + generator shed |
| Fuel Depot | `objective-depot.png` | job `8ed1a938-a7d6-427c-9952-ad65d3565e52`, fuel drums + storage tank |
| Forward Checkpoint | `objective-checkpoint.png` | job `f561ec9c-b006-4194-87ab-d835a14e2322`, checkpoint building with a barrier gate |

No destroyed/explosion frame for either set — losing the objective cuts straight to the Result
screen exactly like aircraft health hitting 0 already does, so an animation wasn't required to
ship. Cover objects render with no idle tween (explicitly stationary, per the player's request);
the defend objective reuses `buildEscortVehicle()`'s bob+sway tween pattern instead, since it's
still meant to read as "a real object sitting in the world," just one that doesn't move around.

### Rank badges (`public/ui/icon-rank-*.png`, 64×64)

An 8-tier XP-based rank system, shown on the Main Menu next to the player's stats
(`RankBadge` in `MainMenu.tsx`, thresholds/lookup in `src/game/data/ranks.ts`). Follows real
military insignia progression — enlisted chevrons escalating to officer bars, an oak leaf, then
an eagle — so each tier reads as a step up from the last at a glance:

| Tier | XP threshold | File | Notes |
| --- | --- | --- | --- |
| Recruit | 0 | `icon-rank-recruit.png` | job `d47c9af4-700a-4a67-86da-1cc907da656b`, blank patch, no insignia |
| Private | 1,000 | `icon-rank-private.png` | job `646f4284-7b64-41b7-bffd-2af0a1e48eab`, single chevron |
| Corporal | 2,500 | `icon-rank-corporal.png` | job `a5e8906a-c1a5-4273-93d2-79bf5762aa44`, two chevrons |
| Sergeant | 5,000 | `icon-rank-sergeant.png` | job `3b48eabe-294b-4532-b6dd-2e28b6e5ac58`, three chevrons with rocker |
| Lieutenant | 10,000 | `icon-rank-lieutenant.png` | job `597b80a8-ebbb-4237-b320-13d9efc464f8`, single gold bar |
| Captain | 20,000 | `icon-rank-captain.png` | job `bfd3ae6e-d2c1-404e-8fc1-340da279260b`, two gold bars |
| Major | 35,000 | `icon-rank-major.png` | job `25409f93-d633-41bf-9f2f-442baeb129fd`, gold oak leaf |
| Colonel | 60,000 | `icon-rank-colonel.png` | job `02124ec8-d781-4dfb-b1c0-10b8fad39698`, silver eagle |

Thresholds are spaced against the actual reward math (`xpEarned === score` server-side, see
`functions/src/index.ts`) — a full mission clear nets roughly 1,000-4,500 XP depending on the
operation, so early tiers clear in a handful of missions and later tiers take many more, rather
than a flat per-rank XP curve. `getRankProgress(xp)` in `ranks.ts` returns the current tier, the
next tier, and a 0-1 progress fraction; the Main Menu renders that as a small bar with "N XP to
[next rank]" under the badge, or just the badge with no bar once Colonel (max) is reached.

The badge is clickable — opens a modal (`RankListModal`) listing all 8 tiers with the current one
highlighted and marked "YOU", so the player has a reference point for the full ladder, not just
their current rung. Closes on backdrop click or the ✕.

Verified: rank/progress math checked at every tier boundary (999/1000, 2499/2500, ... 59999/60000,
plus 250,000 well past Colonel) via a scratch script — all thresholds and progress percentages
came back correct. All 8 icon files confirmed as valid 64×64 RGBA PNGs and load-tested (200s)
through the dev server. The badge, its click-to-open modal (8 rows, correct "YOU" marker,
closes on backdrop click), and the underlying progress bar were all verified live end-to-end via
Playwright against a real signed-up account on the local emulator suite (this session didn't have
the live-site `pw-verify` test account's credentials — see prior note in this file's history).

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

**Perspective fix (2026-09-04):** the facing-direction fix above still read wrong — it was a flat,
straight-on rear-elevation shot (looking at the tailgate head-on) rather than the aerial/top-down
angle the rest of the game's ground objects use, since the helicopter is flying *over* the convoy,
not trailing behind it at ground level. Regenerated at `view="high top-down"` (job
`b7194e93-5184-4b3e-93d9-86d9a866e171`) — more overhead than the `"low top-down"` used for
everything else, since on the previous attempt the text description alone didn't pull the angle
overhead enough even with `view="low top-down"` set. Now shows the roof and canvas-covered cargo
bed from above, cab still oriented away (matching "driving into the distance," not toward the
viewer).

**Orientation correction (2026-09-04, later same day):** the aerial-angle version above actually
came out with the cab toward the *bottom* of the frame (south/toward the viewer) — a
misjudgment on my part when reviewing it, not what the "faces away" fix was meant to produce.
Corrected with a deterministic 180° image rotation (`sharp`, an npm-installable library, installed
to a scratch dir and removed after — not a project dependency) rather than another AI regeneration,
since the fix needed was an exact, guaranteed transform, not a re-roll. Cab now sits at the top of
the frame (north/away) as intended.

**Full regeneration (2026-09-04, owner request):** regenerated from scratch on a fresh owner
request for a cleaner "top-down 3/4 view from the back, front facing north" base rather than
continuing to patch the earlier version. First attempt (`create_image_pixflux`, `view="high
top-down"` + `direction="north"`) came out as a side-profile "hero shot," not overhead at all —
confirms the earlier-documented lesson that `view`/`direction` are weakly-guiding and the text
description has to carry the angle. Re-prompted with explicit "bird's eye aerial view straight
down from directly overhead, as if photographed from a helicopter flying above" language (job
`7aa0bcdf-5701-4329-a25b-d01e07b11a8a`) — got a clean overhead angle, but the cab landed at the
bottom of the frame again (front toward viewer/south). Same deterministic 180° rotation fix as
before (`sharp`, scratch-installed) rather than re-rolling; cab confirmed at the top (north) this
time by inspecting the *rotated* result directly rather than trusting a single visual read, given
the two earlier misjudgments on this exact asset. Verified live in Operation Steel Convoy via
Playwright.

**Boat variant (`public/env/escort-boat.png`, 96×96, 2026-09-04):** same treatment — bird's-eye
aerial description, same 180° rotation correction after the initial generation put the bow at the
bottom instead of the top. **Wired up the same day** into a new mission, Operation Riverine Shield
(`missions.ts`) — `CombatScene.escortVehicleAsset(landscape)` picks the boat texture automatically
whenever an Escort mission's landscape is `'coastal'`, the same per-landscape-swap idea as the
enemy boat reskins above, just for the one non-enemy ground prop.

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
- [x] Enemy death animation frames (PixelLab, per type) — done, see the Enemies section above.
      Non-lethal hit reaction shipped 2026-09-04 as a procedural white-flash + scale-punch
      (`Enemy.playHitFlinch`), not new PixelLab frames — same call as death (real animation) vs.
      muzzle flash/hit-spark (procedural) below.
- [x] Muzzle flash + hit-spark VFX — procedural tween VFX shipped 2026-09-02 (2); rotor flicker +
      dust kickup also shipped since (see [AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md)'s Visual
      effects section) — nothing open here anymore.
- [x] Menu icons (Upgrades/Settings/Credits) — done 2026-09-03.
