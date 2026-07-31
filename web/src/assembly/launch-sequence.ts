import type { PartTypeId } from '../parts/types'

export const LAUNCH_TARGET_TYPES: readonly PartTypeId[] = [
  'engine',
  'ring-connector',
  'radial-connector',
  'parachute',
] as const

export function isLaunchTargetType(typeId: PartTypeId): boolean {
  return (LAUNCH_TARGET_TYPES as readonly string[]).includes(typeId)
}

export interface LaunchStage {
  id: string
  number: number
  targetPartIds: string[]
}

export interface LaunchSequenceData {
  stages: LaunchStage[]
}

let nextStageId = 1

function createStageId(): string {
  return `stage-${nextStageId++}`
}

export class LaunchSequenceState {
  private stages: LaunchStage[] = []

  getStages(): readonly LaunchStage[] {
    return [...this.stages].sort((a, b) => a.number - b.number)
  }

  getStageById(id: string): LaunchStage | undefined {
    return this.stages.find((s) => s.id === id)
  }

  addStage(): LaunchStage {
    const maxNumber = this.stages.reduce((max, s) => Math.max(max, s.number), 0)
    const stage: LaunchStage = {
      id: createStageId(),
      number: maxNumber + 1,
      targetPartIds: [],
    }
    this.stages.push(stage)
    return stage
  }

  removeStage(id: string): void {
    this.stages = this.stages.filter((s) => s.id !== id)
  }

  addTarget(stageId: string, partId: string): boolean {
    const stage = this.getStageById(stageId)
    if (!stage || stage.targetPartIds.includes(partId)) return false
    if (this.findStageForPart(partId)) return false
    stage.targetPartIds.push(partId)
    return true
  }

  removeTarget(stageId: string, partId: string): void {
    const stage = this.getStageById(stageId)
    if (!stage) return
    stage.targetPartIds = stage.targetPartIds.filter((id) => id !== partId)
  }

  findStageForPart(partId: string): LaunchStage | undefined {
    return this.stages.find((s) => s.targetPartIds.includes(partId))
  }

  getAllTargetPartIds(): Set<string> {
    const ids = new Set<string>()
    for (const stage of this.stages) {
      for (const id of stage.targetPartIds) {
        ids.add(id)
      }
    }
    return ids
  }

  exportData(): LaunchSequenceData {
    return {
      stages: this.stages.map((s) => ({
        id: s.id,
        number: s.number,
        targetPartIds: [...s.targetPartIds],
      })),
    }
  }

  importData(data: LaunchSequenceData): void {
    this.stages = data.stages.map((s) => ({
      id: s.id,
      number: s.number,
      targetPartIds: [...s.targetPartIds],
    }))
    const maxStageNum = nextStageId
    for (const stage of this.stages) {
      const match = stage.id.match(/^stage-(\d+)$/)
      if (match) {
        nextStageId = Math.max(nextStageId, Number(match[1]) + 1)
      }
    }
    if (nextStageId === maxStageNum && this.stages.length > 0) {
      nextStageId = this.stages.length + 1
    }
  }

  clear(): void {
    this.stages = []
  }
}
