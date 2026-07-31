import type { FlightRocket } from './rocket-body'
import {
  airDensityRatio,
  atmosphereDragMultiplier,
} from './atmosphere'
import { computeGravityAcceleration } from './gravity'

const PX_PER_METER = 32
const BASE_DRAG = 0.02
const PARACHUTE_DRAG = 4.2
const TILT_RATE = 0.8

export interface FlightState {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
}

export function createInitialFlightState(
  padX: number,
  padSurfaceY: number,
  _rocket: FlightRocket,
): FlightState {
  return {
    x: padX,
    y: padSurfaceY,
    vx: 0,
    vy: 0,
    angle: 0,
  }
}

export function updateFlight(
  state: FlightState,
  rocket: FlightRocket,
  dt: number,
  options: {
    throttle: number
    engineOn: boolean
    activeEngineIds: string[]
    tiltLeft: boolean
    tiltRight: boolean
    grounded: boolean
    altKm: number
    simTimeS: number
  },
): void {
  if (options.tiltLeft) state.angle -= TILT_RATE * dt
  if (options.tiltRight) state.angle += TILT_RATE * dt
  state.angle = clamp(state.angle, -1.2, 1.2)

  const mass = Math.max(rocket.getTotalMass(), 1)
  const grav = computeGravityAcceleration(state, options.simTimeS)
  let ax = grav.ax
  let ay = grav.ay

  if (options.engineOn) {
    const thrust = rocket.getIgnitedEngineThrust(options.throttle, options.activeEngineIds)
    const engineCount = rocket.getActiveEngineCount(options.activeEngineIds)
    if (thrust > 0) {
      rocket.consumeFuel(dt, options.throttle, engineCount)
      const thrustPx = (thrust / mass) * PX_PER_METER
      ax += Math.sin(state.angle) * thrustPx
      ay -= Math.cos(state.angle) * thrustPx
    }
  }

  if (options.grounded) {
    if (ay >= grav.ay * 0.98) {
      state.vy = 0
      state.vx *= 0.92
      return
    }
  } else {
    const speed = Math.hypot(state.vx, state.vy)
    const parachute = rocket.hasParachuteDeployed()
    let dragCoeff = parachute ? PARACHUTE_DRAG : BASE_DRAG
    if (!parachute) {
      dragCoeff *= atmosphereDragMultiplier(options.altKm)
    } else {
      dragCoeff *= 0.5 + airDensityRatio(options.altKm) * 0.5
    }
    if (speed > 0.01) {
      ax -= (state.vx / speed) * dragCoeff * speed
      ay -= (state.vy / speed) * dragCoeff * speed
    }
  }

  state.vx += ax * dt
  state.vy += ay * dt
  state.x += state.vx * dt * PX_PER_METER
  state.y += state.vy * dt * PX_PER_METER
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export { PX_PER_METER }
