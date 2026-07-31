import { getPartDefinition } from '../parts/definitions'
import type { PartInstance } from '../parts/types'

const ENVELOPABLE_TYPES = new Set(['heat-shield', 'engine'])
const ANCHOR_TYPES = new Set(['command-pod', 'fuel-tank'])

function partCenterX(part: PartInstance): number {
  const def = getPartDefinition(part.typeId)
  return part.x + def.width / 2
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

  const rings = parts.filter((p) => p.typeId === 'ring-connector' && !p.mirrorOf)

  for (const ring of rings) {
    const column = getColumnParts(parts, ring).sort((a, b) => a.y - b.y)
    const envelopable = column.filter((p) => ENVELOPABLE_TYPES.has(p.typeId))
    if (envelopable.length === 0) continue

    const envTop = Math.min(...envelopable.map((p) => p.y))
    const envBottom = Math.max(
      ...envelopable.map((p) => p.y + getPartDefinition(p.typeId).height),
    )

    let topAnchor: PartInstance | null = null
    let bottomAnchor: PartInstance | null = null

    for (const p of column) {
      if (!ANCHOR_TYPES.has(p.typeId)) continue
      const def = getPartDefinition(p.typeId)
      const bottom = p.y + def.height
      if (bottom <= envTop + 2 && (!topAnchor || bottom > topAnchor.y + getPartDefinition(topAnchor.typeId).height)) {
        topAnchor = p
      }
      if (p.y >= envBottom - 2 && (!bottomAnchor || p.y < bottomAnchor.y)) {
        bottomAnchor = p
      }
    }

    if (!topAnchor || !bottomAnchor) continue

    const topDef = getPartDefinition(topAnchor.typeId)
    const spanTop = topAnchor.y + topDef.height
    const spanBottom = bottomAnchor.y
    const span = spanBottom - spanTop
    if (span < getPartDefinition('ring-connector').height) continue

    const ringDef = getPartDefinition(ring.typeId)
    ring.x = partCenterX(topAnchor) - ringDef.width / 2
    ring.y = spanTop
    ring.ringSpan = span

    for (const p of envelopable) {
      p.envelopedBy = ring.id
    }
  }
}
