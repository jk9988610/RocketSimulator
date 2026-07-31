import type { LaunchSequenceState } from '../assembly/launch-sequence'
import { getPartDefinition } from '../parts/definitions'
import { drawPart } from '../parts/render'
import type { PartInstance } from '../parts/types'
import {
  createInitialFlightState,
  updateFlight,
  type FlightState,
} from './flight-physics'
import {
  FlightRocket,
  getActiveStageEngineIds,
} from './rocket-body'
import { drawMapView, computeMapLayout, panToFocusTarget, type MapFocusTarget, type ViewMode } from './map-renderer'
import { OrbitTracker } from './orbit-tracker'
import { StageRunner } from './stage-runner'
import {
  evaluateLanding,
  landingMessage,
  type LandingResult,
} from './landing'
import {
  altitudeAboveEarthKm,
  resolveHudReadout,
} from './orbit-mechanics'
import { gravityAtAltitude, KARMAN_LINE_KM } from './atmosphere'
import {
  collectPartsBelowConnector,
  createFloatingStage,
  updateFloatingStage,
  type FloatingStage,
} from './stage-separation'
import type { LaunchStage } from '../assembly/launch-sequence'

const WORLD_PAD_Y = 0
const WORLD_PAD_X = 0
/** 火箭在画面中的垂直偏移（负值 = 略高于中心，留出下方视野） */
const CAMERA_Y_OFFSET = -90

