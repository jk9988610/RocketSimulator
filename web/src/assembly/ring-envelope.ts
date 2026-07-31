import { getPartDefinition } from '../parts/definitions'
import {
  CONNECTOR_ALIGN_TOL,
  findConnectorPartner,
  getConnectorWorldY,
  getPartBounds,
  RING_GEOMETRY,
} from '../parts/part-geometry'
import type { PartInstance } from '../parts/types'

const ANCHOR_TYPES = new Set(['command-pod', 'fuel-tank'])
const ENVELOP_TYPES = new Set(['heat-shield', 'engine'])

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

function findAnchorAbove(
  column: readonly PartInstance[],
  ringTop: number,
): PartInstance | null {
  let best: PartInstance | null = null
  let bestBottom = -Infinity

  for (const part of column) {
    if (!ANCHOR_TYPES.has(part.typeId)) continue
    const bottom = getConnectorWorldY(part, 'bottom')
    if (bottom === null || bottom > ringTop + CONNECTOR_ALIGN_TOL) continue
    if (bottom > bestBottom) {
      bestBottom = bottom
      best = part
    }
  }

  return best
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

    const connectedAbove = findConnectorPartner(ring, 'top', others)
    const connectedBelow = findConnectorPartner(ring, 'bottom', others)

    let spanTop = placedTop
    let spanBottom = placedBottom

    if (connectedAbove) {
      const aboveBottom = getConnectorWorldY(connectedAbove, 'bottom')
      if (aboveBottom !== null) spanTop = aboveBottom

      if (connectedAbove.typeId === 'heat-shield') {
        const anchor = findAnchorAbove(column, spanTop)
        if (anchor) {
          const anchorBottom = getConnectorWorldY(anchor, 'bottom')
          if (anchorBottom !== null) spanTop = anchorBottom
        }
      }
    } else {
      const heat = column.find(
        (p) =>
          p.typeId === 'heat-shield' &&
          getConnectorWorldY(p, 'bottom') !== null &&
          Math.abs(getConnectorWorldY(p, 'bottom')! - placedTop) <= CONNECTOR_ALIGN_TOL,
      )
      if (heat) {
        spanTop = heat.y
        const anchor = findAnchorAbove(column, spanTop)
        if (anchor) {
          const anchorBottom = getConnectorWorldY(anchor, 'bottom')
          if (anchorBottom !== null) spanTop = anchorBottom
        }
      } else {
        const anchor = column.find(
          (p) =>
            ANCHOR_TYPES.has(p.typeId) &&
            getConnectorWorldY(p, 'bottom') !== null &&
            Math.abs(getConnectorWorldY(p, 'bottom')! - placedTop) <= CONNECTOR_ALIGN_TOL,
        )
        if (!anchor) continue
        spanTop = getConnectorWorldY(anchor, 'bottom')!
      }
    }

    if (connectedBelow?.typeId === 'engine') {
      const engineBottom = getConnectorWorldY(connectedBelow, 'bottom')
      const engineTop = getConnectorWorldY(connectedBelow, 'top')
      if (engineBottom !== null) spanBottom = engineBottom
      if (engineTop !== null) {
        ring.ringBottomLy = engineTop - spanTop
      }
    }

    const span = spanBottom - spanTop
    if (span < RING_GEOMETRY.height - 0.5) continue

    const ref = connectedAbove ?? connectedBelow ?? findAnchorAbove(column, spanTop) ?? ring
    ring.x = partCenterX(ref) - ringDef.width / 2
    ring.y = spanTop
    ring.ringSpan = span

    for (const p of column) {
      if (p.id === ring.id || !ENVELOP_TYPES.has(p.typeId)) continue
      const bounds = getPartBounds(p)
      if (bounds.top < spanTop - 0.5 || bounds.bottom > spanBottom + 0.5) continue

      if (p.typeId === 'engine' && connectedBelow?.id === p.id) {
        p.envelopedBy = ring.id
      } else if (p.typeId === 'heat-shield') {
        p.envelopedBy = ring.id
      }
    }
  }
}
