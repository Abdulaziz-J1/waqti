/**
 * Media helper, run as an Electron utility process (services/media.ts starts
 * one per request). It reaches Windows' media controls (GSMTC) through WinRT
 * with koffi — no PowerShell and no native build — and runs apart from the
 * main process so a failure here can never take the lock down with it.
 *
 * Vtable slots are read from Windows.Media.winmd and Windows.Foundation.winmd;
 * IInspectable takes slots 0–5 of every interface. The mute uses Core Audio
 * (mmdeviceapi.h, endpointvolume.h), classic COM where IUnknown takes 0–2.
 */
import koffi from 'koffi'
import {
  type MediaReply,
  type MediaRequest,
  type MediaSessionInfo,
  releasesAfterPause,
  shouldPause
} from '../shared/media'

const IID_MANAGER_STATICS = '2050c4ee-11a0-57de-aed7-c97c70338245'
const IID_ASYNC_INFO = '00000036-0000-0000-c000-000000000046'
const MANAGER_CLASS = 'Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager'
const CLSID_DEVICE_ENUMERATOR = 'bcde0395-e52f-467c-8e3d-c4579291692e'
const IID_DEVICE_ENUMERATOR = 'a95664d2-9614-4f35-a746-de8db63617e6'
const IID_ENDPOINT_VOLUME = '5cdf2c82-841e-4546-9722-0cf74078229a'
const CLSCTX_INPROC_SERVER = 0x1
const CLSCTX_ALL = 0x17
const RENDER = 0
const MULTIMEDIA = 1

const SLOT = {
  queryInterface: 0,
  release: 2,
  /** IGlobalSystemMediaTransportControlsSessionManagerStatics */
  requestAsync: 6,
  /** IGlobalSystemMediaTransportControlsSessionManager */
  getSessions: 7,
  /** IVectorView<T> */
  getAt: 6,
  size: 7,
  /** IGlobalSystemMediaTransportControlsSession */
  sourceAppId: 6,
  playbackInfo: 9,
  tryPause: 11,
  tryStop: 12,
  /** IGlobalSystemMediaTransportControlsSessionPlaybackInfo */
  playbackStatus: 7,
  /** IAsyncInfo */
  asyncStatus: 7,
  /** IAsyncOperation<T> */
  getResults: 8,
  /** IMMDeviceEnumerator */
  defaultEndpoint: 4,
  /** IMMDevice */
  activate: 3,
  /** IAudioEndpointVolume */
  setMute: 14,
  getMute: 15
} as const

const ASYNC_STARTED = 0
const ASYNC_COMPLETED = 1
const RPC_E_CHANGED_MODE = 0x80010106 | 0

const combase = koffi.load('combase.dll')
const ole32 = koffi.load('ole32.dll')
// Registers the GUID type that the declarations below use by name.
koffi.struct('GUID', {
  Data1: 'uint32',
  Data2: 'uint16',
  Data3: 'uint16',
  Data4: koffi.array('uint8', 8)
})
const RoInitialize = combase.func('int __stdcall RoInitialize(int type)')
const WindowsCreateString = combase.func(
  'int __stdcall WindowsCreateString(str16 s, uint32 len, _Out_ void **out)'
)
const WindowsDeleteString = combase.func('int __stdcall WindowsDeleteString(void *s)')
const WindowsGetStringRawBuffer = combase.func(
  'void * __stdcall WindowsGetStringRawBuffer(void *s, _Out_ uint32 *len)'
)
const RoGetActivationFactory = combase.func(
  'int __stdcall RoGetActivationFactory(void *cls, GUID *iid, _Out_ void **out)'
)
const OutPtr = koffi.proto('int __stdcall OutPtr(void *self, _Out_ void **out)')
const OutU32 = koffi.proto('int __stdcall OutU32(void *self, _Out_ uint32 *out)')
const OutU8 = koffi.proto('int __stdcall OutU8(void *self, _Out_ uint8 *out)')
const GetAt = koffi.proto('int __stdcall GetAt(void *self, uint32 index, _Out_ void **out)')
const QueryInterface = koffi.proto(
  'int __stdcall QueryInterface(void *self, GUID *iid, _Out_ void **out)'
)
const Release = koffi.proto('uint32 __stdcall Release(void *self)')
const CoCreateInstance = ole32.func(
  'int __stdcall CoCreateInstance(GUID *clsid, void *outer, uint32 ctx, GUID *iid, _Out_ void **out)'
)
const DefaultEndpoint = koffi.proto(
  'int __stdcall DefaultEndpoint(void *self, int flow, int role, _Out_ void **out)'
)
const Activate = koffi.proto(
  'int __stdcall Activate(void *self, GUID *iid, uint32 ctx, void *params, _Out_ void **out)'
)
const GetMute = koffi.proto('int __stdcall GetMute(void *self, _Out_ int *muted)')
const SetMute = koffi.proto('int __stdcall SetMute(void *self, int muted, void *context)')

