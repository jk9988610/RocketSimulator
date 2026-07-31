import { COMMAND_POD_INSET_RATIO, getPartDefinition } from './definitions'
import { getConnectorsForPart } from './connection-points'
import {
  COMMAND_POD_GEOMETRY,
  traceEngineShape,
} from './part-geometry'
import type { PartInstance, PartTypeId } from './types'

export interface DrawPartOptions {
  selected?: boolean
  showConnectors?: boolean
  highlightConnectors?: boolean
  ringSpan?: number
  /** 仅绘制实物：无描边、无选中框、无连接点 */
  physical?: boolean
}

export function drawPart(
  ctx: CanvasRenderingContext2D,
  part: PartInstance,
  selected = false,
  options: DrawPartOptions = {},
): void {
  drawPartAt(ctx, part.typeId, part.x, part.y, {
    selected,
    ...options,
    ringSpan: part.ringSpan,
  })
}

export function drawPartAt(
  ctx: CanvasRenderingContext2D,
  typeId: PartTypeId,
  x: number,
  y: number,
  options: DrawPartOptions = {},
): void {
  const def = getPartDefinition(typeId)
  const { width: w, height: h, color, accent } = def
  const drawH = options.ringSpan ?? h
  const {
    selected = false,
    showConnectors = false,
    highlightConnectors = false,
    physical = false,
  } = options

  ctx.save()

  if (!physical) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 3
  }

  switch (typeId) {
    case 'command-pod':
      drawCommandPod(ctx, x, y, w, h, color, accent, physical)
      break
    case 'parachute':
      drawParachute(ctx, x, y, w, h, color, accent, physical)
      break
    case 'heat-shield':
      drawHeatShield(ctx, x, y, w, h, color, accent, physical)
      break
    case 'ring-connector':
      drawRingConnector(ctx, x, y, w, drawH, color, accent, !!options.ringSpan, physical)
      break
    case 'fuel-tank':
      drawFuelTank(ctx, x, y, w, h, color, accent, physical)
      break
    case 'radial-connector':
      drawRadialConnector(ctx, x, y, w, h, color, accent, physical)
      break
    case 'nose-cone':
      drawNoseCone(ctx, x, y, w, h, color, accent, physical)
      break
    case 'engine':
      drawEngine(ctx, x, y, w, h, color, accent, physical)
      break
  }

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  if (!physical) {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.lineWidth = 1.5
    strokePartOutline(ctx, typeId, x, y, w, drawH)

    if (selected) {
      ctx.strokeStyle = '#3b9eff'
      ctx.lineWidth = 2
      ctx.strokeRect(x - 2, y - 2, w + 4, drawH + 4)
    }

    if (showConnectors) {
      const fakePart: PartInstance = {
        id: '_',
        typeId,
        x,
        y,
        ringSpan: options.ringSpan,
      }
      for (const c of getConnectorsForPart(fakePart)) {
        ctx.beginPath()
        ctx.arc(c.x, c.y, highlightConnectors ? 5 : 4, 0, Math.PI * 2)
        ctx.fillStyle = highlightConnectors
          ? 'rgba(80, 220, 120, 0.9)'
          : 'rgba(59, 158, 255, 0.75)'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }

  ctx.restore()
}

export function renderPartPreviewCanvas1to1(typeId: PartTypeId): HTMLCanvasElement {
  const def = getPartDefinition(typeId)
  const canvas = document.createElement('canvas')
  canvas.width = def.width
  canvas.height = def.height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, def.width, def.height)
  drawPartAt(ctx, typeId, 0, 0, { physical: true })
  return canvas
}

export function renderPartPreviewCanvas(
  typeId: PartTypeId,
  size: number,
): HTMLCanvasElement {
  const def = getPartDefinition(typeId)
  const canvas = document.createElement('canvas')
  const scale = Math.min(size / def.width, size / def.height) * 0.82
  const w = def.width * scale
  const h = def.height * scale
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  const ox = (size - w) / 2
  const oy = (size - h) / 2
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(scale, scale)
  drawPartAt(ctx, typeId, 0, 0, { physical: true })
  ctx.restore()
  return canvas
}

