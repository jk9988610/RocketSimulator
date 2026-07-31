import { getPartDefinition } from '../parts/definitions'
import type { PartInstance, PartTypeId } from '../parts/types'

export interface FlightPartState extends PartInstance {
  detached: boolean
  ignited: boolean
  parachuteDeployed: boolean
  connectorOpen: boolean
}

export interface RocketBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
  centerX: number
  bottomY: number
}

const PART_MASS: Record<PartTypeId, number> = {
  'command-pod': 1200,
  parachute: 150,
  'heat-shield': 200,
  'ring-connector': 300,
  'fuel-tank': 2500,
  'radial-connector': 400,
  'nose-cone': 100,
  engine: 900,
}

const ENGINE_THRUST = 18000

export class FlightRocket {
  readonly parts: FlightPartState[]
  readonly bounds: RocketBounds

  constructor(parts: PartInstance[]) {
    this.parts = parts
      .filter((p) => !p.mirrorOf)
      .map((p) => ({
        ...p,
        detached: false,
        ignited: false,
        parachuteDeployed: false,
        connectorOpen: false,
      }))
    this.bounds = this.computeBounds()
  }

  static fromAssembly(parts: readonly PartInstance[]): FlightRocket | null {
    const primaries = parts.filter((p) => !p.mirrorOf)
    if (!primaries.some((p) => p.typeId === 'engine')) return null
    return new FlightRocket([...primaries])
  }

  getPart(id: string): FlightPartState | undefined {
    return this.parts.find((p) => p.id === id)
  }

  getTotalMass(): number {
    return this.parts
      .filter((p) => !p.detached)
      .reduce((sum, p) => sum + PART_MASS[p.typeId], 0)
  }

  getIgnitedEngineThrust(throttle: number, activeEngineIds: string[]): number {
    if (throttle <= 0 || activeEngineIds.length === 0) return 0
    const active = new Set(activeEngineIds)
    const count = this.parts.filter(
      (p) => p.typeId === 'engine' && !p.detached && p.ignited && active.has(p.id),
    ).length
    return count * ENGINE_THRUST * throttle
  }

  hasParachuteDeployed(): boolean {
    return this.parts.some((p) => p.typeId === 'parachute' && p.parachuteDeployed)
  }

  applyStageAction(partId: string): void {
    const part = this.getPart(partId)
    if (!part || part.detached) return

    switch (part.typeId) {
      case 'engine':
        part.ignited = true
        break
      case 'parachute':
        part.parachuteDeployed = true
        break
      case 'ring-connector':
      case 'radial-connector':
        part.connectorOpen = true
        break
    }
  }

  private computeBounds(): RocketBounds {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const part of this.parts) {
      const def = getPartDefinition(part.typeId)
      const h = part.ringSpan ?? def.height
      minX = Math.min(minX, part.x)
      minY = Math.min(minY, part.y)
      maxX = Math.max(maxX, part.x + def.width)
      maxY = Math.max(maxY, part.y + h)
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      bottomY: maxY,
    }
  }
}

export function getActiveStageEngineIds(
  rocket: FlightRocket,
  stages: readonly { number: number; targetPartIds: string[] }[],
): string[] {
  const sorted = [...stages].sort((a, b) => b.number - a.number)
  for (const stage of sorted) {
    const engines = stage.targetPartIds.filter((id) => {
      const part = rocket.getPart(id)
      return part?.typeId === 'engine' && !part.detached
    })
    if (engines.length > 0) return engines
  }
  return []
}
