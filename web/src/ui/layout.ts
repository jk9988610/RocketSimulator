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
  buildStamp: HTMLElement
}

export function createLayout(root: HTMLElement): LayoutElements {
  root.innerHTML = `
    <div class="app-shell">
      <aside class="parts-panel" id="parts-panel">
        <div id="parts-view" class="side-panel-view">
          <header class="parts-panel__header">物件栏</header>
          <div class="parts-inventory" role="list">
            ${PART_LIST.map(
              (part) => `
                <div class="inventory-item" data-part-id="${part.id}" role="listitem">
                  <div class="inventory-item__title">${part.label}</div>
                  <div class="inventory-item__preview" aria-hidden="true"></div>
                </div>
              `,
            ).join('')}
          </div>
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
          <div class="build-stamp" id="build-stamp" aria-label="当前构建版本"></div>
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
      <div class="launch-menu-wrap">
        <button type="button" class="menu-btn" id="launch-menu-btn" aria-haspopup="true">☰ 菜单</button>
        <div id="launch-menu" class="launch-menu launch-menu--hidden">
          <button type="button" class="launch-menu__item" id="back-to-assembly">返回组装</button>
          <button type="button" class="launch-menu__item" id="relaunch-btn">重新发射</button>
        </div>
      </div>
      <button type="button" class="map-toggle-btn" id="map-toggle">现场</button>
      <select id="map-focus-select" class="map-focus-select map-focus-select--hidden" aria-label="地图追踪">
        <option value="rocket" selected>追踪：火箭</option>
        <option value="earth">追踪：地球</option>
        <option value="moon">追踪：月球</option>
        <option value="sun">追踪：太阳</option>
      </select>
      <div class="time-warp-controls">
        <button type="button" class="warp-btn" id="warp-slower" title="减速">−</button>
        <button type="button" class="warp-btn warp-btn--pause" id="warp-pause" title="暂停">⏸</button>
        <span class="warp-label" id="warp-label">1×</span>
        <button type="button" class="warp-btn" id="warp-faster" title="加速">+</button>
      </div>
      <div class="resource-bars">
        <div id="temp-bar-wrap" class="temp-bar-wrap temp-bar-wrap--hidden">
          <div class="temp-bar">
            <span class="temp-bar__label">温度</span>
            <div class="temp-bar__track">
              <div id="temp-bar-fill" class="temp-bar__fill"></div>
            </div>
          </div>
        </div>
        <div id="fuel-bars" class="fuel-bars"></div>
      </div>
      <div id="flight-hud" class="flight-hud">
        <button type="button" class="tilt-btn" id="tilt-left" aria-label="左倾">←</button>
        <div class="flight-hud__readout">
          <div class="flight-hud__row">
            <span class="flight-hud__key">速度</span>
            <span class="flight-hud__val" id="hud-speed">0.0 m/s</span>
          </div>
          <div class="flight-hud__row">
            <span class="flight-hud__key" id="hud-alt-label">距地面</span>
            <span class="flight-hud__val" id="hud-altitude">0.00 km</span>
          </div>
          <div class="flight-hud__row">
            <span class="flight-hud__key">垂直速度</span>
            <span class="flight-hud__val" id="hud-vvel">0.0 m/s</span>
          </div>
        </div>
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
    buildStamp: root.querySelector('#build-stamp')!,
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
