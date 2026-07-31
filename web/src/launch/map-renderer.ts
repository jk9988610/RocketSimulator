import {
  AU_KM,
  EARTH_RADIUS_KM,
  kmToMapPx,
  MOON_ORBIT_KM,
  MOON_RADIUS_KM,
  SUN_RADIUS_KM,
} from './cosmos-scale'
import { computeHeliocentricState } from './cosmos-simulation'
import type { OrbitTracker } from './orbit-tracker'
import type { FlightState } from './flight-physics'

type ViewMode = 'live' | 'map'

export type MapFocusTarget = 'sun' | 'earth' | 'moon' | 'rocket' | 'free'

export interface MapViewState {
  zoom: number
  panX: number
  panY: number
}

export interface MapLayout {
  sunX: number
  sunY: number
  earthX: number
  earthY: number
  moonX: number
  moonY: number
  rocketMapX: number
  rocketMapY: number
  earthRotation: number
  moonRotation: number
  sunRotation: number
}

export function computeMapLayout(
  tracker: OrbitTracker,
  flight: FlightState,
  padCenterX: number,
  padSurfaceY: number,
  zoom: number,
  simTimeS: number,
): MapLayout {
  const helio = computeHeliocentricState(simTimeS)
  const earthX = kmToMapPx(helio.earth.x, zoom)
  const earthY = kmToMapPx(helio.earth.y, zoom)
  const moonX = kmToMapPx(helio.moon.x, zoom)
  const moonY = kmToMapPx(helio.moon.y, zoom)
  const rocket = tracker.getRocketMapPosition(flight, padCenterX, padSurfaceY, zoom)
  return {
    sunX: 0,
    sunY: 0,
    earthX,
    earthY,
    moonX,
    moonY,
    rocketMapX: earthX + rocket.mapX,
    rocketMapY: earthY + rocket.mapY,
    earthRotation: helio.earthRotation,
    moonRotation: helio.moonRotation,
    sunRotation: helio.sunRotation,
  }
}

export const MAP_ZOOM_MIN = 0.3
export const MAP_ZOOM_MAX = 6

export function clampMapZoom(zoom: number): number {
  return Math.max(MAP_ZOOM_MIN, Math.min(MAP_ZOOM_MAX, zoom))
}

export function panToFocusTarget(
  layout: MapLayout,
  target: Exclude<MapFocusTarget, 'free'>,
  zoom: number,
): { panX: number; panY: number } {
  let focusX: number
  let focusY: number
  switch (target) {
    case 'sun':
      focusX = layout.sunX
      focusY = layout.sunY
      break
    case 'earth':
      focusX = layout.earthX
      focusY = layout.earthY
      break
    case 'moon':
      focusX = layout.moonX
      focusY = layout.moonY
      break
    case 'rocket':
      focusX = layout.rocketMapX
      focusY = layout.rocketMapY
      break
  }
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
  simTimeS: number,
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

  const layout = computeMapLayout(
    tracker,
    flight,
    padCenterX,
    padSurfaceY,
    zoom,
    simTimeS,
  )
  const { earthX, earthY } = layout
  const earthOrbitR = kmToMapPx(AU_KM, zoom)

  drawRotatingBody(ctx, 0, 0, Math.max(8, kmToMapPx(SUN_RADIUS_KM, zoom)), layout.sunRotation, zoom, {
    fill: '#ffd54a',
    glow: 'rgba(255, 200, 60, 0.12)',
    glowRadius: kmToMapPx(SUN_RADIUS_KM, zoom),
    marker: '#ffb300',
    label: '太阳',
    labelOffset: { x: Math.max(12, kmToMapPx(SUN_RADIUS_KM, zoom)) + 4, y: 4 },
    labelAlign: 'left' as CanvasTextAlign,
  })

  ctx.strokeStyle = 'rgba(100, 160, 220, 0.45)'
  ctx.lineWidth = 3 / zoom
  ctx.beginPath()
  ctx.arc(0, 0, earthOrbitR, 0, Math.PI * 2)
  ctx.stroke()

  const moonOrbitR = kmToMapPx(MOON_ORBIT_KM, zoom)
  ctx.strokeStyle = 'rgba(200, 200, 220, 0.5)'
  ctx.lineWidth = 2.5 / zoom
  ctx.beginPath()
  ctx.arc(earthX, earthY, moonOrbitR, 0, Math.PI * 2)
  ctx.stroke()

  const moonR = Math.max(3, kmToMapPx(MOON_RADIUS_KM, zoom))
  drawRotatingBody(ctx, layout.moonX, layout.moonY, moonR, layout.moonRotation, zoom, {
    fill: '#b8b8c8',
    marker: '#8888a0',
    label: '月球',
    labelOffset: { x: moonR + 3, y: 3 },
    labelAlign: 'left' as CanvasTextAlign,
  })

  ctx.save()
  ctx.translate(earthX, earthY)

  const earthR = kmToMapPx(EARTH_RADIUS_KM, zoom)
  drawRotatingBody(ctx, 0, 0, earthR, layout.earthRotation, zoom, {
    fill: '#1b4332',
    stroke: '#40916c',
    strokeWidth: 2 / zoom,
    marker: '#74c69d',
    label: '地球',
    labelOffset: { x: 0, y: earthR + 12 / zoom },
    labelAlign: 'center' as CanvasTextAlign,
  })

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

interface BodyDrawStyle {
  fill: string
  glow?: string
  glowRadius?: number
  stroke?: string
  strokeWidth?: number
  marker: string
  label: string
  labelOffset: { x: number; y: number }
  labelAlign: CanvasTextAlign
}

function drawRotatingBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  rotation: number,
  zoom: number,
  style: BodyDrawStyle,
): void {
  if (style.glow && style.glowRadius) {
    ctx.fillStyle = style.glow
    ctx.beginPath()
    ctx.arc(x, y, style.glowRadius, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)

  ctx.fillStyle = style.fill
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, Math.PI * 2)
  ctx.fill()

  if (style.stroke) {
    ctx.strokeStyle = style.stroke
    ctx.lineWidth = style.strokeWidth ?? 1
    ctx.stroke()
  }

  ctx.fillStyle = style.marker
  ctx.beginPath()
  ctx.arc(radius * 0.55, 0, Math.max(1.5, radius * 0.12), 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(radius * 0.85, 0)
  ctx.strokeStyle = style.marker
  ctx.lineWidth = Math.max(0.8, radius * 0.06)
  ctx.stroke()

  ctx.restore()

  ctx.fillStyle = 'rgba(200,220,240,0.85)'
  ctx.font = `${10 / zoom}px system-ui`
  ctx.textAlign = style.labelAlign
  ctx.fillText(style.label, x + style.labelOffset.x, y + style.labelOffset.y)
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
