import type { MissionDef } from '../types'

export const MISSION_TYPES: MissionDef['type'][] = [
  'Search & Destroy',
  'Escort',
  'Extraction',
  'Rescue',
  'Base Defense',
  'Reconnaissance',
]

const NAME_WORDS = [
  'Firebreak',
  'Steel Convoy',
  'Nightfall',
  'Dustwind',
  'Redline',
  'Iron Vigil',
  'Hollow Ridge',
  'Cinder',
  'Broken Arrow',
  'Longshadow',
  'Stonecutter',
  'Ashfall',
  'Wolfpack',
  'Highwater',
  'Backdraft',
]

const BRIEFINGS: Record<MissionDef['type'], string[]> = {
  'Search & Destroy': [
    'Hostile forces are massing in the sector. Clear each wave of contacts and keep the bird in the air until the area is secured.',
    "Intel puts multiple hostile groups converging on this position. Break them up before they can regroup — there won't be a second pass.",
  ],
  Escort: [
    'A convoy is running this route and needs air cover from first contact to the far checkpoint. Keep the sky over it clear.',
    'Ground assets are moving through hostile territory below. Stay on station and clear anything that gets within range.',
  ],
  Extraction: [
    "The ground team is exposed and the extraction window is short. Clear the LZ and hold it until they're clear.",
    'Extraction is inbound and hostiles are already converging on the pickup point. This one is fast and it does not get easier.',
  ],
  Rescue: [
    'Downed personnel are pinned down and running out of options. Suppress the hostiles closing on their position until they can move.',
    'A rescue team is en route to a stranded unit. Keep the approach clear so they have a corridor to work with.',
  ],
  'Base Defense': [
    'Forward operating base is under threat of imminent assault. Hold the perimeter — nothing gets through.',
    'Hostiles are massing for a push on the position below. Break the assault before it reaches the wire.',
  ],
  Reconnaissance: [
    'This is a recon sweep that went loud. Contacts are already inbound — clear them and keep the sensor package intact.',
    'Advance scouts triggered an ambush. Clean up the response force before it overwhelms the position.',
  ],
}

export function generateMissionName(rng: { pick: <T>(items: readonly T[]) => T }): string {
  return `Operation ${rng.pick(NAME_WORDS)}`
}

export function generateBriefing(rng: { pick: <T>(items: readonly T[]) => T }, type: MissionDef['type']): string {
  return rng.pick(BRIEFINGS[type])
}