function strokePartOutline(
  ctx: CanvasRenderingContext2D,
  typeId: PartTypeId,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  switch (typeId) {
    case 'command-pod':
      drawCommandPodOutline(ctx, x, y, w, h)
      ctx.stroke()
      break
    case 'parachute':
      drawParachuteOutline(ctx, x, y, w, h)
      ctx.stroke()
      break
    case 'heat-shield':
      drawHeatShieldOutline(ctx, x, y, w, h)
      ctx.stroke()
      break
    case 'nose-cone':
      ctx.beginPath()
      ctx.moveTo(x + w / 2, y)
      ctx.lineTo(x + w, y + h)
      ctx.lineTo(x, y + h)
      ctx.closePath()
      ctx.stroke()
      break
    case 'engine':
      traceEngineShape(ctx, x, y, w, h)
      ctx.stroke()
      break
    default:
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
  }
}

function drawCommandPod(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
  physical: boolean,
): void {
  const inset = w * COMMAND_POD_INSET_RATIO
  const topY = y + h * COMMAND_POD_GEOMETRY.topYRatio

  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, lighten(color, 14))
  grad.addColorStop(1, color)
  ctx.fillStyle = grad

  ctx.beginPath()
  ctx.moveTo(x + inset, topY)
  ctx.lineTo(x + w - inset, topY)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()

  if (!physical) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.stroke()
  }

  ctx.fillStyle = physical ? '#5a8ab0' : accent
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h * 0.52, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.arc(x + w / 2 - 2, y + h * 0.5 - 2, 3, 0, Math.PI * 2)
  ctx.fill()
}

function drawCommandPodOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const inset = w * COMMAND_POD_INSET_RATIO
  const topY = y + h * COMMAND_POD_GEOMETRY.topYRatio
  ctx.beginPath()
  ctx.moveTo(x + inset, topY)
  ctx.lineTo(x + w - inset, topY)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
}

function drawParachute(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  _accent: string,
  physical: boolean,
): void {
  const cx = x + w / 2
  const baseY = y + h
  const outerR = w / 2
  const innerR = outerR * 0.62

  ctx.fillStyle = physical ? 'rgba(200, 205, 215, 0.7)' : 'rgba(210, 215, 225, 0.55)'
  ctx.beginPath()
  ctx.arc(cx, baseY, outerR, Math.PI, 0)
  ctx.closePath()
  ctx.fill()

  if (!physical) {
    ctx.strokeStyle = 'rgba(160, 168, 180, 0.9)'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  const grad = ctx.createRadialGradient(cx, baseY, 0, cx, baseY, innerR)
  grad.addColorStop(0, lighten(color, physical ? 8 : 24))
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, baseY, innerR, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
}

function drawParachuteOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const cx = x + w / 2
  const baseY = y + h
  ctx.beginPath()
  ctx.arc(cx, baseY, w / 2, Math.PI, 0)
  ctx.closePath()
  ctx.moveTo(cx - w / 2, baseY)
  ctx.lineTo(cx + w / 2, baseY)
}

function drawHeatShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
  physical: boolean,
): void {
  ctx.fillStyle = color
  heatShieldPath(ctx, x, y, w, h)
  ctx.fill()

  if (!physical) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.5
    heatShieldPath(ctx, x, y, w, h)
    ctx.stroke()
  }
}

function heatShieldPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const inset = w * COMMAND_POD_INSET_RATIO
  const cx = x + w / 2
  const flatY = y + h
  ctx.beginPath()
  ctx.moveTo(x + inset, flatY)
  ctx.lineTo(x + w - inset, flatY)
  ctx.lineTo(x + w - inset * 0.3, y + h * 0.15)
  ctx.lineTo(cx, y)
  ctx.lineTo(x + inset * 0.3, y + h * 0.15)
  ctx.closePath()
}

