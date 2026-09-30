import { lang } from '../strings'

export interface City {
  id: string
  /** Arabic display name. */
  name: string
  /** Region (منطقة) the city belongs to. */
  region: string
  nameEn: string
  regionEn: string
  lat: number
  lng: number
}

/**
 * The 13 region capitals plus the other major cities.
 * Coordinates are city centres (WGS84, 4 decimals ≈ 11 m), which keeps prayer
 * times within the same minute across each city.
 */
export const CITIES: readonly City[] = [
  {
    id: 'riyadh',
    name: 'الرياض',
    region: 'منطقة الرياض',
    nameEn: 'Riyadh',
    regionEn: 'Riyadh Region',
    lat: 24.7136,
    lng: 46.6753
  },
  {
    id: 'makkah',
    name: 'مكة المكرمة',
    region: 'منطقة مكة المكرمة',
    nameEn: 'Makkah',
    regionEn: 'Makkah Region',
    lat: 21.4225,
    lng: 39.8262
  },
  {
    id: 'madinah',
    name: 'المدينة المنورة',
    region: 'منطقة المدينة المنورة',
    nameEn: 'Madinah',
    regionEn: 'Madinah Region',
    lat: 24.4672,
    lng: 39.6111
  },
  {
    id: 'buraydah',
    name: 'بريدة',
    region: 'منطقة القصيم',
    nameEn: 'Buraydah',
    regionEn: 'Al-Qassim Region',
    lat: 26.326,
    lng: 43.975
  },
  {
    id: 'dammam',
    name: 'الدمام',
    region: 'المنطقة الشرقية',
    nameEn: 'Dammam',
    regionEn: 'Eastern Province',
    lat: 26.4207,
    lng: 50.0888
  },
  {
    id: 'abha',
    name: 'أبها',
    region: 'منطقة عسير',
    nameEn: 'Abha',
    regionEn: 'Asir Region',
    lat: 18.2164,
    lng: 42.5053
  },
  {
    id: 'tabuk',
    name: 'تبوك',
    region: 'منطقة تبوك',
    nameEn: 'Tabuk',
    regionEn: 'Tabuk Region',
    lat: 28.3835,
    lng: 36.5662
  },
  {
    id: 'hail',
    name: 'حائل',
    region: 'منطقة حائل',
    nameEn: 'Hail',
    regionEn: 'Hail Region',
    lat: 27.5114,
    lng: 41.7208
  },
  {
    id: 'arar',
    name: 'عرعر',
    region: 'منطقة الحدود الشمالية',
    nameEn: 'Arar',
    regionEn: 'Northern Borders Region',
    lat: 30.9753,
    lng: 41.0381
  },
  {
    id: 'jazan',
    name: 'جازان',
    region: 'منطقة جازان',
    nameEn: 'Jazan',
    regionEn: 'Jazan Region',
    lat: 16.8892,
    lng: 42.5511
  },
  {
    id: 'najran',
    name: 'نجران',
    region: 'منطقة نجران',
    nameEn: 'Najran',
    regionEn: 'Najran Region',
    lat: 17.5656,
    lng: 44.2289
  },
  {
    id: 'albaha',
    name: 'الباحة',
    region: 'منطقة الباحة',
    nameEn: 'Al Bahah',
    regionEn: 'Al Bahah Region',
    lat: 20.0129,
    lng: 41.4677
  },
  {
    id: 'sakaka',
    name: 'سكاكا',
    region: 'منطقة الجوف',
    nameEn: 'Sakaka',
    regionEn: 'Al Jouf Region',
    lat: 29.9697,
    lng: 40.2064
  },
  {
    id: 'jeddah',
    name: 'جدة',
    region: 'منطقة مكة المكرمة',
    nameEn: 'Jeddah',
    regionEn: 'Makkah Region',
    lat: 21.4858,
    lng: 39.1925
  },
  {
    id: 'taif',
    name: 'الطائف',
    region: 'منطقة مكة المكرمة',
    nameEn: 'Taif',
    regionEn: 'Makkah Region',
    lat: 21.2703,
    lng: 40.4158
  },
  {
    id: 'khobar',
    name: 'الخبر',
    region: 'المنطقة الشرقية',
    nameEn: 'Khobar',
    regionEn: 'Eastern Province',
    lat: 26.2172,
    lng: 50.1971
  },
  {
    id: 'jubail',
    name: 'الجبيل',
    region: 'المنطقة الشرقية',
    nameEn: 'Jubail',
    regionEn: 'Eastern Province',
    lat: 27.0046,
    lng: 49.646
  },
  {
    id: 'alahsa',
    name: 'الأحساء',
    region: 'المنطقة الشرقية',
    nameEn: 'Al-Ahsa',
    regionEn: 'Eastern Province',
    lat: 25.3833,
    lng: 49.5864
  },
  {
    id: 'yanbu',
    name: 'ينبع',
    region: 'منطقة المدينة المنورة',
    nameEn: 'Yanbu',
    regionEn: 'Madinah Region',
    lat: 24.0895,
    lng: 38.0618
  }
]

/** The city's name in the interface language. */
export function cityName(c: City): string {
  return lang === 'en' ? c.nameEn : c.name
}

/** The city's region in the interface language. */
export function cityRegion(c: City): string {
  return lang === 'en' ? c.regionEn : c.region
}

export function findCity(id: string): City | undefined {
  return CITIES.find((c) => c.id === id)
}

export const DEFAULT_CITY_ID = 'riyadh'

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -65 &&
    lat <= 65 &&
    lng >= -180 &&
    lng <= 180
  )
}
