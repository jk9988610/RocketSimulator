import type { PartDefinition, PartTypeId } from './types'

export const PART_DEFINITIONS: Record<PartTypeId, PartDefinition> = {
  'command-pod': {
    id: 'command-pod',
    label: '指令仓',
    width: 64,
    height: 64,
    color: '#f0f0f4',
    accent: '#3b9eff',
  },
  parachute: {
    id: 'parachute',
    label: '降落伞',
    width: 64,
    height: 40,
    color: '#ff6b6b',
    accent: '#cc4444',
  },
  'heat-shield': {
    id: 'heat-shield',
    label: '隔热片',
    width: 64,
    height: 16,
    color: '#8b6914',
    accent: '#c49a1a',
  },
  'ring-connector': {
    id: 'ring-connector',
    label: '圆环连接器',
    width: 64,
    height: 24,
    color: '#707080',
    accent: '#a0a0b0',
  },
  'fuel-tank': {
    id: 'fuel-tank',
    label: '圆柱燃料箱',
    width: 64,
    height: 96,
    color: '#e0e0e8',
    accent: '#b0b0c0',
  },
  'radial-connector': {
    id: 'radial-connector',
    label: '径向连接器',
    width: 96,
    height: 48,
    color: '#606070',
    accent: '#9090a0',
  },
  'nose-cone': {
    id: 'nose-cone',
    label: '鼻锥',
    width: 48,
    height: 48,
    color: '#d8d8e0',
    accent: '#a8a8b8',
  },
  engine: {
    id: 'engine',
    label: '引擎',
    width: 64,
    height: 56,
    color: '#505060',
    accent: '#ff8c42',
  },
}

export const PART_LIST = Object.values(PART_DEFINITIONS)

export function getPartDefinition(typeId: PartTypeId): PartDefinition {
  return PART_DEFINITIONS[typeId]
}
