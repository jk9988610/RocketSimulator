import {
  COMMAND_POD_INSET_RATIO,
  getCommandPodTopWidth,
  getPartDefinition,
} from './definitions'
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

function commandPodConnectors(): ConnectorDef[] {
  const { width, height } = getPartDefinition('command-pod')
  const topY = height * 0.16
  return [
    { kind: 'top', lx: width / 2, ly: topY },
    { kind: 'bottom', lx: width / 2, ly: height },
  ]
}

function parachuteConnectors(): ConnectorDef[] {
  const w = Math.round(getCommandPodTopWidth())
  const h = Math.round(w / 2)
  return [{ kind: 'bottom', lx: w / 2, ly: h }]
}

function ringConnectorConnectors(part: PartInstance): ConnectorDef[] {
  const { width, height } = getPartDefinition('ring-connector')
  const span = part.ringSpan ?? height
  if (part.ringSpan) {
    return [
      { kind: 'top', lx: width / 2, ly: 0 },
      { kind: 'bottom', lx: width / 2, ly: span },
    ]
  }
  const barH = Math.max(10, height * 0.55)
  const barY = (height - barH) / 2
  return [
    { kind: 'top', lx: width / 2, ly: barY },
    { kind: 'bottom', lx: width / 2, ly: barY + barH },
  ]
}

function radialConnectorConnectors(): ConnectorDef[] {
  const { width, height } = getPartDefinition('radial-connector')
  return [
    { kind: 'left', lx: 0, ly: height / 2 },
    { kind: 'right', lx: width, ly: height / 2 },
  ]
}

function engineConnectors(): ConnectorDef[] {
  const { width, height } = getPartDefinition('engine')
  return [
    { kind: 'top', lx: width / 2, ly: 0 },
    { kind: 'bottom', lx: width / 2, ly: height },
  ]
}

function noseConeConnectors(): ConnectorDef[] {
  const { width, height } = getPartDefinition('nose-cone')
  return [{ kind: 'bottom', lx: width / 2, ly: height }]
}

function heatShieldConnectors(): ConnectorDef[] {
  const { width, height } = getPartDefinition('heat-shield')
  return [
    { kind: 'top', lx: width / 2, ly: 0 },
    { kind: 'bottom', lx: width / 2, ly: height },
  ]
}

type ConnectorBuilder = (part: PartInstance) => ConnectorDef[]

const CONNECTOR_BUILDERS: Record<PartTypeId, ConnectorBuilder> = {
  'command-pod': () => commandPodConnectors(),
  parachute: () => parachuteConnectors(),
  'heat-shield': () => heatShieldConnectors(),
  'ring-connector': (part) => ringConnectorConnectors(part),
  'fuel-tank': () => {
    const { width, height } = getPartDefinition('fuel-tank')
    return [
      { kind: 'top', lx: width / 2, ly: 0 },
      { kind: 'bottom', lx: width / 2, ly: height },
    ]
  },
  'radial-connector': () => radialConnectorConnectors(),
  'nose-cone': () => noseConeConnectors(),
  engine: () => engineConnectors(),
}

const OPPOSITE: Record<ConnectorKind, ConnectorKind> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

export function getConnectorsForPart(part: PartInstance): WorldConnector[] {
  const defs = CONNECTOR_BUILDERS[part.typeId]?.(part) ?? []
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
  threshold = 36,
): { dx: number; dy: number } | null {
  if (moving.envelopedBy) return null

  const movingConnectors = getConnectorsForPart(moving)
  let best: { dx: number; dy: number; dist: number } | null = null

  for (const mc of movingConnectors) {
    for (const other of others) {
      if (other.id === moving.id || other.mirrorOf === moving.id) continue
      if (other.envelopedBy) continue
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

export const COMMAND_POD_TOP_Y_RATIO = 0.16
export { COMMAND_POD_INSET_RATIO }
