import { getPartDefinition } from '../parts/definitions'
import { renderPartPreviewCanvas1to1 } from '../parts/render'
import type { PartTypeId } from '../parts/types'

export class DragGhost {
  private readonly el: HTMLDivElement
  private readonly canvas: HTMLCanvasElement
  private cacheKey = ''
  private dragging = false

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'drag-ghost'
    this.canvas = document.createElement('canvas')
    this.el.appendChild(this.canvas)
    document.body.appendChild(this.el)
    this.hide()
  }

  start(typeId: PartTypeId): void {
    this.dragging = true
    this.ensurePreview(typeId)
    this.el.style.display = 'block'
    document.body.classList.add('is-dragging-part')
  }

  move(_typeId: PartTypeId, clientX: number, clientY: number): void {
    if (!this.dragging) return
    this.el.style.left = `${clientX}px`
    this.el.style.top = `${clientY}px`
  }

  hide(): void {
    this.dragging = false
    this.el.style.display = 'none'
    document.body.classList.remove('is-dragging-part')
  }

  private ensurePreview(typeId: PartTypeId): void {
    if (this.cacheKey === typeId) return

    const def = getPartDefinition(typeId)
    const preview = renderPartPreviewCanvas1to1(typeId)
    this.canvas.width = preview.width
    this.canvas.height = preview.height
    const ctx = this.canvas.getContext('2d')!
    ctx.clearRect(0, 0, preview.width, preview.height)
    ctx.drawImage(preview, 0, 0)
    this.el.style.width = `${def.width}px`
    this.el.style.height = `${def.height}px`
    this.cacheKey = typeId
  }

  destroy(): void {
    this.hide()
    this.el.remove()
  }
}
