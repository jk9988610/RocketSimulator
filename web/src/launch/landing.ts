import type { FlightState } from './flight-physics'
import type { FlightRocket } from './rocket-body'

export type LandingResult = 'none' | 'success' | 'crash'

/** 无降落伞时允许安全着陆的最大竖直速度 (m/s) */
const SAFE_TOUCHDOWN_MS = 6
/** 有降落伞时允许安全着陆的最大竖直速度 (m/s) */
const PARACHUTE_SAFE_MS = 14
/** 至少达到此高度才判定着陆（米） */
const MIN_FLIGHT_ALT_M = 15
/** 着陆时允许的最大倾角（弧度，约 18°） */
const MAX_LANDING_ANGLE_RAD = 0.32
/** 触发降落伞建议的下降速度 (m/s) */
export const PARACHUTE_ADVISORY_VY_MS = 25
/** 触发降落伞建议的最低高度 (m) */
export const PARACHUTE_ADVISORY_ALT_M = 800

export function evaluateLanding(
  rocket: FlightRocket,
  impactSpeedMs: number,
  maxAltM: number,
  landingAngleRad: number,
): LandingResult {
  if (maxAltM < MIN_FLIGHT_ALT_M) return 'none'

  const hasCommandPod = rocket.parts.some(
    (p) => p.typeId === 'command-pod' && !p.detached,
  )
  if (!hasCommandPod) return 'crash'

  if (Math.abs(landingAngleRad) > MAX_LANDING_ANGLE_RAD) return 'crash'

  const parachute = rocket.hasParachuteDeployed()
  const limit = parachute ? PARACHUTE_SAFE_MS : SAFE_TOUCHDOWN_MS

  return impactSpeedMs <= limit ? 'success' : 'crash'
}

export function landingMessage(
  result: LandingResult,
  parachute: boolean,
  landingAngleRad: number,
): string {
  if (result === 'crash' && Math.abs(landingAngleRad) > MAX_LANDING_ANGLE_RAD) {
    return '坠毁 — 着陆倾角过大'
  }
  switch (result) {
    case 'success':
      return parachute ? '降落成功 — 宇航员安全着陆' : '着陆成功 — 宇航员安全'
    case 'crash':
      return parachute ? '着陆失败 — 速度过快' : '坠毁 — 需要降落伞或减速'
    default:
      return ''
  }
}

/** 下降中且速度过快、未展开降落伞时提示 */
export function needsParachuteAdvisory(
  altM: number,
  verticalSpeedMs: number,
  parachuteDeployed: boolean,
  grounded: boolean,
): boolean {
  if (grounded || parachuteDeployed) return false
  return altM < PARACHUTE_ADVISORY_ALT_M && verticalSpeedMs > PARACHUTE_ADVISORY_VY_MS
}

export function altitudeMeters(flight: FlightState, padY: number, pxPerMeter: number): number {
  return Math.max(0, (padY - flight.y) / pxPerMeter)
}
