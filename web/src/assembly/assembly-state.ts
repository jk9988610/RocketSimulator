import { findSnapPair } from '../parts/connection-points'
import { getPartDefinition } from '../parts/definitions'
import type { PartInstance, PartTypeId, PointerPosition } from '../parts/types'
import { snapPoint, snapToGrid } from './grid'
import { updateRingEnvelopes } from './ring-envelope'

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

  setSymmetryEnabled(enabled: boolean, _axisX: number): void {
    this.symmetryEnabled = enabled
    if (!enabled) {
      this.removeMirrorParts()
    }
  }

  ensureMirrorForPart(part: PartInstance, axisX: number): void {
    if (!this.symmetryEnabled || part.mirrorOf) return
    if (!this.getMirror(part)) {
      this.parts.push(this.createMirror(part, axisX))
    } else {
      const mirror = this.getMirror(part)!
      this.positionMirror(part, mirror, axisX)
    }
  }

  getMirrorPreviewPosition(
    part: PartInstance,
    axisX: number,
  ): { x: number; y: number } | null {
    if (!this.symmetryEnabled || part.mirrorOf) return null
    const def = getPartDefinition(part.typeId)
    const centerX = part.x + def.width / 2
    const mirrorCenterX = 2 * axisX - centerX
    return {
      x: snapToGrid(mirrorCenterX - def.width / 2),
      y: part.y,
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
      this.ensureMirrorForPart(part, axisX)
    }

    updateRingEnvelopes(this.parts)
    return part
  }

  getPartById(id: string): PartInstance | undefined {
    return this.parts.find((p) => p.id === id)
  }

  hitTestAny(point: PointerPosition): PartInstance | null {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i]!
      const def = getPartDefinition(part.typeId)
      const h = part.ringSpan ?? def.height
      if (
        point.x >= part.x &&
        point.x <= part.x + def.width &&
        point.y >= part.y &&
        point.y <= part.y + h
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
    this.parts = parts
      .filter((p) => (p.typeId as string) !== 'frustum' && !p.mirrorOf)
      .map((p) => ({ ...p, mirrorOf: undefined }))
    this.selectedIds.clear()
    syncNextIdFromParts(this.parts)
    updateRingEnvelopes(this.parts)
  }

  clearParts(): void {
    this.parts = []
    this.selectedIds.clear()
  }

  hitTest(point: PointerPosition): PartInstance | null {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const part = this.parts[i]!
      if (this.symmetryEnabled && part.mirrorOf) continue
      if (part.envelopedBy) continue
      const def = getPartDefinition(part.typeId)
      const h = part.ringSpan ?? def.height
      if (
        point.x >= part.x &&
        point.x <= part.x + def.width &&
        point.y >= part.y &&
        point.y <= part.y + h
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

  removeParts(ids: string[]): string[] {
    const toRemove = new Set<string>()

    for (const id of ids) {
      const part = this.getPartById(id)
      if (!part) continue

      toRemove.add(part.id)

      if (part.mirrorOf) continue

      const mirror = this.getMirror(part)
      if (mirror) toRemove.add(mirror.id)
    }

    if (toRemove.size === 0) return []

    this.parts = this.parts.filter((p) => !toRemove.has(p.id))
    for (const id of toRemove) {
      this.selectedIds.delete(id)
    }

    updateRingEnvelopes(this.parts)
    return [...toRemove]
  }

  getSelectedParts(): PartInstance[] {
    return this.parts.filter((p) => this.selectedIds.has(p.id))
  }

  moveParts(ids: string[], dx: number, dy: number, axisX: number): void {
    if (dx === 0 && dy === 0) return

    const idSet = new Set(ids)
    const moved = new Set<string>()

    for (const part of this.parts) {
      if (!idSet.has(part.id) || moved.has(part.id)) continue

      part.x += dx
      part.y += dy
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

  finalizeMove(ids: string[], axisX: number): void {
    const idSet = new Set(
      ids.filter((id) => {
        const p = this.getPartById(id)
        return p && !p.mirrorOf
      }),
    )

    for (const part of this.parts) {
      if (!idSet.has(part.id)) continue

      const others = this.parts.filter(
        (p) => p.id !== part.id && !idSet.has(p.id),
      )
      const pair = findSnapPair(part, others)
      if (pair) {
        part.x += pair.dx
        part.y += pair.dy
      } else {
        const snapped = snapPoint(part.x, part.y)
        part.x = snapped.x
        part.y = snapped.y
      }

      if (this.symmetryEnabled) {
        this.ensureMirrorForPart(part, axisX)
      }
    }

    updateRingEnvelopes(this.parts)
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

  hasMirror(primaryId: string): boolean {
    return this.parts.some((p) => p.mirrorOf === primaryId)
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
