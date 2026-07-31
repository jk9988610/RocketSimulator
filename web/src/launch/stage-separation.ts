import { getPartDefinition } from '../parts/definitions'
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
}

function partBottom(part: FlightPartState): number {
  const def = getPartDefinition(part.typeId)
  return part.y + (part.ringSpan ?? def.height)
}

function partsOverlapColumn(a: FlightPartState, b: FlightPartState): boolean {
  const da = getPartDefinition(a.typeId)
  const db = getPartDefinition(b.typeId)
  const overlap =
    Math.min(a.x + da.width, b.x + db.width) - Math.max(a.x, b.x)
  return overlap > Math.min(da.width, db.width) * 0.3
}

export function collectPartsBelowConnector(
  connector: FlightPartState,
  parts: readonly FlightPartState[],
): FlightPartState[] {
  const splitY = partBottom(connector)
  return parts.filter(
    (p) =>
      !p.detached &&
      p.id !== connector.id &&
      !p.envelopedBy &&
      partsOverlapColumn(p, connector) &&
      p.y >= splitY - 6,
  )
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
  }
}

export function updateFloatingStage(
  stage: FloatingStage,
  dt: number,
  gravity: number,
): void {
  stage.age += dt
  stage.vy += gravity * dt
  stage.x += stage.vx * dt * 32
  stage.y += stage.vy * dt * 32
  stage.angle += stage.spin * dt
  stage.vx *= 1 - 0.04 * dt
  stage.vy *= 1 - 0.01 * dt
}
