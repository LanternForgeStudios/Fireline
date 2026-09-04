# Fireline — Development Progress

Tracks where the project actually stands against the [GDD](GDD.md#recommended-development-phases)
phases. Update this at the end of each milestone (see the `push-and-deploy` skill). Newest entry
on top.

## Status by GDD phase

| Phase | Goal | Status |
| --- | --- | --- |
| 1 | Core Combat | **Done** — playable shooting prototype |
| 2 | Mission System | **Done** per the GDD's own deliverable ("complete extraction mission") — 3 missions (Search & Destroy, Escort, Extraction) with a select screen, each with distinct visual theming, plus loadout selection via the weapon upgrade system (see Phase 4) |
| 3 | Procedural Content | **Done** per the GDD's own list — seeded generation, encounter blocks, threat budgets, weather/time-of-day variety, and secondary objectives, all shipped. Weather stays visual-mood only, not gameplay-affecting — a deliberate scope call, not a gap |
| 4 | Backend | **Done** — see below |
| 5 | Release | Not started (web live on GitHub Pages; iOS/Capacitor future) |

## Backend (Phase 4) detail

- [x] Firebase project (`fireline-lf`) created
- [x] Firebase Authentication — Google + Email/Password sign-in, gates play
- [x] Firestore — `players/{uid}` profile (xp, credits, missionsCompleted/Failed, bestScore,
      unlockedUpgrades) + `players/{uid}/missionResults/{id}` history, live-synced to the UI
- [x] Firestore security rules — per-player read/write isolation (`firestore.rules`)
- [x] App Check (reCAPTCHA Enterprise) **enforced** on Firestore/Auth (owner flipped it in Console
      2026-09-04, after the provider/project-mismatch fixes below made App Check actually work end
      to end). Verified live immediately after: fresh sign-in, Firestore player-profile read, and a
      full mission launch all succeeded with zero Firestore/Auth/App Check errors.
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
- [x] Per-operation lifetime stats — `players/{uid}/missionStats/{missionId}` (`completions`,
      `highestDifficulty`), server-maintained inside `submitMissionResult`'s existing transaction.
      Read-only to the client, same model as `missionResults`.

## Log

### 2026-09-04 (30) — Combat music: play the intro once, loop only the body
- combat.ogg previously looped the entire 73.37s file from 0, intro included, via Phaser's
  `sound.play({ loop: true })` — every ~73s the player heard the same intro flourish restart.
  Ran two automated waveform analyses (exact-repeat cross-correlation; energy-envelope scan for a
  structural intro/body boundary) trying to find a confident splice point in the actual audio;
  neither found a strong signal, which points to this file being the pack's "full preview" render
  rather than the dedicated loop-optimized export its license PDF documents (that file isn't in
  this project's copy of the pack — see the existing note above). Picked user option: ship a
  best-guess loop point now rather than block on sourcing the real file.
- `COMBAT_MUSIC_LOOP_START_SEC = 29.0` in `CombatScene.ts`, the least-weak candidate from the
  correlation pass — a best guess, not a verified splice.
- Implemented via the raw Web Audio API's `AudioBufferSourceNode.loopStart`/`loopEnd` (the native,
  sample-accurate tool for exactly "play once, then loop only a subrange") rather than Phaser's
  `sound.play({ loop: true })`, which always loops the whole buffer back to 0 with no way to offset
  just the repeat passes. Reuses Phaser's own decoded buffer (`sound.add(key).audioBuffer` — NOT
  `this.cache.audio`, which doesn't hold the decoded WebAudio-backend buffer) and Phaser's existing
  AudioContext, so this doesn't spin up a second audio graph. Falls back to Phaser's normal
  whole-buffer loop if the WebAudio backend isn't active.
- Verified live via Playwright: confirmed `combatMusicSource.{loop,loopStart,loopEnd}` are correct
  on a fresh mission launch (not just after Phaser's own asset cache warms up — the first check
  hit a test-harness timing gotcha, not a real bug: `window.__fireline` becomes available at
  `Phaser.Game` construction, well before the async preload that fetches/decodes combat.ogg
  finishes, so the test needed to wait for the actual signal instead of a fixed delay) and again
  after a scene restart (fresh node, same loop config, old node stopped cleanly on `SHUTDOWN`).
  Could not verify by ear whether 29.0s actually sounds seamless — that needs a real listen.

### 2026-09-04 (29) — Fixed laggy UI click sounds
- Player-reported: UI SFX (button clicks etc.) sometimes played noticeably late relative to the
  click. Root cause: `playUiSound()` (`src/audio/uiSound.ts`) called `new Audio(src)` followed
  immediately by `.play()` on *every single call* — building a fresh `HTMLAudioElement` forces the
  browser to fetch and decode the file from scratch before playback can start, paying that latency
  on every click, not just the first.
- Fixed by pre-creating and preloading one cached `Audio` element per sound file at module load
  (`preload = 'auto'`), so the fetch/decode happens up front during idle time; `playUiSound()` now
  just resets `currentTime` to 0 on the cached element and plays.
- Verified live via Playwright: instrumented the real `Audio` constructor to time from `.play()`
  call to the `playing` event actually firing (audible-frame latency, not just call overhead) —
  every play, including the first "cold" one, now fires within ~1ms, down from paying a full
  fetch+decode on each click before.

### 2026-09-04 (28) — Clickable rank list modal, weapon upgrades expanded to 10 levels/track
- The rank badge on the Main Menu is now clickable, opening a modal listing all 8 rank tiers
  (icon, name, XP threshold) with the player's current tier highlighted and marked "YOU" — a
  reference for where they stand and what's still ahead, not just the single current badge.
  Closes on backdrop click or the ✕ button (`RankListModal` in `MainMenu.tsx`).
- Expanded all 4 weapon upgrade tracks (Rounds, Cooling, Heat Capacity, Fire Rate) from 3 levels to
  10. The original 3 hand-picked values per track were already a near-exact fit for a formula —
  cost(n) = 50·(n²+n+1) for credits, and each stat's own ~1.2-1.25x-per-level geometric ratio for
  its effect — so levels 4-10 continue those same formulas rather than inventing new curves. Costs
  now run 150cr (L1) up to 5,550cr (L10); maxing one track costs 22,500cr total, all four costs
  90,000cr. See `src/game/data/upgrades.ts` for the exact per-level values.
- Updated the server-side mirror (`functions/src/upgradeCatalog.ts`, same cost formula) and
  redeployed Cloud Functions — `purchaseUpgrade`'s validation logic already walked `levels[]`
  generically (no track-length assumption), so this was a pure data change, no logic change.
- Verified live end-to-end via Playwright against the local emulator suite: rank modal opens with
  all 8 rows and exactly one "YOU" marker on the correct current tier, closes on backdrop click;
  Upgrades screen renders 10 dots per track cleanly at a 375px mobile viewport with no overflow;
  a real purchase (via a debug-hook-forced mission completion for test credits, then buying Rounds
  level 1) went through the actual rebuilt Cloud Function, deducted the right cost, filled the
  first dot, and updated the button to the level 2 price — confirming client/server catalogs agree
  end to end, not just that they match on paper.

### 2026-09-04 (27) — Hit-flinch reaction on non-lethal hits
- Enemies previously gave zero visual feedback on a hit that didn't kill them — nothing happened
  until the health bar ticked down, unlike the death animation's clear payoff on a kill. Added a
  brief flinch reaction (`Enemy.playHitFlinch()`): a white flash via Phaser 4's `setTint(0xffffff)
  .setTintMode(TintModes.FILL)` (the documented way to flash a sprite white on a hit) plus a quick
  scale "punch" tween on the sprite.
- Purely procedural, no new art — applied uniformly to every enemy type/texture (humanoid,
  vehicle, drone, coastal boat reskin alike), unlike the walk cycle which only exists for the 4
  humanoid types.
- The punch tween runs on `sprite.scaleX/Y`, never on `container.scale` — the container's scale is
  rewritten every frame by `update()` from the enemy's approach progress, so a tween on it would
  just get overwritten the next tick. Runs independently of the walk-cycle animation (tint/scale
  vs. `sprite.play()`), so a flinch mid-walk doesn't interrupt the walk loop.
- Verified live end-to-end via Playwright against a real signed-up account on the local emulator
  suite (this session didn't have the `pw-verify` live-site credentials — see prior entry): loaded
  a mission, called `playHitFlinch()` on a live enemy, and confirmed via `sprite.isTinted`
  (`false` → `true`, `tintMode: 1`/FILL) plus a direct before/after screenshot that the sprite
  visibly flashes solid white. Also confirmed the scale punch returns cleanly to baseline after
  the tween (0.4375 → 0.516 → 0.4375) and that a humanoid's walk animation keeps playing
  uninterrupted through a flinch.

### 2026-09-04 (26) — Rank badge system (8 tiers, XP-based)
- Added an 8-tier military rank system (Recruit → Private → Corporal → Sergeant → Lieutenant →
  Captain → Major → Colonel), driven by the `xp` field already tracked on `PlayerProfile` — no
  backend changes needed, this is purely a new client-side display over existing data.
- Thresholds (`src/game/data/ranks.ts`) are spaced against the real reward math (`xpEarned ===
  score` server-side): a full mission clear nets roughly 1,000-4,500 XP depending on the
  operation, so early tiers clear in a handful of missions and later tiers take many more.
- Generated 8 PixelLab insignia icons following real military rank progression (blank patch →
  chevrons → bars → oak leaf → eagle) so each tier reads as a clear step up from the last — see
  [ART_ASSETS.md](ART_ASSETS.md) for the full table and job IDs.
- Shown on the Main Menu (`RankBadge` in `MainMenu.tsx`): icon, rank name, and a progress bar with
  "N XP to [next rank]", or just the badge once Colonel (max tier) is reached.
- Verified the threshold/progress math at every tier boundary via a scratch script (all correct)
  and confirmed all 8 icons are valid 64×64 PNGs that load through the dev server. Did **not**
  verify the live on-screen layout against a signed-in account — this session didn't have the
  `pw-verify` test account's credentials on hand. Worth a quick look next time the site's open.

### 2026-09-04 (25) — Character API walk-cycle prototype, rolled out to 4 humanoid enemy types
- Prototyped the PixelLab **Character API** (`create_character` v3 mode, using each enemy's
  existing sprite as a reference image) on infantry first, to evaluate quality/cost before
  committing further — per an earlier open design question about Character API vs Object API.
  Quality was excellent (faithfully preserved the original design) and cost was low (~9
  generations per type for a full 8-direction character + 8-direction walk cycle).
- Decided against full 8-direction rollout: enemies close in almost straight toward the viewer in
  this game, so 7 of 8 generated directions would rarely be seen — not worth the extra cost/
  complexity. Rolled out a **south-only looping walk cycle** instead, replacing the single static
  frame enemies previously sat on for their entire approach.
- Applied to the 4 **humanoid** enemy types only (infantry, gunner, rocket, commander) — the
  Character API doesn't support vehicles/aircraft, so technical/armored/drone keep their existing
  static Object API sprites (fine, since those don't need a walk cycle the way a soldier does).
- Verified live: walk animation confirmed actively playing during approach, cleanly interrupted by
  the existing death animation on kill, and confirmed **not** applied to coastal boat-reskinned
  enemies (which reuse these same 4 type IDs but render as boats — the walk frames are soldier
  art, so `Enemy.ts` gates playback on the actual texture key in use, not just the enemy type).
  See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (24) — Music re-encode, escort vehicle orientation correction
- Music tracks re-encoded 128kbps (from ~500kbps): `menu.ogg` 6.9MB → 2.0MB, `combat.ogg` 4.2MB →
  1.1MB, same duration to the millisecond. Used `ffmpeg-static` (npm-installable, scratch-installed
  and removed after — not a project dependency), verified by loading both through the real dev
  server into an `<audio>` element rather than trusting ffmpeg's own decode check alone. See
  [AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md).
- Escort vehicle was actually facing backwards after the aerial-angle regeneration — the cab sat
  toward the bottom of the frame (south/toward the viewer), a misjudgment when reviewing that
  generation, not the intended fix. Corrected with a deterministic 180° rotation (`sharp`, same
  scratch-install-and-remove pattern) rather than another AI re-roll, since the needed fix was an
  exact transform. See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (23) — Mission-end sting respects music volume, bigger enemies again, escort vehicle aerial angle
- **Real bug found and fixed:** the earlier music-hydration-race fix didn't cover the reported
  "music still plays after an operation finishes" case — traced with debug logging through the
  full mission-completion flow and found the actual source: `mission_complete`/`mission_failed`
  (musical-sounding synth stings, played via `playUiSound` on the result screen) were volume-gated
  by `sfxVolume`, not `musicVolume`. A player who muted music but left SFX volume up would still
  hear that sting at full SFX volume right at mission end — technically "honoring settings"
  (SFX volume was respected), but not matching what a player experiences as "music." Reclassified
  those two sounds to respect `musicVolume` instead, in `uiSound.ts`. Verified via debug logging:
  `playUiSound mission_complete appliedVolume= 0` with music muted, even with SFX volume left at
  its default 0.8.
- Enemies spawn another 50% larger again (`SPAWN_SCALE` 0.525 → 0.7875 in `Enemy.ts`), same
  unchanged growth-as-it-approaches curve as before, so impact size grows too, not just spawn
  size. Second bump on top of the earlier +50% (0.35 → 0.525 → 0.7875 total).
- **Escort vehicle art fixed again:** the previous regeneration fixed the *facing* direction but
  came out as a flat, straight-on rear-elevation shot rather than the aerial/top-down angle the
  rest of the game's ground objects use. Regenerated with `view="high top-down"` (more overhead
  than the `"low top-down"` used elsewhere, since the text description alone wasn't pulling the
  angle overhead enough on the prior attempt) — now shows the roof and cargo bed from above,
  matching "flying over the top of it." See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (22) — Main Menu: sign-out confirmation, subtler Credits link
- Sign out is now a `.btn-danger` (red-outlined) button that requires confirmation — click shows
  "Sign out of your account?" with Cancel/Confirm, matching the existing confirm-before-destructive-
  action pattern already used for Settings' "Reset progress." Previously a single click signed out
  immediately with no confirmation.
- Credits (the attribution screen, not the player's in-game currency shown in the stats line) is
  now a small underlined text link below the Sign Out button instead of a full icon+button in the
  Upgrades/Settings row — de-emphasized since it's a low-priority, legally-required-but-not-primary
  nav item.

### 2026-09-04 (21) — Fourth hand-authored mission (jungle), Mission Select icons
- **Operation Green Hell** — a Rescue-type mission using the jungle landscape, closing the gap
  where jungle only existed for procedural missions. 4 waves (Undergrowth Contact → Flanking
  Patrol → River Crossing → LZ Secure), `no-damage` secondary objective (+95 credits), warm dusk
  sky tint chosen to pair with the jungle backdrop's own baked-in sunset. Added to both
  `src/game/data/missions.ts` (client) and `functions/src/missionCatalog.ts` (server-side reward
  bounds — required, or `submitMissionResult` would reject it as an unknown mission). Verified
  live against the emulator: mission completes, records correctly, bonus objective credits land.
- **Mission Select icons:** each of the 4 hand-authored missions now shows a PixelLab icon
  (crosshair/dunes, shield/truck, distress beacon, moon/ladder — one per operation's theme), plus
  a fixed die-with-question-mark icon on the procedural mission card. Same visual treatment as the
  Upgrades screen's track icons. See [ART_ASSETS.md](ART_ASSETS.md).

### 2026-09-04 (20) — Fix mobile-landscape canvas mis-centering
- **Real bug found and fixed:** on mobile landscape (any phone aspect wider than the game's fixed
  16:9 world — most of them), the combat canvas wasn't centered — noticeably more black space on
  the left than the right. Root cause: `.game-canvas`'s CSS (`display: flex; align-items: center;
  justify-content: center`) and Phaser's own `Scale.FIT` + `CENTER_BOTH` centering (an inline
  margin on the `<canvas>` element) were both trying to center the canvas at once — the flexbox
  re-centered the canvas's already-margined box, landing it off-center. Invisible on a ~16:9
  desktop viewport (Phaser's own margin is ~0 there, so there's nothing for the flexbox to
  conflict with) — only shows up when Phaser actually needs a real centering margin, i.e. mobile
  landscape. **Not a regression from this session's portrait/landscape work** — traced via
  `git log -S` to the original scaffold commit (`23c3bec`); it just never got exercised by real
  mobile-landscape testing until now. Fixed by removing the redundant flex-centering from
  `.game-canvas` — Phaser's own centering is sufficient on its own. Verified via Playwright on an
  844×390 landscape viewport: canvas is now symmetrically centered (75px black bar each side,
  matching the expected FIT-letterbox math exactly) instead of the previous 112.8px/37.9px split.
- Some letterboxing on the sides is still inherent to keeping a fixed 16:9 world on phone aspect
  ratios wider than that (most of them) — this fix corrects the *centering*, not the remaining
  gap itself. Eliminating that entirely would mean a bigger change (dynamic world width, or
  `Scale.ENVELOP` with its own crop-vs-HUD tradeoffs) — not attempted here, flagged as a possible
  follow-up if it's still wanted after seeing the corrected centering in person.

### 2026-09-04 (19) — Music volume hydration race, escort vehicle facing + movement
- **Real bug fixed:** menu music could briefly play at the default volume (0.6) on load even for a
  returning player who'd saved it at 0 — `playMusic()` fired on mount before the real setting had
  hydrated from Firestore. Fixed by gating it on the player profile actually being loaded
  (`App.tsx`'s music effect now depends on `profile`, not just `screen`). See
  [AUDIO_AND_POLISH.md](AUDIO_AND_POLISH.md).
- **Escort vehicle facing fixed:** the truck showed its cab/windshield toward the camera, reading
  as driving at the helicopter instead of traveling alongside it. Regenerated facing away
  (rear/tailgate toward the viewer). Checked the enemy vehicle sprites for the same class of
  issue — they're 3/4-profile shots that don't make a directional claim either way, so no
  mismatch there. See [ART_ASSETS.md](ART_ASSETS.md).
- Escort vehicle now also sways side to side (on a different tween period than its existing
  vertical bob) so it reads as doing something rather than sitting totally still.

### 2026-09-04 (18) — Larger enemy targets (mobile + desktop)
- Enemies now spawn 50% larger (`SPAWN_SCALE` 0.35 → 0.525 in `Enemy.ts`) and still grow the same
  amount on top of that as they approach (`APPROACH_SCALE_GROWTH` unchanged at 1.55) — player
  feedback that targets were hard to track/hit, especially on mobile. Hit-detection radius
  (`Enemy.containsPoint`) and the touch aim-assist radius (`CombatScene.applyTouchAimAssist`) both
  read `container.scale` directly rather than a hardcoded constant, so both grew in step
  automatically — no separate tuning needed there.

### 2026-09-04 (17) — Fourth landscape: jungle
- Added `jungle` as a 4th `LandscapeId` — ground tile + backdrop via PixelLab (dense foliage tile,
  palm-silhouette sunset skyline with birds), wired into `CombatScene`'s
  `LANDSCAPE_GROUND_FILE`/`LANDSCAPE_MOUNTAIN_FILE` maps and `generateMission.ts`'s `LANDSCAPES`
  pool. Procedural-only for now — no hand-authored mission uses it yet (Firebreak/Steel
  Convoy/Nightfall keep their existing desert/urban/coastal assignments). See
  [ART_ASSETS.md](ART_ASSETS.md).
- Confirmed the procedural generator already rolls a landscape independently of weather/mission
  type for every generated mission (`rng.pick(LANDSCAPES)` in `generateMission.ts`, unchanged
  logic, just a longer pool now) — this was already correct, not a new bug fix.
- Verified live: rerolled Mission Select until landing on jungle (using a temporary debug log to
  confirm which landscape a given reroll produced, removed before committing), launched it,
  confirmed the backdrop/ground/enemies all render correctly with zero missing-asset errors.

### 2026-09-04 (16) — Upgrade screen visual pass, coastal boat enemies, Escort ground vehicle
- **Upgrades screen:** each track now shows a PixelLab icon (bullet/snowflake/gauge/lightning bolt
  for Rounds/Cooling/Heat Capacity/Fire Rate) plus a per-track accent color on the card's left
  border, replacing the plain text list. A maxed-out track gets a gold border/tint instead of its
  normal accent. See [ART_ASSETS.md](ART_ASSETS.md).
- **Coastal boat reskins:** ground vehicles/infantry standing on open water read wrong, so every
  non-aerial enemy type (all but Drone) now gets a boat/watercraft texture swap on coastal
  missions (`COASTAL_BOAT_TYPES`/`enemyTextureKey` in `CombatScene.ts`) — same stats, same death
  animation as the land version, just the base sprite differs. Verified live on Operation
  Nightfall: multiple distinct boats visible on the water, zero missing-texture placeholders.
- **Escort ground vehicle:** `mission.type === 'Escort'` missions (Operation Steel Convoy today)
  now show a friendly, non-hostile-looking supply truck sitting in the mid-ground — sells the
  "you're escorting this convoy" premise instead of empty terrain. Purely decorative: never added
  to `this.enemies`, so it can't be targeted or damaged. Held roughly fixed on screen with a
  gentle bob (not a scroll), same reasoning the helicopter itself doesn't move on screen.
- **Process note:** a background subagent tasked with *only* generating the boat images went out
  of scope and also wrote the texture-swap logic into `CombatScene.ts` on its own initiative,
  colliding with the same code I was writing concurrently (`COASTAL_BOAT_TYPES` declared twice —
  a Vite parse error, caught immediately via a live Playwright check). Redirected the agent to
  images-only and removed its code; no lasting damage, but worth remembering that "just generate
  these assets" instructions don't reliably stop a capable agent from also wiring them up.

### 2026-09-04 (15) — Per-operation completion stats (times completed, highest difficulty)
- Added `players/{uid}/missionStats/{missionId}` — a small per-mission doc tracking
  `completions` and `highestDifficulty`, maintained server-side inside `submitMissionResult`'s
  existing transaction (only a `'complete'` outcome moves either field; a failed attempt at a
  higher difficulty doesn't retroactively claim it). `MissionResult` gained a `difficulty` field
  (sourced from `audioSettings.difficulty`) so the server has something to compare against.
- The Function now returns the operation's updated `completions`/`highestDifficulty` in its
  response, so the result screen can show them immediately without a second read racing the
  write. `recordMissionResult` (client) returns that; `loadAllMissionStats` bulk-fetches the whole
  `missionStats` collection once per sign-in (a handful of small docs — cheaper than N per-mission
  listeners) for Mission Select's per-card display.
- Shown on **both** the result screen ("This operation: completed 2× · highest difficulty
  Normal") and Mission Select (a line under each hand-authored mission's blurb) — the random
  mission doesn't get one, since it gets a fresh id every reroll and has no persistent identity to
  accumulate history against.
- `resetProgress` now also wipes `missionStats` alongside `missionResults`, so "reset my save"
  doesn't leave stale completion counts behind. Extracted the batched-delete-a-collection loop
  into a shared `deleteAllDocs` helper (previously inlined, now used twice).
- **Verified against the Local Emulator Suite**: forced two `endMission('complete')` calls and one
  `endMission('failed')` via a temporary debug hook (reverted after) — completions correctly went
  0→1→2, highest difficulty tracked correctly, and the failed run left both fields unchanged.
  Confirmed live on both the result screen and Mission Select. Caught and fixed a real gotcha in
  the process: the Functions emulator was silently serving a **stale compiled `functions/lib/`**
  (only watches for file changes, doesn't run `tsc` itself) — `npm run build` inside `functions/`
  is required after editing `functions/src/*.ts` for local testing to reflect the real change.

### 2026-09-04 (14) — Second half of the App Check fix: wrong GCP project for the site key
- The provider swap in the entry below fixed the client/Console *provider* mismatch (confirmed by
  the exchange call correctly switching to `exchangeRecaptchaEnterpriseToken`), but live
  verification turned up a **second, independent bug**: the exchange now failed with `"Unable to
  call the reCAPTCHA Enterprise CreateAssessment method; ensure that the reCAPTCHA Enterprise API
  is enabled and that the site key is from the same project as the one containing this app."`
- **Root cause:** the reCAPTCHA Enterprise key lived under a completely different, unrelated
  Google Cloud project (`fireline-507502`) than the actual Firebase project (`fireline-lf`,
  project number `643236089836` — confirmed via `firebase projects:list`, which doesn't list
  `fireline-507502` at all). App Check's `CreateAssessment` call requires the key to be in the
  *same* GCP project as the Firebase app; a key from any other project fails outright regardless
  of whether the reCAPTCHA Enterprise API is enabled there. Likely cause of the mixup: Cloud
  Console's project switcher had two entries both display-named "fireline" (only distinguishable
  by the Project ID field), and Cloud Console's raw navigation kept defaulting to the wrong one.
- **Fix:** created a new reCAPTCHA Enterprise key directly under `fireline-lf` (via a
  `?project=fireline-lf`-scoped Console link to force past the project-switcher ambiguity),
  domain `lanternforgestudios.github.io`, score-based. Swapped the new key into
  `RECAPTCHA_ENTERPRISE_SITE_KEY` in `src/firebase/config.ts`.
- **Verified live, end to end:** the App Check exchange now returns `200` with a valid token
  (`"provider":"recaptcha_enterprise"`, correct project audience, 1hr TTL) — confirmed via a
  direct network-response check against the deployed site. Player-confirmed after: completed a
  mission on the live site and credits/XP landed correctly. This also unblocks `resetProgress` and
  `purchaseUpgrade`, which were failing for the same underlying reason.
- **Unrelated, same-session cleanup:** also bumped the deploy workflow's pinned GitHub Actions
  (`checkout` v4→v7, `setup-node` v4→v7, `configure-pages` v5→v6, `upload-pages-artifact` v3→v5,
  `deploy-pages` v4→v5) to clear a "Node.js 20 actions are deprecated" warning — all had already
  migrated to the Node 24 runtime in their latest majors (GitHub is removing Node 20 support
  2026-09-23). No behavior change for this workflow's simple usage of each.

### 2026-09-03 (13) — Fix App Check provider mismatch breaking all progression on the live site
- **Real, live-site-breaking bug found and fixed.** Reported symptom: "completed a mission,
  earned no credits" — investigation showed it was much bigger than credits: App Check's
  reCAPTCHA token exchange was failing on the live site
  (`content-firebaseappcheck.googleapis.com/.../exchangeRecaptchaV3Token` → 400 `"App not
  registered: 1:643236089836:web:81b5e92d625b0096c53ac9."`), and since deployed Cloud Functions
  enforce App Check (`enforceAppCheck: !isEmulator` — see the Backend detail table above), that
  meant **every** call to `submitMissionResult`, `resetProgress`, and `purchaseUpgrade` was being
  silently rejected in production, for every player, since Functions started enforcing it. The
  client swallows the failure with `.catch(console.error)` (`App.tsx`), so nothing ever surfaced
  it — no error toast, nothing. Not new from this session's changes; this had already been
  live-broken.
- **Root cause:** the client was initializing App Check with `ReCaptchaV3Provider`, but the app
  is registered in Firebase Console -> App Check -> Apps under **reCAPTCHA Enterprise**, not the
  (now-deprecated) v3 provider — a provider/registration mismatch fails token exchange outright.
  Firebase requires the client SDK provider to match what's registered for the app: v3 talks to
  `exchangeRecaptchaV3Token`, Enterprise to `exchangeRecaptchaEnterpriseToken`, and Console only
  accepts tokens from the one actually registered.
- **Fix:** `src/firebase/config.ts` now uses `ReCaptchaEnterpriseProvider` in place of
  `ReCaptchaV3Provider` (same site key — `firebase/app-check`'s Enterprise provider takes an
  Enterprise score-based site key with the same `6L...` shape, and Console confirmed this one is
  registered as Enterprise). Couldn't fully reproduce the fix locally (dev mode routes through the
  App Check *debug*-token exchange instead of the real reCAPTCHA flow, and the Enterprise site
  key's domain allowlist likely only covers the production domain anyway) — verify live after
  deploy: sign in on the live site, complete or fail a mission, confirm credits/XP actually land
  in the player profile.

### 2026-09-03 (12) — Easy-mode difficulty tuning, desktop touch-pad visibility, mobile portrait fix
- Easy mode now also boosts aircraft max health (130 instead of 100) and slows enemy return fire
  (`fireIntervalMult`) — previously only enemy health/damage were softened, and player feedback
  was that even easy felt punishing. `DIFFICULTY_MULTIPLIERS` gained `fireIntervalMult` and
  `aircraftHealthMult` alongside the existing `health`/`damage` factors.
- Touch pads are functionally touch-only already (`engagePad` only fires for touch pointers) —
  they're now also visually hidden on devices with no touch support (`supportsTouch()` check in
  `CombatScene.buildPadSide`), instead of sitting idle over a mouse player's view.
- **Mobile portrait fix:** the combat view is a fixed 1280×720 (16:9) world with `Scale.FIT` —
  on a tall/narrow phone held in portrait, FIT's scale is capped by the *width*, so the canvas
  shrank to a small strip with huge empty space above/below (exactly the reported "battle screen
  much smaller in portrait" symptom). Rather than re-tuning every gameplay position constant
  (`HORIZON_Y`, `IMPACT_Y_RANGE`, `GUN_ORIGIN`, `TOUCH_PAD_Y`, etc.) to a dynamic aspect ratio,
  touch devices held in portrait during combat now get a "Rotate your device to landscape to fly"
  overlay (`GameCanvas.tsx`), with the Phaser scene paused underneath (`game.scene.pause`) until
  they rotate back — matches the genre convention for landscape-only mobile games, and avoids
  touching the many already-tuned position constants. Verified via Playwright with iPhone 13
  device emulation: prompt shows in portrait, scene pauses; rotating to landscape resumes and the
  canvas fills the viewport properly (thin top/bottom bars from the aspect mismatch, not the
  previous large empty strip).
- **Local dev note (not a shipped bug):** while investigating a "no credits earned" report, found
  the Local Emulator Suite's Cloud Functions emulator can fail to load function definitions on
  boot (`Cannot determine backend specification. Timeout after 10000ms` — an intermittent
  discovery-timeout flake, not a code issue; the compiled `functions/lib/index.js` loads fine
  standalone). When that happens, `submitMissionResult` never registers, so every mission-complete
  call to it fails — silently, since `App.tsx`'s `recordMissionResult(...).catch(console.error)`
  has no user-facing surface for that failure. Restarting the emulator suite clears it. Doesn't
  affect the deployed production Functions. Worth revisiting whether that catch should surface
  something to the player (a toast, a retry) rather than failing invisibly, even for the rarer
  real-world case (e.g. a dropped connection) — not done here since it's speculative UX scope
  beyond this session's reported bug.

### 2026-09-03 (11) — Enemy death animations + landscape variety (coastal, urban)
- Replaced the placeholder scale-up-and-fade death effect with real PixelLab animations for all 7
  enemy types (`animate_object`, 7 frames each — see [ART_ASSETS.md](ART_ASSETS.md)). Required
  converting each enemy's visual from a Phaser `Image` to a `Sprite` (`Enemy.ts`) so it can play an
  animation, and registering each `${id}-death` AnimationManager entry once per texture load
  (`CombatScene.buildEnemyAnimations`, guarded with `this.anims.exists()` since the
  AnimationManager is shared/global across scene restarts, not per-scene).
- Added 2 new landscapes (coastal, urban) alongside desert — each with its own ground tile
  (`create_tiles_pro`) and backdrop (`create_image_pixflux`). `landscape` is now its own field on
  `MissionTheme`, independently rolled from weather for procedural missions
  (`generateMission.ts`), and hand-picked per hand-authored mission to match its narrative (desert
  for Firebreak, urban for Steel Convoy, coastal for Nightfall).
- Caught and fixed a real bug before it shipped: initially planned to keep the ground/mountain
  texture keys fixed and just repoint `preload()` at a different file per mission — would have
  silently broken, since Phaser's texture cache skips reloading an already-existing key across
  scene restarts. Fixed by making the keys landscape-specific
  (`` `ground-art-${landscape}` ``/`` `mountains-art-${landscape}` ``).
- **Verification note:** after deploying, a live Playwright sweep-and-fire test repeatedly
  registered 0 kills, which initially looked like a real regression from the Image→Sprite swap.
  Root-caused with a targeted diagnostic instead (a temporary `window.__fireline` debug hook in a
  local dev build, calling `handleFiring()` with the crosshair forced exactly onto a live enemy
  and damage forced lethal) — the kill path (`containsPoint` → `takeDamage` → removal →
  score/`enemiesDestroyed`) fired correctly on the first try. The 0-kill sweep results were an
  artifact of the automated test's blind mouse-sweep aiming against small, fast-moving targets,
  not a code bug. No production code changed as a result; the debug hook was reverted after use.

### 2026-09-03 (10) — Enemy return-fire projectiles + touch aim assist
- Enemies that already fired back (gunner, rocket, technical, armored, commander) now launch a
  visible tracer bolt (`spawnEnemyProjectile`, distinct red/orange tint and additive blend from the
  player's own pale-yellow tracer) that travels from the enemy to the gun mount and applies damage
  on arrival rather than instantly on trigger — gives the player a beat to react/reposition instead
  of taking unavoidable instant damage.
- Added touch-only aim assist: while dragging the touch pad, the crosshair gets pulled toward the
  nearest enemy within a small bonus radius (`applyTouchAimAssist`, `AIM_ASSIST_RADIUS_BONUS` /
  `AIM_ASSIST_STRENGTH`), addressing reported difficulty tracking fast-closing targets on mobile.
  Mouse aiming is untouched (still direct 1:1 cursor position).

### 2026-09-03 (9) — Menu icons + rotor flicker / dust kickup VFX
- Added PixelLab-generated icons to the Main Menu's Upgrades/Settings/Credits buttons.
- Added rotor-blade flicker and ground dust kickup VFX to combat (both procedural, no new art) —
  live-verified in an actual mission via Playwright.

### 2026-09-03 (8) — Playwright self-verification, 4 real mobile bugs found and fixed
- Added `playwright` as a devDependency and a real test account
  (`pw-verify@lanternforgestudios.dev`) on the live Firebase project, purpose-built for
  screenshot-based self-verification instead of relying on hand-checking every change. Running it
  against the **live GitHub Pages site** (not a local `vite preview`, which turned out to silently
  mis-serve `/Fireline/`-base-path assets and isn't representative of the real deploy — see the
  scratch investigation notes in this session if that ever needs revisiting) at a 375×667 mobile
  viewport immediately paid for itself: found 4 real, previously-unverified UI bugs in one pass:
  1. `.title` ("FIRELINE") was a fixed `4.5rem` — wider than a phone screen, dragging the whole
     Main Menu into horizontal overflow. Fixed with `clamp(2.5rem, 11vw, 4.5rem)`.
  2. `.menu-icon-row` (Upgrades/Settings/Credits buttons) had no wrap, contributing to the same
     overflow. Added `flex-wrap: wrap; justify-content: center;`.
  3. `.upgrade-track-list` had its own nested `max-height: 22rem; overflow-y: auto` *inside* the
     already-scrolling `.screen` — a double-scroll container that clipped the last upgrade card
     with no visible indicator there was more below. Removed the inner scroll; one is enough.
  4. Mission Select's "Randomly Generated · <type>" header text was colliding with the wave count
     on wrap. Changed `.mission-list-header` to `align-items: flex-start` with a dedicated flexible
     `.briefing-type` and non-shrinking `.hud-label`, and glued the separator dot to "Generated"
     with a non-breaking space so it doesn't end up alone on its own line.
  Also found and fixed a 5th, non-CSS bug: the procedural mission name generator's word pool still
  included `Firebreak`/`Steel Convoy`/`Nightfall` — the exact names of the 3 hand-authored missions
  — so it could (and did) generate a mission literally called "Operation Nightfall" with unrelated
  content. Removed those 3 words from `NAME_WORDS` in `briefingTemplates.ts`.
- **Verified against production** (all screenshots taken against the live site after each deploy,
  not assumed from reading the CSS): confirmed `document.documentElement.scrollWidth ===
  clientWidth` (no horizontal overflow) on Main Menu, Upgrades, and Mission Select at 375px width;
  confirmed the Upgrades list's last card and its scroll-to-bottom content are both fully visible;
  confirmed generated mission names no longer collide with the hand-authored 3.

### 2026-09-03 (7) — Secondary objectives (closes GDD Phase 3)
- Every mission — the 3 hand-authored and every procedurally generated one — now has a
  `secondaryObjective`: `no-damage` (finish without the aircraft taking any damage) or
  `clean-sweep` (destroy every enemy spawned, let none reach the helicopter), paying a credit
  bonus on top of the normal reward. Only awarded on a `complete` outcome — a failed mission
  doesn't get partial credit for "would have kept the streak."
- `CombatScene` tracks it live (`noDamageTaken`/`totalEnemiesSpawned`) and reports
  `secondaryObjectiveComplete` in the `MissionResult`. `submitMissionResult` re-checks this
  server-side against its own bounds catalog rather than trusting the client's flag — same model
  as everything else progression-related. Generated missions get a bonus scaled to the mission's
  real max score (~20% of a hypothetical full-clear's credits); the server-side fallback for
  `random-*` ids uses the same generous ceiling the rest of that validation already relies on.
- Mission Briefing shows the objective before launch; Result Screen shows whether it was met and
  what it paid.
- **Verification note:** confirmed via two clean `tsc` compiles (frontend and functions) and a
  clean predeploy build at actual deploy time, but **not** via a live emulator round-trip test —
  unlike `submitMissionResult`'s and `purchaseUpgrade`'s original verification, both of which were
  exercised end-to-end against the Local Emulator Suite. The system was under heavy, sustained I/O
  load this session (git, npm, even PowerShell process queries were all taking 10-100x longer than
  normal) and the Functions emulator's 10-second discovery timeout failed twice in a row before
  the user reasonably suggested backing off rather than keep retrying against a struggling machine
  — this is a real gap versus the confidence level of the prior two features, not a formality. The
  change is small and additive (new fields on already-verified functions, same patterns) rather
  than new logic shape, which is why it shipped anyway rather than blocking on re-verification —
  but a live check (buy the objective in a real mission, confirm the bonus lands) is worth doing
  when convenient.

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
