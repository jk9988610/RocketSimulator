/**
 * 天体与环境常数（基于真实 SI 单位，仿真时间轴为压缩比例）
 *
 * 参考值：
 * - 地球半径 6371 km，μ = 3.986×10¹⁴ m³/s²
 * - 月球半径 1737 km，轨道 384400 km，μ = 4.905×10¹² m³/s²
 * - 太阳半径 696000 km，1 AU ≈ 1.496×10⁸ km，μ = 1.327×10²⁰ m³/s²
 * - 卡门线 100 km；大气标高 ~8.5 km
 */

export const EARTH_RADIUS_KM = 6371
export const EARTH_MU = 3.986004418e14
export const MOON_RADIUS_KM = 1737
export const MOON_ORBIT_KM = 384_400
export const MOON_MU = 4.9048695e12
export const SUN_RADIUS_KM = 696_000
export const SUN_MU = 1.32712440018e20
export const AU_KM = 149_597_870.7

/** 地图显示：1 像素代表的公里数（zoom=1 时地月系统概览） */
export const MAP_KM_PER_PX_BASE = 8000

/** 真实周期（秒）— 仅作文档参考 */
export const REAL_PERIODS_S = {
  earthRotation: 86_164,
  earthRevolution: 31_557_600,
  moonOrbit: 2_360_592,
  moonRotation: 2_360_592, // 潮汐锁定
  sunRotation: 2_160_000,
} as const

/**
 * 仿真时间压缩：地图/自转动画用（秒 = 一圈）
 * 真实比例过大，此处为可观察的游戏时间尺度
 */
export const SIM_PERIODS_S = {
  earthRotation: 120,
  earthRevolution: 200,
  moonOrbit: 50,
  moonRotation: 50, // 与公转同步（潮汐锁定）
  sunRotation: 160,
} as const

export const CELESTIAL = {
  sun: {
    id: 'sun' as const,
    label: '太阳',
    radiusKm: SUN_RADIUS_KM,
    mu: SUN_MU,
    hasAtmosphere: false,
    rotationPeriodS: SIM_PERIODS_S.sunRotation,
  },
  earth: {
    id: 'earth' as const,
    label: '地球',
    radiusKm: EARTH_RADIUS_KM,
    mu: EARTH_MU,
    hasAtmosphere: true,
    rotationPeriodS: SIM_PERIODS_S.earthRotation,
    revolutionPeriodS: SIM_PERIODS_S.earthRevolution,
  },
  moon: {
    id: 'moon' as const,
    label: '月球',
    radiusKm: MOON_RADIUS_KM,
    mu: MOON_MU,
    hasAtmosphere: false,
    rotationPeriodS: SIM_PERIODS_S.moonRotation,
    revolutionPeriodS: SIM_PERIODS_S.moonOrbit,
  },
} as const

export type CelestialId = keyof typeof CELESTIAL
export type SurfaceRef = 'earth' | 'moon' | 'space'

/** 物理与环境开关 */
export const ENV_CONFIG = {
  /** 月球引力是否参与飞行积分 */
  moonGravity: true,
  /** 地球引力使用地心矢量（替代纯高度标量） */
  vectorEarthGravity: true,
  /** 太阳/地球公转引力（飞行尺度可忽略，地图仅视觉） */
  heliocentricGravity: false,
} as const

/** 地图世界坐标（未乘视图 zoom，由 canvas scale 统一缩放） */
export function kmToMapUnits(km: number): number {
  return km / MAP_KM_PER_PX_BASE
}

export function kmToMapPx(km: number, zoom: number): number {
  return kmToMapUnits(km) * zoom
}

export function mapPxToKm(px: number, zoom: number): number {
  return px * (MAP_KM_PER_PX_BASE / zoom)
}

/** 仿真时间 → 角速度（弧度/秒） */
export function angularRateRadPerS(periodS: number): number {
  return (2 * Math.PI) / periodS
}
