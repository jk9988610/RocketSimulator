import { getPartDefinition } from '../parts/definitions'
import type { PartInstance, PartTypeId } from '../parts/types'

export interface FlightPartState extends PartInstance {
  detached: boolean
  ignited: boolean
  parachuteDeployed: boolean
  connectorOpen: boolean
  fuel?: number
}

export interface FuelTankStatus {
  id: string
  label: string
  fraction: number
  y: number
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

const PART_DRY_MASS: Record<PartTypeId, number> = {
  'command-pod': 1200,
  parachute: 150,
  'heat-shield': 200,
  'ring-connector': 300,
  'fuel-tank': 400,
  'radial-connector': 400,
  'nose-cone': 100,
  engine: 900,
}

const FUEL_CAPACITY = 4800
const FUEL_MASS_PER_UNIT = 0.5
const ENGINE_THRUST = 18000
const FUEL_BURN_RATE = 2.8

export class FlightRocket {
  readonly parts: FlightPartState[]
  bounds: RocketBounds

  constructor(parts: PartInstance[]) {
    this.parts = parts
      .filter((p) => !p.mirrorOf)
      .map((p) => ({
        ...p,
        detached: false,
        ignited: false,
        parachuteDeployed: false,
        connectorOpen: false,
        fuel: p.typeId === 'fuel-tank' ? FUEL_CAPACITY : undefined,
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
      .reduce((sum, p) => {
        let mass = PART_DRY_MASS[p.typeId]
        if (p.typeId === 'fuel-tank' && p.fuel !== undefined) {
          mass += p.fuel * FUEL_MASS_PER_UNIT
        }
        return sum + mass
      }, 0)
  }

  getFuelTanksOrdered(): FuelTankStatus[] {
    return this.parts
      .filter((p) => p.typeId === 'fuel-tank' && !p.detached)
      .sort((a, b) => a.y - b.y)
      .map((p, i) => ({
        id: p.id,
        label: `燃料箱 ${i + 1}`,
        fraction: (p.fuel ?? 0) / FUEL_CAPACITY,
        y: p.y,
      }))
  }

  consumeFuel(dt: number, throttle: number, engineCount: number): void {
    if (engineCount <= 0 || throttle <= 0) return
    const need = FUEL_BURN_RATE * throttle * engineCount * dt

    const tanks = this.parts.filter(
      (p) => p.typeId === 'fuel-tank' && !p.detached && (p.fuel ?? 0) > 0,
    )
    if (tanks.length === 0) return

    const totalFuel = tanks.reduce((sum, t) => sum + (t.fuel ?? 0), 0)
    if (totalFuel <= 0) return

    const takeTotal = Math.min(need, totalFuel)
    for (const tank of tanks) {
      const fraction = (tank.fuel ?? 0) / totalFuel
      tank.fuel = Math.max(0, (tank.fuel ?? 0) - takeTotal * fraction)
    }
  }

  hasFuel(): boolean {
    return this.parts.some(
      (p) => p.typeId === 'fuel-tank' && !p.detached && (p.fuel ?? 0) > 0.01,
    )
  }

  getIgnitedEngineThrust(throttle: number, activeEngineIds: string[]): number {
    if (throttle <= 0 || activeEngineIds.length === 0 || !this.hasFuel()) return 0
    const active = new Set(activeEngineIds)
    const count = this.parts.filter(
      (p) => p.typeId === 'engine' && !p.detached && p.ignited && active.has(p.id),
    ).length
    return count * ENGINE_THRUST * throttle
  }

  getActiveEngineCount(activeEngineIds: string[]): number {
    const active = new Set(activeEngineIds)
    return this.parts.filter(
      (p) => p.typeId === 'engine' && !p.detached && p.ignited && active.has(p.id),
    ).length
  }

  hasParachuteDeployed(): boolean {
    return this.parts.some(
      (p) => p.typeId === 'parachute' && p.parachuteDeployed && !p.detached,
    )
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

  recomputeBounds(): void {
    this.bounds = this.computeBounds()
  }

  private computeBounds(): RocketBounds {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let hasPart = false

    for (const part of this.parts) {
      if (part.detached) continue
      hasPart = true
      const def = getPartDefinition(part.typeId)
      const h = part.ringSpan ?? def.height
      minX = Math.min(minX, part.x)
      minY = Math.min(minY, part.y)
      maxX = Math.max(maxX, part.x + def.width)
      maxY = Math.max(maxY, part.y + h)
    }

    if (!hasPart) {
      return {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
        centerX: 0,
        bottomY: 0,
      }
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

export { FUEL_CAPACITY }
