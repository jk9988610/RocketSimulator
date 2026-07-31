import { EARTH_MAP_RADIUS, type OrbitSample, type OrbitTracker } from './orbit-tracker'
import type { FlightState } from './flight-physics'

type ViewMode = 'live' | 'map'

export function drawMapView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tracker: OrbitTracker,
  flight: FlightState,
  padCenterX: number,
  padSurfaceY: number,
  flightAngle: number,
): void {
  ctx.fillStyle = '#050510'
  ctx.fillRect(0, 0, width, height)

  const cx = width * 0.42
  const cy = height * 0.5
  const scale = Math.min(width, height) / 320

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)

  drawStars(ctx, width, height, scale, cx, cy)

  // 太阳公转轨道（示意）
  ctx.strokeStyle = 'rgba(255, 200, 60, 0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(0, 0, 200, 0, Math.PI * 2)
  ctx.stroke()

  const sunAngle = Date.now() / 8000
  const sunX = Math.cos(sunAngle) * 200
  const sunY = Math.sin(sunAngle) * 200
  ctx.fillStyle = '#ffd54a'
  ctx.beginPath()
  ctx.arc(sunX, sunY, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 213, 74, 0.5)'
  ctx.font = '9px system-ui'
  ctx.fillText('太阳', sunX + 12, sunY + 3)

  // 月球公转轨道
  ctx.strokeStyle = 'rgba(200, 200, 220, 0.2)'
  ctx.beginPath()
  ctx.arc(0, 0, 110, 0, Math.PI * 2)
  ctx.stroke()

  const moonAngle = Date.now() / 5000
  const moonX = Math.cos(moonAngle) * 110
  const moonY = Math.sin(moonAngle) * 110
  ctx.fillStyle = '#c8c8d8'
  ctx.beginPath()
  ctx.arc(moonX, moonY, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(200,200,220,0.7)'
  ctx.font = '8px system-ui'
  ctx.fillText('月球', moonX + 10, moonY + 3)

  // 地球
  ctx.fillStyle = '#1b4332'
  ctx.beginPath()
  ctx.arc(0, 0, EARTH_MAP_RADIUS, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#40916c'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = 'rgba(180,220,200,0.8)'
  ctx.font = '10px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText('地球', 0, EARTH_MAP_RADIUS + 14)

  // 火箭飞行轨道
  const samples = tracker.getSamples()
  if (samples.length > 1) {
    ctx.strokeStyle = 'rgba(59, 158, 255, 0.65)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(samples[0]!.mapX, samples[0]!.mapY)
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(samples[i]!.mapX, samples[i]!.mapY)
    }
    ctx.stroke()
  }

  const apo = tracker.getApoapsis()
  const peri = tracker.getPeriapsis()
  if (apo && apo.altKm > 0.1) {
    drawOrbitMarker(ctx, apo, '远点', '#ff6b6b')
  }
  if (peri && peri.altKm > 0.05) {
    drawOrbitMarker(ctx, peri, '近点', '#50dc78')
  }

  // 火箭（三角形）
  const rocket = tracker.getRocketMapPosition(flight, padCenterX, padSurfaceY)
  const tipAngle = flightAngle - Math.PI / 2
  ctx.fillStyle = '#3b9eff'
  ctx.beginPath()
  ctx.moveTo(
    rocket.mapX + Math.cos(tipAngle) * 10,
    rocket.mapY + Math.sin(tipAngle) * 10,
  )
  ctx.lineTo(
    rocket.mapX + Math.cos(tipAngle + 2.4) * 7,
    rocket.mapY + Math.sin(tipAngle + 2.4) * 7,
  )
  ctx.lineTo(
    rocket.mapX + Math.cos(tipAngle - 2.4) * 7,
    rocket.mapY + Math.sin(tipAngle - 2.4) * 7,
  )
  ctx.closePath()
  ctx.fill()

  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = '11px system-ui'
  ctx.textAlign = 'left'
  ctx.fillText(`高度 ${rocket.altKm.toFixed(1)} km`, 12, height - 12)
}

function drawOrbitMarker(
  ctx: CanvasRenderingContext2D,
  sample: OrbitSample,
  label: string,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(sample.mapX, sample.mapY, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.font = '9px system-ui'
  ctx.textAlign = 'left'
  ctx.fillText(label, sample.mapX + 6, sample.mapY - 4)
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  cx: number,
  cy: number,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137.5) % (width / scale)) - cx / scale
    const sy = ((i * 97.3) % (height / scale)) - cy / scale
    ctx.fillRect(sx, sy, 1, 1)
  }
}

export type { ViewMode }
