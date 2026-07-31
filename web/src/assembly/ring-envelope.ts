import { getPartDefinition } from '../parts/definitions'
import type { PartInstance } from '../parts/types'

const ENVELOPABLE_TYPES = new Set(['heat-shield', 'engine'])
const ANCHOR_TYPES = new Set(['command-pod', 'fuel-tank'])

function partCenterX(part: PartInstance): number {
  const def = getPartDefinition(part.typeId)
  return part.x + def.width / 2
}

function partBottom(part: PartInstance): number {
  const def = getPartDefinition(part.typeId)
  return part.y + def.height
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

    // 环底端固定在放置位置，只向上延伸包裹，底端仅连接下方物件
    const ringBottom = ring.y + ringDef.height

    const envelopable = column.filter(
      (p) =>
        ENVELOPABLE_TYPES.has(p.typeId) &&
        p.y < ringBottom &&
        partBottom(p) <= ringBottom + 2,
    )
    if (envelopable.length === 0) continue

    const envTop = Math.min(...envelopable.map((p) => p.y))
    let spanTop = envTop

    const anchors = column.filter((p) => ANCHOR_TYPES.has(p.typeId))
    for (const anchor of anchors) {
      const bottom = partBottom(anchor)
      if (bottom <= ring.y + 2 || bottom <= envTop + 2) {
        spanTop = Math.min(spanTop, bottom)
      }
    }

    const spanBottom = ringBottom
    const span = spanBottom - spanTop
    if (span < ringDef.height) continue

    const ref =
      anchors.find((a) => partBottom(a) <= envTop + 2) ?? envelopable[0]!
    ring.x = partCenterX(ref) - ringDef.width / 2
    ring.y = spanTop
    ring.ringSpan = span

    for (const p of envelopable) {
      p.envelopedBy = ring.id
    }
  }
}
