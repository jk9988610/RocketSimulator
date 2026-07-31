/** 真实天体常数（用于轨道计算，单位 SI） */
export const EARTH_RADIUS_KM = 6371
export const EARTH_MU = 3.986004418e14 // m³/s² 地球标准引力参数
export const MOON_RADIUS_KM = 1737
export const MOON_ORBIT_KM = 384_400
export const MOON_MU = 4.9048695e12
export const SUN_RADIUS_KM = 696_000
export const AU_KM = 149_597_870.7

/** 地图显示：1 像素代表的公里数（zoom=1 时地月系统概览） */
export const MAP_KM_PER_PX_BASE = 8000

export const CELESTIAL = {
  earth: {
    id: 'earth' as const,
    label: '地球',
    radiusKm: EARTH_RADIUS_KM,
    mu: EARTH_MU,
    hasAtmosphere: true,
  },
  moon: {
    id: 'moon' as const,
    label: '月球',
    radiusKm: MOON_RADIUS_KM,
    mu: MOON_MU,
    hasAtmosphere: false,
  },
} as const

export type CelestialId = keyof typeof CELESTIAL
export type SurfaceRef = 'earth' | 'moon' | 'space'

export function kmToMapPx(km: number, zoom: number): number {
  return km / (MAP_KM_PER_PX_BASE / zoom)
}

export function mapPxToKm(px: number, zoom: number): number {
  return px * (MAP_KM_PER_PX_BASE / zoom)
}
