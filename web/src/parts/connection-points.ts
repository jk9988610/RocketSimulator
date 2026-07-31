import type { PartInstance, PartTypeId } from './types'

export type ConnectorKind = 'top' | 'bottom' | 'left' | 'right'

export interface ConnectorDef {
  kind: ConnectorKind
  lx: number
  ly: number
}

export interface WorldConnector {
  partId: string
  kind: ConnectorKind
  x: number
  y: number
}

const CONNECTORS: Record<PartTypeId, ConnectorDef[]> = {
  'command-pod': [{ kind: 'bottom', lx: 32, ly: 64 }],
  parachute: [{ kind: 'bottom', lx: 32, ly: 40 }],
  'heat-shield': [
    { kind: 'top', lx: 32, ly: 0 },
    { kind: 'bottom', lx: 32, ly: 16 },
  ],
  'ring-connector': [
    { kind: 'top', lx: 32, ly: 0 },
    { kind: 'bottom', lx: 32, ly: 24 },
  ],
  'fuel-tank': [
    { kind: 'top', lx: 32, ly: 0 },
    { kind: 'bottom', lx: 32, ly: 96 },
  ],
  'radial-connector': [
    { kind: 'top', lx: 48, ly: 0 },
    { kind: 'bottom', lx: 48, ly: 48 },
    { kind: 'left', lx: 0, ly: 24 },
    { kind: 'right', lx: 96, ly: 24 },
  ],
  'nose-cone': [{ kind: 'bottom', lx: 24, ly: 48 }],
  engine: [{ kind: 'top', lx: 32, ly: 0 }],
}

const OPPOSITE: Record<ConnectorKind, ConnectorKind> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

export function getConnectorsForPart(part: PartInstance): WorldConnector[] {
  const defs = CONNECTORS[part.typeId] ?? []
  return defs.map((c) => ({
    partId: part.id,
    kind: c.kind,
    x: part.x + c.lx,
    y: part.y + c.ly,
  }))
}

export function findSnapPair(
  moving: PartInstance,
  others: readonly PartInstance[],
  threshold = 28,
): { dx: number; dy: number } | null {
  const movingConnectors = getConnectorsForPart(moving)
  let best: { dx: number; dy: number; dist: number } | null = null

  for (const mc of movingConnectors) {
    for (const other of others) {
      if (other.id === moving.id || other.mirrorOf === moving.id) continue
      const otherConnectors = getConnectorsForPart(other)
      for (const oc of otherConnectors) {
        if (OPPOSITE[mc.kind] !== oc.kind) continue
        const dx = oc.x - mc.x
        const dy = oc.y - mc.y
        const dist = Math.hypot(dx, dy)
        if (dist < threshold && (!best || dist < best.dist)) {
          best = { dx, dy, dist }
        }
      }
    }
  }

  return best ? { dx: best.dx, dy: best.dy } : null
}
