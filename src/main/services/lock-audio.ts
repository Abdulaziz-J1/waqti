/** The system's sound output, as far as the lock needs it. */
export interface OutputMute {
  /** Mutes the output; resolves whether it was already muted. */
  mute(): Promise<boolean>
  set(muted: boolean): Promise<void>
}

/** Where the output's state from before the lock is kept (survives a crash). */
export interface MuteMemory {
  read(): boolean | null
  write(before: boolean | null): void
}

/**
 * Mutes the sound while a lock is up (a game keeps playing sound otherwise)
 * and puts it back exactly as it was when the lock goes down — prayed,
 * emergency exit, snooze or end of time. What the output was before is saved,
 * so a quit or crash in the middle is undone on the next start. Requests run
 * one after another; a mute still waiting for the chime is dropped when the
 * lock is already gone.
 */
export class LockAudio {
  private chain: Promise<void> = Promise.resolve()
  private locked = false

  constructor(
    private readonly output: OutputMute,
    private readonly memory: MuteMemory,
    private readonly onError: (err: unknown) => void,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms))
  ) {}

  /** The lock went up; mute after `delayMs` (the lock's own chime plays first). */
  lockShown(delayMs: number): Promise<void> {
    this.locked = true
    return this.enqueue(async () => {
      if (delayMs > 0) await this.sleep(delayMs)
      // Gone again meanwhile, or already muted by an earlier show of this lock.
      if (!this.locked || this.memory.read() !== null) return
      this.memory.write(await this.output.mute())
    })
  }

  /** The lock went down (or the app starts after one was interrupted): restore. */
  lockHidden(): Promise<void> {
    this.locked = false
    return this.enqueue(async () => {
      const before = this.memory.read()
      if (before === null) return
      await this.output.set(before)
      this.memory.write(null)
    })
  }

  private enqueue(step: () => Promise<void>): Promise<void> {
    this.chain = this.chain.then(step).catch(this.onError)
    return this.chain
  }
}

/** Stands in for the real output in isolated test profiles: never touches the machine's sound. */
export class VirtualOutput implements OutputMute {
  muted = false

  mute(): Promise<boolean> {
    const before = this.muted
    this.muted = true
    return Promise.resolve(before)
  }

  set(muted: boolean): Promise<void> {
    this.muted = muted
    return Promise.resolve()
  }
}
