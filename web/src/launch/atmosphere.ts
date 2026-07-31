/** 卡门线（大气层边界参考） */
export const KARMAN_LINE_KM = 100

const SCALE_HEIGHT_KM = 8.5

/** 相对海平面的空气密度比 (0–1) */
export function airDensityRatio(altKm: number): number {
  if (altKm <= 0) return 1
  if (altKm >= KARMAN_LINE_KM) return 0
  return Math.exp(-altKm / SCALE_HEIGHT_KM)
}

/** 大气层内额外阻力系数 */
export function atmosphereDragMultiplier(altKm: number): number {
  const density = airDensityRatio(altKm)
  return 1 + density * 12
}

export function gravityAtAltitude(altKm: number): number {
  const g0 = 9.81
  const earthRadiusKm = 6371
  const r = earthRadiusKm + Math.max(0, altKm)
  return g0 * (earthRadiusKm / r) ** 2
}

export type AtmosphereZone = 'surface' | 'atmosphere' | 'space'

export function atmosphereZone(altKm: number): AtmosphereZone {
  if (altKm < 0.05) return 'surface'
  if (altKm < KARMAN_LINE_KM) return 'atmosphere'
  return 'space'
}

export function zoneLabel(zone: AtmosphereZone): string {
  switch (zone) {
    case 'surface':
      return '地面'
    case 'atmosphere':
      return '大气层'
    case 'space':
      return '太空'
  }
}
