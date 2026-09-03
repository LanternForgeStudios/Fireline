import type { MissionTheme } from '../types'

/**
 * Weather/time-of-day presets — the GDD calls for "weather, time of day" as
 * part of procedural variety. This pass keeps it visual/mood-only (sky,
 * mountain and ground tint, same shape the 3 hand-authored missions use —
 * see docs/AUDIO_AND_POLISH.md for gameplay-affecting weather as a
 * follow-up, not attempted here to keep this pass shippable).
 */
/** Mood tint only — landscape (which ground/backdrop art) is a separate,
 * independently-rolled axis for procedural missions (see generateMission.ts),
 * layered on top of whichever preset gets picked. */
export interface WeatherPreset {
  id: string
  label: string
  theme: Omit<MissionTheme, 'landscape'>
}

export const WEATHER_PRESETS: WeatherPreset[] = [
  {
    id: 'clear-midday',
    label: 'Clear',
    theme: { skyTop: 0xf7d9a0, skyBottom: 0xf2b26b, mountainTint: 0xffffff, mountainAlpha: 0.75, groundTint: 0xffffff },
  },
  {
    id: 'hazy-dust',
    label: 'Dust Haze',
    theme: { skyTop: 0xe4d2a8, skyBottom: 0xc9a878, mountainTint: 0xd8c39a, mountainAlpha: 0.55, groundTint: 0xe8dcc0 },
  },
  {
    id: 'dusk',
    label: 'Dusk',
    theme: { skyTop: 0x6b4a6e, skyBottom: 0xd9784e, mountainTint: 0x8a5a6e, mountainAlpha: 0.9, groundTint: 0xa9836e },
  },
  {
    id: 'dawn',
    label: 'Dawn',
    theme: { skyTop: 0xa8c4d9, skyBottom: 0xf2b98a, mountainTint: 0xb8a4c9, mountainAlpha: 0.7, groundTint: 0xd9c4a8 },
  },
  {
    id: 'overcast',
    label: 'Overcast',
    theme: { skyTop: 0x9aa0a8, skyBottom: 0xb8ada0, mountainTint: 0xa8a8a8, mountainAlpha: 0.65, groundTint: 0xc4bfb5 },
  },
]
