/**
 * Every user-facing string lives here (Arabic). Functions take already-formatted
 * values (numbers, durations) so digit and plural rules stay in `format.ts`.
 * To add English later, mirror this object's shape.
 */

export const units = {
  minute: { one: 'دقيقة', two: 'دقيقتان', twoOblique: 'دقيقتين', few: 'دقائق', many: 'دقيقة' },
  hour: { one: 'ساعة', two: 'ساعتان', twoOblique: 'ساعتين', few: 'ساعات', many: 'ساعة' },
  day: { one: 'يوم', two: 'يومان', twoOblique: 'يومين', few: 'أيام', many: 'يومًا', other: 'يوم' },
  session: { one: 'جلسة', two: 'جلستان', twoOblique: 'جلستين', few: 'جلسات', many: 'جلسة' },
  time: { one: 'مرة', two: 'مرتان', twoOblique: 'مرتين', few: 'مرات', many: 'مرة' },
  lessThanMinute: 'أقل من دقيقة',
  and: 'و',
  am: 'ص',
  pm: 'م',
  hourShort: 'س',
  minuteShort: 'د'
} as const

export const prayerNames = {
  fajr: 'الفجر',
  sunrise: 'الشروق',
  dhuhr: 'الظهر',
  asr: 'العصر',
  maghrib: 'المغرب',
  isha: 'العشاء',
  jumuah: 'الجمعة'
} as const

export const periodNames = {
  night: 'الليل',
  dawn: 'الفجر',
  morning: 'الضحى',
  day: 'الظهيرة',
  asr: 'العصر',
  dusk: 'المغرب'
} as const

export const toasts = {
  preReminderTitle: (prayer: string) => `صلاة ${prayer}`,
  preReminderBody: (duration: string, prayer: string) => `باقي ${duration} على صلاة ${prayer}`,
  prayerNowTitle: 'وقتي',
  prayerNowBody: (prayer: string) => `حان الآن وقت صلاة ${prayer}`,
  meetingTitle: 'أنت في اجتماع الآن',
  meetingBody: 'أنت في اجتماع الآن، بنذكّرك بعد ما تخلص',
  meetingFinalBody: (prayer: string) => `خلص وقت القفل، لا تنسى صلاة ${prayer}`,
  resumeTitle: (prayer: string) => `صلاة ${prayer}`,
  resumeBody: (ago: string, prayer: string) => `دخل وقت صلاة ${prayer} قبل ${ago} وجهازك كان نايم`,
  offerTitle: (prayer: string) => `دخل وقت صلاة ${prayer}`,
  offerBody: (ago: string) => `دخل الوقت قبل ${ago}. اضغط هنا إذا تبي تقفل الشاشة للصلاة`,
  focusResumedTitle: 'رجعنا للتركيز',
  focusResumedBody: (remaining: string) => `كمّل جلستك، باقي ${remaining}`,
  focusDoneTitle: 'خلصت جلسة التركيز',
  focusDoneBody: (focused: string) => `ركّزت ${focused}. خذ نفَس وارتاح شوي`,
  breakOverTitle: 'خلصت الاستراحة',
  breakOverBody: 'جاهز لجلسة ثانية؟ افتح وقتي وابدأ',
  closeToTrayTitle: 'وقتي شغّال في الخلفية',
  closeToTrayBody:
    'قفلت النافذة بس التطبيق باقي عند الساعة. افتحه من أيقونته، أو اختر خروج من قائمتها',
  dbRestoredTitle: 'رجّعنا بياناتك من نسخة احتياطية',
  dbRestoredBody: 'ملف البيانات كان تالف، فاسترجعنا آخر نسخة سليمة',
  dbResetTitle: 'بدأنا ملف بيانات جديد',
  dbResetBody: 'ملف البيانات كان تالف وما لقينا نسخة احتياطية سليمة. حفظنا الملف القديم باسم مختلف'
} as const

export const tray = {
  open: 'فتح وقتي',
  focus25: 'ابدأ تركيز ٢٥ دقيقة',
  stopFocus: 'إنهاء جلسة التركيز',
  pauseTracking: 'إيقاف التتبع مؤقتاً',
  resumeTracking: 'استئناف التتبع',
  quit: 'خروج',
  tooltipNext: (prayer: string, inText: string) => `${prayer} بعد ${inText}`,
  tooltipPaused: 'التتبع متوقف مؤقتاً',
  tooltipFallback: 'وقتي'
} as const

export const lock = {
  headline: (prayer: string) => `حان الآن وقت صلاة ${prayer}`,
  sub: 'شاشتك بانتظارك، خذ وقتك',
  remaining: (d: string) => `باقي ${d}`,
  prayed: 'صلّيت',
  prayedIn: (t: string) => `متاح بعد ${t}`,
  snooze: 'أجّل ٥ دقائق',
  snoozeUsed: 'استخدمت التأجيل',
  emergency: 'خروج طارئ',
  emergencyHint: 'اضغط مطوّلاً ٣ ثوانٍ',
  breatheIn: 'شهيق',
  breatheOut: 'زفير'
} as const

export const guard = {
  headline: (remaining: string) => `ارجع لتركيزك — باقي ${remaining}`,
  sub: (target: string) => `فتحت ${target} وأنت في جلسة تركيز`,
  back: 'رجوع للشغل',
  snooze: '٥ دقائق',
  snoozeHint: 'بنسجّلها تشتيت'
} as const

export const app = {
  name: 'وقتي',
  tagline: 'يعرف وين يروح وقتك على الكمبيوتر، يساعدك تركّز، ويوقف كل شي وقت الصلاة'
} as const

export const compare = {
  prev: { day: 'أمس', week: 'الأسبوع الماضي', month: 'الشهر الماضي' },
  less: (prev: string, by: string) => `أقل من ${prev} ${by}`,
  more: (prev: string, by: string) => `أكثر من ${prev} ${by}`,
  same: (prev: string) => `قريب من ${prev}`,
  noPrev: (prev: string) => `ما عندنا بيانات عن ${prev} للمقارنة`
} as const

/** Column headers of the CSV export. */
export const csvHeaders = [
  'اليوم',
  'البداية',
  'النهاية',
  'المدة (دقائق)',
  'التطبيق',
  'العملية',
  'الموقع',
  'التصنيف',
  'عنوان النافذة'
] as const

export const dialogs = {
  exportTitle: 'حفظ نسخة من بياناتك',
  importTitle: 'اختر ملف بيانات وقتي'
} as const
