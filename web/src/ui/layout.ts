import { PART_LIST } from '../parts/definitions'

export type SidePanelMode = 'parts' | 'launch-sequence'

export interface LayoutElements {
  assemblyArea: HTMLDivElement
  partsPanel: HTMLElement
  partsView: HTMLElement
  launchSequenceView: HTMLElement
  symmetryToggle: HTMLButtonElement
  launchSequenceBtn: HTMLButtonElement
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
          <button type="button" class="launch-btn" id="launch-btn" disabled title="组装完成后可用">
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
  `

  return {
    assemblyArea: root.querySelector('#assembly-area')!,
    partsPanel: root.querySelector('#parts-panel')!,
    partsView: root.querySelector('#parts-view')!,
    launchSequenceView: root.querySelector('#launch-sequence-view')!,
    symmetryToggle: root.querySelector('#symmetry-toggle')!,
    launchSequenceBtn: root.querySelector('#launch-sequence-btn')!,
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
