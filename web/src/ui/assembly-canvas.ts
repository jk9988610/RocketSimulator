import { AssemblyState } from '../assembly/assembly-state'
import { GRID_SIZE, snapPoint } from '../assembly/grid'
import { getPartDefinition } from '../parts/definitions'
import { drawPart } from '../parts/render'
import type { PartInstance, PartTypeId, PointerPosition } from '../parts/types'

type DragMode = 'none' | 'move' | 'place'

interface DragState {
  mode: DragMode
  partTypeId?: PartTypeId
  startPointer: PointerPosition
  lastPointer: PointerPosition
  moved: boolean
  hitId?: string
  wasSelectedOnDown: boolean
}

export class AssemblyCanvas {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly container: HTMLElement
  private readonly state: AssemblyState
  private symmetryVisible = false
  private rafId = 0
  private drag: DragState = {
    mode: 'none',
    startPointer: { x: 0, y: 0 },
    lastPointer: { x: 0, y: 0 },
    moved: false,
    wasSelectedOnDown: false,
  }
  private ghostPosition: PointerPosition | null = null

  constructor(container: HTMLElement, state: AssemblyState) {
    this.container = container
    this.state = state

    const canvas = container.querySelector<HTMLCanvasElement>('#assembly-canvas')
    if (!canvas) throw new Error('Assembly canvas not found')

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')

    this.canvas = canvas
    this.ctx = ctx
  }

  getState(): AssemblyState {
    return this.state
  }

  start(): void {
    this.resize()
    this.bindEvents()
    this.draw()
  }

  resize(): void {
    const { width, height } = this.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    this.canvas.width = Math.floor(width * dpr)
    this.canvas.height = Math.floor(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    this.state.updateMirrorsAxis(this.getAxisX())
    this.draw()
  }

  setSymmetryVisible(visible: boolean): void {
    this.symmetryVisible = visible
    this.draw()
  }

  beginPlaceDrag(typeId: PartTypeId, clientX: number, clientY: number): void {
    const pointer = this.clientToCanvas(clientX, clientY)
    this.drag = {
      mode: 'place',
      partTypeId: typeId,
      startPointer: pointer,
      lastPointer: pointer,
      moved: false,
      wasSelectedOnDown: false,
    }
    this.ghostPosition = pointer
    this.draw()
  }

  updatePlaceDrag(clientX: number, clientY: number): void {
    if (this.drag.mode !== 'place') return
    const pointer = this.clientToCanvas(clientX, clientY)
    this.ghostPosition = pointer
    this.drag.lastPointer = pointer
    this.drag.moved = true
    this.draw()
  }

  endPlaceDrag(clientX: number, clientY: number): void {
    if (this.drag.mode !== 'place' || !this.drag.partTypeId) return

    const rect = this.canvas.getBoundingClientRect()
    const inside =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom

    if (inside) {
      const pointer = this.clientToCanvas(clientX, clientY)
      const def = getPartDefinition(this.drag.partTypeId)
      this.state.addPart(
        this.drag.partTypeId,
        pointer.x - def.width / 2,
        pointer.y - def.height / 2,
        this.getAxisX(),
      )
    }

    this.drag = {
      mode: 'none',
      startPointer: { x: 0, y: 0 },
      lastPointer: { x: 0, y: 0 },
      moved: false,
      wasSelectedOnDown: false,
    }
    this.ghostPosition = null
    this.draw()
  }

  cancelPlaceDrag(): void {
    this.drag = {
      mode: 'none',
      startPointer: { x: 0, y: 0 },
      lastPointer: { x: 0, y: 0 },
      moved: false,
      wasSelectedOnDown: false,
    }
    this.ghostPosition = null
    this.draw()
  }

  private bindEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.drag.mode === 'place') return

    const pointer = this.clientToCanvas(e.clientX, e.clientY)
    const hit = this.state.hitTest(pointer)

