import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, HostListener
} from '@angular/core';

@Component({
  selector: 'app-face-overlay',
  standalone: true,
  template: `<canvas #canvas class="overlay-canvas"></canvas>`,
  styles: [`:host { display: block; position: absolute; inset: 0; pointer-events: none; }
            canvas { width: 100%; height: 100%; }`]
})
export class FaceOverlayComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() faceDetected = false;
  @Input() boundingBox: number[] | null = null;   // [x, y, w, h]
  @Input() landmarks: Record<string, number[]> | null = null;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private rafId = 0;
  private animT = 0;
  private pulseScale = 1;

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.startLoop();
  }

  ngOnChanges(): void {
    if (this.ctx) this.draw();
  }

  @HostListener('window:resize')
  resize(): void {
    const canvas = this.canvasRef.nativeElement;
    const parent = canvas.parentElement!;
    canvas.width  = parent.clientWidth;
    canvas.height = parent.clientHeight;
    this.draw();
  }

  private startLoop(): void {
    const animate = () => {
      this.animT += 0.03;
      this.pulseScale = this.faceDetected
        ? 1 + Math.sin(this.animT * 2) * 0.015
        : 1;
      this.draw();
      this.rafId = requestAnimationFrame(animate);
    };
    this.rafId = requestAnimationFrame(animate);
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const { width, height } = canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // Oval guide — centered
    const cx  = width  / 2;
    const cy  = height / 2 - height * 0.04;
    const rx  = (Math.min(width, height) * 0.28) * this.pulseScale;
    const ry  = rx * 1.35 * this.pulseScale;

    // Dark mask outside oval
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Oval border
    const detected = this.faceDetected;
    const alpha = detected ? 1 : 0.65 + Math.sin(this.animT) * 0.2;
    ctx.strokeStyle = detected ? `rgba(39,174,96,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 3;
    ctx.setLineDash(detected ? [] : [10, 7]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Green glow when detected
    if (detected) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#27AE60';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pulse ring
      const ringAlpha = Math.max(0, 0.5 - (this.animT % 1));
      ctx.strokeStyle = `rgba(39,174,96,${ringAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * (1 + (this.animT % 1) * 0.3), ry * (1 + (this.animT % 1) * 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bounding box (from API detection)
    if (this.boundingBox && this.boundingBox.length >= 4) {
      const [bx, by, bw, bh] = this.boundingBox;
      ctx.strokeStyle = 'rgba(74,144,217,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
    }

    // Landmark dots
    if (this.landmarks && this.faceDetected) {
      ctx.fillStyle = '#4A90D9';
      for (const coords of Object.values(this.landmarks)) {
        if (coords.length >= 2) {
          ctx.beginPath();
          ctx.arc(coords[0], coords[1], 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
