import { COMMAND_POD_INSET_RATIO, getPartDefinition } from './definitions'
import { getConnectorsForPart, type ConnectorKind } from './connection-points'
import type { PartInstance } from './types'

/** 堆叠对齐容差：与磁吸后残余误差一致 */
export const CONNECTOR_ALIGN_TOL = 3

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

/** 指令仓 */
export const COMMAND_POD_GEOMETRY = {
  topYRatio: 0.16,
  bottomYRatio: 1,
} as const

/** 引擎：简洁梯形（顶窄底宽，64×56） */
export const ENGINE_GEOMETRY = {
  width: 64,
  height: 56,
  topInset: 14,
} as const

/** 圆环连接器 */
export const RING_GEOMETRY = {
  width: 64,
  height: 24,
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

/** 部件底端连接点 Y（数学定义） */
export function getPartBottomY(part: PartInstance): number {
  const y = getConnectorWorldY(part, 'bottom')
  if (y !== null) return y
  const def = getPartDefinition(part.typeId)
  return part.y + (part.ringSpan ?? def.height)
}

/** 部件顶端连接点 Y（数学定义） */
export function getPartTopY(part: PartInstance): number {
  const y = getConnectorWorldY(part, 'top')
  if (y !== null) return y
  return part.y
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

/** 上方部件底端与下方部件顶端是否贴合 */
export function isStackedOn(
  upper: PartInstance,
  lowerTopY: number,
): boolean {
  return Math.abs(getPartBottomY(upper) - lowerTopY) <= CONNECTOR_ALIGN_TOL
}

export function getCommandPodBottomY(partY: number, partHeight: number): number {
  return partY + partHeight * COMMAND_POD_GEOMETRY.bottomYRatio
}

/** 梯形引擎轮廓 */
export function traceEngineShape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const inset = (w / ENGINE_GEOMETRY.width) * ENGINE_GEOMETRY.topInset
  ctx.beginPath()
  ctx.moveTo(x + inset, y)
  ctx.lineTo(x + w - inset, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
}

export { COMMAND_POD_INSET_RATIO }
