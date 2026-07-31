import { collectConnectedAssembly } from '../assembly/part-connections'
import type { FlightPartState } from './rocket-body'

/** 与指定引擎物理对接链上可达的燃料箱（含径向并联） */
export function collectFuelTanksForEngines(
  engineIds: readonly string[],
  parts: readonly FlightPartState[],
): FlightPartState[] {
  const tankIds = new Set<string>()

  for (const engineId of engineIds) {
    const component = collectConnectedAssembly([engineId], parts)
    for (const p of component) {
      if (p.typeId === 'fuel-tank' && !(p as FlightPartState).detached) {
        tankIds.add(p.id)
      }
    }
  }

  return parts.filter(
    (p) => p.typeId === 'fuel-tank' && !p.detached && tankIds.has(p.id),
  )
}

/** 引擎供油链上是否仍有燃料 */
export function feedHasFuel(
  engineIds: readonly string[],
  parts: readonly FlightPartState[],
): boolean {
  return collectFuelTanksForEngines(engineIds, parts).some((t) => (t.fuel ?? 0) > 0.01)
}
