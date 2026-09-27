import koffi from 'koffi'
import type { Bounds, RawForeground } from '../../shared/tracking/apps'
import { log } from './logger'

export interface WindowEntry {
  hwnd: number
  pid: number
  exePath: string
  title: string
}

/** Win32 helpers through koffi. Every call is guarded so a native failure never crashes the app. */
export interface Native {
  available: boolean
  foreground(): RawForeground | null
  minimize(hwnd: number): boolean
  className(hwnd: number): string | null
  listWindows(): WindowEntry[]
  fileDescription(exePath: string): string | null
}

const unavailable: Native = {
  available: false,
  foreground: () => null,
  minimize: () => false,
  className: () => null,
  listWindows: () => [],
  fileDescription: () => null
}

const SW_MINIMIZE = 6
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const GWL_EXSTYLE = -20
const WS_EX_TOOLWINDOW = 0x00000080
const DWMWA_CLOAKED = 14

function load(): Native {
  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')
  const version = koffi.load('version.dll')
  const dwmapi = koffi.load('dwmapi.dll')

  const HANDLE = koffi.pointer('HANDLE', koffi.opaque())
  koffi.alias('HWND', HANDLE)
  const RECT = koffi.struct('RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' })
  const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(HWND hwnd, intptr_t lParam)')

  const GetForegroundWindow = user32.func('HWND __stdcall GetForegroundWindow()')
  const GetWindowTextW = user32.func(
    'int __stdcall GetWindowTextW(HWND hWnd, _Out_ char16_t *lpString, int nMaxCount)'
  )
  const GetWindowThreadProcessId = user32.func(
    'uint32_t __stdcall GetWindowThreadProcessId(HWND hWnd, _Out_ uint32_t *lpdwProcessId)'
  )
  const GetClassNameW = user32.func(
    'int __stdcall GetClassNameW(HWND hWnd, _Out_ char16_t *lpClassName, int nMaxCount)'
  )
  const ShowWindow = user32.func('bool __stdcall ShowWindow(HWND hWnd, int nCmdShow)')
  const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(HWND hWnd)')
  const IsIconic = user32.func('bool __stdcall IsIconic(HWND hWnd)')
  const GetWindowRect = user32.func('bool __stdcall GetWindowRect(HWND hWnd, _Out_ RECT *lpRect)')
  const GetWindowLongPtrW = user32.func(
    'intptr_t __stdcall GetWindowLongPtrW(HWND hWnd, int nIndex)'
  )
  const EnumWindows = user32.func(
    'bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr_t lParam)'
  )
  const OpenProcess = kernel32.func(
    'HANDLE __stdcall OpenProcess(uint32_t access, bool inherit, uint32_t pid)'
  )
  const CloseHandle = kernel32.func('bool __stdcall CloseHandle(HANDLE h)')
  const QueryFullProcessImageNameW = kernel32.func(
    'bool __stdcall QueryFullProcessImageNameW(HANDLE hProcess, uint32_t flags, _Out_ char16_t *exeName, _Inout_ uint32_t *size)'
  )
  const GetFileVersionInfoSizeW = version.func(
    'uint32_t __stdcall GetFileVersionInfoSizeW(const char16_t *file, _Out_ uint32_t *handle)'
  )
  const GetFileVersionInfoW = version.func(
    'bool __stdcall GetFileVersionInfoW(const char16_t *file, uint32_t handle, uint32_t len, _Out_ uint8_t *data)'
  )
  const VerQueryValueW = version.func(
    'bool __stdcall VerQueryValueW(const uint8_t *block, const char16_t *sub, _Out_ void **buffer, _Out_ uint32_t *len)'
  )
  const DwmGetWindowAttribute = dwmapi.func(
    'int32_t __stdcall DwmGetWindowAttribute(HWND hwnd, uint32_t attr, _Out_ uint32_t *value, uint32_t size)'
  )

  const toHandle = (hwnd: number): bigint => BigInt(hwnd)
  const toNumber = (h: unknown): number => (typeof h === 'bigint' ? Number(h) : Number(h ?? 0))

  const text = (
    fn: (h: bigint, buf: Buffer, n: number) => number,
    hwnd: bigint,
    max = 512
  ): string => {
    const buf = Buffer.alloc(max * 2)
    const n = fn(hwnd, buf, max)
    return n > 0 ? buf.toString('utf16le', 0, n * 2) : ''
  }

  const exePathOf = (pid: number): string => {
    const h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
    if (!h) return ''
    try {
      const buf = Buffer.alloc(1024 * 2)
      const size = [1024]
      return QueryFullProcessImageNameW(h, 0, buf, size)
        ? buf.toString('utf16le', 0, size[0]! * 2)
        : ''
    } finally {
      CloseHandle(h)
    }
  }

  const pidOf = (hwnd: bigint): number => {
    const out = [0]
    GetWindowThreadProcessId(hwnd, out)
    return out[0] ?? 0
  }

  const boundsOf = (hwnd: bigint): Bounds | null => {
    const r: { left: number; top: number; right: number; bottom: number } = {
      left: 0,
      top: 0,
      right: 0,
      bottom: 0
    }
    if (!GetWindowRect(hwnd, r)) return null
    return { x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top }
  }

  const descriptions = new Map<string, string | null>()

  const native: Native = {
    available: true,

    foreground() {
      const h = GetForegroundWindow() as bigint | null
      if (!h) return null
      const pid = pidOf(h)
      if (!pid) return null
      return {
        exePath: exePathOf(pid),
        title: text(GetWindowTextW, h),
        pid,
        hwnd: toNumber(h),
        bounds: boundsOf(h),
        description: null,
        className: text(GetClassNameW, h, 128)
      }
    },

    minimize(hwnd) {
      try {
        return Boolean(ShowWindow(toHandle(hwnd), SW_MINIMIZE))
      } catch (err) {
        log.warn('minimize failed', err)
        return false
      }
    },

    className(hwnd) {
      try {
        return text(GetClassNameW, toHandle(hwnd), 128) || null
      } catch {
        return null
      }
    },

    listWindows() {
      const out: WindowEntry[] = []
      const cb = (h: bigint): boolean => {
        try {
          if (!IsWindowVisible(h) || IsIconic(h) === null) return true
          const ex = Number(GetWindowLongPtrW(h, GWL_EXSTYLE))
          if (ex & WS_EX_TOOLWINDOW) return true
          const cloaked = [0]
          if (DwmGetWindowAttribute(h, DWMWA_CLOAKED, cloaked, 4) === 0 && cloaked[0]) return true
          const title = text(GetWindowTextW, h)
          if (!title.trim()) return true
          const pid = pidOf(h)
          const exePath = pid ? exePathOf(pid) : ''
          if (exePath) out.push({ hwnd: toNumber(h), pid, exePath, title })
        } catch {
          // skip this window
        }
        return true
      }
      EnumWindows(cb, 0)
      return out
    },

    fileDescription(exePath) {
      if (descriptions.has(exePath)) return descriptions.get(exePath) ?? null
      let result: string | null = null
      try {
        const handle = [0]
        const size = GetFileVersionInfoSizeW(exePath, handle)
        if (size > 0) {
          const data = Buffer.alloc(size)
          if (GetFileVersionInfoW(exePath, 0, size, data)) {
            const ptr = [null as unknown]
            const len = [0]
            let codepages: string[] = ['040904B0', '040904E4', '000004B0']
            if (VerQueryValueW(data, '\\VarFileInfo\\Translation', ptr, len) && len[0]! >= 4) {
              const tr = koffi.decode(ptr[0], 'uint16_t', 2) as number[]
              const cp = tr.map((n) => n.toString(16).padStart(4, '0').toUpperCase()).join('')
              codepages = [cp, ...codepages]
            }
            for (const cp of codepages) {
              if (
                VerQueryValueW(data, `\\StringFileInfo\\${cp}\\FileDescription`, ptr, len) &&
                len[0]! > 1
              ) {
                const s = koffi.decode(ptr[0], 'char16_t', len[0]! - 1) as string
                if (s.trim()) {
                  result = s.trim()
                  break
                }
              }
            }
          }
        }
      } catch (err) {
        log.warn('fileDescription failed', err)
      }
      descriptions.set(exePath, result)
      return result
    }
  }
  void RECT
  void EnumWindowsProc
  return native
}

let instance: Native | null = null

export function getNative(): Native {
  if (instance) return instance
  if (process.platform !== 'win32') {
    instance = unavailable
    return instance
  }
  try {
    instance = load()
  } catch (err) {
    log.error('koffi native helpers unavailable', err)
    instance = unavailable
  }
  return instance
}
