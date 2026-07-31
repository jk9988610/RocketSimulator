import { COMMAND_POD_INSET_RATIO, getPartDefinition } from './definitions'
import { getConnectorsForPart, type ConnectorKind } from './connection-points'
import type { PartInstance } from './types'

/** 连接器对齐判定容差（像素） */
export const CONNECTOR_ALIGN_TOL = 2

export interface PartBounds {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
  centerX: number
  centerY: number
}

/** 指令仓几何 */
export const COMMAND_POD_GEOMETRY = {
  topYRatio: 0.16,
  bottomYRatio: 1,
} as const

/** 引擎：封口倒 Y 形（相对 64×56 包围盒） */
export const ENGINE_GEOMETRY = {
  width: 64,
  height: 56,
  topBar: { left: 18, right: 46, bottom: 11 },
  leftOuter: { x: 5, y: 56 },
  rightOuter: { x: 59, y: 56 },
  leftInner: { x: 24, y: 52 },
  rightInner: { x: 40, y: 52 },
  bottomTip: { x: 32, y: 56 },
} as const

/** 圆环连接器默认几何 */
export const RING_GEOMETRY = {
  width: 64,
  height: 24,
  barHeightRatio: 0.55,
} as const

export function getPartBounds(part: PartInstance): PartBounds {
  const def = getPartDefinition(part.typeId)
  const height = part.ringSpan ?? def.height
  const left = part.x
  const top = part.y
  const width = def.width
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2,
  }
}

export function getConnectorWorldY(part: PartInstance, kind: ConnectorKind): number | null {
  const connector = getConnectorsForPart(part).find((c) => c.kind === kind)
  return connector?.y ?? null
}

const OPPOSITE: Record<ConnectorKind, ConnectorKind> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

export function findConnectorPartner(
  part: PartInstance,
  kind: ConnectorKind,
  others: readonly PartInstance[],
): PartInstance | null {
  const source = getConnectorsForPart(part).find((c) => c.kind === kind)
  if (!source) return null

  const opposite = OPPOSITE[kind]
  let best: { part: PartInstance; dist: number } | null = null

  for (const other of others) {
    if (other.id === part.id || other.mirrorOf || other.envelopedBy) continue
    const target = getConnectorsForPart(other).find((c) => c.kind === opposite)
    if (!target) continue
    const dist = Math.hypot(source.x - target.x, source.y - target.y)
    if (dist <= CONNECTOR_ALIGN_TOL && (!best || dist < best.dist)) {
      best = { part: other, dist }
    }
  }

  return best?.part ?? null
}

export function connectorsAligned(
  partA: PartInstance,
  kindA: ConnectorKind,
  partB: PartInstance,
  kindB: ConnectorKind,
): boolean {
  const a = getConnectorsForPart(partA).find((c) => c.kind === kindA)
  const b = getConnectorsForPart(partB).find((c) => c.kind === kindB)
  if (!a || !b || OPPOSITE[kindA] !== kindB) return false
  return Math.hypot(a.x - b.x, a.y - b.y) <= CONNECTOR_ALIGN_TOL
}

export function getCommandPodTopY(partY: number, partHeight: number): number {
  return partY + partHeight * COMMAND_POD_GEOMETRY.topYRatio
}

export function getCommandPodBottomY(partY: number, partHeight: number): number {
  return partY + partHeight * COMMAND_POD_GEOMETRY.bottomYRatio
}

/** 绘制引擎封口倒 Y 轮廓（局部坐标，原点为部件左上角） */
export function traceEngineShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const sx = w / ENGINE_GEOMETRY.width
  const sy = h / ENGINE_GEOMETRY.height
  const g = ENGINE_GEOMETRY
  const tx = (px: number): number => x + px * sx
  const ty = (py: number): number => y + py * sy

  ctx.beginPath()
  ctx.moveTo(tx(g.topBar.left), ty(0))
  ctx.lineTo(tx(g.topBar.right), ty(0))
  ctx.lineTo(tx(g.rightInner.x), ty(g.topBar.bottom))
  ctx.lineTo(tx(g.rightOuter.x), ty(g.rightOuter.y))
  ctx.lineTo(tx(g.rightInner.x), ty(g.rightInner.y))
  ctx.lineTo(tx(g.bottomTip.x), ty(g.bottomTip.y))
  ctx.lineTo(tx(g.leftInner.x), ty(g.leftInner.y))
  ctx.lineTo(tx(g.leftOuter.x), ty(g.leftOuter.y))
  ctx.lineTo(tx(g.leftInner.x), ty(g.topBar.bottom))
  ctx.closePath()
}

export { COMMAND_POD_INSET_RATIO }
