type Handler = (...args: any[]) => void

/**
 * Shared bridge between the Phaser combat scene and the React UI (HUD,
 * briefing, results screen). React and Phaser own separate render trees per
 * the GDD architecture, so this is the seam between them.
 *
 * A minimal custom emitter rather than Phaser.Events.EventEmitter — this
 * module is imported from the React app shell (App.tsx, Hud.tsx), which
 * would otherwise pull the entire Phaser package into the initial bundle
 * just for a three-method pub/sub utility. GameCanvas dynamically imports
 * Phaser itself only once a mission actually starts.
 */
class GameEventEmitter {
  private handlers = new Map<string, Set<Handler>>()

  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(handler)
  }

  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler)
  }

  emit(event: string, payload?: unknown) {
    for (const handler of this.handlers.get(event) ?? []) handler(payload)
  }
}

export const gameEvents = new GameEventEmitter()
