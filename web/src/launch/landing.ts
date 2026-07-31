import type { FlightState } from './flight-physics'
import type { FlightRocket } from './rocket-body'

export type LandingResult = 'none' | 'success' | 'crash'

/** 无降落伞时允许安全着陆的最大竖直速度 (m/s) */
const SAFE_TOUCHDOWN_MS = 6
/** 有降落伞时允许安全着陆的最大竖直速度 (m/s) */
const PARACHUTE_SAFE_MS = 14
/** 至少达到此高度才判定着陆（米） */
const MIN_FLIGHT_ALT_M = 15

export function evaluateLanding(
  rocket: FlightRocket,
  impactSpeedMs: number,
  maxAltM: number,
): LandingResult {
  if (maxAltM < MIN_FLIGHT_ALT_M) return 'none'

  const hasCommandPod = rocket.parts.some(
    (p) => p.typeId === 'command-pod' && !p.detached,
  )
  if (!hasCommandPod) return 'crash'

  const parachute = rocket.hasParachuteDeployed()
  const limit = parachute ? PARACHUTE_SAFE_MS : SAFE_TOUCHDOWN_MS

  return impactSpeedMs <= limit ? 'success' : 'crash'
}

export function landingMessage(result: LandingResult, parachute: boolean): string {
  switch (result) {
    case 'success':
      return parachute ? '降落成功 — 宇航员安全着陆' : '着陆成功 — 宇航员安全'
    case 'crash':
      return parachute ? '着陆失败 — 速度过快' : '坠毁 — 需要降落伞或减速'
    default:
      return ''
  }
}

export function altitudeMeters(flight: FlightState, padY: number, pxPerMeter: number): number {
  return Math.max(0, (padY - flight.y) / pxPerMeter)
}