    if (hit) {
      const wasSelected = this.state.isSelected(hit.id)
      if (!wasSelected) {
        this.state.toggleSelection(hit.id)
      }

      this.drag = {
        mode: 'move',
        startPointer: pointer,
        lastPointer: pointer,
        moved: false,
        hitId: hit.id,
        wasSelectedOnDown: wasSelected,
      }
      this.canvas.setPointerCapture(e.pointerId)
      this.draw()
    } else {
      this.state.clearSelection()
      this.draw()
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.drag.mode === 'place') return

    if (this.drag.mode === 'move') {
      const pointer = this.clientToCanvas(e.clientX, e.clientY)
      const dx = pointer.x - this.drag.lastPointer.x
      const dy = pointer.y - this.drag.lastPointer.y

      if (dx !== 0 || dy !== 0) {
        const ids = [...this.state.getSelectedIds()]
        this.state.moveParts(ids, dx, dy, this.getAxisX())
        this.drag.lastPointer = pointer
        this.drag.moved = true
        this.draw()
      }
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.drag.mode === 'move') {
      if (!this.drag.moved && this.drag.wasSelectedOnDown && this.drag.hitId) {
        this.state.toggleSelection(this.drag.hitId)
        this.draw()
      }
      this.canvas.releasePointerCapture(e.pointerId)
    }

    this.drag = {
      mode: 'none',
      startPointer: { x: 0, y: 0 },
      lastPointer: { x: 0, y: 0 },
      moved: false,
      wasSelectedOnDown: false,
    }
  }

  private clientToCanvas(clientX: number, clientY: number): PointerPosition {
    const rect = this.canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  private getAxisX(): number {
    return this.canvas.clientWidth / 2
  }

  private draw(): void {
    cancelAnimationFrame(this.rafId)
    this.rafId = requestAnimationFrame(() => {
      const width = this.canvas.clientWidth
      const height = this.canvas.clientHeight

      this.ctx.fillStyle = '#000000'
      this.ctx.fillRect(0, 0, width, height)

      this.drawGrid(width, height)

      if (this.symmetryVisible) {
        this.drawSymmetryAxis(width, height)
      }

      for (const part of this.state.getParts()) {
        drawPart(this.ctx, part, this.state.isSelected(part.id))
      }

      if (this.drag.mode === 'place' && this.drag.partTypeId && this.ghostPosition) {
        this.drawGhost(this.drag.partTypeId, this.ghostPosition)
      }
    })
  }

  private drawGrid(width: number, height: number): void {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    this.ctx.lineWidth = 1

    for (let x = 0; x <= width; x += GRID_SIZE) {
      this.ctx.beginPath()
      this.ctx.moveTo(x + 0.5, 0)
      this.ctx.lineTo(x + 0.5, height)
      this.ctx.stroke()
    }

    for (let y = 0; y <= height; y += GRID_SIZE) {
      this.ctx.beginPath()
      this.ctx.moveTo(0, y + 0.5)
      this.ctx.lineTo(width, y + 0.5)
      this.ctx.stroke()
    }
  }

  private drawSymmetryAxis(width: number, height: number): void {
    const centerX = width / 2

    this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)'
    this.ctx.lineWidth = 1
    this.ctx.setLineDash([6, 6])
    this.ctx.beginPath()
    this.ctx.moveTo(centerX + 0.5, 0)
    this.ctx.lineTo(centerX + 0.5, height)
    this.ctx.stroke()
    this.ctx.setLineDash([])
  }

  private drawGhost(typeId: PartTypeId, pointer: PointerPosition): void {
    const def = getPartDefinition(typeId)
    const snapped = snapPoint(pointer.x - def.width / 2, pointer.y - def.height / 2)
    const ghost: PartInstance = {
      id: 'ghost',
      typeId,
      x: snapped.x,
      y: snapped.y,
    }
    this.ctx.globalAlpha = 0.55
    drawPart(this.ctx, ghost, false)
    this.ctx.globalAlpha = 1
  }
}
