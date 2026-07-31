import type { FlightState } from './flight-physics'
import { CELESTIAL, ENV_CONFIG } from './cosmos-scale'
import { computeGeocentricState } from './cosmos-simulation'
import { positionFromEarthCenterM } from './orbit-mechanics'

export interface GravityAcceleration {
  ax: number
  ay: number
}

/**
 * 地心坐标系下的引力加速度（m/s²）
 * +y 指向地心（与飞行积分坐标一致）
 */
export function computeGravityAcceleration(
  flight: FlightState,
  simTimeS: number,
): GravityAcceleration {
  const pos = positionFromEarthCenterM(flight)
  const r = Math.hypot(pos.x, pos.y)
  if (r < 1) return { ax: 0, ay: 9.81 }

  let ax = 0
  let ay = 0

  if (ENV_CONFIG.vectorEarthGravity) {
    const gEarth = CELESTIAL.earth.mu / (r * r * r)
    ax -= gEarth * pos.x
    ay -= gEarth * pos.y
  } else {
    const g0 = 9.81
    const earthRadiusM = CELESTIAL.earth.radiusKm * 1000
    const g = g0 * (earthRadiusM / r) ** 2
    ax += 0
    ay += g
  }

  if (ENV_CONFIG.moonGravity) {
    const { moonPositionM } = computeGeocentricState(simTimeS)
    const dx = moonPositionM.x - pos.x
    const dy = moonPositionM.y - pos.y
    const rm = Math.hypot(dx, dy)
    if (rm > 1) {
      const gMoon = CELESTIAL.moon.mu / (rm * rm * rm)
      ax += gMoon * dx
      ay += gMoon * dy
    }
  }

  return { ax, ay }
}
