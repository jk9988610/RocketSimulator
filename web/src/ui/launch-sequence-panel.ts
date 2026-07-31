import { getPartDefinition } from '../parts/definitions'
import type { AssemblyState } from '../assembly/assembly-state'
import {
  isLaunchTargetType,
  type LaunchSequenceState,
} from '../assembly/launch-sequence'

export interface LaunchSequencePanelOptions {
  container: HTMLElement
  launchState: LaunchSequenceState
  assemblyState: AssemblyState
  onPickTarget: (stageId: string | null) => void
  onChange: () => void
}

export class LaunchSequencePanel {
  private readonly listEl: HTMLElement
  private readonly options: LaunchSequencePanelOptions
  private pickingStageId: string | null = null

  constructor(options: LaunchSequencePanelOptions) {
    this.options = options
    this.listEl = options.container.querySelector('#launch-stage-list')!
    this.bindAddStage()
    this.render()
  }

  isPicking(): boolean {
    return this.pickingStageId !== null
  }

  getPickingStageId(): string | null {
    return this.pickingStageId
  }

  setPickingStageId(stageId: string | null): void {
    this.pickingStageId = stageId
    this.render()
    this.options.onPickTarget(stageId)
  }

  render(): void {
    const stages = this.options.launchState.getStages()

    if (stages.length === 0) {
      this.listEl.innerHTML = `
        <p class="launch-sequence__empty">暂无启动级，点击下方按钮添加。</p>
      `
      return
    }

    this.listEl.innerHTML = stages
      .map((stage) => this.renderStage(stage))
      .join('')

    this.bindStageEvents()
  }

  private renderStage(stage: import('../assembly/launch-sequence').LaunchStage): string {
    const isPicking = this.pickingStageId === stage.id
    const allStages = this.options.launchState.getStages()
    const maxNum = allStages.reduce((m, s) => Math.max(m, s.number), 0)
    const minNum = allStages.reduce((m, s) => Math.min(m, s.number), stage.number)
    const hint =
      stage.number === maxNum && allStages.length > 1
        ? '最先执行'
        : stage.number === minNum && allStages.length > 1
          ? '最后执行'
          : ''
    const targets = stage.targetPartIds
      .map((partId) => {
        const part = this.options.assemblyState.getPartById(partId)
        const label = part ? getPartDefinition(part.typeId).label : '已删除'
        return `
          <li class="launch-target">
            <span>${label}</span>
            <button
              type="button"
              class="launch-target__remove"
              data-action="remove-target"
              data-stage-id="${stage.id}"
              data-part-id="${partId}"
              aria-label="移除目标"
            >×</button>
          </li>
        `
      })
      .join('')

    return `
      <section class="launch-stage ${isPicking ? 'launch-stage--picking' : ''}" data-stage-id="${stage.id}">
        <header class="launch-stage__header">
          <span class="launch-stage__number">启动级 ${stage.number}</span>
          <button
            type="button"
            class="launch-stage__delete"
            data-action="delete-stage"
            data-stage-id="${stage.id}"
            aria-label="删除启动级"
          >×</button>
        </header>
        <p class="launch-stage__hint">${hint}</p>
        <ul class="launch-target-list">${targets || '<li class="launch-target launch-target--empty">暂无目标</li>'}</ul>
        <button
          type="button"
          class="launch-stage__add-target ${isPicking ? 'active' : ''}"
          data-action="pick-target"
          data-stage-id="${stage.id}"
        >
          ${isPicking ? '点击组装区选择…' : '+ 添加目标'}
        </button>
      </section>
    `
  }

  private bindAddStage(): void {
    const btn = this.options.container.querySelector('#add-stage-btn')
    btn?.addEventListener('click', () => {
      this.options.launchState.addStage()
      this.options.onChange()
      this.render()
    })
  }

  private bindStageEvents(): void {
    this.listEl.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const action = el.dataset.action
        const stageId = el.dataset.stageId
        const partId = el.dataset.partId

        if (action === 'delete-stage' && stageId) {
          if (this.pickingStageId === stageId) {
            this.setPickingStageId(null)
          }
          this.options.launchState.removeStage(stageId)
          this.options.onChange()
          this.render()
        }

        if (action === 'pick-target' && stageId) {
          if (this.pickingStageId === stageId) {
            this.setPickingStageId(null)
          } else {
            this.setPickingStageId(stageId)
          }
        }

        if (action === 'remove-target' && stageId && partId) {
          this.options.launchState.removeTarget(stageId, partId)
          this.options.onChange()
          this.render()
        }
      })
    })
  }

  handlePartPicked(partId: string): boolean {
    if (!this.pickingStageId) return false

    const part = this.options.assemblyState.getPartById(partId)
    if (!part || !isLaunchTargetType(part.typeId)) return false

    const added = this.options.launchState.addTarget(this.pickingStageId, partId)
    if (added) {
      this.options.onChange()
      this.render()
    }
    return added
  }
}
