import { PART_LIST } from '../parts/definitions'
import { renderPartPreviewCanvas1to1 } from '../parts/render'
import type { PartTypeId } from '../parts/types'

export function initPartsPanelPreviews(panel: HTMLElement): void {
  panel.querySelectorAll<HTMLElement>('.inventory-item').forEach((item) => {
    const typeId = item.dataset.partId as PartTypeId | undefined
    if (!typeId) return

    const slot = item.querySelector<HTMLElement>('.inventory-item__preview')
    if (!slot) return

    const canvas = renderPartPreviewCanvas1to1(typeId)
    canvas.className = 'inventory-item__canvas'
    slot.replaceChildren(canvas)
  })
}

export { PART_LIST }
