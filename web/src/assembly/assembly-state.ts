import { getPartDefinition } from '../parts/definitions'
import type { PartInstance, PartTypeId, PointerPosition } from '../parts/types'
import { snapPoint, snapToGrid } from './grid'

let nextId = 1

function createId(): string {
  return `part-${nextId++}`
}

function syncNextIdFromParts(parts: PartInstance[]): void {
  for (const part of parts) {
    const match = part.id.match(/^part-(\d+)$/)
    if (match) {
      nextId = Math.max(nextId, Number(match[1]) + 1)
    }
  }
}

export class AssemblyState {
  private parts: PartInstance[] = []
  private selectedIds = new Set<string>()
  symmetryEnabled = false

  getParts(): readonly PartInstance[] {
    return this.parts
  }

  getSelectedIds(): ReadonlySet<string> {
    return this.selectedIds
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id)
  }

  setSymmetryEnabled(enabled: boolean, axisX: number): void {
    this.symmetryEnabled = enabled
    if (enabled) {
      this.syncMirrors(axisX)
    } else {
      this.removeMirrorParts()
    }
  }

  addPart(typeId: PartTypeId, x: number, y: number, axisX: number): PartInstance {
    const snapped = snapPoint(x, y)
    const part: PartInstance = {
      id: createId(),
      typeId,
      x: snapped.x,
      y: snapped.y,
    }
    this.parts.push(part)

    if (this.symmetryEnabled) {
      const mirror = this.createMirror(part, axisX)
      this.parts.push(mirror)
    }

    return part
  }

  getPartById(id: string): PartInstance | undefined {
    return this.parts.find((p) => p.id === id)
  }

  hitTestAny(point: PointerPosition): PartInstance | null {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i]!
      const def = getPartDefinition(part.typeId)
      if (
        point.x >= part.x &&
        point.x <= part.x + def.width &&
        point.y >= part.y &&
        point.y <= part.y + def.height
      ) {
        return part
      }
    }
    return null
  }

  exportParts(): PartInstance[] {
    return this.parts.map((p) => ({ ...p }))
  }

  importParts(parts: PartInstance[]): void {
    this.parts = parts.map((p) => ({ ...p }))
    this.selectedIds.clear()
    syncNextIdFromParts(this.parts)
  }

  clearParts(): void {
    this.parts = []
    this.selectedIds.clear()
  }

  hitTest(point: PointerPosition): PartInstance | null {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i]!
      if (this.symmetryEnabled && part.mirrorOf) continue
      const def = getPartDefinition(part.typeId)
      if (
        point.x >= part.x &&
        point.x <= part.x + def.width &&
        point.y >= part.y &&
        point.y <= part.y + def.height
      ) {
        return part
      }
    }
    return null
  }

  toggleSelection(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id)
    } else {
      this.selectedIds.add(id)
    }
  }

  clearSelection(): void {
    this.selectedIds.clear()
  }

  getSelectedParts(): PartInstance[] {
    return this.parts.filter((p) => this.selectedIds.has(p.id))
  }

  moveParts(ids: string[], dx: number, dy: number, axisX: number): void {
    const snappedDx = snapToGrid(dx)
    const snappedDy = snapToGrid(dy)
    if (snappedDx === 0 && snappedDy === 0) return

    const idSet = new Set(ids)
    const moved = new Set<string>()

    for (const part of this.parts) {
      if (!idSet.has(part.id) || moved.has(part.id)) continue

      part.x += snappedDx
      part.y += snappedDy
      moved.add(part.id)

      if (this.symmetryEnabled) {
        const mirror = this.getMirror(part)
        if (mirror) {
          this.positionMirror(part, mirror, axisX)
          moved.add(mirror.id)
        }
      }
    }
  }

  setPartPosition(part: PartInstance, x: number, y: number, axisX: number): void {
    const snapped = snapPoint(x, y)
    part.x = snapped.x
    part.y = snapped.y

    if (this.symmetryEnabled) {
      const mirror = this.getMirror(part)
      if (mirror) {
        this.positionMirror(part, mirror, axisX)
      }
    }
  }

  private createMirror(source: PartInstance, axisX: number): PartInstance {
    const def = getPartDefinition(source.typeId)
    const centerX = source.x + def.width / 2
    const mirrorCenterX = 2 * axisX - centerX
    const mirror: PartInstance = {
      id: createId(),
      typeId: source.typeId,
      x: snapToGrid(mirrorCenterX - def.width / 2),
      y: source.y,
      mirrorOf: source.id,
    }
    return mirror
  }

  private getMirror(part: PartInstance): PartInstance | undefined {
    if (part.mirrorOf) {
      return this.parts.find((p) => p.id === part.mirrorOf)
    }
    return this.parts.find((p) => p.mirrorOf === part.id)
  }

  private positionMirror(source: PartInstance, mirror: PartInstance, axisX: number): void {
    const def = getPartDefinition(source.typeId)
    const centerX = source.x + def.width / 2
    const mirrorCenterX = 2 * axisX - centerX
    mirror.x = snapToGrid(mirrorCenterX - def.width / 2)
    mirror.y = source.y
  }

  private syncMirrors(axisX: number): void {
    const primaries = this.parts.filter((p) => !p.mirrorOf)
    for (const part of primaries) {
      if (!this.getMirror(part)) {
        this.parts.push(this.createMirror(part, axisX))
      }
    }
  }

  private removeMirrorParts(): void {
    const mirrorIds = new Set(
      this.parts.filter((p) => p.mirrorOf).map((p) => p.id),
    )
    this.parts = this.parts.filter((p) => !p.mirrorOf)
    for (const id of mirrorIds) {
      this.selectedIds.delete(id)
    }
  }

  updateMirrorsAxis(axisX: number): void {
    if (!this.symmetryEnabled) return
    for (const part of this.parts) {
      if (!part.mirrorOf) {
        const mirror = this.getMirror(part)
        if (mirror) this.positionMirror(part, mirror, axisX)
      }
    }
  }
}
