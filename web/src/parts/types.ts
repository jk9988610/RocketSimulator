export type PartTypeId =
  | 'frustum'
  | 'command-pod'
  | 'parachute'
  | 'heat-shield'
  | 'ring-connector'
  | 'fuel-tank'
  | 'radial-connector'
  | 'nose-cone'
  | 'engine'

export interface PartDefinition {
  id: PartTypeId
  label: string
  width: number
  height: number
  color: string
  accent: string
}

export interface PartInstance {
  id: string
  typeId: PartTypeId
  x: number
  y: number
  mirrorOf?: string
}

export interface PointerPosition {
  x: number
  y: number
}
