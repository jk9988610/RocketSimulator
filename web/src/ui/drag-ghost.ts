import { getPartDefinition } from '../parts/definitions'
import { renderPartPreviewCanvas } from '../parts/render'
import type { PartTypeId } from '../parts/types'

export class DragGhost {
  private readonly el: HTMLDivElement
  private readonly canvas: HTMLCanvasElement

  constructor() {
    this.el = document.createElement('div')
    this.el.className = 'drag-ghost'
    this.canvas = document.createElement('canvas')
    this.el.appendChild(this.canvas)
    document.body.appendChild(this.el)
    this.hide()
  }

  update(typeId: PartTypeId, clientX: number, clientY: number): void {
    const def = getPartDefinition(typeId)
    const preview = renderPartPreviewCanvas(typeId, Math.max(def.width, def.height) + 16)
    this.canvas.width = preview.width
    this.canvas.height = preview.height
    const ctx = this.canvas.getContext('2d')!
    ctx.clearRect(0, 0, preview.width, preview.height)
    ctx.drawImage(preview, 0, 0)

    this.el.style.display = 'block'
    this.el.style.left = `${clientX}px`
    this.el.style.top = `${clientY}px`
    this.el.style.transform = 'translate(-50%, -50%)'
    this.el.style.width = `${preview.width}px`
    this.el.style.height = `${preview.height}px`
  }

  hide(): void {
    this.el.style.display = 'none'
  }

  destroy(): void {
    this.el.remove()
  }
}
