import type { AssemblyCanvas } from './assembly-canvas'
import type { PartTypeId } from '../parts/types'

export function bindPartsPanelDrag(
  panel: HTMLElement,
  canvas: AssemblyCanvas,
): void {
  let activeTypeId: PartTypeId | null = null
  let pointerId: number | null = null
  let activeItem: HTMLElement | null = null

  const onPointerMove = (e: PointerEvent): void => {
    if (activeTypeId === null || e.pointerId !== pointerId) return
    canvas.updatePlaceDrag(e.clientX, e.clientY)
  }

  const onPointerEnd = (e: PointerEvent): void => {
    if (activeTypeId === null || e.pointerId !== pointerId) return

    canvas.endPlaceDrag(e.clientX, e.clientY)
    activeItem?.classList.remove('dragging')

    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerEnd)
    document.removeEventListener('pointercancel', onPointerEnd)

    activeTypeId = null
    pointerId = null
    activeItem = null
  }

  panel.querySelectorAll<HTMLElement>('.parts-list__item').forEach((item) => {
    item.addEventListener('pointerdown', (e) => {
      const typeId = item.dataset.partId as PartTypeId | undefined
      if (!typeId) return

      e.preventDefault()
      activeTypeId = typeId
      pointerId = e.pointerId
      activeItem = item
      item.setPointerCapture(e.pointerId)
      item.classList.add('dragging')
      canvas.beginPlaceDrag(typeId, e.clientX, e.clientY)

      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', onPointerEnd)
      document.addEventListener('pointercancel', onPointerEnd)
    })
  })
}
