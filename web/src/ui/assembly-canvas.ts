import { AssemblyState } from '../assembly/assembly-state'
import { isLaunchTargetType } from '../assembly/launch-sequence'
import { findSnapPair, getConnectorsForPart } from '../parts/connection-points'
import { GRID_SIZE, snapPoint } from '../assembly/grid'
import { getPartDefinition } from '../parts/definitions'
import { drawPart } from '../parts/render'
import type { PartInstance, PartTypeId, PointerPosition } from '../parts/types'

const VIEW_ZOOM_MIN = 0.45
const VIEW_ZOOM_MAX = 2.8
const WORKSPACE_HEIGHT = 2200
const VIEW_PAN_MARGIN = 160

type DragMode = 'none' | 'move' | 'place' | 'pan'

interface DragState {
  mode: DragMode
  partTypeId?: PartTypeId
  startPointer: PointerPosition
  lastPointer: PointerPosition
  moved: boolean
  hitId?: string
  wasSelectedOnDown: boolean
}

type InteractionMode = 'assembly' | 'pick-target'

export interface AssemblyCanvasOptions {
  onPartPicked?: (partId: string) => void
  getLaunchTargetIds?: () => Set<string>
  onAssemblyChange?: () => void
  recycleZone?: HTMLElement
  onPartsRecycled?: (partIds: string[]) => void
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
  private interactionMode: InteractionMode = 'assembly'
  private readonly options: AssemblyCanvasOptions
  private viewZoom = 1
  private viewPanY = 0
  private lastPinchDist = 0

