import { PART_LIST } from '../parts/definitions'

export type SidePanelMode = 'parts' | 'launch-sequence'

export interface LayoutElements {
  appShell: HTMLElement
  assemblyArea: HTMLDivElement
  partsPanel: HTMLElement
  partsView: HTMLElement
  launchSequenceView: HTMLElement
  symmetryToggle: HTMLButtonElement
  launchSequenceBtn: HTMLButtonElement
  launchBtn: HTMLButtonElement
  launchScene: HTMLElement
}

export function createLayout(root: HTMLElement): LayoutElements {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="parts-panel" id="parts-panel">
        <div id="parts-view" class="side-panel-view">
          <header class="parts-panel__header">物件栏</header>
          <ul class="parts-list" role="list">
            ${PART_LIST.map(
              (part) => `
                <li class="parts-list__item" data-part-id="${part.id}">
                  <span class="parts-list__icon parts-list__icon--${part.id}" aria-hidden="true"></span>
                  <span class="parts-list__label">${part.label}</span>
                </li>
              `,
            ).join('')}
          </ul>
        </div>
        <div id="launch-sequence-view" class="side-panel-view side-panel-view--hidden">
          <header class="parts-panel__header">启动链设计</header>
          <div class="launch-sequence__body">
            <div id="launch-stage-list" class="launch-stage-list"></div>
            <button type="button" class="panel-btn" id="add-stage-btn">+ 添加启动级</button>
          </div>
        </div>
        <footer class="parts-panel__footer">
          <button type="button" class="panel-btn" id="symmetry-toggle" data-enabled="false">
            对称：关
          </button>
          <button type="button" class="panel-btn" id="launch-sequence-btn">
            启动链
          </button>
        </footer>
      </aside>
      <main class="assembly-panel">
        <div class="assembly-panel__toolbar">
          <button type="button" class="launch-btn" id="launch-btn" disabled title="需要至少一个引擎">
            发射
          </button>
        </div>
        <div class="assembly-area" id="assembly-area">
          <div id="pick-hint" class="pick-hint pick-hint--hidden">
            点击组装区中的引擎、连接器或降落伞以添加启动目标
          </div>
          <canvas id="assembly-canvas" aria-label="火箭组装区"></canvas>
        </div>
      </main>
    </div>
    <div id="launch-scene" class="launch-scene launch-scene--hidden">
      <canvas id="launch-canvas" aria-label="发射台"></canvas>
      <button type="button" class="back-btn" id="back-to-assembly">← 返回组装</button>
      <button type="button" class="map-toggle-btn" id="map-toggle">现场</button>
      <div class="tilt-controls">
        <button type="button" class="tilt-btn" id="tilt-left" aria-label="左倾">←</button>
        <button type="button" class="tilt-btn" id="tilt-right" aria-label="右倾">→</button>
      </div>
      <div class="launch-controls">
        <button type="button" class="launch-ctrl-btn" id="engine-switch">引擎关</button>
        <div class="throttle-wrap">
          <label class="throttle-label" for="throttle">节流阀</label>
          <input type="range" id="throttle" class="throttle-slider" min="0" max="100" value="0" orient="vertical" />
        </div>
        <button type="button" class="launch-ctrl-btn" id="sequence-view-btn">启动链</button>
        <button type="button" class="launch-ctrl-btn launch-ctrl-btn--primary" id="stage-step-btn">启动</button>
      </div>
      <div id="sequence-readout" class="sequence-readout sequence-readout--hidden"></div>
    </div>
  `

  return {
    appShell: root.querySelector('.app-shell')!,
    assemblyArea: root.querySelector('#assembly-area')!,
    partsPanel: root.querySelector('#parts-panel')!,
    partsView: root.querySelector('#parts-view')!,
    launchSequenceView: root.querySelector('#launch-sequence-view')!,
    symmetryToggle: root.querySelector('#symmetry-toggle')!,
    launchSequenceBtn: root.querySelector('#launch-sequence-btn')!,
    launchBtn: root.querySelector('#launch-btn')!,
    launchScene: root.querySelector('#launch-scene')!,
  }
}

export function setSidePanelMode(
  elements: Pick<LayoutElements, 'partsView' | 'launchSequenceView' | 'launchSequenceBtn'>,
  mode: SidePanelMode,
): void {
  const isLaunch = mode === 'launch-sequence'
  elements.partsView.classList.toggle('side-panel-view--hidden', isLaunch)
  elements.launchSequenceView.classList.toggle('side-panel-view--hidden', !isLaunch)
  elements.launchSequenceBtn.classList.toggle('active', isLaunch)
  elements.launchSequenceBtn.textContent = isLaunch ? '返回物件栏' : '启动链'
}
