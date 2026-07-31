import { collectConnectedAssembly, getNeighborsViaKinds } from '../assembly/part-connections'
import type { FlightPartState } from './rocket-body'

export interface FloatingStage {
  parts: FlightPartState[]
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  spin: number
  age: number
  massKg: number
}

/**
 * 级间分离：从连接器「脱落侧」出发，沿物理对接关系取连通整体。
 * 例如：连接器—燃料箱—（鼻锥+引擎）作为一体脱落，上方主干保留。
 */
export function collectDetachedStageParts(
  connector: FlightPartState,
  parts: readonly FlightPartState[],
): FlightPartState[] {
  const detachKinds =
    connector.typeId === 'radial-connector'
      ? (['bottom', 'left', 'right'] as const)
      : (['bottom'] as const)

  const seeds = getNeighborsViaKinds(connector, [...detachKinds], parts)
  const seedIds = new Set<string>([connector.id, ...seeds.map((p) => p.id)])

  const component = collectConnectedAssembly(seedIds, parts)

  if (connector.typeId === 'ring-connector') {
    const ids = new Set(component.map((p) => p.id))
    for (const p of parts) {
      if (p.envelopedBy === connector.id && !ids.has(p.id)) {
        component.push(p)
        ids.add(p.id)
      }
    }
  }

  return component as FlightPartState[]
}

export function createFloatingStage(
  parts: FlightPartState[],
  flightX: number,
  flightY: number,
  flightVx: number,
  flightVy: number,
  flightAngle: number,
  _boundsCenterX: number,
  boundsBottomY: number,
  massKg: number,
): FloatingStage {
  let minY = Infinity
  for (const p of parts) {
    minY = Math.min(minY, p.y)
  }

  const separationBoost = 4 + Math.random() * 2

  return {
    parts,
    x: flightX + (Math.random() - 0.5) * 6,
    y: flightY + (minY - boundsBottomY) * 0.2,
    vx: flightVx + (Math.random() - 0.5) * 1.5,
    vy: flightVy + separationBoost,
    angle: flightAngle + (Math.random() - 0.5) * 0.15,
    spin: (Math.random() - 0.5) * 0.6,
    age: 0,
    massKg: Math.max(massKg, 1),
  }
}

export function updateFloatingStage(
  stage: FloatingStage,
  dt: number,
  gravity: number,
): void {
  stage.age += dt
  const massFactor = Math.sqrt(1200 / stage.massKg)
  stage.vy += gravity * dt
  stage.x += stage.vx * dt * 32 * massFactor
  stage.y += stage.vy * dt * 32 * massFactor
  stage.angle += stage.spin * dt
  stage.vx *= 1 - 0.04 * dt
  stage.vy *= 1 - 0.01 * dt
}
