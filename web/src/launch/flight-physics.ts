import type { FlightRocket } from './rocket-body'

const GRAVITY = 9.81
const PX_PER_METER = 32
const DRAG = 0.02
const PARACHUTE_DRAG = 2.5
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
  },
): void {
  if (options.tiltLeft) state.angle -= TILT_RATE * dt
  if (options.tiltRight) state.angle += TILT_RATE * dt
  state.angle = clamp(state.angle, -1.2, 1.2)

  const mass = Math.max(rocket.getTotalMass(), 1)
  let ax = 0
  let ay = GRAVITY

  if (options.engineOn) {
    const thrust = rocket.getIgnitedEngineThrust(options.throttle, options.activeEngineIds)
    if (thrust > 0) {
      const thrustPx = (thrust / mass) * PX_PER_METER
      ax += Math.sin(state.angle) * thrustPx
      ay -= Math.cos(state.angle) * thrustPx
    }
  }

  if (options.grounded) {
    if (ay >= GRAVITY * 0.98) {
      state.vy = 0
      state.vx *= 0.92
      return
    }
  } else {
    const speed = Math.hypot(state.vx, state.vy)
    const dragCoeff = rocket.hasParachuteDeployed() ? PARACHUTE_DRAG : DRAG
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
