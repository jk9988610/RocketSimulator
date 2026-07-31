import { PX_PER_METER } from './flight-physics'
import type { FlightState } from './flight-physics'
import { CELESTIAL, EARTH_RADIUS_KM, MOON_ORBIT_KM, type CelestialId, type SurfaceRef } from './cosmos-scale'

export interface OrbitalElements {
  apoapsisKm: number
  periapsisKm: number
  eccentricity: number
  semiMajorAxisKm: number
  isEscape: boolean
}

export interface SurfaceState {
  body: CelestialId
  label: string
  altKm: number
  surfaceRef: SurfaceRef
}

const EARTH_RADIUS_M = EARTH_RADIUS_KM * 1000

/** 相对地球中心的位置（米） */
export function positionFromEarthCenterM(flight: FlightState): { x: number; y: number } {
  return {
    x: flight.x / PX_PER_METER,
    y: flight.y / PX_PER_METER - EARTH_RADIUS_M,
  }
}

/** 从航天学 vis-viva 估算近点/远点（相对地球） */
export function computeOrbitalElements(flight: FlightState): OrbitalElements | null {
  const pos = positionFromEarthCenterM(flight)
  const r = Math.hypot(pos.x, pos.y)
  if (r < EARTH_RADIUS_M * 0.5) return null

  const vx = flight.vx
  const vy = flight.vy
  const v2 = vx * vx + vy * vy
  const mu = CELESTIAL.earth.mu

  const energy = v2 / 2 - mu / r
  const h = pos.x * vy - pos.y * vx

  if (Math.abs(h) < 1) return null

  if (energy >= 0) {
    return {
      apoapsisKm: Infinity,
      periapsisKm: Math.max(0, r / 1000 - EARTH_RADIUS_KM),
      eccentricity: 1,
      semiMajorAxisKm: Infinity,
      isEscape: true,
    }
  }

  const e2 = 1 + (2 * energy * h * h) / (mu * mu)
  if (e2 < 0) return null
  const e = Math.sqrt(e2)
  const a = -mu / (2 * energy)
  const rp = a * (1 - e)
  const ra = a * (1 + e)

  return {
    apoapsisKm: Math.max(0, ra / 1000 - EARTH_RADIUS_KM),
    periapsisKm: Math.max(0, rp / 1000 - EARTH_RADIUS_KM),
    eccentricity: e,
    semiMajorAxisKm: a / 1000,
    isEscape: false,
  }
}

export function altitudeAboveEarthKm(flight: FlightState): number {
  const pos = positionFromEarthCenterM(flight)
  const r = Math.hypot(pos.x, pos.y)
  return Math.max(0, r / 1000 - EARTH_RADIUS_KM)
}

export function distanceToMoonKm(flight: FlightState): number {
  const pos = positionFromEarthCenterM(flight)
  const moonDistM = MOON_ORBIT_KM * 1000
  const mx = moonDistM
  const my = 0
  return Math.hypot(pos.x - mx, pos.y - my) / 1000
}

export function resolveSurfaceState(flight: FlightState, grounded: boolean): SurfaceState {
  const altEarth = altitudeAboveEarthKm(flight)
  const moonDist = distanceToMoonKm(flight)

  if (grounded && altEarth < 1) {
    return { body: 'earth', label: '地球表面', altKm: 0, surfaceRef: 'earth' }
  }

  if (moonDist < CELESTIAL.moon.radiusKm + 5 && altEarth > 100_000) {
    const altMoon = moonDist - CELESTIAL.moon.radiusKm
    return {
      body: 'moon',
      label: '月球表面',
      altKm: Math.max(0, altMoon),
      surfaceRef: 'moon',
    }
  }

  if (altEarth < 1 && !grounded) {
    return { body: 'earth', label: '地球低空', altKm: altEarth, surfaceRef: 'earth' }
  }

  return {
    body: 'earth',
    label: altEarth < 100 ? '地球大气层' : '太空（地心距）',
    altKm: altEarth,
    surfaceRef: 'space',
  }
}
