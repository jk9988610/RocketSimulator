import { AssemblyState } from '../assembly/assembly-state'
import { createLayout } from '../ui/layout'
import { AssemblyCanvas } from '../ui/assembly-canvas'
import { bindPartsPanelDrag } from '../ui/parts-panel-drag'

export function initApp(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  const { assemblyArea, partsPanel, symmetryToggle, launchSequenceBtn } =
    createLayout(root)

  const state = new AssemblyState()
  const canvas = new AssemblyCanvas(assemblyArea, state)
  canvas.start()

  bindPartsPanelDrag(partsPanel, canvas)

  symmetryToggle.addEventListener('click', () => {
    const enabled = symmetryToggle.dataset.enabled === 'true'
    const next = !enabled
    const axisX = assemblyArea.clientWidth / 2

    symmetryToggle.dataset.enabled = String(next)
    symmetryToggle.classList.toggle('active', next)
    symmetryToggle.textContent = next ? '对称：开' : '对称：关'
    state.setSymmetryEnabled(next, axisX)
    canvas.setSymmetryVisible(next)
    canvas.resize()
  })

  launchSequenceBtn.addEventListener('click', () => {
    launchSequenceBtn.classList.toggle('active')
  })

  window.addEventListener('resize', () => canvas.resize())
}
