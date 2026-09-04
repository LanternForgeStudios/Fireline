import { DEFAULT_GUN_ID } from './data/guns'

/**
 * Live handle to the player's purchased upgrades/equipped gun, readable by
 * Phaser (CombatScene, mounted separately from React and can't easily
 * receive props) — same pattern as missionState/audioSettings. App.tsx keeps
 * this in sync with the Firestore-backed PlayerProfile whenever it changes.
 */
export const playerLoadout = {
  unlockedUpgrades: [] as string[],
  equippedGun: DEFAULT_GUN_ID,
}
