import { createLayout } from '../ui/layout'
import { AssemblyCanvas } from '../ui/assembly-canvas'

export function initApp(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  const { assemblyArea, symmetryToggle, launchSequenceBtn } = createLayout(root)

  const canvas = new AssemblyCanvas(assemblyArea)
  canvas.start()

  symmetryToggle.addEventListener('click', () => {
    const enabled = symmetryToggle.dataset.enabled === 'true'
    symmetryToggle.dataset.enabled = String(!enabled)
    symmetryToggle.classList.toggle('active', !enabled)
    symmetryToggle.textContent = !enabled ? '对称：开' : '对称：关'
    canvas.setSymmetryVisible(!enabled)
  })

  launchSequenceBtn.addEventListener('click', () => {
    launchSequenceBtn.classList.toggle('active')
  })

  window.addEventListener('resize', () => canvas.resize())
}
