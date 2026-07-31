import {
  AU_KM,
  EARTH_RADIUS_KM,
  kmToMapPx,
  MOON_ORBIT_KM,
  MOON_RADIUS_KM,
  SUN_RADIUS_KM,
} from './cosmos-scale'
import type { OrbitTracker } from './orbit-tracker'
import type { FlightState } from './flight-physics'

type ViewMode = 'live' | 'map'

export type MapFocusTarget = 'earth' | 'rocket' | 'free'

export interface MapViewState {
  zoom: number
  panX: number
  panY: number
}

export interface MapLayout {
  earthX: number
  earthY: number
  rocketMapX: number
  rocketMapY: number
}

export function computeMapLayout(
  tracker: OrbitTracker,
  flight: FlightState,
  padCenterX: number,
  padSurfaceY: number,
  zoom: number,
  timeMs = Date.now(),
): MapLayout {
  const earthOrbitR = kmToMapPx(AU_KM, zoom)
  const earthAngle = timeMs / 20000
  const earthX = Math.cos(earthAngle) * earthOrbitR
  const earthY = Math.sin(earthAngle) * earthOrbitR
  const rocket = tracker.getRocketMapPosition(flight, padCenterX, padSurfaceY, zoom)
  return {
    earthX,
    earthY,
    rocketMapX: earthX + rocket.mapX,
    rocketMapY: earthY + rocket.mapY,
  }
}

export function panToFocusTarget(
  layout: MapLayout,
  target: 'earth' | 'rocket',
  zoom: number,
): { panX: number; panY: number } {
  const focusX = target === 'earth' ? layout.earthX : layout.rocketMapX
  const focusY = target === 'earth' ? layout.earthY : layout.rocketMapY
  return { panX: -focusX * zoom, panY: -focusY * zoom }
}

export function drawMapView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tracker: OrbitTracker,
  flight: FlightState,
  padCenterX: number,
  padSurfaceY: number,
  flightAngle: number,
  view: MapViewState,
): void {
  ctx.fillStyle = '#050510'
  ctx.fillRect(0, 0, width, height)

  const cx = width / 2 + view.panX
  const cy = height / 2 + view.panY
  const zoom = view.zoom

  drawStars(ctx, width, height)

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(zoom, zoom)

  const layout = computeMapLayout(tracker, flight, padCenterX, padSurfaceY, zoom)
  const { earthX, earthY } = layout
  const earthOrbitR = kmToMapPx(AU_KM, zoom)

  // 太阳（日心）
  ctx.fillStyle = 'rgba(255, 200, 60, 0.12)'
  ctx.beginPath()
  ctx.arc(0, 0, kmToMapPx(SUN_RADIUS_KM, zoom), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffd54a'
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(8, kmToMapPx(SUN_RADIUS_KM, zoom)), 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 213, 74, 0.85)'
  ctx.font = `${10 / zoom}px system-ui`
  ctx.textAlign = 'left'
  ctx.fillText('太阳', Math.max(12, kmToMapPx(SUN_RADIUS_KM, zoom)) + 4, 4)

  ctx.strokeStyle = 'rgba(100, 160, 220, 0.45)'
  ctx.lineWidth = 3 / zoom
  ctx.beginPath()
  ctx.arc(0, 0, earthOrbitR, 0, Math.PI * 2)
  ctx.stroke()

  ctx.save()
  ctx.translate(earthX, earthY)

  const moonOrbitR = kmToMapPx(MOON_ORBIT_KM, zoom)
  ctx.strokeStyle = 'rgba(200, 200, 220, 0.5)'
  ctx.lineWidth = 2.5 / zoom
  ctx.beginPath()
  ctx.arc(0, 0, moonOrbitR, 0, Math.PI * 2)
  ctx.stroke()

  const moonAngle = Date.now() / 8000
  const moonX = Math.cos(moonAngle) * moonOrbitR
  const moonY = Math.sin(moonAngle) * moonOrbitR
  const moonR = Math.max(3, kmToMapPx(MOON_RADIUS_KM, zoom))
  ctx.fillStyle = '#b8b8c8'
  ctx.beginPath()
  ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(200,200,220,0.75)'
  ctx.font = `${8 / zoom}px system-ui`
  ctx.fillText('月球', moonX + moonR + 3, moonY + 3)

  // 地球
  const earthR = kmToMapPx(EARTH_RADIUS_KM, zoom)
  ctx.fillStyle = '#1b4332'
  ctx.beginPath()
  ctx.arc(0, 0, earthR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#40916c'
  ctx.lineWidth = 2 / zoom
  ctx.stroke()
  ctx.fillStyle = 'rgba(180,220,200,0.85)'
  ctx.font = `${10 / zoom}px system-ui`
  ctx.textAlign = 'center'
  ctx.fillText('地球', 0, earthR + 12 / zoom)

  const samples = tracker.getSamples()
  if (samples.length > 1) {
    ctx.strokeStyle = 'rgba(59, 158, 255, 0.7)'
    ctx.lineWidth = 1.5 / zoom
    ctx.beginPath()
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!
      const rKm = EARTH_RADIUS_KM + s.altKm
      const theta = Math.atan2(s.horizKm, rKm)
      const x = kmToMapPx(rKm * Math.sin(theta), zoom)
      const y = -kmToMapPx(rKm * Math.cos(theta), zoom)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  const apo = tracker.getApoapsis(zoom)
  const peri = tracker.getPeriapsis(zoom, flight)
  if (apo) drawOrbitMarker(ctx, apo, zoom)
  if (peri) drawOrbitMarker(ctx, peri, zoom)

  const rocket = tracker.getRocketMapPosition(flight, padCenterX, padSurfaceY, zoom)
  const tipAngle = flightAngle - Math.PI / 2
  ctx.fillStyle = '#3b9eff'
  ctx.beginPath()
  const tip = 10 / zoom
  ctx.moveTo(rocket.mapX + Math.cos(tipAngle) * tip, rocket.mapY + Math.sin(tipAngle) * tip)
  ctx.lineTo(
    rocket.mapX + Math.cos(tipAngle + 2.4) * tip * 0.7,
    rocket.mapY + Math.sin(tipAngle + 2.4) * tip * 0.7,
  )
  ctx.lineTo(
    rocket.mapX + Math.cos(tipAngle - 2.4) * tip * 0.7,
    rocket.mapY + Math.sin(tipAngle - 2.4) * tip * 0.7,
  )
  ctx.closePath()
  ctx.fill()

  ctx.restore()
  ctx.restore()

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '10px system-ui'
  ctx.textAlign = 'left'
  ctx.fillText(`地图缩放 ${zoom.toFixed(1)}× · 滚轮/双指缩放 · 拖拽平移`, 10, height - 10)
}

function drawOrbitMarker(
  ctx: CanvasRenderingContext2D,
  sample: { mapX: number; mapY: number; altKm: number; label: string },
  zoom: number,
): void {
  const color = sample.label === '远点' ? '#ff6b6b' : '#50dc78'
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(sample.mapX, sample.mapY, 4 / zoom, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.font = `${9 / zoom}px system-ui`
  ctx.textAlign = 'left'
  ctx.fillText(`${sample.label} ${sample.altKm.toFixed(1)} km`, sample.mapX + 6 / zoom, sample.mapY - 4 / zoom)
}

function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  for (let i = 0; i < 60; i++) {
    const sx = (i * 137.5) % width
    const sy = (i * 97.3) % height
    ctx.fillRect(sx, sy, 1, 1)
  }
}

export type { ViewMode }
