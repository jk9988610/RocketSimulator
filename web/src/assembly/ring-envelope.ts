import { getPartDefinition } from '../parts/definitions'
import {
  CONNECTOR_ALIGN_TOL,
  findConnectorPartner,
  getPartBottomY,
  getPartBounds,
  getPartTopY,
  isStackedOn,
  RING_GEOMETRY,
} from '../parts/part-geometry'
import type { PartInstance } from '../parts/types'

const ANCHOR_TYPES = new Set(['command-pod', 'fuel-tank'])

function partCenterX(part: PartInstance): number {
  return getPartBounds(part).centerX
}

function partsOverlapColumn(a: PartInstance, b: PartInstance): boolean {
  const da = getPartDefinition(a.typeId)
  const db = getPartDefinition(b.typeId)
  const overlap =
    Math.min(a.x + da.width, b.x + db.width) - Math.max(a.x, b.x)
  return overlap > Math.min(da.width, db.width) * 0.35
}

function getColumnParts(parts: readonly PartInstance[], anchor: PartInstance): PartInstance[] {
  return parts.filter(
    (p) => !p.mirrorOf && !p.envelopedBy && partsOverlapColumn(p, anchor),
  )
}

function clearEnvelopeState(parts: PartInstance[]): void {
  for (const part of parts) {
    delete part.envelopedBy
    if (part.typeId === 'ring-connector') {
      delete part.ringSpan
      delete part.ringBottomLy
    }
  }
}

function findAnchorBottomY(
  column: readonly PartInstance[],
  belowY: number,
): number | null {
  let best: number | null = null
  for (const part of column) {
    if (!ANCHOR_TYPES.has(part.typeId)) continue
    const bottom = getPartBottomY(part)
    if (bottom > belowY + CONNECTOR_ALIGN_TOL) continue
    if (best === null || bottom < best) best = bottom
  }
  return best
}

function resolveSpanTopFromEngine(
  engine: PartInstance,
  others: readonly PartInstance[],
  column: readonly PartInstance[],
  ringPlacedTop: number,
): number | null {
  const above = findConnectorPartner(engine, 'top', others)
  if (above?.typeId === 'fuel-tank') {
    return getPartBottomY(above)
  }
  if (above?.typeId === 'command-pod') {
    return getPartBottomY(above)
  }
  if (above?.typeId === 'heat-shield') {
    const pod = findConnectorPartner(above, 'top', others)
    if (pod?.typeId === 'command-pod') {
      return getPartBottomY(pod)
    }
    return findAnchorBottomY(column, ringPlacedTop)
  }
  return null
}

export function updateRingEnvelopes(parts: PartInstance[]): void {
  clearEnvelopeState(parts)

  const ringDef = getPartDefinition('ring-connector')
  const rings = parts.filter((p) => p.typeId === 'ring-connector' && !p.mirrorOf)

  for (const ring of rings) {
    const column = getColumnParts(parts, ring)
    const others = parts.filter((p) => p.id !== ring.id && !p.mirrorOf)

    const placedTop = ring.y
    const placedBottom = ring.y + ringDef.height

    let spanTop = placedTop
    const spanBottom = placedBottom
    const toEnvelop: PartInstance[] = []

    const engineAbove = column.find(
      (p) => p.typeId === 'engine' && isStackedOn(p, placedTop),
    )

    if (engineAbove) {
      const targetTop = resolveSpanTopFromEngine(engineAbove, others, column, placedTop)
      if (targetTop === null) continue
      spanTop = targetTop
      toEnvelop.push(engineAbove)
    } else {
      const heatAbove = column.find(
        (p) => p.typeId === 'heat-shield' && isStackedOn(p, placedTop),
      )
      if (heatAbove) {
        toEnvelop.push(heatAbove)
        const pod = findConnectorPartner(heatAbove, 'top', others)
        if (pod?.typeId === 'command-pod') {
          spanTop = getPartBottomY(pod)
        } else {
          const anchorY = findAnchorBottomY(column, placedTop)
          if (anchorY !== null) spanTop = anchorY
        }
      } else {
        const anchorAbove = column.find(
          (p) => ANCHOR_TYPES.has(p.typeId) && isStackedOn(p, placedTop),
        )
        if (!anchorAbove) continue
        spanTop = getPartBottomY(anchorAbove)
      }
    }

    const span = spanBottom - spanTop
    if (span < RING_GEOMETRY.height - 0.5) continue
    if (spanTop >= placedTop - 0.5 && toEnvelop.length === 0) continue

    const ref =
      toEnvelop[0] ??
      column.find((p) => ANCHOR_TYPES.has(p.typeId) && isStackedOn(p, placedTop)) ??
      ring

    ring.x = partCenterX(ref) - ringDef.width / 2
    ring.y = spanTop
    ring.ringSpan = span
    ring.ringBottomLy = placedBottom - spanTop

    for (const p of toEnvelop) {
      const top = getPartTopY(p)
      const bottom = getPartBottomY(p)
      if (top >= spanTop - 0.5 && bottom <= spanBottom + 0.5) {
        p.envelopedBy = ring.id
      }
    }
  }
}
