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

/** 获取连接器下方的部件（不含连接器自身） */
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

  return {
    parts,
    x: flightX,
    y: flightY + (minY - boundsBottomY) * 0.3,
    vx: flightVx + (Math.random() - 0.5) * 2,
    vy: flightVy + 1.5 + Math.random() * 1.5,
    angle: flightAngle,
    spin: (Math.random() - 0.5) * 0.4,
  }
}

export function updateFloatingStage(stage: FloatingStage, dt: number, gravity: number): void {
  stage.vy += gravity * dt
  stage.x += stage.vx * dt * 32
  stage.y += stage.vy * dt * 32
  stage.angle += stage.spin * dt
  stage.vx *= 1 - 0.08 * dt
}
