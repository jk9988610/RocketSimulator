import { getConnectorsForPart } from '../parts/connection-points'
import type { ConnectorKind } from '../parts/connection-points'
import type { PartInstance } from '../parts/types'

const SNAP_TOLERANCE = 10

function isActivePart(p: PartInstance): boolean {
  if (p.mirrorOf) return false
  const detached = (p as PartInstance & { detached?: boolean }).detached
  return !detached
}

const OPPOSITE: Record<ConnectorKind, ConnectorKind> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

export function partsAreSnapped(a: PartInstance, b: PartInstance): boolean {
  if (a.id === b.id) return false
  const aConn = getConnectorsForPart(a)
  const bConn = getConnectorsForPart(b)
  for (const ac of aConn) {
    for (const bc of bConn) {
      if (OPPOSITE[ac.kind] !== bc.kind) continue
      if (Math.hypot(ac.x - bc.x, ac.y - bc.y) < SNAP_TOLERANCE) {
        return true
      }
    }
  }
  return false
}

/** 与 seed 部件物理对接的所有部件（连通分量） */
export function collectConnectedAssembly(
  seedIds: Iterable<string>,
  parts: readonly PartInstance[],
): PartInstance[] {
  const active = parts.filter(isActivePart)
  const idSet = new Set(active.map((p) => p.id))
  const seeds = [...seedIds].filter((id) => idSet.has(id))
  if (seeds.length === 0) return []

  const visited = new Set<string>(seeds)
  const queue = [...seeds]

  while (queue.length > 0) {
    const id = queue.shift()!
    const part = active.find((p) => p.id === id)
    if (!part) continue
    for (const other of active) {
      if (visited.has(other.id)) continue
      if (partsAreSnapped(part, other)) {
        visited.add(other.id)
        queue.push(other.id)
      }
    }
  }

  return active.filter((p) => visited.has(p.id))
}

/** 通过连接器某一侧接口对接的邻居 */
export function getNeighborsViaKinds(
  part: PartInstance,
  kinds: ConnectorKind[],
  parts: readonly PartInstance[],
): PartInstance[] {
  const partConn = getConnectorsForPart(part)
  const result: PartInstance[] = []
  for (const other of parts) {
    if (other.id === part.id || !isActivePart(other)) continue
    const otherConn = getConnectorsForPart(other)
    for (const pc of partConn) {
      if (!kinds.includes(pc.kind)) continue
      for (const oc of otherConn) {
        if (OPPOSITE[pc.kind] !== oc.kind) continue
        if (Math.hypot(pc.x - oc.x, pc.y - oc.y) < SNAP_TOLERANCE) {
          result.push(other)
        }
      }
    }
  }
  return result
}
