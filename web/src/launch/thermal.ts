import { airDensityRatio } from './atmosphere'

/** 低于此值不显示温度条（0–1） */
export const HEAT_DISPLAY_THRESHOLD = 0.22

export interface HeatUpdateOptions {
  /** 装有隔热片时显著降低气动加热 */
  hasHeatShield?: boolean
}

/** 热负荷积分：大气动压加热，高空自然冷却 */
export function updateHeatLevel(
  current: number,
  speedMs: number,
  altKm: number,
  dt: number,
  options: HeatUpdateOptions = {},
): number {
  const density = airDensityRatio(altKm)
  const heatMul = options.hasHeatShield ? 0.32 : 1
  const coolMul = options.hasHeatShield ? 1.35 : 1
  const heating = density * speedMs * speedMs * 0.00012 * heatMul
  const cooling = (altKm > 80 ? 0.18 : 0.06) * current * coolMul
  return Math.max(0, Math.min(1, current + (heating - cooling) * dt))
}

export function heatBarColor(level: number): string {
  if (level < 0.45) return '#c8a832'
  if (level < 0.72) return '#e87830'
  return '#e83838'
}
