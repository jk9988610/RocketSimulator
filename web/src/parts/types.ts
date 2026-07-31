export type PartTypeId =
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
  /** 被圆环连接器包络隐藏 */
  envelopedBy?: string
  /** 圆环连接器纵向延伸高度（px） */
  ringSpan?: number
  /** 圆环底端连接器相对顶部的纵向偏移（默认等于 ringSpan） */
  ringBottomLy?: number
  /** 未延伸时环顶端的放置 Y（延伸后用于复位） */
  ringPlacementTop?: number
}

export interface PointerPosition {
  x: number
  y: number
}
