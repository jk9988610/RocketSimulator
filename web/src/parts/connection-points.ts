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

function ringConnectorConnectors(): ConnectorDef[] {
  const { width, height } = getPartDefinition('ring-connector')
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
    { kind: 'top', lx: width / 2, ly: 2 },
    { kind: 'bottom', lx: width / 2, ly: height - 2 },
  ]
}

function engineConnectors(): ConnectorDef[] {
  const { width } = getPartDefinition('engine')
  return [{ kind: 'top', lx: width / 2, ly: 0 }]
}

function noseConeConnectors(): ConnectorDef[] {
  const { width, height } = getPartDefinition('nose-cone')
  return [{ kind: 'bottom', lx: width / 2, ly: height }]
}

const CONNECTOR_BUILDERS: Record<PartTypeId, () => ConnectorDef[]> = {
  'command-pod': commandPodConnectors,
  parachute: parachuteConnectors,
  'heat-shield': () => {
    const { width, height } = getPartDefinition('heat-shield')
    return [
      { kind: 'top', lx: width / 2, ly: 0 },
      { kind: 'bottom', lx: width / 2, ly: height },
    ]
  },
  'ring-connector': ringConnectorConnectors,
  'fuel-tank': () => {
    const { width, height } = getPartDefinition('fuel-tank')
    return [
      { kind: 'top', lx: width / 2, ly: 0 },
      { kind: 'bottom', lx: width / 2, ly: height },
    ]
  },
  'radial-connector': radialConnectorConnectors,
  'nose-cone': noseConeConnectors,
  engine: engineConnectors,
}

const OPPOSITE: Record<ConnectorKind, ConnectorKind> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

export function getConnectorsForPart(part: PartInstance): WorldConnector[] {
  const defs = CONNECTOR_BUILDERS[part.typeId]?.() ?? []
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

/** 与 render.ts 中指令仓顶边几何一致，供测试/文档引用 */
export const COMMAND_POD_TOP_Y_RATIO = 0.16
export { COMMAND_POD_INSET_RATIO }
