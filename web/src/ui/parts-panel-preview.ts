import { PART_LIST } from '../parts/definitions'
import { renderPartPreviewCanvas } from '../parts/render'

export function initPartsPanelPreviews(panel: HTMLElement): void {
  panel.querySelectorAll<HTMLElement>('.parts-list__item').forEach((item) => {
    const typeId = item.dataset.partId
    if (!typeId) return

    const slot = item.querySelector<HTMLElement>('.parts-list__preview')
    if (!slot) return

    const canvas = renderPartPreviewCanvas(typeId as import('../parts/types').PartTypeId, 32)
    canvas.className = 'parts-list__preview-canvas'
    slot.replaceChildren(canvas)
  })
}

export function getPartLabels(): typeof PART_LIST {
  return PART_LIST
}
