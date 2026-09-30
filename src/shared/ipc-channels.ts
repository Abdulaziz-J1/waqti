/**
 * Channel and event names only (no zod), so the sandboxed preload can import
 * this file without pulling in dependencies.
 */
export const CHANNELS = [
  'app:snapshot',
  'app:info',
  'app:ready',
  'app:openFolder',
  'app:dismissNotice',
  'settings:update',
  'onboarding:complete',
  'prayer:preview',
  'prayer:history',
  'today:get',
  'reports:get',
  'focus:start',
  'focus:adjust',
  'focus:stop',
  'focus:sessions',
  'lock:action',
  'guard:action',
  'adhan:close',
  'overlay:state',
  'tracking:setPaused',
  'categories:get',
  'categories:create',
  'categories:update',
  'categories:delete',
  'rules:set',
  'rules:delete',
  'apps:running',
  'apps:recent',
  'data:export',
  'data:import',
  'data:deleteAll',
  'data:counts',
  'debug:simulatePrayer',
  'debug:simulatePre',
  'debug:simulateAdhan',
  'debug:mediaSessions',
  'debug:setIdle',
  'debug:setMeeting',
  'debug:setOffset',
  'debug:jumpBefore',
  'debug:seed',
  'debug:clearDemo',
  'debug:readout',
  'debug:startupOffer',
  'debug:simulateDistraction'
] as const

export type Channel = (typeof CHANNELS)[number]

export const EVENTS = [
  'app:snapshot',
  'nav:go',
  'focus:summary',
  'data:changed',
  'window:visibility',
  'overlay:state',
  'debug:toggle'
] as const

export type EventName = (typeof EVENTS)[number]