export class LaunchScene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly container: HTMLElement
  private rocket: FlightRocket
  private flight: FlightState
  private readonly stageRunner = new StageRunner()
  private readonly orbitTracker = new OrbitTracker()

  private viewMode: ViewMode = 'live'
  private cameraX = 0
  private cameraY = CAMERA_Y_OFFSET

  private engineOn = false
  private throttle = 0
  private tiltLeft = false
  private tiltRight = false
  private earthScale = 1
  private lastPinchDist = 0
  private rafId = 0
  private lastTime = 0
  private running = false
  private statusMessage = ''
  private statusTimer = 0
  private sequencePanelVisible = false
  private sequencePanel: HTMLElement | null = null
  private maxAltM = 0
  private prevGrounded = true
  private landingResult: LandingResult = 'none'
  private floatingStages: FloatingStage[] = []
  private timeWarp = 1
  private paused = false
  private mapZoom = 1
  private mapPanX = 0
  private mapPanY = 0
  private mapFocusTarget: MapFocusTarget = 'rocket'
  private mapFocusActive = true
  private mapDragging = false
  private mapDragStart = { x: 0, y: 0, panX: 0, panY: 0 }

  private readonly launchState: LaunchSequenceState
  private readonly onBack: () => void
  private readonly onRelaunch: () => void

  constructor(
    container: HTMLElement,
    rocket: FlightRocket,
    launchState: LaunchSequenceState,
    onBack: () => void,
    onRelaunch: () => void,
  ) {
    this.container = container
    this.rocket = rocket
    this.launchState = launchState
    this.onBack = onBack
    this.onRelaunch = onRelaunch

    const canvas = container.querySelector<HTMLCanvasElement>('#launch-canvas')
    if (!canvas) throw new Error('Launch canvas not found')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')

    this.canvas = canvas
    this.ctx = ctx
    this.flight = createInitialFlightState(WORLD_PAD_X, WORLD_PAD_Y, rocket)
    this.cameraX = WORLD_PAD_X
    this.cameraY = WORLD_PAD_Y + CAMERA_Y_OFFSET
  }

  start(): void {
    this.resize()
    this.bindControls()
    this.bindPinchZoom()
    this.bindMapInteraction()
    this.running = true
    this.lastTime = performance.now()
    this.updateFuelBars()
    this.updateFlightHud()
    this.loop()
  }

  reset(rocket: FlightRocket): void {
    this.rocket = rocket
    this.flight = createInitialFlightState(WORLD_PAD_X, WORLD_PAD_Y, rocket)
    this.cameraX = WORLD_PAD_X
    this.cameraY = WORLD_PAD_Y + CAMERA_Y_OFFSET
    this.orbitTracker.reset()
    this.stageRunner.reset()
    this.floatingStages = []
    this.landingResult = 'none'
    this.maxAltM = 0
    this.prevGrounded = true
    this.engineOn = false
    this.throttle = 0
    this.statusTimer = 0
    this.statusMessage = ''
    this.updateFuelBars()
    const engineSwitch = this.container.querySelector<HTMLButtonElement>('#engine-switch')
    const throttle = this.container.querySelector<HTMLInputElement>('#throttle')
    if (engineSwitch) {
      engineSwitch.textContent = '引擎关'
      engineSwitch.classList.remove('active')
    }
    if (throttle) throttle.value = '0'
    this.showStatus('重新发射', 2)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.floor(rect.width * dpr)
    this.canvas.height = Math.floor(rect.height * dpr)
    this.canvas.style.width = `${rect.width}px`
    this.canvas.style.height = `${rect.height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  handleResize(): void {
    this.resize()
  }

  private bindControls(): void {
    const engineSwitch = this.container.querySelector<HTMLButtonElement>('#engine-switch')!
    const throttle = this.container.querySelector<HTMLInputElement>('#throttle')!
    const stageStep = this.container.querySelector<HTMLButtonElement>('#stage-step-btn')!
    const sequenceView = this.container.querySelector<HTMLButtonElement>('#sequence-view-btn')!
    const sequencePanel = this.container.querySelector<HTMLElement>('#sequence-readout')!
    const backBtn = this.container.querySelector<HTMLButtonElement>('#back-to-assembly')!
    const relaunchBtn = this.container.querySelector<HTMLButtonElement>('#relaunch-btn')!
    const menuBtn = this.container.querySelector<HTMLButtonElement>('#launch-menu-btn')!
    const menuPanel = this.container.querySelector<HTMLElement>('#launch-menu')!
    const warpSlower = this.container.querySelector<HTMLButtonElement>('#warp-slower')!
    const warpPause = this.container.querySelector<HTMLButtonElement>('#warp-pause')!
    const warpFaster = this.container.querySelector<HTMLButtonElement>('#warp-faster')!
    const warpLabel = this.container.querySelector<HTMLElement>('#warp-label')!
    const mapToggle = this.container.querySelector<HTMLButtonElement>('#map-toggle')!
    const mapFocusSelect = this.container.querySelector<HTMLSelectElement>('#map-focus-select')!

    this.sequencePanel = sequencePanel

    const refreshWarpLabel = (): void => {
      if (!warpLabel) return
      warpLabel.textContent = this.paused ? '暂停' : `${this.timeWarp}×`
    }

    const setWarp = (factor: number): void => {
      this.timeWarp = Math.max(0.25, Math.min(8, factor))
      refreshWarpLabel()
    }

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      menuPanel.classList.toggle('launch-menu--hidden')
    })

    document.addEventListener('click', () => {
      menuPanel.classList.add('launch-menu--hidden')
    })

    menuPanel.addEventListener('click', (e) => e.stopPropagation())

    relaunchBtn.addEventListener('click', () => {
      menuPanel.classList.add('launch-menu--hidden')
      this.onRelaunch()
    })

    engineSwitch.addEventListener('click', () => {
      this.engineOn = !this.engineOn
      engineSwitch.textContent = this.engineOn ? '引擎开' : '引擎关'
      engineSwitch.classList.toggle('active', this.engineOn)
    })

    throttle.addEventListener('input', () => {
      this.throttle = Number(throttle.value) / 100
    })

    stageStep.addEventListener('click', () => {
      const next = this.stageRunner.getNextStage(this.launchState.getStages())
      if (!next) {
        this.showStatus('启动链已全部执行')
        return
      }
      this.stageRunner.executeStage(next, this.rocket)
      this.handleStageSeparation(next)
      this.showStatus(`执行启动级 ${next.number}`)
      this.updateSequenceReadout(sequencePanel)
    })

    sequenceView.addEventListener('click', () => {
      this.sequencePanelVisible = !this.sequencePanelVisible
      sequencePanel.classList.toggle('sequence-readout--hidden', !this.sequencePanelVisible)
      sequenceView.classList.toggle('active', this.sequencePanelVisible)
      this.updateSequenceReadout(sequencePanel)
    })

    backBtn.addEventListener('click', () => {
      menuPanel.classList.add('launch-menu--hidden')
      this.stop()
      this.onBack()
    })

    warpSlower.addEventListener('click', () => {
      if (this.paused) return
      setWarp(this.timeWarp / 2)
    })
    warpFaster.addEventListener('click', () => {
      if (this.paused) return
      setWarp(this.timeWarp * 2)
    })

    warpPause.addEventListener('click', () => {
      this.paused = !this.paused
      warpPause.classList.toggle('active', this.paused)
      warpPause.textContent = this.paused ? '▶' : '⏸'
      warpPause.title = this.paused ? '继续' : '暂停'
      if (this.paused) {
        this.lastTime = performance.now()
      }
      refreshWarpLabel()
    })

    mapFocusSelect.addEventListener('change', () => {
      this.mapFocusTarget = mapFocusSelect.value as 'earth' | 'rocket'
      this.mapFocusActive = true
    })

    const setMapModeUi = (isMap: boolean): void => {
      mapFocusSelect.classList.toggle('map-focus-select--hidden', !isMap)
      if (isMap) {
        this.mapFocusTarget = mapFocusSelect.value as 'earth' | 'rocket'
        this.mapFocusActive = true
      }
    }

    mapToggle.addEventListener('click', () => {
      this.viewMode = this.viewMode === 'live' ? 'map' : 'live'
      mapToggle.textContent = this.viewMode === 'live' ? '现场' : '地图'
      mapToggle.classList.toggle('active', this.viewMode === 'map')
      setMapModeUi(this.viewMode === 'map')
      if (this.viewMode === 'map' && this.sequencePanel) {
        this.sequencePanel.classList.add('sequence-readout--hidden')
        this.sequencePanelVisible = false
        sequenceView.classList.remove('active')
      }
    })

    const bindTilt = (id: string, prop: 'tiltLeft' | 'tiltRight') => {
      const btn = this.container.querySelector<HTMLButtonElement>(id)!
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        this[prop] = true
        btn.setPointerCapture(e.pointerId)
      })
      const release = (e: PointerEvent) => {
        this[prop] = false
        btn.releasePointerCapture(e.pointerId)
      }
      btn.addEventListener('pointerup', release)
      btn.addEventListener('pointercancel', release)
    }

    bindTilt('#tilt-left', 'tiltLeft')
    bindTilt('#tilt-right', 'tiltRight')

    this.updateSequenceReadout(sequencePanel)
  }

  private updateSequenceReadout(panel: HTMLElement): void {
    const stages = this.launchState.getStages()
    const executed = new Set(this.stageRunner.getExecutedNumbers())
    panel.innerHTML = `
      <header class="sequence-readout__header">启动链</header>
      <ul class="sequence-readout__list">
        ${stages.length === 0 ? '<li class="sequence-readout__empty">未配置</li>' : ''}
        ${[...stages]
          .sort((a, b) => b.number - a.number)
          .map((stage) => {
            const done = executed.has(stage.number)
            const next = this.stageRunner.getNextStage(this.launchState.getStages())
            const isNext = next?.number === stage.number
            const targets = stage.targetPartIds
              .map((id) => this.rocket.getPart(id))
              .filter(Boolean)
              .map((p) => getPartDefinition(p!.typeId).label)
              .join('、') || '无'
            return `
              <li class="sequence-readout__item ${done ? 'sequence-readout__item--done' : ''} ${isNext ? 'sequence-readout__item--next' : ''}">
                <span>级 ${stage.number}${done ? ' ✓' : isNext ? ' →' : ''}</span>
                <span class="sequence-readout__targets">${targets}</span>
              </li>
            `
          })
          .join('')}
      </ul>
    `
  }

  private showStatus(msg: string, duration = 2): void {
    this.statusMessage = msg
    this.statusTimer = duration
  }

  private bindPinchZoom(): void {
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length !== 2) return
        e.preventDefault()
        const dist = Math.hypot(
          e.touches[0]!.clientX - e.touches[1]!.clientX,
          e.touches[0]!.clientY - e.touches[1]!.clientY,
        )
        if (this.lastPinchDist > 0) {
          const ratio = dist / this.lastPinchDist
          if (this.viewMode === 'live') {
            this.earthScale = Math.max(0.5, Math.min(3, this.earthScale * ratio))
          } else {
            this.mapZoom = Math.max(0.3, Math.min(6, this.mapZoom * ratio))
            this.mapFocusActive = false
          }
        }
        this.lastPinchDist = dist
      },
      { passive: false },
    )
    this.canvas.addEventListener('touchend', () => {
      this.lastPinchDist = 0
    })
  }

  private bindMapInteraction(): void {
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.viewMode !== 'map') return
        e.preventDefault()
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        this.mapZoom = Math.max(0.3, Math.min(6, this.mapZoom * factor))
        this.mapFocusActive = false
      },
      { passive: false },
    )

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.viewMode !== 'map') return
      this.mapDragging = true
      this.mapFocusActive = false
      this.mapDragStart = {
        x: e.clientX,
        y: e.clientY,
        panX: this.mapPanX,
        panY: this.mapPanY,
      }
      this.canvas.setPointerCapture(e.pointerId)
    })

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.mapDragging || this.viewMode !== 'map') return
      this.mapPanX = this.mapDragStart.panX + (e.clientX - this.mapDragStart.x)
      this.mapPanY = this.mapDragStart.panY + (e.clientY - this.mapDragStart.y)
    })

    const endMapDrag = (e: PointerEvent): void => {
      if (!this.mapDragging) return
      this.mapDragging = false
      this.canvas.releasePointerCapture(e.pointerId)
    }
    this.canvas.addEventListener('pointerup', endMapDrag)
    this.canvas.addEventListener('pointercancel', endMapDrag)
  }

  private loop(): void {
    if (!this.running) return

    const now = performance.now()
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    const dt = this.paused ? 0 : rawDt * this.timeWarp

    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const grounded = this.flight.y >= WORLD_PAD_Y - 1
    const prevVy = this.flight.vy

    if (grounded) {
      this.flight.y = WORLD_PAD_Y
      if (this.flight.vy > 0) this.flight.vy = 0
      if (this.flight.vy === 0) this.flight.vx *= 0.92
    }

    const activeEngineIds = getActiveStageEngineIds(
      this.rocket,
      this.launchState.getStages(),
    )

    const altKm = altitudeAboveEarthKm(this.flight)
    const altM = altKm * 1000

    updateFlight(this.flight, this.rocket, dt, {
      throttle: this.throttle,
      engineOn: this.engineOn,
      activeEngineIds,
      tiltLeft: this.tiltLeft,
      tiltRight: this.tiltRight,
      grounded: grounded && this.flight.vy <= 0.01,
      altKm,
    })

    const grav = gravityAtAltitude(altKm)
    for (const stage of this.floatingStages) {
      updateFloatingStage(stage, dt, grav)
    }

    if (this.statusTimer > 0) this.statusTimer -= dt

    this.maxAltM = Math.max(this.maxAltM, altM)

    if (grounded && !this.prevGrounded && this.landingResult === 'none') {
      const impactSpeed = Math.abs(prevVy)
      const result = evaluateLanding(this.rocket, impactSpeed, this.maxAltM)
      if (result !== 'none') {
        this.landingResult = result
        this.showStatus(
          landingMessage(result, this.rocket.hasParachuteDeployed()),
          result === 'success' ? 6 : 5,
        )
      }
    }
    this.prevGrounded = grounded

    // 相机锁定火箭，无延迟跟随
    this.cameraX = this.flight.x
    this.cameraY = this.flight.y + CAMERA_Y_OFFSET

    this.orbitTracker.record(this.flight, WORLD_PAD_X, WORLD_PAD_Y)

    if (this.sequencePanelVisible && this.sequencePanel) {
      this.updateSequenceReadout(this.sequencePanel)
    }

    this.updateFuelBars()
    this.updateFlightHud(grounded)

    if (this.viewMode === 'map' && this.mapFocusActive && this.mapFocusTarget !== 'free') {
      const layout = computeMapLayout(
        this.orbitTracker,
        this.flight,
        WORLD_PAD_X,
        WORLD_PAD_Y,
        this.mapZoom,
      )
      const pan = panToFocusTarget(layout, this.mapFocusTarget, this.mapZoom)
      this.mapPanX = pan.panX
      this.mapPanY = pan.panY
    }

    this.draw(width, height, altKm)
    this.rafId = requestAnimationFrame(() => this.loop())
  }

  private handleStageSeparation(stage: LaunchStage): void {
    const connectorTypes = new Set(['ring-connector', 'radial-connector'])

    for (const partId of stage.targetPartIds) {
      const connector = this.rocket.getPart(partId)
      if (!connector || !connectorTypes.has(connector.typeId) || !connector.connectorOpen) {
        continue
      }

      const below = collectPartsBelowConnector(connector, this.rocket.parts)
      if (below.length === 0) continue

      for (const p of below) p.detached = true

      const { centerX, bottomY } = this.rocket.bounds
      this.floatingStages.push(
        createFloatingStage(
          below,
          this.flight.x,
          this.flight.y,
          this.flight.vx,
          this.flight.vy,
          this.flight.angle,
          centerX,
          bottomY,
        ),
      )
      this.showStatus('级间分离', 2.5)
    }

    this.rocket.recomputeBounds()
  }

  private draw(width: number, height: number, altKm: number): void {
    if (this.viewMode === 'map') {
      drawMapView(
        this.ctx,
        width,
        height,
        this.orbitTracker,
        this.flight,
        WORLD_PAD_X,
        WORLD_PAD_Y,
        this.flight.angle,
        { zoom: this.mapZoom, panX: this.mapPanX, panY: this.mapPanY },
      )
      return
    }

    const sky = this.ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#0a1628')
    sky.addColorStop(0.55, '#1a3a5c')
    sky.addColorStop(1, '#2d6a4f')
    this.ctx.fillStyle = sky
    this.ctx.fillRect(0, 0, width, height)

    this.ctx.save()
    this.ctx.translate(width / 2 - this.cameraX, height * 0.58 - this.cameraY)

    this.drawEarth()
    this.drawLaunchPad()

    for (const fs of this.floatingStages) {
      this.drawFloatingStage(fs)
    }

    this.ctx.save()
    this.ctx.translate(this.flight.x, this.flight.y)
    this.ctx.rotate(this.flight.angle)
    this.ctx.translate(-this.rocket.bounds.centerX, -this.rocket.bounds.bottomY)

    for (const part of this.rocket.parts) {
      if (part.detached || part.envelopedBy) continue
      const instance: PartInstance = part
      drawPart(this.ctx, instance, false, { ringSpan: part.ringSpan })
      if (part.connectorOpen && (part.typeId === 'ring-connector' || part.typeId === 'radial-connector')) {
        this.drawOpenConnector(part)
      }
      if (part.ignited && part.typeId === 'engine' && this.engineOn && this.throttle > 0) {
        this.drawEngineFlame(part)
      }
      if (part.parachuteDeployed && part.typeId === 'parachute') {
        this.drawDeployedParachute(part)
      }
    }

    this.ctx.restore()
    this.ctx.restore()

    this.drawKarmanBanner(width, height, altKm)
    this.drawLandingOverlay(width, height)

    if (this.statusTimer > 0 && this.statusMessage) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.6)'
      this.ctx.fillRect(width / 2 - 100, 48, 200, 28)
      this.ctx.fillStyle = '#ffd23c'
      this.ctx.font = '13px system-ui'
      this.ctx.textAlign = 'center'
      this.ctx.fillText(this.statusMessage, width / 2, 66)
    }
  }

  private drawEarth(): void {
    const earthR = 720 * this.earthScale
    const cx = 0
    const cy = 280

    this.ctx.fillStyle = '#1b4332'
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, earthR, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.strokeStyle = '#40916c'
    this.ctx.lineWidth = 3
    this.ctx.beginPath()
    this.ctx.arc(cx, cy, earthR, Math.PI * 1.05, Math.PI * 1.95)
    this.ctx.stroke()
  }

  private drawLaunchPad(): void {
    const padW = 180
    const topW = 100
    const h = 36
    const padSurfaceY = WORLD_PAD_Y

    this.ctx.fillStyle = '#555568'
    this.ctx.beginPath()
    this.ctx.moveTo(-topW / 2, padSurfaceY)
    this.ctx.lineTo(topW / 2, padSurfaceY)
    this.ctx.lineTo(padW / 2, padSurfaceY + h)
    this.ctx.lineTo(-padW / 2, padSurfaceY + h)
    this.ctx.closePath()
    this.ctx.fill()

    this.ctx.strokeStyle = '#888898'
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(-topW / 2, padSurfaceY)
    this.ctx.lineTo(topW / 2, padSurfaceY)
    this.ctx.stroke()
  }

  private drawEngineFlame(part: import('./rocket-body').FlightPartState): void {
    const def = getPartDefinition(part.typeId)
    const fx = part.x + def.width / 2
    const fy = part.y + def.height
    const flicker = 8 + Math.random() * 12

    this.ctx.fillStyle = `rgba(255, ${140 + Math.random() * 60}, 40, 0.85)`
    this.ctx.beginPath()
    this.ctx.moveTo(fx - 8, fy)
    this.ctx.lineTo(fx, fy + flicker * this.throttle)
    this.ctx.lineTo(fx + 8, fy)
    this.ctx.closePath()
    this.ctx.fill()
  }

  private drawFloatingStage(fs: FloatingStage): void {
    let minX = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const part of fs.parts) {
      const def = getPartDefinition(part.typeId)
      const h = part.ringSpan ?? def.height
      minX = Math.min(minX, part.x)
      maxX = Math.max(maxX, part.x + def.width)
      maxY = Math.max(maxY, part.y + h)
    }
    const centerX = (minX + maxX) / 2
    const bottomY = maxY

    this.ctx.save()
    this.ctx.translate(fs.x, fs.y)
    this.ctx.rotate(fs.angle)
    this.ctx.translate(-centerX, -bottomY)

    for (const part of fs.parts) {
      drawPart(this.ctx, part, false, { ringSpan: part.ringSpan })
    }
    this.ctx.restore()
  }

  private drawOpenConnector(part: import('./rocket-body').FlightPartState): void {
    const def = getPartDefinition(part.typeId)
    const h = part.ringSpan ?? def.height

    const gap = 6

    this.ctx.strokeStyle = 'rgba(255, 210, 60, 0.9)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([4, 3])
    this.ctx.beginPath()
    this.ctx.moveTo(part.x, part.y + h * 0.5 - gap)
    this.ctx.lineTo(part.x + def.width, part.y + h * 0.5 - gap)
    this.ctx.moveTo(part.x, part.y + h * 0.5 + gap)
    this.ctx.lineTo(part.x + def.width, part.y + h * 0.5 + gap)
    this.ctx.stroke()
    this.ctx.setLineDash([])
  }

  private updateFuelBars(): void {
    const container = this.container.querySelector<HTMLElement>('#fuel-bars')
    if (!container) return
    const tanks = this.rocket.getFuelTanksOrdered()
    container.innerHTML = tanks
      .map(
        (t) => `
        <div class="fuel-bar">
          <span class="fuel-bar__label">${t.label}</span>
          <div class="fuel-bar__track">
            <div class="fuel-bar__fill" style="width:${Math.round(t.fraction * 100)}%"></div>
          </div>
        </div>
      `,
      )
      .join('')
  }

  private updateFlightHud(grounded?: boolean): void {
    const onGround = grounded ?? this.flight.y >= WORLD_PAD_Y - 1
    const hud = resolveHudReadout(this.flight, onGround)
    const speedEl = this.container.querySelector<HTMLElement>('#hud-speed')
    const altLabelEl = this.container.querySelector<HTMLElement>('#hud-alt-label')
    const altEl = this.container.querySelector<HTMLElement>('#hud-altitude')
    if (speedEl) speedEl.textContent = `${hud.speedMs.toFixed(1)} m/s`
    if (altLabelEl) altLabelEl.textContent = hud.distanceLabel
    if (altEl) altEl.textContent = `${hud.distanceKm.toFixed(2)} km`
  }

  private drawKarmanBanner(width: number, _height: number, altKm: number): void {
    if (altKm < KARMAN_LINE_KM * 0.8) return

    const nearKarman = altKm >= KARMAN_LINE_KM
    this.ctx.fillStyle = nearKarman ? 'rgba(80, 200, 255, 0.9)' : 'rgba(255, 210, 60, 0.9)'
    this.ctx.font = 'bold 11px system-ui'
    this.ctx.textAlign = 'center'
    this.ctx.fillText(
      nearKarman ? '✦ 已进入太空（卡门线）' : `接近卡门线 ${KARMAN_LINE_KM} km`,
      width / 2,
      24,
    )
  }

  private drawDeployedParachute(part: import('./rocket-body').FlightPartState): void {
    const def = getPartDefinition(part.typeId)
    const cx = part.x + def.width / 2
    const baseY = part.y + def.height
    const expandR = def.width * 1.35
    const canopyR = expandR * 0.72

    this.ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    this.ctx.lineWidth = 1
    for (let i = -2; i <= 2; i++) {
      this.ctx.beginPath()
      this.ctx.moveTo(cx + i * 8, baseY - 4)
      this.ctx.lineTo(cx + i * expandR * 0.22, baseY - canopyR * 0.55)
      this.ctx.stroke()
    }

    this.ctx.fillStyle = 'rgba(255, 90, 90, 0.75)'
    this.ctx.strokeStyle = '#cc4444'
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.arc(cx, baseY, expandR, Math.PI, 0)
    this.ctx.closePath()
    this.ctx.fill()
    this.ctx.stroke()

    this.ctx.fillStyle = 'rgba(255, 180, 180, 0.4)'
    this.ctx.beginPath()
    this.ctx.arc(cx, baseY, canopyR, Math.PI, 0)
    this.ctx.closePath()
    this.ctx.fill()
  }

  private drawLandingOverlay(width: number, height: number): void {
    if (this.landingResult === 'none') return

    const isSuccess = this.landingResult === 'success'
    this.ctx.fillStyle = isSuccess ? 'rgba(40, 120, 70, 0.85)' : 'rgba(140, 40, 40, 0.85)'
    this.ctx.fillRect(width / 2 - 130, height / 2 - 28, 260, 56)
    this.ctx.strokeStyle = isSuccess ? '#50dc78' : '#ff6b6b'
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(width / 2 - 130, height / 2 - 28, 260, 56)
    this.ctx.fillStyle = '#fff'
    this.ctx.font = 'bold 15px system-ui'
    this.ctx.textAlign = 'center'
    this.ctx.fillText(
      isSuccess ? '任务成功' : '任务失败',
      width / 2,
      height / 2 - 6,
    )
    this.ctx.font = '12px system-ui'
    this.ctx.fillStyle = 'rgba(255,255,255,0.85)'
    this.ctx.fillText(this.statusMessage, width / 2, height / 2 + 14)
  }
}
