import type { AssemblyCanvas } from './assembly-canvas'
import { DragGhost } from './drag-ghost'
import type { PartTypeId } from '../parts/types'

const DRAG_THRESHOLD = 6

export function bindPartsPanelDrag(
  panel: HTMLElement,
  canvas: AssemblyCanvas,
): void {
  const ghost = new DragGhost()
  const list = panel.querySelector<HTMLElement>('.parts-list')
  if (!list) return

  let activeTypeId: PartTypeId | null = null
  let pointerId: number | null = null
  let activeItem: HTMLElement | null = null
  let startX = 0
  let startY = 0
  let dragStarted = false

  const cleanup = (): void => {
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerUp, true)
    activeItem?.classList.remove('dragging')
    ghost.hide()
    activeTypeId = null
    pointerId = null
    activeItem = null
    dragStarted = false
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (activeTypeId === null || e.pointerId !== pointerId) return

    e.preventDefault()
    e.stopPropagation()

    const dist = Math.hypot(e.clientX - startX, e.clientY - startY)
    if (!dragStarted && dist < DRAG_THRESHOLD) return

    if (!dragStarted) {
      dragStarted = true
      ghost.start(activeTypeId)
      canvas.beginPlaceDrag(activeTypeId, e.clientX, e.clientY)
    }

    ghost.move(activeTypeId, e.clientX, e.clientY)
    canvas.updatePlaceDrag(e.clientX, e.clientY)
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (activeTypeId === null || e.pointerId !== pointerId) return

    e.preventDefault()
    e.stopPropagation()

    if (dragStarted) {
      canvas.endPlaceDrag(e.clientX, e.clientY)
    } else {
      canvas.cancelPlaceDrag()
    }

    cleanup()
  }

  list.addEventListener(
    'pointerdown',
    (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.parts-list__item')
      if (!item || !list.contains(item)) return

      const typeId = item.dataset.partId as PartTypeId | undefined
      if (!typeId) return

      e.preventDefault()
      e.stopPropagation()

      activeTypeId = typeId
      pointerId = e.pointerId
      activeItem = item
      startX = e.clientX
      startY = e.clientY
      dragStarted = false

      item.classList.add('dragging')

      window.addEventListener('pointermove', onPointerMove, { capture: true, passive: false })
      window.addEventListener('pointerup', onPointerUp, { capture: true })
      window.addEventListener('pointercancel', onPointerUp, { capture: true })
    },
    { passive: false },
  )
}