type Ptr = unknown

function guid(s: string): Record<string, unknown> {
  const h = s.replace(/-/g, '')
  return {
    Data1: parseInt(h.slice(0, 8), 16),
    Data2: parseInt(h.slice(8, 12), 16),
    Data3: parseInt(h.slice(12, 16), 16),
    Data4: Array.from({ length: 8 }, (_, i) => parseInt(h.slice(16 + i * 2, 18 + i * 2), 16))
  }
}

function check(hr: number, what: string): void {
  if (hr < 0) throw new Error(`${what} failed (0x${(hr >>> 0).toString(16)})`)
}

/** The function at `index` in a COM object's vtable. */
function slot(obj: Ptr, index: number): Ptr {
  const vtable: Ptr = koffi.decode(obj, 'void *')
  return koffi.decode(vtable, index * 8, 'void *') as Ptr
}

function outPtr(obj: Ptr, index: number, what: string): Ptr {
  const out: Ptr[] = [null]
  check(koffi.call(slot(obj, index), OutPtr, obj, out) as number, what)
  return out[0]
}

function outU32(obj: Ptr, index: number, what: string): number {
  const out = [0]
  check(koffi.call(slot(obj, index), OutU32, obj, out) as number, what)
  return out[0]!
}

function release(obj: Ptr): void {
  if (obj) koffi.call(slot(obj, SLOT.release), Release, obj)
}

