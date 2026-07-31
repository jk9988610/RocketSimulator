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
import { StageRunner } from './stage-runner'

export class LaunchScene {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly container: HTMLElement
  private rocket: FlightRocket
  private flight: FlightState
  private readonly stageRunner = new StageRunner()

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

  private readonly launchState: LaunchSequenceState
  private readonly onBack: () => void

  constructor(
    container: HTMLElement,
    rocket: FlightRocket,
    launchState: LaunchSequenceState,
    onBack: () => void,
  ) {
    this.container = container
    this.rocket = rocket
    this.launchState = launchState
    this.onBack = onBack

    const canvas = container.querySelector<HTMLCanvasElement>('#launch-canvas')
    if (!canvas) throw new Error('Launch canvas not found')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')

    this.canvas = canvas
    this.ctx = ctx

    const padX = 0
    const padY = 0
    this.flight = createInitialFlightState(padX, padY, rocket)
  }

  start(): void {
    this.resize()
    this.bindControls()
    this.bindPinchZoom()
    this.running = true
    this.lastTime = performance.now()
    this.loop()
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

    const padSurfaceY = rect.height * 0.72
    const padCenterX = rect.width / 2
    this.flight = createInitialFlightState(padCenterX, padSurfaceY, this.rocket)
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
      this.showStatus(`执行启动级 ${next.number}`)
      this.updateSequenceReadout(sequencePanel)
    })

    sequenceView.addEventListener('click', () => {
      sequencePanel.classList.toggle('sequence-readout--hidden')
      this.updateSequenceReadout(sequencePanel)
    })

    backBtn.addEventListener('click', () => {
      this.stop()
      this.onBack()
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
            const targets = stage.targetPartIds
              .map((id) => this.rocket.getPart(id))
              .filter(Boolean)
              .map((p) => getPartDefinition(p!.typeId).label)
              .join('、') || '无'
            return `
              <li class="sequence-readout__item ${done ? 'sequence-readout__item--done' : ''}">
                <span>级 ${stage.number}${done ? ' ✓' : ''}</span>
                <span class="sequence-readout__targets">${targets}</span>
              </li>
            `
          })
          .join('')}
      </ul>
    `
  }

  private showStatus(msg: string): void {
    this.statusMessage = msg
    this.statusTimer = 2
  }

  private bindPinchZoom(): void {
    this.canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault()
          const dist = Math.hypot(
            e.touches[0]!.clientX - e.touches[1]!.clientX,
            e.touches[0]!.clientY - e.touches[1]!.clientY,
          )
          if (this.lastPinchDist > 0) {
            const ratio = dist / this.lastPinchDist
            this.earthScale = Math.max(0.5, Math.min(3, this.earthScale * ratio))
          }
          this.lastPinchDist = dist
        }
      },
      { passive: false },
    )
    this.canvas.addEventListener('touchend', () => {
      this.lastPinchDist = 0
    })
  }

  private loop(): void {
    if (!this.running) return

    const now = performance.now()
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now

    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const padSurfaceY = height * 0.72
    const grounded = this.flight.y >= padSurfaceY - 1

    if (grounded) {
      this.flight.y = padSurfaceY
      if (this.flight.vy > 0) this.flight.vy = 0
      if (this.flight.vy === 0) this.flight.vx *= 0.92
    }

    const activeEngineIds = getActiveStageEngineIds(
      this.rocket,
      this.launchState.getStages(),
    )

    updateFlight(this.flight, this.rocket, dt, {
      throttle: this.throttle,
      engineOn: this.engineOn,
      activeEngineIds,
      tiltLeft: this.tiltLeft,
      tiltRight: this.tiltRight,
      grounded: grounded && this.flight.vy <= 0.01,
    })

    if (this.statusTimer > 0) this.statusTimer -= dt

    this.draw(width, height, padSurfaceY)
    this.rafId = requestAnimationFrame(() => this.loop())
  }

  private draw(width: number, height: number, padSurfaceY: number): void {
    const sky = this.ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#0a1628')
    sky.addColorStop(0.55, '#1a3a5c')
    sky.addColorStop(1, '#2d6a4f')
    this.ctx.fillStyle = sky
    this.ctx.fillRect(0, 0, width, height)

    this.drawEarth(width, padSurfaceY)
    this.drawLaunchPad(width, padSurfaceY)

    this.ctx.save()
    this.ctx.translate(this.flight.x, this.flight.y)
    this.ctx.rotate(this.flight.angle)
    this.ctx.translate(-this.rocket.bounds.centerX, -this.rocket.bounds.bottomY)

    for (const part of this.rocket.parts) {
      if (part.detached) continue
      const instance: PartInstance = part
      drawPart(this.ctx, instance, false)
      if (part.ignited && part.typeId === 'engine' && this.engineOn && this.throttle > 0) {
        this.drawEngineFlame(part)
      }
      if (part.parachuteDeployed && part.typeId === 'parachute') {
        this.ctx.strokeStyle = 'rgba(255, 120, 120, 0.6)'
        this.ctx.lineWidth = 2
        const def = getPartDefinition(part.typeId)
        this.ctx.strokeRect(part.x, part.y - 6, def.width, def.height + 6)
      }
    }

    this.ctx.restore()

    if (this.statusTimer > 0 && this.statusMessage) {
      this.ctx.fillStyle = 'rgba(0,0,0,0.6)'
      this.ctx.fillRect(width / 2 - 100, 48, 200, 28)
      this.ctx.fillStyle = '#ffd23c'
      this.ctx.font = '13px system-ui'
      this.ctx.textAlign = 'center'
      this.ctx.fillText(this.statusMessage, width / 2, 66)
    }
  }

  private drawEarth(width: number, padSurfaceY: number): void {
    const cx = width / 2
    const earthR = width * 1.2 * this.earthScale
    const cy = padSurfaceY + earthR - 40

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

  private drawLaunchPad(width: number, padSurfaceY: number): void {
    const padW = 180
    const topW = 100
    const h = 36
    const cx = width / 2

    this.ctx.fillStyle = '#555568'
    this.ctx.beginPath()
    this.ctx.moveTo(cx - topW / 2, padSurfaceY)
    this.ctx.lineTo(cx + topW / 2, padSurfaceY)
    this.ctx.lineTo(cx + padW / 2, padSurfaceY + h)
    this.ctx.lineTo(cx - padW / 2, padSurfaceY + h)
    this.ctx.closePath()
    this.ctx.fill()

    this.ctx.strokeStyle = '#888898'
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(cx - topW / 2, padSurfaceY)
    this.ctx.lineTo(cx + topW / 2, padSurfaceY)
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
}
