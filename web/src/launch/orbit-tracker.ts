import { PX_PER_METER } from './flight-physics'
import type { FlightState } from './flight-physics'

export interface OrbitSample {
  mapX: number
  mapY: number
  altKm: number
}

const EARTH_MAP_RADIUS = 52
const ALT_SCALE = 6

export class OrbitTracker {
  private samples: OrbitSample[] = []

  reset(): void {
    this.samples = []
  }

  record(
    flight: FlightState,
    padCenterX: number,
    padSurfaceY: number,
  ): void {
    const altKm = Math.max(0, (padSurfaceY - flight.y) / PX_PER_METER / 1000)
    if (altKm < 0.02) return

    const horizKm = (flight.x - padCenterX) / PX_PER_METER / 1000
    const r = EARTH_MAP_RADIUS + altKm * ALT_SCALE
    const angle = Math.atan2(horizKm, altKm + 0.001) - Math.PI / 2
    const mapX = Math.cos(angle) * r
    const mapY = Math.sin(angle) * r

    const last = this.samples[this.samples.length - 1]
    if (last) {
      const dist = Math.hypot(mapX - last.mapX, mapY - last.mapY)
      if (dist < 2) return
    }

    this.samples.push({ mapX, mapY, altKm })
    if (this.samples.length > 800) {
      this.samples.shift()
    }
  }

  getSamples(): readonly OrbitSample[] {
    return this.samples
  }

  getRocketMapPosition(
    flight: FlightState,
    padCenterX: number,
    padSurfaceY: number,
  ): OrbitSample {
    const altKm = Math.max(0, (padSurfaceY - flight.y) / PX_PER_METER / 1000)
    const horizKm = (flight.x - padCenterX) / PX_PER_METER / 1000
    const r = EARTH_MAP_RADIUS + altKm * ALT_SCALE
    const angle = Math.atan2(horizKm, altKm + 0.001) - Math.PI / 2
    return {
      mapX: Math.cos(angle) * r,
      mapY: Math.sin(angle) * r,
      altKm,
    }
  }

  getApoapsis(): OrbitSample | null {
    if (this.samples.length < 3) return null
    return this.samples.reduce((max, s) => (s.altKm > max.altKm ? s : max))
  }

  getPeriapsis(): OrbitSample | null {
    const airborne = this.samples.filter((s) => s.altKm > 0.05)
    if (airborne.length < 3) return null
    return airborne.reduce((min, s) => (s.altKm < min.altKm ? s : min))
  }
}

export { EARTH_MAP_RADIUS }
