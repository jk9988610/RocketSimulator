import type { LaunchSequenceState } from '../assembly/launch-sequence'
import { getPartDefinition } from '../parts/definitions'
import { drawPart, getCommandPodTopAnchors } from '../parts/render'
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
import { drawMapView, computeMapLayout, panToFocusTarget, clampMapZoom, type MapFocusTarget, type ViewMode } from './map-renderer'
import { OrbitTracker } from './orbit-tracker'
import { StageRunner } from './stage-runner'
import {
  evaluateLanding,
  landingMessage,
  needsParachuteAdvisory,
  type LandingResult,
} from './landing'
import {
  altitudeAboveEarthKm,
  resolveHudReadout,
} from './orbit-mechanics'
import { KARMAN_LINE_KM } from './atmosphere'
import { computeGeocentricState } from './cosmos-simulation'
import { computeGravityAcceleration } from './gravity'
import {
  collectDetachedStageParts,
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
  private cosmosSimTimeS = 0
  private parachuteAdvisoryShown = false

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
    this.cosmosSimTimeS = 0
    this.parachuteAdvisoryShown = false
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
      const hadParachute = this.rocket.hasParachuteDeployed()
      this.stageRunner.executeStage(next, this.rocket)
      this.handleStageSeparation(next)
      const deployedParachute = !hadParachute && this.rocket.hasParachuteDeployed()
      if (deployedParachute) {
        this.showStatus('降落伞已展开', 3)
      } else {
        this.showStatus(`执行启动级 ${next.number}`)
      }
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
      this.mapFocusTarget = mapFocusSelect.value as MapFocusTarget
    })

    const setMapModeUi = (isMap: boolean): void => {
      mapFocusSelect.classList.toggle('map-focus-select--hidden', !isMap)
      if (isMap) {
        this.mapFocusTarget = mapFocusSelect.value as MapFocusTarget
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
            this.applyMapZoom(this.mapZoom * ratio)
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
        this.applyMapZoom(this.mapZoom * factor)
      },
      { passive: false },
    )
  }

  private loop(): void {
    if (!this.running) return

    const now = performance.now()
    const rawDt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    const dt = this.paused ? 0 : rawDt * this.timeWarp
    if (dt > 0) this.cosmosSimTimeS += dt

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
    const verticalSpeedMs = this.flight.vy

    if (
      needsParachuteAdvisory(
        altM,
        verticalSpeedMs,
        this.rocket.hasParachuteDeployed(),
        grounded,
      ) &&
      !this.parachuteAdvisoryShown
    ) {
      this.parachuteAdvisoryShown = true
      this.showStatus('下降过快 — 请执行降落伞启动级', 4)
    }

    updateFlight(this.flight, this.rocket, dt, {
      throttle: this.throttle,
      engineOn: this.engineOn,
      activeEngineIds,
      tiltLeft: this.tiltLeft,
      tiltRight: this.tiltRight,
      grounded: grounded && this.flight.vy <= 0.01,
      altKm,
      simTimeS: this.cosmosSimTimeS,
    })

    const grav = computeGravityAcceleration(this.flight, this.cosmosSimTimeS)
    const gravScalar = Math.hypot(grav.ax, grav.ay)
    for (const stage of this.floatingStages) {
      updateFloatingStage(stage, dt, gravScalar)
    }

    if (this.statusTimer > 0) this.statusTimer -= dt

    this.maxAltM = Math.max(this.maxAltM, altM)

    if (grounded && !this.prevGrounded && this.landingResult === 'none') {
      const impactSpeed = Math.abs(prevVy)
      const result = evaluateLanding(
        this.rocket,
        impactSpeed,
        this.maxAltM,
        this.flight.angle,
      )
      if (result !== 'none') {
        this.landingResult = result
        this.showStatus(
          landingMessage(result, this.rocket.hasParachuteDeployed(), this.flight.angle),
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
    this.updateFlightHud(grounded, verticalSpeedMs)

    if (this.viewMode === 'map' && this.mapFocusTarget !== 'free') {
      const layout = computeMapLayout(
        this.orbitTracker,
        this.flight,
        WORLD_PAD_X,
        WORLD_PAD_Y,
        this.cosmosSimTimeS,
      )
      const pan = panToFocusTarget(layout, this.mapFocusTarget, this.mapZoom)
      this.mapPanX = pan.panX
      this.mapPanY = pan.panY
    }

    this.draw(width, height, altKm, verticalSpeedMs)
    this.rafId = requestAnimationFrame(() => this.loop())
  }

  private handleStageSeparation(stage: LaunchStage): void {
    const connectorTypes = new Set(['ring-connector', 'radial-connector'])

    for (const partId of stage.targetPartIds) {
      const connector = this.rocket.getPart(partId)
      if (!connector || !connectorTypes.has(connector.typeId) || !connector.connectorOpen) {
        continue
      }

      const detached = collectDetachedStageParts(connector, this.rocket.parts)
      if (detached.length === 0) continue

      for (const p of detached) p.detached = true

      const { centerX, bottomY } = this.rocket.bounds
      this.floatingStages.push(
        createFloatingStage(
          detached,
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

  private draw(width: number, height: number, altKm: number, verticalSpeedMs: number): void {
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
        this.cosmosSimTimeS,
      )
      return
    }

    const sky = this.ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#0a1628')
    sky.addColorStop(0.55, '#1a3a5c')
    sky.addColorStop(1, '#2d6a4f')
    this.ctx.fillStyle = sky
    this.ctx.fillRect(0, 0, width, height)

    this.drawSkyMoon(width, height, altKm)

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
      drawPart(this.ctx, instance, false, { ringSpan: part.ringSpan, physical: true })
      if (part.ignited && part.typeId === 'engine' && this.engineOn && this.throttle > 0) {
        this.drawEngineFlame(part)
      }
      if (part.parachuteDeployed && part.typeId === 'parachute') {
        this.drawDeployedParachute(part)
      }
    }

    const commandPod = this.rocket.parts.find(
      (p) => p.typeId === 'command-pod' && !p.detached,
    )
    if (commandPod) {
      const deployedChute = this.rocket.parts.find(
        (p) => p.typeId === 'parachute' && p.parachuteDeployed && !p.detached,
      )
      if (deployedChute) {
        this.drawParachuteRigging(deployedChute, commandPod)
      }
    }

    this.ctx.restore()
    this.ctx.restore()

    this.drawKarmanBanner(width, height, altKm)
    this.drawDescentWarning(width, height, altKm, verticalSpeedMs)
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
    const { earthRotation } = computeGeocentricState(this.cosmosSimTimeS)

    this.ctx.save()
    this.ctx.translate(cx, cy)
    this.ctx.rotate(earthRotation)

    this.ctx.fillStyle = '#1b4332'
    this.ctx.beginPath()
    this.ctx.arc(0, 0, earthR, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.fillStyle = '#74c69d'
    this.ctx.beginPath()
    this.ctx.arc(earthR * 0.55, 0, earthR * 0.08, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.strokeStyle = '#40916c'
    this.ctx.lineWidth = 3
    this.ctx.beginPath()
    this.ctx.arc(0, 0, earthR, Math.PI * 1.05, Math.PI * 1.95)
    this.ctx.stroke()

    this.ctx.restore()
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
      drawPart(this.ctx, part, false, { ringSpan: part.ringSpan, physical: true })
    }
    this.ctx.restore()
  }

  private drawParachuteRigging(
    chute: import('./rocket-body').FlightPartState,
    pod: import('./rocket-body').FlightPartState,
  ): void {
    const podDef = getPartDefinition('command-pod')
    const anchors = getCommandPodTopAnchors(pod.x, pod.y, podDef.width, podDef.height)
    const chuteDef = getPartDefinition('parachute')
    const cx = chute.x + chuteDef.width / 2
    const canopyBaseY = chute.y
    const expandR = chuteDef.width * 1.35
    const canopyR = expandR * 0.72
    const canopyY = canopyBaseY - canopyR * 0.55

    const rigPoints = [
      { x: anchors.leftX, y: anchors.topY },
      { x: anchors.centerX, y: anchors.topY },
      { x: anchors.rightX, y: anchors.topY },
    ]
    const canopyAttach = [
      { x: cx - expandR * 0.55, y: canopyY },
      { x: cx, y: canopyY - canopyR * 0.15 },
      { x: cx + expandR * 0.55, y: canopyY },
    ]

    this.ctx.strokeStyle = 'rgba(220, 220, 230, 0.75)'
    this.ctx.lineWidth = 1.2
    for (let i = 0; i < rigPoints.length; i++) {
      const from = rigPoints[i]!
      const to = canopyAttach[i]!
      this.ctx.beginPath()
      this.ctx.moveTo(from.x, from.y)
      this.ctx.lineTo(to.x, to.y)
      this.ctx.stroke()
    }
  }

  private drawDeployedParachute(part: import('./rocket-body').FlightPartState): void {
    const def = getPartDefinition(part.typeId)
    const cx = part.x + def.width / 2
    const baseY = part.y
    const expandR = def.width * 1.35
    const canopyR = expandR * 0.72
    const canopyCenterY = baseY - canopyR * 0.55

    this.ctx.fillStyle = 'rgba(255, 90, 90, 0.82)'
    this.ctx.beginPath()
    this.ctx.arc(cx, canopyCenterY + canopyR * 0.5, expandR, Math.PI, 0)
    this.ctx.closePath()
    this.ctx.fill()

    this.ctx.fillStyle = 'rgba(255, 180, 180, 0.45)'
    this.ctx.beginPath()
    this.ctx.arc(cx, canopyCenterY + canopyR * 0.5, canopyR, Math.PI, 0)
    this.ctx.closePath()
    this.ctx.fill()
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

  private applyMapZoom(nextZoom: number): void {
    this.mapZoom = clampMapZoom(nextZoom)
    if (this.viewMode !== 'map' || this.mapFocusTarget === 'free') {
      return
    }
    const layout = computeMapLayout(
      this.orbitTracker,
      this.flight,
      WORLD_PAD_X,
      WORLD_PAD_Y,
      this.cosmosSimTimeS,
    )
    const pan = panToFocusTarget(layout, this.mapFocusTarget, this.mapZoom)
    this.mapPanX = pan.panX
    this.mapPanY = pan.panY
  }

  private updateFlightHud(grounded?: boolean, verticalSpeedMs?: number): void {
    const onGround = grounded ?? this.flight.y >= WORLD_PAD_Y - 1
    const hud = resolveHudReadout(this.flight, onGround, this.cosmosSimTimeS)
    const vvel = verticalSpeedMs ?? this.flight.vy
    const speedEl = this.container.querySelector<HTMLElement>('#hud-speed')
    const altLabelEl = this.container.querySelector<HTMLElement>('#hud-alt-label')
    const altEl = this.container.querySelector<HTMLElement>('#hud-altitude')
    const vvelEl = this.container.querySelector<HTMLElement>('#hud-vvel')
    const chuteEl = this.container.querySelector<HTMLElement>('#hud-chute')
    const parachute = this.rocket.hasParachuteDeployed()
    if (speedEl) speedEl.textContent = `${hud.speedMs.toFixed(1)} m/s`
    if (altLabelEl) altLabelEl.textContent = hud.distanceLabel
    if (altEl) altEl.textContent = `${hud.distanceKm.toFixed(2)} km`
    if (vvelEl) {
      const label = vvel > 0.5 ? '↓' : vvel < -0.5 ? '↑' : ''
      vvelEl.textContent = `${label}${Math.abs(vvel).toFixed(1)} m/s`
      vvelEl.classList.toggle('flight-hud__val--warn', vvel > 20 && !parachute && !onGround)
    }
    if (chuteEl) {
      chuteEl.textContent = parachute ? '已展开' : '未展开'
      chuteEl.classList.toggle('flight-hud__val--ok', parachute)
    }
  }

  private drawSkyMoon(width: number, height: number, altKm: number): void {
    if (altKm < 35) return

    const { moonOrbitAngle } = computeGeocentricState(this.cosmosSimTimeS)
    const visibility = Math.min(1, (altKm - 35) / 50)
    const moonR = 10 + Math.min(8, altKm / 40)
    const moonX = width * (0.52 + Math.cos(moonOrbitAngle) * 0.32)
    const moonY = height * (0.14 + Math.sin(moonOrbitAngle) * 0.06)

    this.ctx.save()
    this.ctx.globalAlpha = visibility * 0.9
    this.ctx.fillStyle = 'rgba(220, 220, 235, 0.25)'
    this.ctx.beginPath()
    this.ctx.arc(moonX, moonY, moonR * 1.6, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.fillStyle = '#c8c8d8'
    this.ctx.beginPath()
    this.ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.fillStyle = 'rgba(200,200,220,0.7)'
    this.ctx.font = '10px system-ui'
    this.ctx.textAlign = 'center'
    this.ctx.fillText('月球', moonX, moonY + moonR + 12)
    this.ctx.restore()
  }

  private drawDescentWarning(
    width: number,
    _height: number,
    altKm: number,
    verticalSpeedMs: number,
  ): void {
    if (
      !needsParachuteAdvisory(
        altKm * 1000,
        verticalSpeedMs,
        this.rocket.hasParachuteDeployed(),
        this.flight.y >= WORLD_PAD_Y - 1,
      )
    ) {
      return
    }

    this.ctx.fillStyle = 'rgba(180, 60, 40, 0.88)'
    this.ctx.fillRect(width / 2 - 120, 38, 240, 22)
    this.ctx.fillStyle = '#ffe0d0'
    this.ctx.font = 'bold 11px system-ui'
    this.ctx.textAlign = 'center'
    this.ctx.fillText('⚠ 下降过快 — 展开降落伞', width / 2, 53)
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
