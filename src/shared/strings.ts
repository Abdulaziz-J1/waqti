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
  appTitle: 'وقتي',
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
  remainingLabel: 'باقي',
  prayed: 'صلّيت',
  prayedIn: (t: string) => `متاح بعد ${t}`,
  snooze: 'أجّل ٥ دقائق',
  snoozeUsed: 'استخدمت التأجيل',
  emergency: 'خروج طارئ',
  emergencyHint: 'اضغط مطوّلاً ٣ ثوانٍ',
  breatheIn: 'شهيق',
  breatheOut: 'زفير'
} as const

export const adhan = {
  title: (prayer: string) => `حان وقت أذان ${prayer}`,
  lockAt: (time: string) => `الشاشة بتنقفل وقت الإقامة، الساعة ${time}`,
  close: 'إغلاق'
} as const

export const guard = {
  headline: (remaining: string) => `ارجع لتركيزك — باقي ${remaining}`,
  subStart: 'فتحت ',
  subEnd: ' وأنت في جلسة تركيز',
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

export const nav = {
  today: 'اليوم',
  focus: 'التركيز',
  reports: 'التقارير',
  prayer: 'الصلاة',
  settings: 'الإعدادات',
  label: 'التنقل الرئيسي'
} as const

export const common = {
  save: 'حفظ',
  cancel: 'إلغاء',
  close: 'إغلاق',
  retry: 'حاول مرة ثانية',
  loading: 'لحظة…',
  next: 'التالي',
  back: 'رجوع',
  done: 'تم',
  delete: 'حذف',
  add: 'إضافة',
  remove: 'إزالة',
  on: 'مفعّل',
  off: 'متوقف',
  minus: 'أقل',
  plus: 'أكثر',
  choose: 'اختر',
  loadError: 'ما قدرنا نجيب البيانات. تأكد إن وقتي شغّال وجرّب مرة ثانية.',
  saveError: 'ما انحفظ التغيير. جرّب مرة ثانية، وإذا تكرر أعد تشغيل وقتي.'
} as const

export const trackingStatus = {
  active: 'التتبع شغّال',
  paused: 'التتبع متوقف مؤقتاً',
  idle: 'ما فيه نشاط حالياً',
  locked: 'الجهاز مقفل',
  overlay: 'وقت الصلاة',
  excluded: 'تطبيق مستثنى',
  none: 'التتبع شغّال',
  pause: 'إيقاف مؤقت',
  resume: 'استئناف',
  now: (app: string) => `الحين: ${app}`
} as const

export const errorScreen = {
  title: 'صار خطأ غير متوقع',
  body: 'بياناتك بأمان. أعد تحميل الواجهة وكمّل من مكانك.',
  reload: 'أعد تحميل الواجهة',
  details: 'تفاصيل للدعم الفني'
} as const

export const notices = {
  dbRestored: 'ملف بياناتك كان تالف، فرجّعنا آخر نسخة احتياطية سليمة. ممكن تنقص بيانات آخر يوم.',
  dbReset:
    'ملف بياناتك كان تالف وما لقينا نسخة احتياطية سليمة، فبدأنا ملف جديد. الملف القديم محفوظ في مجلد البيانات.',
  dismiss: 'تمام'
} as const

export const greetings = {
  night: 'مساء الخير',
  dawn: 'صباح الخير',
  morning: 'صباح الخير',
  day: 'يومك سعيد',
  asr: 'مساء الخير',
  dusk: 'مساء الخير'
} as const

export const today = {
  title: 'اليوم',
  nextPrayer: 'الصلاة القادمة',
  inPrefix: 'بعد',
  nowLabel: 'الحين',
  jumuah: 'صلاة الجمعة',
  prayerOf: (name: string) => `صلاة ${name}`,
  sunriseAt: 'الشروق',
  totalsTitle: 'وقتك اليوم',
  totalLabel: 'على الجهاز اليوم',
  topTitle: 'أكثر شي استخدمته اليوم',
  timelineTitle: 'يومك ساعة بساعة',
  timelineHint: 'مرّر على الشريط لتشوف التفاصيل',
  startFocus: 'ابدأ التركيز',
  focusRunning: 'جلسة تركيز شغّالة',
  focusRemaining: (d: string) => `باقي ${d}`,
  openFocus: 'افتح التركيز',
  empty: 'ما فيه بيانات لليوم بعد. استخدم جهازك كالعادة وبتلقى تقريرك هنا',
  emptyTop: 'أول ما تستخدم تطبيقاتك بتطلع هنا',
  scheduleError: 'ما قدرنا نحسب أوقات الصلاة لموقعك. راجع المدينة أو الإحداثيات من صفحة الصلاة.',
  arcLabel: 'مسار الشمس اليوم ومواقيت الصلاة',
  via: (browser: string) => `عبر ${browser}`,
  focusToday: (n: string, d: string) => `${n} اليوم، ${d} تركيز`,
  focusPitch: (d: string) => `${d} بدون مشتتات، ووقتي يحرس تركيزك`,
  fixLocation: 'راجع الموقع'
} as const

export const focusPage = {
  title: 'التركيز',
  lead: 'اختر مدة، وخل وقتي يحرس تركيزك من المشتتات',
  custom: 'مخصص',
  customMinutes: 'مدة مخصصة بالدقائق',
  start: 'ابدأ التركيز',
  stop: 'إنهاء الجلسة',
  pausedPrayer: 'الجلسة متوقفة لوقت الصلاة',
  pausedSleep: 'الجلسة متوقفة، الجهاز كان نايم',
  remaining: 'باقي',
  endsAt: (t: string) => `تخلص الساعة ${t}`,
  distractionsTitle: 'المشتتات',
  distractionsHint: 'لما يطلع واحد منها وأنت مركّز، بنطلع لك تذكير لطيف ترجع لشغلك',
  sites: 'مواقع',
  apps: 'تطبيقات',
  keywords: 'كلمات في عنوان الصفحة',
  keywordPlaceholder: 'مثال: مباراة',
  newKeyword: 'كلمة جديدة',
  addApp: 'إضافة تطبيق',
  pickApp: 'اختر تطبيق',
  noApps: 'ما فيه تطبيقات مفتوحة غير وقتي. افتح التطبيق اللي يشتتك وارجع هنا',
  breakReminder: 'ذكّرني أرتاح بعد الجلسة',
  breakMinutes: 'مدة الاستراحة',
  todaySessions: 'جلسات اليوم',
  emptySessions: 'ما بدأت أي جلسة اليوم. جرّب ٢٥ دقيقة وشوف الفرق',
  sessionDone: 'اكتملت',
  sessionStopped: 'انتهت بدري',
  blockedCount: (n: string) => `صدّيت ${n}`,
  summaryTitle: 'أحسنت، خلصت جلستك',
  summaryFocused: 'وقت التركيز',
  summaryBlocked: 'مشتتات صدّيتها',
  summarySnoozed: 'سمحت لها ٥ دقائق',
  summaryClose: 'تمام'
} as const

export const reports = {
  title: 'التقارير',
  tabs: { day: 'يوم', week: 'أسبوع', month: 'شهر' },
  prev: 'الفترة السابقة',
  next: 'الفترة التالية',
  total: 'المجموع',
  dailyAverage: 'المعدل اليومي',
  byDay: 'كل يوم حسب التصنيف',
  byHour: 'ساعات اليوم حسب التصنيف',
  byHourNote: 'الوقت يمشي من اليمين لليسار',
  compareTitle: 'مقارنة بالفترة السابقة',
  categories: 'التصنيفات',
  table: 'التطبيقات والمواقع',
  colName: 'التطبيق أو الموقع',
  colTime: 'الوقت',
  colCategory: 'التصنيف',
  recategorize: 'غيّر التصنيف',
  recategorizeTitle: (name: string) => `تصنيف ${name}`,
  recategorizeHint: 'التغيير يطبّق على كل السجل القديم والجديد',
  resetRule: 'رجّع التصنيف الافتراضي',
  focusTitle: 'التركيز',
  focusSessions: 'الجلسات',
  focusTime: 'وقت التركيز',
  focusBlocked: 'مشتتات صدّيتها',
  focusCompletion: 'نسبة الإكمال',
  empty: 'ما فيه بيانات لهالفترة. استخدم جهازك كالعادة وبتلقى تقريرك هنا',
  showMore: 'عرض الكل',
  showLess: 'عرض أقل',
  site: 'موقع',
  app: 'تطبيق',
  siteVia: (b: string) => `موقع عبر ${b}`,
  share: 'النسبة',
  focusCompare: (text: string) => `التركيز: ${text}`
} as const

export const prayerPage = {
  title: 'الصلاة',
  todayTimes: 'مواقيت اليوم',
  location: 'الموقع',
  city: 'المدينة',
  customCoords: 'إحداثيات مخصصة',
  lat: 'خط العرض',
  lng: 'خط الطول',
  coordsInvalid: 'الإحداثيات غير صحيحة. خط العرض بين −٦٥ و٦٥، وخط الطول بين −١٨٠ و١٨٠',
  applyCoords: 'اعتمد الإحداثيات',
  lock: 'قفل الشاشة',
  lockAfter: 'القفل بعد الأذان',
  withAdhan: 'مع الأذان',
  lockAfterHint: 'القفل يجي وقت الإقامة. عدّل المدة حسب مسجدك',
  lockFor: 'مدة القفل',
  adjust: 'تعديل الوقت',
  adjustHint: 'تعديل الوقت: إذا كان مسجدك يأذّن قبل أو بعد الوقت المحسوب',
  sunriseNote: 'للعرض فقط',
  ramadan: 'الإقامة في رمضان',
  ramadanLead: 'في رمضان تتغيّر الإقامة للفجر والمغرب، وباقي الصلوات تبقى زي ما هي',
  ramadanActive: 'مفعّلة الحين',
  friday: 'الجمعة',
  fridayLead: 'الظهر يوم الجمعة يصير صلاة الجمعة، والقفل يبدأ مع الأذان لأن الخطبة تبدأ وقتها',
  fridayReminder: 'التذكير قبل الجمعة',
  fridayLock: 'مدة قفل الجمعة',
  reminders: 'التذكير والقفل',
  reminderBefore: 'التذكير قبل الأذان',
  reminderOff: 'بدون تذكير',
  adhanNotice: 'تنبيه وقت الأذان',
  adhanNoticeHint: 'إشعار لمدة ١٠ ثواني، وتقدر تسكّره قبلها',
  chime: 'نغمة هادئة وقت الصلاة',
  chimeHint: 'نغمة قصيرة من تأليف وقتي، مو أذان',
  minUnlock: 'زر «صلّيت» يتفعّل بعد',
  immediately: 'فوراً',
  smart: 'قواعد ذكية',
  skipAway: 'لا تقفل إذا كنت بعيد عن الجهاز',
  skipAwayHint: 'إذا ما لمست الجهاز ٥ دقائق وقت القفل',
  deferMeetings: 'أجّل القفل إذا كنت في اجتماع',
  deferMeetingsHint: 'Teams وZoom وWebex وGoogle Meet وعرض شرائح PowerPoint',
  history: 'سجل القفل هالأسبوع',
  emptyHistory: 'ما فيه سجل هالأسبوع بعد. أول قفل بيطلع هنا',
  outcome: {
    prayed: 'صلّيت',
    ended: 'انتهت المدة',
    emergency: 'خروج طارئ',
    skipped: 'تخطّي'
  },
  reason: {
    duration: '',
    safety: 'الحد الأقصى للأمان',
    away: 'كنت بعيد عن الجهاز',
    meeting: 'كنت في اجتماع',
    asleep: 'الجهاز كان نايم',
    'late-start': 'فتحت الجهاز بعد الإقامة',
    interrupted: 'وقتي انقفل أثناء القفل',
    superseded: 'دخلت الصلاة اللي بعدها'
  },
  snoozedTag: 'بعد تأجيل',
  nextTag: 'القادمة'
} as const

export const settingsPage = {
  title: 'الإعدادات',
  sections: {
    general: 'عام',
    appearance: 'المظهر',
    tracking: 'التتبع والخصوصية',
    categories: 'التصنيفات والقواعد',
    data: 'البيانات',
    about: 'عن وقتي'
  },
  launchAtStartup: 'شغّل وقتي مع ويندوز',
  launchAtStartupHint: 'يبدأ مخفي عند الساعة',
  closeToTray: 'إغلاق النافذة يخلي وقتي يشتغل في الخلفية',
  digits: 'شكل الأرقام',
  digitsArab: '٠١٢٣',
  digitsLatn: '0123',
  clock: 'نظام الساعة',
  clock12: '١٢ ساعة',
  clock24: '٢٤ ساعة',
  theme: 'السمة',
  themeSky: 'سماء اليوم',
  themeLight: 'فاتح',
  themeDark: 'داكن',
  themeSkyHint: 'الألوان تتبع وقت اليوم من الفجر لليل',
  reduceMotion: 'تقليل الحركة',
  reduceMotionHint: 'يوقف الحركات الجمالية، ويخلي دائرة التنفّس واللي يوضح الحالة',
  pauseTracking: 'إيقاف التتبع مؤقتاً',
  idleAfter: 'اعتبرني بعيد بعد',
  storeTitles: 'احفظ عناوين النوافذ',
  storeTitlesHint: 'نستخدمها لمعرفة المواقع. إذا قفلتها نحفظ اسم التطبيق والموقع فقط',
  excluded: 'تطبيقات ما نتتبعها',
  excludedEmpty: 'ما فيه تطبيقات مستثناة',
  retention: 'مدة الاحتفاظ بالبيانات',
  forever: 'للأبد',
  categoriesLead: 'التصنيفات تنطبق وقت العرض، فأي تغيير يعدّل كل السجل',
  newCategory: 'تصنيف جديد',
  categoryName: 'اسم التصنيف',
  categoryColor: 'لون التصنيف',
  builtin: 'أساسي',
  rulesTitle: 'قواعدك',
  rulesEmpty: 'ما عندك قواعد خاصة. غيّر تصنيف أي تطبيق من صفحة التقارير',
  ruleApp: 'تطبيق',
  ruleSite: 'موقع',
  rulePath: 'مسار',
  deleteCategory: 'حذف التصنيف',
  deleteCategoryConfirm: (name: string) =>
    `حذف تصنيف «${name}»؟ التطبيقات اللي فيه ترجع لتصنيفها الافتراضي.`,
  exportJson: 'تصدير JSON',
  exportCsv: 'تصدير CSV',
  exportHint: 'JSON للنسخ الاحتياطي والاستيراد، وCSV للفتح في Excel',
  exported: 'انحفظ الملف',
  importJson: 'استيراد من ملف JSON',
  imported: (n: string) => `تمت إضافة ${n} من السجلات`,
  importNothing: 'كل السجلات موجودة من قبل',
  importInvalid: 'الملف مو ملف بيانات وقتي. اختر ملف صدّرته من وقتي.',
  importUnreadable: 'ما قدرنا نقرأ الملف. تأكد إنه ملف JSON سليم.',
  deleteAll: 'حذف كل البيانات',
  deleteAllTitle: 'حذف كل بياناتك؟',
  deleteAllBody:
    'بينحذف سجل التطبيقات والتركيز والصلاة والنسخ الاحتياطية من جهازك. ما تقدر ترجعها. إعداداتك تبقى.',
  deleteAllType: 'اكتب «حذف» للتأكيد',
  deleteAllWord: 'حذف',
  deleteAllConfirm: 'احذف نهائياً',
  deleted: 'انحذفت البيانات',
  dataCounts: (i: string, s: string, p: string) =>
    `${i} سجل استخدام، ${s} جلسة تركيز، ${p} سجل صلاة`,
  version: 'الإصدار',
  offline: 'وقتي يشتغل بدون إنترنت. بياناتك تبقى على جهازك وما نرسل أي شي لأي مكان.',
  openData: 'افتح مجلد البيانات',
  openLogs: 'افتح مجلد السجلات',
  licenses: 'التراخيص',
  debugHint: 'لوحة الاختبار: Ctrl+Shift+D'
} as const

export const onboarding = {
  stepOf: (n: string, total: string) => `الخطوة ${n} من ${total}`,
  welcomeTitle: 'هلا بك في وقتي',
  welcomeBody: 'وقتي يعرف وين يروح وقتك على الكمبيوتر، يساعدك تركّز، ويوقف كل شي وقت الصلاة.',
  welcomePrivacy: 'كل شي يبقى على جهازك، بدون إنترنت.',
  start: 'يلا نبدأ',
  cityTitle: 'وين أنت؟',
  cityBody: 'نحسب مواقيت الصلاة بتقويم أم القرى حسب موقعك',
  previewTitle: 'مواقيت اليوم',
  lockTitle: 'قفل الصلاة',
  lockBody:
    'وقت الأذان يجيك تنبيه قصير، ووقت الإقامة تنقفل الشاشة بهدوء. تقدر تعدّل وقت الإقامة لكل صلاة من صفحة الصلاة، وتطلع من القفل متى ما احتجت',
  distractionsTitle: 'وش يشتتك؟',
  distractionsBody: 'اختر التطبيقات والمواقع اللي نذكّرك تبتعد عنها وقت التركيز',
  runningApps: 'تطبيقات مفتوحة الحين',
  presetSites: 'مواقع',
  startupTitle: 'آخر خطوة',
  startupBody: 'خل وقتي يشتغل مع ويندوز عشان ما تفوتك صلاة ولا يضيع يومك بدون تقرير',
  startupToggle: 'شغّل وقتي مع ويندوز',
  startupHint: 'يبدأ مخفي عند الساعة، بدون ما يزعجك',
  noApps: 'ما فيه تطبيقات مفتوحة الحين. تقدر تضيفها بعدين من صفحة التركيز',
  finish: 'ابدأ استخدام وقتي'
} as const

export const debug = {
  title: 'لوحة الاختبار',
  hint: 'للاختبار فقط. ما تظهر في الواجهة العادية.',
  simulate: 'محاكاة',
  prayerNow: 'القفل الآن',
  adhanNow: 'تنبيه الأذان',
  preReminder: 'التذكير المسبق',
  idle: 'محاكاة الابتعاد عن الجهاز',
  meeting: 'محاكاة اجتماع في الواجهة',
  startup: 'محاكاة تشغيل التطبيق بعد الإقامة',
  distraction: 'محاكاة مشتّت (أثناء التركيز)',
  clock: 'ساعة المُجدوِل',
  offset: 'فرق الوقت',
  offsetMinutes: 'دقائق',
  apply: 'طبّق',
  resetClock: 'رجّع الساعة',
  jumpBefore: 'انقل الساعة قبل الأذان بدقيقة',
  jumpAfter: 'انقل الساعة بعد الإقامة بـ٣ دقائق',
  demo: 'بيانات تجريبية',
  seedDay: 'يوم',
  seedWeek: 'أسبوع',
  seedYear: 'سنة',
  clearDemo: 'مسح التجريبية',
  seeded: (n: string, ms: string) => `أضفنا ${n} سجل خلال ${ms} ملّي ثانية`,
  live: 'قراءات حية',
  state: 'حالة المنسّق',
  foreground: 'التطبيق في الواجهة',
  cpu: 'المعالج',
  memory: 'الذاكرة',
  provider: 'مصدر النافذة',
  startupTime: 'زمن التشغيل',
  intervals: 'سجلات الاستخدام',
  inMeeting: 'اجتماع',
  idleSeconds: 'ثواني الخمول',
  yes: 'نعم',
  no: 'لا'
} as const
