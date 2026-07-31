const GRID_SIZE = 32

export class AssemblyCanvas {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly container: HTMLElement
  private symmetryVisible = false
  private rafId = 0

  constructor(container: HTMLElement) {
    this.container = container
    const canvas = container.querySelector<HTMLCanvasElement>('#assembly-canvas')
    if (!canvas) throw new Error('Assembly canvas not found')

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D context unavailable')

    this.canvas = canvas
    this.ctx = ctx
  }

  start(): void {
    this.resize()
    this.draw()
  }

  resize(): void {
    const { width, height } = this.container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1

    this.canvas.width = Math.floor(width * dpr)
    this.canvas.height = Math.floor(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.draw()
  }

  setSymmetryVisible(visible: boolean): void {
    this.symmetryVisible = visible
    this.draw()
  }

  private draw(): void {
    cancelAnimationFrame(this.rafId)
    this.rafId = requestAnimationFrame(() => {
      const width = this.canvas.clientWidth
      const height = this.canvas.clientHeight

      this.ctx.fillStyle = '#000000'
      this.ctx.fillRect(0, 0, width, height)

      this.drawGrid(width, height)

      if (this.symmetryVisible) {
        this.drawSymmetryAxis(width, height)
      }
    })
  }

  private drawGrid(width: number, height: number): void {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    this.ctx.lineWidth = 1

    for (let x = 0; x <= width; x += GRID_SIZE) {
      this.ctx.beginPath()
      this.ctx.moveTo(x + 0.5, 0)
      this.ctx.lineTo(x + 0.5, height)
      this.ctx.stroke()
    }

    for (let y = 0; y <= height; y += GRID_SIZE) {
      this.ctx.beginPath()
      this.ctx.moveTo(0, y + 0.5)
      this.ctx.lineTo(width, y + 0.5)
      this.ctx.stroke()
    }
  }

  private drawSymmetryAxis(width: number, height: number): void {
    const centerX = width / 2

    this.ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)'
    this.ctx.lineWidth = 1
    this.ctx.setLineDash([6, 6])
    this.ctx.beginPath()
    this.ctx.moveTo(centerX + 0.5, 0)
    this.ctx.lineTo(centerX + 0.5, height)
    this.ctx.stroke()
    this.ctx.setLineDash([])
  }
}
