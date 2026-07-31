import { PX_PER_METER } from './flight-physics'
import type { FlightState } from './flight-physics'
import { EARTH_RADIUS_KM, kmToMapUnits } from './cosmos-scale'
import {
  altitudeAboveEarthKm,
  computeOrbitalElements,
  computeOrbitGeometry,
  computePredictedOrbitPath,
  isBoundOrbit,
  type OrbitPathSample,
} from './orbit-mechanics'

export interface OrbitSample {
  horizKm: number
  altKm: number
}

export interface OrbitApsis {
  mapX: number
  mapY: number
  altKm: number
  label: '近点' | '远点'
}

const EARTH_MAP_RADIUS = 40

function sampleToMap(sample: OrbitSample): { x: number; y: number } {
  const rKm = EARTH_RADIUS_KM + sample.altKm
  const theta = Math.atan2(sample.horizKm, rKm)
  return {
    x: kmToMapUnits(rKm * Math.sin(theta)),
    y: -kmToMapUnits(rKm * Math.cos(theta)),
  }
}

function pathSampleToMap(sample: OrbitPathSample): { x: number; y: number } {
  return sampleToMap(sample)
}

export class OrbitTracker {
  private samples: OrbitSample[] = []
  private lastElements: ReturnType<typeof computeOrbitalElements> = null
  private lastFlight: FlightState | null = null

  reset(): void {
    this.samples = []
    this.lastElements = null
    this.lastFlight = null
  }

  record(flight: FlightState, _padX: number, _padY: number): void {
    const altKm = altitudeAboveEarthKm(flight)
    if (altKm < 0.02) return

    const horizKm = flight.x / PX_PER_METER / 1000
    const last = this.samples[this.samples.length - 1]
    if (last && Math.hypot(horizKm - last.horizKm, altKm - last.altKm) < 0.05) return

    this.samples.push({ horizKm, altKm })
    if (this.samples.length > 1200) this.samples.shift()
    this.lastElements = computeOrbitalElements(flight)
    this.lastFlight = { ...flight }
  }

  flightToEarthLocal(flight: FlightState): { x: number; y: number } {
    const altKm = altitudeAboveEarthKm(flight)
    const horizKm = flight.x / PX_PER_METER / 1000
    return sampleToMap({ horizKm, altKm })
  }

  getSamples(): readonly OrbitSample[] {
    return this.samples
  }

  getPredictedOrbitPath(flight: FlightState): OrbitPathSample[] | null {
    if (altitudeAboveEarthKm(flight) < 0.5) return null
    return computePredictedOrbitPath(flight)
  }

  getRocketMapPosition(
    flight: FlightState,
    _padX: number,
    _padY: number,
  ): OrbitSample & { mapX: number; mapY: number } {
    const altKm = altitudeAboveEarthKm(flight)
    const horizKm = flight.x / PX_PER_METER / 1000
    const pos = sampleToMap({ horizKm, altKm })
    return { horizKm, altKm, mapX: pos.x, mapY: pos.y }
  }

  getApoapsis(flight?: FlightState): OrbitApsis | null {
    const el = this.lastElements
    const f = flight ?? this.lastFlight
    if (!el || !f || !isBoundOrbit(el)) return null
    const geometry = computeOrbitGeometry(f)
    if (!geometry) return null

    const rKm = EARTH_RADIUS_KM + el.apoapsisKm
    const angle = geometry.argumentOfPeriapsis + Math.PI
    return {
      mapX: kmToMapUnits(rKm * Math.sin(angle)),
      mapY: -kmToMapUnits(rKm * Math.cos(angle)),
      altKm: el.apoapsisKm,
      label: '远点',
    }
  }

  getPeriapsis(flight?: FlightState): OrbitApsis | null {
    const el = this.lastElements
    const f = flight ?? this.lastFlight
    if (!el || !f || !isBoundOrbit(el)) return null
    const geometry = computeOrbitGeometry(f)
    if (!geometry) return null

    const rKm = EARTH_RADIUS_KM + el.periapsisKm
    const angle = geometry.argumentOfPeriapsis
    return {
      mapX: kmToMapUnits(rKm * Math.sin(angle)),
      mapY: -kmToMapUnits(rKm * Math.cos(angle)),
      altKm: el.periapsisKm,
      label: '近点',
    }
  }

  getOrbitalElements() {
    return this.lastElements
  }

  isInBoundOrbit(): boolean {
    return this.lastElements !== null && isBoundOrbit(this.lastElements)
  }
}

export { EARTH_MAP_RADIUS, pathSampleToMap }
