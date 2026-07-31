import type { AssemblyState } from './assembly-state'
import type { LaunchSequenceData } from './launch-sequence'
import type { PartInstance } from '../parts/types'

export interface RocketDesignV1 {
  version: 1
  symmetryEnabled: boolean
  parts: PartInstance[]
  launchSequence: LaunchSequenceData
}

const STORAGE_KEY = 'rocket-simulator-design-v1'

export function saveRocketDesign(design: RocketDesignV1): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
}

export function loadRocketDesign(): RocketDesignV1 | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const data = JSON.parse(raw) as RocketDesignV1
    if (data.version !== 1) return null
    return data
  } catch {
    return null
  }
}

export function buildRocketDesign(
  assembly: AssemblyState,
  launchSequence: LaunchSequenceData,
): RocketDesignV1 {
  return {
    version: 1,
    symmetryEnabled: assembly.symmetryEnabled,
    parts: assembly.exportParts(),
    launchSequence,
  }
}

export function createAutoSave(
  getDesign: () => RocketDesignV1,
  delayMs = 500,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      saveRocketDesign(getDesign())
      timer = null
    }, delayMs)
  }
}
