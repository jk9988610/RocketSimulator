import { getPartDefinition } from './definitions'
import type { PartInstance } from './types'

export function drawPart(
  ctx: CanvasRenderingContext2D,
  part: PartInstance,
  selected: boolean,
): void {
  const def = getPartDefinition(part.typeId)
  const { x, y } = part
  const { width: w, height: h, color, accent } = def

  ctx.save()

  if (selected) {
    ctx.strokeStyle = '#3b9eff'
    ctx.lineWidth = 2
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
  }

  switch (part.typeId) {
    case 'frustum':
      drawFrustum(ctx, x, y, w, h, color, accent)
      break
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

  ctx.restore()
}

function drawFrustum(
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
  ctx.moveTo(x + w * 0.2, y)
  ctx.lineTo(x + w * 0.8, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.stroke()
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
  ctx.fillStyle = color
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, r)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h * 0.4, 8, 0, Math.PI * 2)
  ctx.fill()
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
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h, w / 2, Math.PI, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + h)
  ctx.lineTo(x + w / 2, y + h + 8)
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
  ctx.lineWidth = 1
  ctx.stroke()
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
  ctx.fillRect(x, y + h * 0.3, w, h * 0.4)
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x + 4, y + 2)
  ctx.lineTo(x + 4, y + h - 2)
  ctx.moveTo(x + w - 4, y + 2)
  ctx.lineTo(x + w - 4, y + h - 2)
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
  ctx.fillStyle = color
  roundRect(ctx, x + 4, y, w - 8, h, 6)
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
  roundRect(ctx, x + 4, y, w - 8, h, 6)
  ctx.stroke()
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  ctx.fillRect(x + w * 0.35, y + 8, w * 0.1, h - 16)
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
  const barW = 12
  const midY = y + h / 2
  ctx.fillStyle = color
  ctx.fillRect(x + w / 2 - barW / 2, y, barW, h)
  ctx.fillRect(x, midY - barW / 2, w, barW)
  ctx.strokeStyle = accent
  ctx.lineWidth = 1.5
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
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x, y + h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = accent
  ctx.lineWidth = 1
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
  ctx.fillRect(x + 4, y, w - 8, h * 0.7)
  ctx.beginPath()
  ctx.moveTo(x + 8, y + h * 0.7)
  ctx.lineTo(x + w / 2, y + h)
  ctx.lineTo(x + w - 8, y + h * 0.7)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.moveTo(x + w / 2 - 6, y + h)
  ctx.lineTo(x + w / 2, y + h + 10)
  ctx.lineTo(x + w / 2 + 6, y + h)
  ctx.closePath()
  ctx.fill()
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
