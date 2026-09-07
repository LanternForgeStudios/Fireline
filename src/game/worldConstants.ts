// Extracted from CombatScene.ts so generation code (src/game/generation/*)
// doesn't need to import a Phaser scene module just for these numbers.
export const WORLD_WIDTH = 1280
export const WORLD_HEIGHT = 720

// Hover-mission ("Base Defense") ground props — also needed by coverGenerator.ts so it can
// keep procedurally-placed cover objects clear of the defend objective's fixed position, the
// same reason WORLD_WIDTH/HEIGHT live here instead of in CombatScene.ts.
export const DEFEND_OBJECTIVE_Y = 460
export const COVER_OBJECT_SIZE = 140
export const DEFEND_OBJECTIVE_SIZE = 140
