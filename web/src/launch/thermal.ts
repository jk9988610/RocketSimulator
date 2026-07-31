import { airDensityRatio } from './atmosphere'

/** 低于此值不显示温度条（0–1） */
export const HEAT_DISPLAY_THRESHOLD = 0.22

/** 热负荷积分：大气动压加热，高空自然冷却 */
export function updateHeatLevel(
  current: number,
  speedMs: number,
  altKm: number,
  dt: number,
): number {
  const density = airDensityRatio(altKm)
  const heating = density * speedMs * speedMs * 0.00012
  const cooling = (altKm > 80 ? 0.18 : 0.06) * current
  return Math.max(0, Math.min(1, current + (heating - cooling) * dt))
}

export function heatBarColor(level: number): string {
  if (level < 0.45) return '#c8a832'
  if (level < 0.72) return '#e87830'
  return '#e83838'
}