function takeString(h: Ptr): string {
  if (!h) return ''
  const len = [0]
  const raw: Ptr = WindowsGetStringRawBuffer(h, len)
  const s = len[0] ? (koffi.decode(raw, 'char16_t', len[0]) as string) : ''
  WindowsDeleteString(h)
  return s
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Waits for a WinRT async operation (polling IAsyncInfo) for up to 5 s. */
async function settle(op: Ptr, what: string): Promise<void> {
  const info: Ptr[] = [null]
  check(
    koffi.call(
      slot(op, SLOT.queryInterface),
      QueryInterface,
      op,
      guid(IID_ASYNC_INFO),
      info
    ) as number,
    `${what}: IAsyncInfo`
  )
  try {
    for (let i = 0; i < 250; i++) {
      const status = outU32(info[0], SLOT.asyncStatus, `${what}: status`)
      if (status === ASYNC_COMPLETED) return
      if (status !== ASYNC_STARTED) throw new Error(`${what} ended with status ${status}`)
      await sleep(20)
    }
    throw new Error(`${what} timed out`)
  } finally {
    release(info[0])
  }
}

/** Joins the multithreaded apartment (WinRT and COM both need it). */
function initRuntime(): void {
  const init = RoInitialize(1) as number
  if (init < 0 && init !== RPC_E_CHANGED_MODE) check(init, 'RoInitialize')
}

/** Runs `fn` on every current session; the session pointer is released afterwards. */
async function forEachSession(
  fn: (session: Ptr, info: MediaSessionInfo) => Promise<void>
): Promise<void> {
  initRuntime()
  const cls: Ptr[] = [null]
  check(
    WindowsCreateString(MANAGER_CLASS, MANAGER_CLASS.length, cls) as number,
    'WindowsCreateString'
  )
  const factory: Ptr[] = [null]
  const hr = RoGetActivationFactory(cls[0], guid(IID_MANAGER_STATICS), factory) as number
  WindowsDeleteString(cls[0])
  check(hr, 'RoGetActivationFactory')
  let op: Ptr = null
  let manager: Ptr = null
  let list: Ptr = null
  try {
    op = outPtr(factory[0], SLOT.requestAsync, 'RequestAsync')
    await settle(op, 'RequestAsync')
    manager = outPtr(op, SLOT.getResults, 'RequestAsync results')
    list = outPtr(manager, SLOT.getSessions, 'GetSessions')
    const count = outU32(list, SLOT.size, 'session count')
    for (let i = 0; i < count; i++) {
      const out: Ptr[] = [null]
      check(koffi.call(slot(list, SLOT.getAt), GetAt, list, i, out) as number, 'GetAt')
      const session = out[0]
      try {
        const appId = takeString(outPtr(session, SLOT.sourceAppId, 'SourceAppUserModelId'))
        const playback = outPtr(session, SLOT.playbackInfo, 'GetPlaybackInfo')
        const status = outU32(playback, SLOT.playbackStatus, 'PlaybackStatus')
        release(playback)
        await fn(session, { appId, status })
      } finally {
        release(session)
      }
    }
  } finally {
    release(list)
    release(manager)
    release(op)
    release(factory[0])
  }
}

/**
 * Pauses every playing session. A browser shows Windows one session for all
 * its tabs; after pausing it the session is stopped (see releasesAfterPause),
 * the next playing tab takes it over, and the sessions are read again until
 * nothing is left playing.
 */
async function pause(onlyAppId: string): Promise<string[]> {
  const paused: string[] = []
  for (let pass = 0; pass < 6; pass++) {
    let pausedNow = 0
    await forEachSession(async (session, info) => {
      if (!shouldPause(info, onlyAppId)) return
      const op = outPtr(session, SLOT.tryPause, 'TryPauseAsync')
      try {
        await settle(op, 'TryPauseAsync')
        const ok = [0]
        check(
          koffi.call(slot(op, SLOT.getResults), OutU8, op, ok) as number,
          'TryPauseAsync results'
        )
        if (ok[0]) {
          paused.push(info.appId)
          pausedNow++
          if (releasesAfterPause(info.appId, onlyAppId)) await stop(session)
        }
      } finally {
        release(op)
      }
    })
    if (pausedNow === 0) break
    await sleep(400)
  }
  return paused
}

/** Stops a (paused) session so a browser hands its media session to the next playing tab. */
async function stop(session: Ptr): Promise<void> {
  const op = outPtr(session, SLOT.tryStop, 'TryStopAsync')
  try {
    await settle(op, 'TryStopAsync')
  } finally {
    release(op)
  }
}

/** Runs `fn` with the default output's IAudioEndpointVolume. */
function withOutputVolume<T>(fn: (volume: Ptr) => T): T {
  initRuntime()
  const enumerator: Ptr[] = [null]
  check(
    CoCreateInstance(
      guid(CLSID_DEVICE_ENUMERATOR),
      null,
      CLSCTX_INPROC_SERVER,
      guid(IID_DEVICE_ENUMERATOR),
      enumerator
    ) as number,
    'MMDeviceEnumerator'
  )
  let device: Ptr = null
  let volume: Ptr = null
  try {
    const d: Ptr[] = [null]
    check(
      koffi.call(
        slot(enumerator[0], SLOT.defaultEndpoint),
        DefaultEndpoint,
        enumerator[0],
        RENDER,
        MULTIMEDIA,
        d
      ) as number,
      'GetDefaultAudioEndpoint'
    )
    device = d[0]
    const v: Ptr[] = [null]
    check(
      koffi.call(
        slot(device, SLOT.activate),
        Activate,
        device,
        guid(IID_ENDPOINT_VOLUME),
        CLSCTX_ALL,
        null,
        v
      ) as number,
      'IAudioEndpointVolume'
    )
    volume = v[0]
    return fn(volume)
  } finally {
    release(volume)
    release(device)
    release(enumerator[0])
  }
}

function outputMuted(volume: Ptr): boolean {
  const muted = [0]
  check(koffi.call(slot(volume, SLOT.getMute), GetMute, volume, muted) as number, 'GetMute')
  return muted[0] !== 0
}

function setOutputMuted(volume: Ptr, muted: boolean): void {
  check(
    koffi.call(slot(volume, SLOT.setMute), SetMute, volume, muted ? 1 : 0, null) as number,
    'SetMute'
  )
}

async function list(): Promise<MediaSessionInfo[]> {
  const sessions: MediaSessionInfo[] = []
  await forEachSession(async (_session, info) => {
    sessions.push(info)
  })
  return sessions
}

async function handle(req: MediaRequest): Promise<MediaReply> {
  try {
    switch (req.kind) {
      case 'pause':
        return { kind: 'paused', appIds: await pause(req.onlyAppId) }
      case 'list':
        return { kind: 'sessions', sessions: await list() }
      case 'mute':
        return withOutputVolume((volume) => {
          const wasMuted = outputMuted(volume)
          if (!wasMuted) setOutputMuted(volume, true)
          return { kind: 'muted', wasMuted }
        })
      case 'setMute':
        withOutputVolume((volume) => setOutputMuted(volume, req.muted))
        return { kind: 'done' }
    }
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

// One request per process; the main process ends it once the reply arrives.
process.parentPort.once('message', (e: Electron.MessageEvent) => {
  void handle(e.data as MediaRequest).then((reply) => process.parentPort.postMessage(reply))
})
