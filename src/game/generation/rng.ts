/**
 * Deterministic, seedable PRNG (mulberry32) — Math.random() can't be seeded,
 * and the GDD explicitly calls for "seeded random generation" so a given
 * seed always reproduces the same mission (useful for debugging, and later
 * for things like daily missions everyone gets the same version of).
 */
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6d2b79f5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]
  }

  /** Weighted pick — weights don't need to sum to 1. */
  pickWeighted<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0)
    let roll = this.next() * total
    for (const item of items) {
      roll -= item.weight
      if (roll <= 0) return item.value
    }
    return items[items.length - 1].value
  }
}

/** Turns a string (e.g. a shareable mission code) into a numeric seed. */
export function hashSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(31, hash) + input.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

/** A fresh, effectively-random seed for "generate me a new one" (not itself deterministic). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}
