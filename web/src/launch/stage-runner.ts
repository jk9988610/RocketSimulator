import type { LaunchStage } from '../assembly/launch-sequence'
import type { FlightRocket } from './rocket-body'

export class StageRunner {
  private executedNumbers = new Set<number>()

  reset(): void {
    this.executedNumbers.clear()
  }

  getNextStage(stages: readonly LaunchStage[]): LaunchStage | null {
    const remaining = stages
      .filter((s) => !this.executedNumbers.has(s.number))
      .sort((a, b) => b.number - a.number)
    return remaining[0] ?? null
  }

  executeStage(stage: LaunchStage, rocket: FlightRocket): void {
    for (const partId of stage.targetPartIds) {
      rocket.applyStageAction(partId)
    }
    this.executedNumbers.add(stage.number)
  }

  getExecutedNumbers(): number[] {
    return [...this.executedNumbers].sort((a, b) => b - a)
  }
}