function drawHeatShieldOutline(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  heatShieldPath(ctx, x, y, w, h)
}

function drawRingConnector(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
  extended = false,
  physical = false,
): void {
  if (extended) {
    const bandH = Math.min(14, h * 0.12)
    const topBandY = y + bandH * 0.35
    const botBandY = y + h - bandH * 1.35

    ctx.fillStyle = 'rgba(70, 72, 82, 0.55)'
    ctx.fillRect(x, y + bandH, w, h - bandH * 2)

    ctx.fillStyle = color
    ctx.fillRect(x, topBandY, w, bandH)
    ctx.fillRect(x, botBandY, w, bandH)

    if (!physical) {
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.strokeRect(x, topBandY, w, bandH)
      ctx.strokeRect(x, botBandY, w, bandH)
    }
    return
  }

  const barH = Math.max(10, h * 0.55)
  const barY = y + (h - barH) / 2
  ctx.fillStyle = color
  ctx.fillRect(x, barY, w, barH)
  if (!physical) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.strokeRect(x, barY, w, barH)
  }
}

function drawFuelTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  _accent: string,
  physical: boolean,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, darken(color, physical ? 6 : 8))
  grad.addColorStop(0.5, lighten(color, physical ? 4 : 8))
  grad.addColorStop(1, darken(color, physical ? 6 : 8))
  ctx.fillStyle = grad
  ctx.fillRect(x, y, w, h)

  ctx.fillStyle = physical ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)'
  ctx.fillRect(x + w * 0.3, y + 10, w * 0.1, h - 20)
  if (!physical) {
    ctx.fillRect(x + w * 0.55, y + 14, w * 0.08, h - 28)
  }
}

function drawRadialConnector(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
  physical: boolean,
): void {
  const barW = Math.max(10, w * 0.42)
  const barH = Math.max(12, h * 0.55)
  const barX = x + (w - barW) / 2
  const barY = y + (h - barH) / 2
  const armW = Math.max(8, w * 0.22)

  ctx.fillStyle = color
  ctx.fillRect(barX, barY, barW, barH)
  ctx.fillRect(x, barY + (barH - armW) / 2, armW, armW)
  ctx.fillRect(x + w - armW, barY + (barH - armW) / 2, armW, armW)

  if (!physical) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.strokeRect(barX, barY, barW, barH)
    ctx.strokeRect(x, barY + (barH - armW) / 2, armW, armW)
    ctx.strokeRect(x + w - armW, barY + (barH - armW) / 2, armW, armW)
  }
}

function drawNoseCone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
  physical: boolean,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, lighten(color, 15))
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
  if (!physical) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawEngine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
  physical: boolean,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, lighten(color, 10))
  grad.addColorStop(1, darken(color, 6))
  ctx.fillStyle = grad
  traceEngineShape(ctx, x, y, w, h)
  ctx.fill()

  if (!physical) {
    ctx.strokeStyle = accent
    ctx.lineWidth = 2
    traceEngineShape(ctx, x, y, w, h)
    ctx.stroke()
  }
}

function lighten(hex: string, amount: number): string {
  return adjustHex(hex, amount)
}

function darken(hex: string, amount: number): string {
  return adjustHex(hex, -amount)
}

function adjustHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, ((n >> 16) & 0xff) + amount))
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount))
  return `rgb(${r},${g},${b})`
}

/** 指令仓顶部连接点（用于降落伞缆绳） */
export function getCommandPodTopAnchors(
  podX: number,
  podY: number,
  podW = 64,
  podH = 64,
): { leftX: number; rightX: number; topY: number; centerX: number } {
  const inset = podW * COMMAND_POD_INSET_RATIO
  const topY = podY + podH * COMMAND_POD_GEOMETRY.topYRatio
  return {
    leftX: podX + inset,
    rightX: podX + podW - inset,
    topY,
    centerX: podX + podW / 2,
  }
}
