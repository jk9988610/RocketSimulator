const PARTS = [
  { id: 'frustum', label: '圆台' },
  { id: 'command-pod', label: '指令仓' },
  { id: 'parachute', label: '降落伞' },
  { id: 'heat-shield', label: '隔热片' },
  { id: 'ring-connector', label: '圆环连接器' },
  { id: 'fuel-tank', label: '圆柱燃料箱' },
  { id: 'radial-connector', label: '径向连接器' },
  { id: 'nose-cone', label: '鼻锥' },
  { id: 'engine', label: '引擎' },
] as const

export interface LayoutElements {
  assemblyArea: HTMLDivElement
  symmetryToggle: HTMLButtonElement
  launchSequenceBtn: HTMLButtonElement
}

export function createLayout(root: HTMLElement): LayoutElements {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="parts-panel">
        <header class="parts-panel__header">物件栏</header>
        <ul class="parts-list" role="list">
          ${PARTS.map(
            (part) => `
              <li class="parts-list__item" data-part-id="${part.id}" draggable="false">
                <span class="parts-list__icon" aria-hidden="true"></span>
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
    symmetryToggle: root.querySelector('#symmetry-toggle')!,
    launchSequenceBtn: root.querySelector('#launch-sequence-btn')!,
  }
}
