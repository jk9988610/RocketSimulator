import { AssemblyState } from '../assembly/assembly-state'
import { LaunchSequenceState } from '../assembly/launch-sequence'
import {
  buildRocketDesign,
  createAutoSave,
  loadRocketDesign,
} from '../assembly/rocket-design'
import { createLayout, setSidePanelMode, type SidePanelMode } from '../ui/layout'
import { AssemblyCanvas } from '../ui/assembly-canvas'
import { bindPartsPanelDrag } from '../ui/parts-panel-drag'
import { LaunchSequencePanel } from '../ui/launch-sequence-panel'

export function initApp(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  const layout = createLayout(root)
  const assemblyState = new AssemblyState()
  const launchState = new LaunchSequenceState()

  let panelMode: SidePanelMode = 'parts'
  let launchPanel!: LaunchSequencePanel
  const pickHint = layout.assemblyArea.querySelector('#pick-hint')!

  const triggerSave = createAutoSave(() =>
    buildRocketDesign(assemblyState, launchState.exportData()),
  )

  const canvas = new AssemblyCanvas(layout.assemblyArea, assemblyState, {
    getLaunchTargetIds: () => launchState.getAllTargetPartIds(),
    onAssemblyChange: triggerSave,
    onPartPicked: (partId) => {
      if (launchPanel.handlePartPicked(partId)) {
        canvas.redraw()
      }
    },
  })

  launchPanel = new LaunchSequencePanel({
    container: layout.launchSequenceView,
    launchState,
    assemblyState,
    onPickTarget: (stageId) => {
      const picking = stageId !== null
      canvas.setInteractionMode(picking ? 'pick-target' : 'assembly')
      pickHint.classList.toggle('pick-hint--hidden', !picking)
      layout.assemblyArea.classList.toggle('assembly-area--picking', picking)
      canvas.redraw()
    },
    onChange: () => {
      canvas.redraw()
      triggerSave()
    },
  })

  canvas.start()
  bindPartsPanelDrag(layout.partsPanel, canvas)

  const saved = loadRocketDesign()
  if (saved) {
    assemblyState.importParts(saved.parts)
    assemblyState.symmetryEnabled = saved.symmetryEnabled
    launchState.importData(saved.launchSequence)
    layout.symmetryToggle.dataset.enabled = String(saved.symmetryEnabled)
    layout.symmetryToggle.classList.toggle('active', saved.symmetryEnabled)
    layout.symmetryToggle.textContent = saved.symmetryEnabled ? '对称：开' : '对称：关'
    canvas.setSymmetryVisible(saved.symmetryEnabled)
    launchPanel.render()
    canvas.redraw()
  }

  layout.symmetryToggle.addEventListener('click', () => {
    const enabled = layout.symmetryToggle.dataset.enabled === 'true'
    const next = !enabled
    const axisX = layout.assemblyArea.clientWidth / 2

    layout.symmetryToggle.dataset.enabled = String(next)
    layout.symmetryToggle.classList.toggle('active', next)
    layout.symmetryToggle.textContent = next ? '对称：开' : '对称：关'
    assemblyState.setSymmetryEnabled(next, axisX)
    canvas.setSymmetryVisible(next)
    canvas.resize()
    triggerSave()
  })

  layout.launchSequenceBtn.addEventListener('click', () => {
    if (panelMode === 'parts') {
      panelMode = 'launch-sequence'
      launchPanel.setPickingStageId(null)
    } else {
      panelMode = 'parts'
      launchPanel.setPickingStageId(null)
      canvas.setInteractionMode('assembly')
      pickHint.classList.add('pick-hint--hidden')
      layout.assemblyArea.classList.remove('assembly-area--picking')
    }
    setSidePanelMode(layout, panelMode)
    launchPanel.render()
    canvas.redraw()
  })

  window.addEventListener('resize', () => canvas.resize())
}
