import { getPartDefinition } from './definitions'
import { getConnectorsForPart } from './connection-points'
import type { PartInstance, PartTypeId } from './types'

export interface DrawPartOptions {
  selected?: boolean
  showConnectors?: boolean
  highlightConnectors?: boolean
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
  const { selected = false, showConnectors = false, highlightConnectors = false } = options

  ctx.save()

  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 3

  switch (typeId) {
    case 'command-pod':
      drawCommandPod(ctx, x, y, w, h, color, accent)
      break
    case 'parachute':
      drawParachute(ctx, x, y, w, h, color, accent)
      break
    case 'heat-shield':
      drawHeatShield(ctx, x, y, w, h, color, accent)
      break
    case 'ring-connector':
      drawRingConnector(ctx, x, y, w, h, color, accent)
      break
    case 'fuel-tank':
      drawFuelTank(ctx, x, y, w, h, color, accent)
      break
    case 'radial-connector':
      drawRadialConnector(ctx, x, y, w, h, color, accent)
      break
    case 'nose-cone':
      drawNoseCone(ctx, x, y, w, h, color, accent)
      break
    case 'engine':
      drawEngine(ctx, x, y, w, h, color, accent)
      break
  }

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = 1.5
  strokePartOutline(ctx, typeId, x, y, w, h)

  if (selected) {
    ctx.strokeStyle = '#3b9eff'
    ctx.lineWidth = 2.5
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6)
  }

  if (showConnectors) {
    const fakePart: PartInstance = { id: '_', typeId, x, y }
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

  ctx.restore()
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
  drawPartAt(ctx, typeId, 0, 0, {})
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
      roundRect(ctx, x, y, w, h, 8)
      ctx.stroke()
      break
    case 'parachute':
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h, w / 2, Math.PI, 0)
      ctx.stroke()
      break
    case 'heat-shield':
      ctx.beginPath()
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
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
): void {
  const r = 8
  const grad = ctx.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, lighten(color, 12))
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  roundRect(ctx, x, y, w, h, r)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h * 0.38, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillRect(x + w / 2 - 3, y + h * 0.32, 6, 8)
}

function drawParachute(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
): void {
  const grad = ctx.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, w / 2)
  grad.addColorStop(0, lighten(color, 20))
  grad.addColorStop(1, color)
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h, w / 2, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + h)
  ctx.lineTo(x + w / 2, y + h + 10)
  ctx.stroke()
}

function drawHeatShield(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.stroke()
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'
    ctx.beginPath()
    ctx.moveTo(x + 8 + i * 10, y + 2)
    ctx.lineTo(x + 12 + i * 10, y + h - 2)
    ctx.stroke()
  }
}

function drawRingConnector(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(x + 2, y + h * 0.28, w - 4, h * 0.44)
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x + w / 2, y + 4, w / 2 - 4, Math.PI, 0)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h - 4, w / 2 - 4, 0, Math.PI)
  ctx.stroke()
}

function drawFuelTank(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
): void {
  const grad = ctx.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, darken(color, 8))
  grad.addColorStop(0.5, lighten(color, 8))
  grad.addColorStop(1, darken(color, 8))
  ctx.fillStyle = grad
  roundRect(ctx, x + 4, y, w - 8, h, 8)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  roundRect(ctx, x + 4, y, w - 8, h, 8)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  ctx.fillRect(x + w * 0.32, y + 10, w * 0.12, h - 20)
}

function drawRadialConnector(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
): void {
  const barW = 14
  const midY = y + h / 2
  ctx.fillStyle = color
  ctx.fillRect(x + w / 2 - barW / 2, y, barW, h)
  ctx.fillRect(x, midY - barW / 2, w, barW)
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.strokeRect(x + w / 2 - barW / 2, y, barW, h)
  ctx.strokeRect(x, midY - barW / 2, w, barW)
}

function drawNoseCone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
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
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawEngine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  accent: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(x + 4, y, w - 8, h * 0.68)
  ctx.beginPath()
  ctx.moveTo(x + 8, y + h * 0.68)
  ctx.lineTo(x + w / 2, y + h)
  ctx.lineTo(x + w - 8, y + h * 0.68)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.strokeRect(x + 4, y, w - 8, h * 0.68)
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.moveTo(x + w / 2 - 7, y + h)
  ctx.lineTo(x + w / 2, y + h + 12)
  ctx.lineTo(x + w / 2 + 7, y + h)
  ctx.closePath()
  ctx.fill()
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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
