import { getPartDefinition } from '../parts/definitions'
import type { PartInstance } from '../parts/types'

const ANCHOR_TYPES = new Set(['command-pod', 'fuel-tank'])
const SNAP_TOL = 4

function partCenterX(part: PartInstance): number {
  const def = getPartDefinition(part.typeId)
  return part.x + def.width / 2
}

function partBottom(part: PartInstance): number {
  const def = getPartDefinition(part.typeId)
  return part.y + def.height
}

function touchesRingTop(part: PartInstance, ringTop: number): boolean {
  const bottom = partBottom(part)
  return bottom >= ringTop - SNAP_TOL && bottom <= ringTop + SNAP_TOL
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
    }
  }
}

export function updateRingEnvelopes(parts: PartInstance[]): void {
  clearEnvelopeState(parts)

  const ringDef = getPartDefinition('ring-connector')
  const rings = parts.filter((p) => p.typeId === 'ring-connector' && !p.mirrorOf)

  for (const ring of rings) {
    const column = getColumnParts(parts, ring).sort((a, b) => a.y - b.y)
    const ringTop = ring.y
    const ringBottom = ring.y + ringDef.height

    const anchors = column.filter((p) => ANCHOR_TYPES.has(p.typeId))
    const anchorsTouching = anchors.filter((a) => touchesRingTop(a, ringTop))
    const heatTouching = column.filter(
      (p) => p.typeId === 'heat-shield' && touchesRingTop(p, ringTop),
    )

    let spanTop = ringTop

    if (heatTouching.length > 0) {
      spanTop = Math.min(spanTop, ...heatTouching.map((p) => p.y))
      for (const anchor of anchors) {
        if (partBottom(anchor) <= spanTop + SNAP_TOL) {
          spanTop = Math.min(spanTop, partBottom(anchor))
        }
      }
    } else if (anchorsTouching.length > 0) {
      spanTop = Math.min(spanTop, ...anchorsTouching.map((a) => partBottom(a)))
    }

    const span = ringBottom - spanTop
    if (span < ringDef.height) continue

    const ref =
      anchorsTouching[0] ?? heatTouching[0] ?? ring
    ring.x = partCenterX(ref) - ringDef.width / 2
    ring.y = spanTop
    ring.ringSpan = span

    for (const p of heatTouching) {
      if (p.y >= spanTop - SNAP_TOL && partBottom(p) <= ringTop + SNAP_TOL) {
        p.envelopedBy = ring.id
      }
    }
  }
}
