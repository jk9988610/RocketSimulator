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
  const ringDef = getPartDefinition('ring-connector')
  for (const part of parts) {
    delete part.envelopedBy
    if (part.typeId === 'ring-connector') {
      if (part.ringSpan !== undefined) {
        if (part.ringPlacementTop === undefined && part.ringBottomLy !== undefined) {
          part.ringPlacementTop = part.y + part.ringBottomLy - ringDef.height
        }
        if (part.ringPlacementTop !== undefined) {
          part.y = part.ringPlacementTop
        }
      }
      delete part.ringSpan
      delete part.ringBottomLy
    }
  }
}

function resolveCompactTop(
  ring: PartInstance,
  column: readonly PartInstance[],
): number {
  const anchor = ring.ringPlacementTop ?? ring.y

  const heat = column.find((p) => p.typeId === 'heat-shield')
  if (heat) {
    const heatBottom = getPartBottomY(heat)
    if (isStackedOn(heat, anchor)) {
      return heatBottom
    }
    const heatTop = getPartTopY(heat)
    if (
      ring.ringPlacementTop !== undefined &&
      Math.abs(ring.ringPlacementTop - heatTop) <= CONNECTOR_ALIGN_TOL
    ) {
      return heatBottom
    }
  }

  const engine = column.find((p) => p.typeId === 'engine')
  if (engine) {
    const engineBottom = getPartBottomY(engine)
    if (isStackedOn(engine, anchor)) {
      return engineBottom
    }
    const engineTop = getPartTopY(engine)
    if (
      ring.ringPlacementTop !== undefined &&
      Math.abs(ring.ringPlacementTop - engineTop) <= CONNECTOR_ALIGN_TOL
    ) {
      return engineBottom
    }
  }

  if (ring.ringPlacementTop !== undefined) {
    return ring.ringPlacementTop
  }

  const above = column.find(
    (p) =>
      p.id !== ring.id &&
      p.typeId !== 'fuel-tank' &&
      p.typeId !== 'command-pod' &&
      isStackedOn(p, ring.y),
  )
  if (above) {
    return getPartBottomY(above)
  }

  return ring.y
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

/** 拖动环时收起延伸、释放被包裹部件（仅首次从延伸态收起） */
export function collapseRingConnector(ring: PartInstance, parts: PartInstance[]): void {
  if (ring.typeId !== 'ring-connector') return
  if (ring.ringSpan === undefined) return

  for (const p of parts) {
    if (p.envelopedBy === ring.id) delete p.envelopedBy
  }

  if (ring.ringPlacementTop !== undefined) {
    ring.y = ring.ringPlacementTop
  }

  delete ring.ringSpan
  delete ring.ringBottomLy
}

/** 环移动并吸附后记录紧凑形态顶端 */
export function syncRingPlacementTop(ring: PartInstance): void {
  if (ring.typeId === 'ring-connector') {
    ring.ringPlacementTop = ring.y
  }
}

export function updateRingEnvelopes(parts: PartInstance[]): void {
  clearEnvelopeState(parts)

  const ringDef = getPartDefinition('ring-connector')
  const rings = parts.filter((p) => p.typeId === 'ring-connector' && !p.mirrorOf)

  for (const ring of rings) {
    const column = getColumnParts(parts, ring)
    const others = parts.filter((p) => p.id !== ring.id && !p.mirrorOf)

    const compactTop = resolveCompactTop(ring, column)
    ring.ringPlacementTop = compactTop
    const anchorTop = compactTop
    const placedBottom = anchorTop + ringDef.height

    let spanTop = anchorTop
    const spanBottom = placedBottom
    const toEnvelop: PartInstance[] = []

    const engineAbove = column.find(
      (p) => p.typeId === 'engine' && isStackedOn(p, anchorTop),
    )
    const heatAbove = column.find(
      (p) => p.typeId === 'heat-shield' && isStackedOn(p, anchorTop),
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
        (p) => ANCHOR_TYPES.has(p.typeId) && isStackedOn(p, anchorTop),
      )
      if (!anchorAbove) continue
      spanTop = getPartBottomY(anchorAbove)
    }

    const span = spanBottom - spanTop
    if (span < RING_GEOMETRY.height - 0.5) continue

    const needsExtension = spanTop < anchorTop - CONNECTOR_ALIGN_TOL
    if (!needsExtension && toEnvelop.length === 0) continue

    const ref =
      toEnvelop[0] ??
      column.find((p) => ANCHOR_TYPES.has(p.typeId) && isStackedOn(p, anchorTop)) ??
      ring

    ring.x = partCenterX(ref) - ringDef.width / 2
    ring.y = spanTop
    ring.ringSpan = span
    ring.ringBottomLy = placedBottom - spanTop
    ring.ringPlacementTop = anchorTop

    for (const p of toEnvelop) {
      const top = getPartTopY(p)
      const bottom = getPartBottomY(p)
      if (top >= spanTop - CONNECTOR_ALIGN_TOL && bottom <= spanBottom + CONNECTOR_ALIGN_TOL) {
        p.envelopedBy = ring.id
      }
    }
  }
}