  constructor(
    container: HTMLElement,
    state: AssemblyState,
    options: AssemblyCanvasOptions = {},
  ) {
    this.container = container
    this.state = state
    this.options = options

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

  setInteractionMode(mode: InteractionMode): void {
    this.interactionMode = mode
    this.state.clearSelection()
    this.draw()
  }

  getInteractionMode(): InteractionMode {
    return this.interactionMode
  }

  redraw(): void {
    this.draw()
  }

  beginPlaceDrag(typeId: PartTypeId, clientX: number, clientY: number): void {
    if (this.interactionMode !== 'assembly') return
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

    const rect = this.container.getBoundingClientRect()
    const inside =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom

    if (inside) {
      const pointer = this.clientToCanvas(clientX, clientY)
      const def = getPartDefinition(this.drag.partTypeId)
      const part = this.state.addPart(
        this.drag.partTypeId,
        pointer.x - def.width / 2,
        pointer.y - def.height / 2,
        this.getAxisX(),
      )
      this.state.finalizeMove([part.id], this.getAxisX())
      this.options.onAssemblyChange?.()
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
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const rect = this.canvas.getBoundingClientRect()
        const sx = e.clientX - rect.left
        const sy = e.clientY - rect.top
        const worldBefore = this.screenToWorld(sx, sy)
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        const nextZoom = Math.max(
          VIEW_ZOOM_MIN,
          Math.min(VIEW_ZOOM_MAX, this.viewZoom * factor),
        )
        const height = this.canvas.clientHeight
        const cy = height / 2
        this.viewPanY = sy - (worldBefore.y - cy) * nextZoom - cy
        this.viewZoom = nextZoom
        this.clampViewPanY()
        this.draw()
      },
      { passive: false },
    )
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
          const rect = this.canvas.getBoundingClientRect()
          const sx =
            (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - rect.left
          const sy =
            (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - rect.top
          const worldBefore = this.screenToWorld(sx, sy)
          const nextZoom = Math.max(
            VIEW_ZOOM_MIN,
            Math.min(VIEW_ZOOM_MAX, this.viewZoom * ratio),
          )
          const height = this.canvas.clientHeight
          const cy = height / 2
          this.viewPanY = sy - (worldBefore.y - cy) * nextZoom - cy
          this.viewZoom = nextZoom
          this.clampViewPanY()
          this.draw()
        }
        this.lastPinchDist = dist
      },
      { passive: false },
    )
    this.canvas.addEventListener('touchend', () => {
      this.lastPinchDist = 0
    })
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (this.drag.mode === 'place') return

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.drag = {
        mode: 'pan',
        startPointer: { x: e.clientX, y: e.clientY },
        lastPointer: { x: e.clientX, y: e.clientY },
        moved: false,
        wasSelectedOnDown: false,
      }
      this.canvas.setPointerCapture(e.pointerId)
      return
    }

    if (e.button !== 0) return

    const pointer = this.clientToCanvas(e.clientX, e.clientY)

    if (this.interactionMode === 'pick-target') {
      const hit = this.state.hitTestAny(pointer)
      if (hit && isLaunchTargetType(hit.typeId)) {
        this.options.onPartPicked?.(hit.id)
      }
      return
    }

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
    if (this.drag.mode === 'place' || this.interactionMode === 'pick-target') return

    if (this.drag.mode === 'pan') {
      const dy = e.clientY - this.drag.lastPointer.y
      if (dy !== 0) {
        this.viewPanY += dy
        this.clampViewPanY()
        this.drag.lastPointer = { x: e.clientX, y: e.clientY }
        this.drag.moved = true
        this.draw()
      }
      return
    }

    if (this.drag.mode === 'move') {
      const pointer = this.clientToCanvas(e.clientX, e.clientY)
      const dx = pointer.x - this.drag.lastPointer.x
      const dy = pointer.y - this.drag.lastPointer.y

      if (dx !== 0 || dy !== 0) {
        const ids = [...this.state.getSelectedIds()]
        this.state.moveParts(ids, dx, dy, this.getAxisX())
        this.drag.lastPointer = pointer
        this.drag.moved = true
        this.options.onAssemblyChange?.()
        this.draw()
      }
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.drag.mode === 'pan') {
      this.canvas.releasePointerCapture(e.pointerId)
      this.drag = {
        mode: 'none',
        startPointer: { x: 0, y: 0 },
        lastPointer: { x: 0, y: 0 },
        moved: false,
        wasSelectedOnDown: false,
      }
      return
    }

    if (this.drag.mode === 'move') {
      if (this.drag.moved) {
        const recycleZone = this.options.recycleZone
        const overRecycle =
          recycleZone !== undefined &&
          this.isPointerOver(recycleZone, e.clientX, e.clientY)

        if (overRecycle) {
          const ids = [...this.state.getSelectedIds()].filter((id) => {
            const part = this.state.getPartById(id)
            return part && !part.mirrorOf
          })
          const removed = this.state.removeParts(ids)
          if (removed.length > 0) {
            this.options.onPartsRecycled?.(removed)
            this.options.onAssemblyChange?.()
          }
        } else {
          const ids = [...this.state.getSelectedIds()]
          this.state.finalizeMove(ids, this.getAxisX())
          this.options.onAssemblyChange?.()
        }
      } else if (!this.drag.moved && this.drag.wasSelectedOnDown && this.drag.hitId) {
        this.state.toggleSelection(this.drag.hitId)
      }
      this.canvas.releasePointerCapture(e.pointerId)
      this.draw()
    }

    this.drag = {
      mode: 'none',
      startPointer: { x: 0, y: 0 },
      lastPointer: { x: 0, y: 0 },
      moved: false,
      wasSelectedOnDown: false,
    }
  }

  private isPointerOver(el: HTMLElement, clientX: number, clientY: number): boolean {
    const rect = el.getBoundingClientRect()
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    )
  }

  private clientToCanvas(clientX: number, clientY: number): PointerPosition {
    const rect = this.canvas.getBoundingClientRect()
    return this.screenToWorld(clientX - rect.left, clientY - rect.top)
  }

  private screenToWorld(sx: number, sy: number): PointerPosition {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const cx = width / 2
    const cy = height / 2
    return {
      x: (sx - cx) / this.viewZoom + cx,
      y: (sy - this.viewPanY - cy) / this.viewZoom + cy,
    }
  }

  private clampViewPanY(): void {
    const height = this.canvas.clientHeight
    const scaledWorkspace = WORKSPACE_HEIGHT * this.viewZoom
    const maxPanDown = height * 0.3
    const maxPanUp = Math.min(
      -(scaledWorkspace - height + VIEW_PAN_MARGIN),
      -VIEW_PAN_MARGIN * 0.25,
    )
    this.viewPanY = Math.max(maxPanUp, Math.min(maxPanDown, this.viewPanY))
  }

  private applyViewTransform(width: number, height: number): void {
    const cx = width / 2
    const cy = height / 2
    this.ctx.translate(0, this.viewPanY)
    this.ctx.translate(cx, cy)
    this.ctx.scale(this.viewZoom, this.viewZoom)
    this.ctx.translate(-cx, -cy)
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

      this.ctx.save()
      this.applyViewTransform(width, height)

      this.drawGrid(width)

      if (this.symmetryVisible) {
        this.drawSymmetryAxis(width, height)
      }

      for (const part of this.state.getParts()) {
        if (part.envelopedBy) continue
        const isSelected = this.state.isSelected(part.id)

        const isLaunchTarget = this.options.getLaunchTargetIds?.().has(part.id) ?? false
        const isEligible =
          this.interactionMode === 'pick-target' && isLaunchTargetType(part.typeId)

        drawPart(this.ctx, part, false, {
          ringSpan: part.ringSpan,
          physical: true,
        })

        if (this.interactionMode === 'assembly' && isSelected) {
          this.drawSelectionOutline(part)
        }
        if (this.interactionMode === 'pick-target' && isLaunchTarget) {
          this.drawLaunchTargetOutline(part)
        }
        if (this.interactionMode === 'pick-target' && isEligible && !isLaunchTarget) {
          this.drawEligibleOutline(part)
        }
      }

      if (this.interactionMode === 'assembly' && this.drag.mode === 'move' && this.drag.moved) {
        this.drawSnapPreview()
      }

      if (this.drag.mode === 'place' && this.drag.partTypeId && this.ghostPosition) {
        this.drawGhost(this.drag.partTypeId, this.ghostPosition)
      }

      this.drawSymmetryGhosts()

      this.ctx.restore()
    })
  }

  private drawSymmetryGhosts(): void {
    if (!this.state.symmetryEnabled) return
    const axisX = this.getAxisX()

    this.ctx.globalAlpha = 0.42

    if (this.drag.mode === 'place' && this.drag.partTypeId && this.ghostPosition && this.drag.moved) {
      const def = getPartDefinition(this.drag.partTypeId)
      const snapped = snapPoint(
        this.ghostPosition.x - def.width / 2,
        this.ghostPosition.y - def.height / 2,
      )
      const fake: PartInstance = {
        id: '_mirror',
        typeId: this.drag.partTypeId,
        x: snapped.x,
        y: snapped.y,
      }
      const pos = this.state.getMirrorPreviewPosition(fake, axisX)
      if (pos) {
        drawPart(this.ctx, { ...fake, x: pos.x, y: pos.y }, false)
      }
    }

    if (this.drag.mode === 'move' && this.drag.moved) {
      for (const part of this.state.getSelectedParts()) {
        if (part.mirrorOf || this.state.hasMirror(part.id)) continue
        const pos = this.state.getMirrorPreviewPosition(part, axisX)
        if (pos) {
          drawPart(this.ctx, { ...part, x: pos.x, y: pos.y }, false, {
            ringSpan: part.ringSpan,
            physical: true,
          })
        }
      }
    }

    this.ctx.globalAlpha = 1
  }

  private drawGrid(width: number): void {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    this.ctx.lineWidth = 1 / this.viewZoom

    const gridExtent = Math.max(width, WORKSPACE_HEIGHT) + GRID_SIZE * 4
    const startY = -GRID_SIZE * 2
    const endY = gridExtent

    for (let x = 0; x <= width; x += GRID_SIZE) {
      this.ctx.beginPath()
      this.ctx.moveTo(x + 0.5 / this.viewZoom, startY)
      this.ctx.lineTo(x + 0.5 / this.viewZoom, endY)
      this.ctx.stroke()
    }

    for (let y = startY; y <= endY; y += GRID_SIZE) {
      this.ctx.beginPath()
      this.ctx.moveTo(0, y + 0.5 / this.viewZoom)
      this.ctx.lineTo(width, y + 0.5 / this.viewZoom)
      this.ctx.stroke()
    }

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    this.ctx.setLineDash([8 / this.viewZoom, 8 / this.viewZoom])
    this.ctx.beginPath()
    this.ctx.moveTo(0, WORKSPACE_HEIGHT)
    this.ctx.lineTo(width, WORKSPACE_HEIGHT)
    this.ctx.stroke()
    this.ctx.setLineDash([])
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

  private partDrawHeight(part: PartInstance): number {
    const def = getPartDefinition(part.typeId)
    return part.ringSpan ?? def.height
  }

  private drawSelectionOutline(part: PartInstance): void {
    const def = getPartDefinition(part.typeId)
    const h = this.partDrawHeight(part)
    this.ctx.strokeStyle = 'rgba(59, 158, 255, 0.85)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([5, 4])
    this.ctx.strokeRect(part.x - 2, part.y - 2, def.width + 4, h + 4)
    this.ctx.setLineDash([])
  }

  private drawLaunchTargetOutline(part: PartInstance): void {
    const def = getPartDefinition(part.typeId)
    const h = this.partDrawHeight(part)
    this.ctx.strokeStyle = 'rgba(80, 220, 120, 0.9)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([4, 4])
    this.ctx.strokeRect(part.x - 2, part.y - 2, def.width + 4, h + 4)
    this.ctx.setLineDash([])
  }

  private drawEligibleOutline(part: PartInstance): void {
    const def = getPartDefinition(part.typeId)
    const h = this.partDrawHeight(part)
    this.ctx.strokeStyle = 'rgba(255, 210, 60, 0.75)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([4, 4])
    this.ctx.strokeRect(part.x - 1, part.y - 1, def.width + 2, h + 2)
    this.ctx.setLineDash([])
  }

  private drawSnapPreview(): void {
    const selected = this.state.getSelectedParts().filter((p) => !p.mirrorOf)
    if (selected.length === 0) return

    const anchor = selected[0]!
    const others = this.state.getParts().filter((p) => !this.state.isSelected(p.id))
    const pair = findSnapPair(anchor, others)
    if (!pair) return

    const connectors = getConnectorsForPart(anchor)
    this.ctx.strokeStyle = 'rgba(80, 220, 120, 0.8)'
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([4, 4])
    for (const c of connectors) {
      this.ctx.beginPath()
      this.ctx.moveTo(c.x, c.y)
      this.ctx.lineTo(c.x + pair.dx, c.y + pair.dy)
      this.ctx.stroke()
    }
    this.ctx.setLineDash([])
  }

  private drawGhost(typeId: PartTypeId, pointer: PointerPosition): void {
    const def = getPartDefinition(typeId)
    const snapped = snapPoint(pointer.x - def.width / 2, pointer.y - def.height / 2)
    this.ctx.globalAlpha = 0.45
    drawPart(this.ctx, { id: 'ghost', typeId, x: snapped.x, y: snapped.y }, false, {
      physical: true,
    })
    this.ctx.globalAlpha = 1
  }
}
