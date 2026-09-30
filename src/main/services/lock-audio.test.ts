import { describe, expect, it } from 'vitest'
import { LockAudio, type MuteMemory, VirtualOutput } from './lock-audio'

function setup(startMuted = false) {
  const output = new VirtualOutput()
  output.muted = startMuted
  let saved: boolean | null = null
  const memory: MuteMemory = {
    read: () => saved,
    write: (v) => {
      saved = v
    }
  }
  const errors: unknown[] = []
  const waits: Array<() => void> = []
  // Chime delays wait for the test to release them.
  const sleep = (): Promise<void> => new Promise((resolve) => waits.push(resolve))
  const audio = new LockAudio(output, memory, (e) => errors.push(e), sleep)
  return { output, audio, errors, memory, releaseWaits: () => waits.splice(0).forEach((w) => w()) }
}

describe('lock audio', () => {
  it('mutes with the lock and restores the sound when it ends', async () => {
    const { output, audio, memory } = setup()
    await audio.lockShown(0)
    expect(output.muted).toBe(true)
    expect(memory.read()).toBe(false)
    await audio.lockHidden()
    expect(output.muted).toBe(false)
    expect(memory.read()).toBeNull()
  })

  it('leaves a sound that was already muted muted', async () => {
    const { output, audio } = setup(true)
    await audio.lockShown(0)
    await audio.lockHidden()
    expect(output.muted).toBe(true)
  })

  it('mutes again after a snooze, and a re-shown lock does not overwrite the saved state', async () => {
    const { output, audio, memory } = setup()
    await audio.lockShown(0)
    await audio.lockShown(0) // shown again after sleep: still the state from before the lock
    expect(memory.read()).toBe(false)
    await audio.lockHidden() // snooze
    expect(output.muted).toBe(false)
    await audio.lockShown(0) // back after the snooze
    expect(output.muted).toBe(true)
    await audio.lockHidden()
    expect(output.muted).toBe(false)
  })

  it('waits for the chime, and skips the mute when the lock is gone by then', async () => {
    const { output, audio, releaseWaits } = setup()
    const shown = audio.lockShown(4000)
    expect(output.muted).toBe(false)
    const hidden = audio.lockHidden() // emergency exit during the chime
    await Promise.resolve()
    releaseWaits()
    await shown
    await hidden
    expect(output.muted).toBe(false)
  })

  it('restores after an interrupted run and reports failures without breaking later calls', async () => {
    const { output, audio, memory, errors } = setup()
    output.muted = true
    memory.write(false) // the app quit mid-lock last time
    await audio.lockHidden() // at start
    expect(output.muted).toBe(false)
    const failing = new LockAudio(
      {
        mute: () => Promise.reject(new Error('no device')),
        set: () => Promise.resolve()
      },
      memory,
      (e) => errors.push(e)
    )
    await failing.lockShown(0)
    expect(errors).toHaveLength(1)
    await failing.lockHidden()
    expect(errors).toHaveLength(1)
  })
})
