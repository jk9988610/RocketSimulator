import { getPartDefinition } from '../parts/definitions'
import {
  CONNECTOR_ALIGN_TOL,
  findConnectorPartner,
  getPartBottomY,
  getPartBounds,
  getPartTopY,
  isStackedBelow,
  isStackedOn,
  RING_GEOMETRY,
} from '../parts/part-geometry'
import type { PartInstance } from '../parts/types'

const ANCHOR_TYPES = new Set(['command-pod', 'fuel-tank'])
const BELOW_BLOCKS_WRAP = new Set(['fuel-tank', 'engine'])

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
      if (part.ringSpan !== undefined && part.ringPlacementTop !== undefined) {
        part.y = part.ringPlacementTop
      }
      delete part.ringSpan
      delete part.ringBottomLy
    }
  }
}

function findPartBelow(
  column: readonly PartInstance[],
  ring: PartInstance,
  placedBottom: number,
): PartInstance | null {
  return (
    column.find(
      (p) =>
        p.id !== ring.id &&
        BELOW_BLOCKS_WRAP.has(p.typeId) &&
        isStackedBelow(p, placedBottom),
    ) ?? null
  )
}

function resolveSpanTopFromEngine(
  engine: PartInstance,
  others: readonly PartInstance[],
): number | null {
  const above = findConnectorPartner(engine, 'top', others)
  if (above?.typeId === 'fuel-tank' || above?.typeId === 'command-pod') {
    return getPartBottomY(above)
  }
  if (above?.typeId === 'heat-shield') {
    const pod = findConnectorPartner(above, 'top', others)
    if (pod?.typeId === 'command-pod') {
      return getPartBottomY(pod)
    }
  }
  return null
}

/** 拖动环时收起延伸、释放被包裹部件 */
export function collapseRingConnector(ring: PartInstance, parts: PartInstance[]): void {
  if (ring.typeId !== 'ring-connector') return

  for (const p of parts) {
    if (p.envelopedBy === ring.id) delete p.envelopedBy
  }

  if (ring.ringPlacementTop !== undefined) {
    ring.y = ring.ringPlacementTop
  }

  delete ring.ringSpan
  delete ring.ringBottomLy
}

export function updateRingEnvelopes(parts: PartInstance[]): void {
  clearEnvelopeState(parts)

  const ringDef = getPartDefinition('ring-connector')
  const rings = parts.filter((p) => p.typeId === 'ring-connector' && !p.mirrorOf)

  for (const ring of rings) {
    const column = getColumnParts(parts, ring)
    const others = parts.filter((p) => p.id !== ring.id && !p.mirrorOf)

    const placementTop = ring.y
    const placedBottom = placementTop + ringDef.height
    ring.ringPlacementTop = placementTop

    const partBelow = findPartBelow(column, ring, placedBottom)
    if (partBelow !== null) continue

    let spanTop = placementTop
    const spanBottom = placedBottom
    const toEnvelop: PartInstance[] = []

    const engineAbove = column.find(
      (p) => p.typeId === 'engine' && isStackedOn(p, placementTop),
    )
    const heatAbove = column.find(
      (p) => p.typeId === 'heat-shield' && isStackedOn(p, placementTop),
    )

    if (engineAbove) {
      const targetTop = resolveSpanTopFromEngine(engineAbove, others)
      if (targetTop === null) continue
      spanTop = targetTop
      toEnvelop.push(engineAbove)
    } else if (heatAbove) {
      const pod = findConnectorPartner(heatAbove, 'top', others)
      if (pod?.typeId !== 'command-pod') continue
      spanTop = getPartBottomY(pod)
      toEnvelop.push(heatAbove)
    } else {
      const anchorAbove = column.find(
        (p) => ANCHOR_TYPES.has(p.typeId) && isStackedOn(p, placementTop),
      )
      if (!anchorAbove) continue
      spanTop = getPartBottomY(anchorAbove)
    }

    const span = spanBottom - spanTop
    if (span < RING_GEOMETRY.height - 0.5) continue

    const needsExtension = spanTop < placementTop - CONNECTOR_ALIGN_TOL
    if (!needsExtension && toEnvelop.length === 0) continue

    const ref =
      toEnvelop[0] ??
      column.find((p) => ANCHOR_TYPES.has(p.typeId) && isStackedOn(p, placementTop)) ??
      ring

    ring.x = partCenterX(ref) - ringDef.width / 2
    ring.y = spanTop
    ring.ringSpan = span
    ring.ringBottomLy = placedBottom - spanTop

    for (const p of toEnvelop) {
      const top = getPartTopY(p)
      const bottom = getPartBottomY(p)
      if (top >= spanTop - CONNECTOR_ALIGN_TOL && bottom <= spanBottom + CONNECTOR_ALIGN_TOL) {
        p.envelopedBy = ring.id
      }
    }
  }
}
