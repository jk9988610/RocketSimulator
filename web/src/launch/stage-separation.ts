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

function partsOverlapColumn(a: FlightPartState, b: FlightPartState): boolean {
  const da = getPartDefinition(a.typeId)
  const db = getPartDefinition(b.typeId)
  const overlap =
    Math.min(a.x + da.width, b.x + db.width) - Math.max(a.x, b.x)
  return overlap > Math.min(da.width, db.width) * 0.3
}

/**
 * 级间分离：连接器与下层/侧枝（枝干）一起脱落，上方主干保留。
 * 包含：连接器本体、同列其下部件、被该环包裹的引擎/隔热片、径向侧枝。
 */
export function collectDetachedStageParts(
  connector: FlightPartState,
  parts: readonly FlightPartState[],
): FlightPartState[] {
  const splitY = connector.y
  const detachedIds = new Set<string>([connector.id])

  for (const p of parts) {
    if (p.detached || p.id === connector.id) continue

    const inColumnBelow =
      partsOverlapColumn(p, connector) && p.y >= splitY - 4

    if (inColumnBelow) {
      detachedIds.add(p.id)
    }
  }

  if (connector.typeId === 'ring-connector') {
    for (const p of parts) {
      if (p.envelopedBy === connector.id) {
        detachedIds.add(p.id)
      }
    }
  }

  if (connector.typeId === 'radial-connector') {
    const connDef = getPartDefinition(connector.typeId)
    const connRight = connector.x + connDef.width
    for (const p of parts) {
      if (p.detached || p.id === connector.id) continue
      const sideAttached =
        (p.x + getPartDefinition(p.typeId).width >= connector.x - 8 &&
          p.x <= connRight + 8 &&
          Math.abs(
            p.y +
              (p.ringSpan ?? getPartDefinition(p.typeId).height) / 2 -
              (connector.y + connDef.height / 2),
          ) < connDef.height * 0.75) ||
        (partsOverlapColumn(p, connector) && p.y >= splitY - 4)
      if (sideAttached) {
        detachedIds.add(p.id)
      }
    }
  }

  let changed = true
  while (changed) {
    changed = false
    for (const p of parts) {
      if (p.detached || !p.envelopedBy) continue
      if (detachedIds.has(p.envelopedBy) && !detachedIds.has(p.id)) {
        detachedIds.add(p.id)
        changed = true
      }
    }
  }

  return parts.filter((p) => detachedIds.has(p.id) && !p.detached)
}

/** @deprecated 使用 collectDetachedStageParts */
export function collectPartsBelowConnector(
  connector: FlightPartState,
  parts: readonly FlightPartState[],
): FlightPartState[] {
  return collectDetachedStageParts(connector, parts)
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
