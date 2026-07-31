import { AssemblyState } from '../assembly/assembly-state'
import { LaunchSequenceState } from '../assembly/launch-sequence'
import { LaunchScene } from '../launch/launch-scene'
import { FlightRocket } from '../launch/rocket-body'
import {
  buildRocketDesign,
  createAutoSave,
  loadRocketDesign,
} from '../assembly/rocket-design'
import { createLayout, setSidePanelMode, type SidePanelMode } from '../ui/layout'
import { AssemblyCanvas } from '../ui/assembly-canvas'
import { bindPartsPanelDrag } from '../ui/parts-panel-drag'
import { initPartsPanelPreviews } from '../ui/parts-panel-preview'
import { LaunchSequencePanel } from '../ui/launch-sequence-panel'

export function initApp(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  const layout = createLayout(root)
  const assemblyState = new AssemblyState()
  const launchState = new LaunchSequenceState()

  let panelMode: SidePanelMode = 'parts'
  let launchPanel!: LaunchSequencePanel
  let launchScene: LaunchScene | null = null
  const pickHint = layout.assemblyArea.querySelector('#pick-hint')!

  const triggerSave = createAutoSave(() =>
    buildRocketDesign(assemblyState, launchState.exportData()),
  )

  const updateLaunchButton = (): void => {
    const hasEngine = assemblyState
      .getParts()
      .some((p) => !p.mirrorOf && p.typeId === 'engine')
    layout.launchBtn.disabled = !hasEngine
  }

  const canvas = new AssemblyCanvas(layout.assemblyArea, assemblyState, {
    getLaunchTargetIds: () => launchState.getAllTargetPartIds(),
    recycleZone: layout.partsView,
    onPartsRecycled: (partIds) => {
      launchState.purgeTargets(partIds)
      launchPanel.render()
    },
    onAssemblyChange: () => {
      triggerSave()
      updateLaunchButton()
    },
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
  initPartsPanelPreviews(layout.partsPanel)
  bindPartsPanelDrag(layout.partsPanel, canvas)
  updateLaunchButton()

  const enterLaunchScene = (): void => {
    const rocket = FlightRocket.fromAssembly(assemblyState.getParts())
    if (!rocket) return

    launchPanel.setPickingStageId(null)
    canvas.setInteractionMode('assembly')
    pickHint.classList.add('pick-hint--hidden')
    layout.assemblyArea.classList.remove('assembly-area--picking')

    layout.appShell.classList.add('app-shell--hidden')
    layout.launchScene.classList.remove('launch-scene--hidden')

    launchScene = new LaunchScene(
      layout.launchScene,
      rocket,
      launchState,
      () => {
        launchScene?.stop()
        launchScene = null
        layout.launchScene.classList.add('launch-scene--hidden')
        layout.appShell.classList.remove('app-shell--hidden')
        canvas.resize()
      },
    )
    launchScene.start()
  }

  layout.launchBtn.addEventListener('click', enterLaunchScene)

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
    updateLaunchButton()
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

  window.addEventListener('resize', () => {
    canvas.resize()
    launchScene?.handleResize()
  })
}
