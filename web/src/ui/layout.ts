import { PART_LIST } from '../parts/definitions'

export interface LayoutElements {
  assemblyArea: HTMLDivElement
  partsPanel: HTMLElement
  symmetryToggle: HTMLButtonElement
  launchSequenceBtn: HTMLButtonElement
}

export function createLayout(root: HTMLElement): LayoutElements {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="parts-panel" id="parts-panel">
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
          <canvas id="assembly-canvas" aria-label="火箭组装区"></canvas>
        </div>
      </main>
    </div>
  `

  return {
    assemblyArea: root.querySelector('#assembly-area')!,
    partsPanel: root.querySelector('#parts-panel')!,
    symmetryToggle: root.querySelector('#symmetry-toggle')!,
    launchSequenceBtn: root.querySelector('#launch-sequence-btn')!,
  }
}
