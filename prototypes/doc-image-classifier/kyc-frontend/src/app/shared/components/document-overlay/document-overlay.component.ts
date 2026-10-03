import {
  Component, Input, OnChanges, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, HostListener
} from '@angular/core';

@Component({
  selector: 'app-document-overlay',
  standalone: true,
  template: `<canvas #canvas class="overlay-canvas"></canvas>`,
  styles: [`:host { display: block; position: absolute; inset: 0; pointer-events: none; }
            canvas { width: 100%; height: 100%; }`]
})
export class DocumentOverlayComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() isDetected   = false;
  @Input() confidence   = 0;
  @Input() handDetected = false;

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private rafId = 0;
  private animProgress = 0;

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
      this.animProgress = (this.animProgress + 0.02) % (Math.PI * 2);
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

    // Guide rectangle — credit card ratio 1.586:1
    const isMobile = width < 768;
    const rectW = isMobile ? width * 0.85 : Math.min(width * 0.62, 500);
    const rectH = rectW / 1.586;
    const rx = (width  - rectW) / 2;
    const ry = (height - rectH) / 2;

    // Dark vignette outside guide
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, width, height);
    ctx.clearRect(rx, ry, rectW, rectH);

    // Border — red when hand detected, green when detected, white otherwise
    const detected = this.isDetected;
    const hand     = this.handDetected;
    const alpha    = detected ? 1 : 0.6 + Math.sin(this.animProgress) * 0.2;
    ctx.strokeStyle = hand
      ? `rgba(231,76,60,${alpha})`
      : detected ? `rgba(39,174,96,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = hand ? 4 : 3;
    ctx.setLineDash(detected || hand ? [] : [12, 8]);
    ctx.strokeRect(rx, ry, rectW, rectH);
    ctx.setLineDash([]);

    // Red tint overlay when hand detected
    if (hand) {
      ctx.fillStyle = 'rgba(231,76,60,0.15)';
      ctx.fillRect(rx, ry, rectW, rectH);
    }

    // Corner markers
    const cLen = 24;
    ctx.lineWidth = 4;
    ctx.strokeStyle = hand ? '#E74C3C' : detected ? '#27AE60' : 'white';
    ctx.lineCap = 'round';
    const corners: [number, number, number, number][] = [
      [rx, ry, cLen, cLen],
      [rx + rectW, ry, -cLen, cLen],
      [rx + rectW, ry + rectH, -cLen, -cLen],
      [rx, ry + rectH, cLen, -cLen]
    ];
    for (const [cx, cy, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy);
      ctx.stroke();
    }

    // Green fill overlay when detected
    if (detected) {
      ctx.fillStyle = 'rgba(39,174,96,0.12)';
      ctx.fillRect(rx, ry, rectW, rectH);
    }

    // Confidence label
    if (this.confidence > 0) {
      const label = `${Math.round(this.confidence * 100)}%`;
      ctx.font = '600 14px Inter, sans-serif';
      ctx.fillStyle = detected ? '#27AE60' : 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(label, rx + rectW / 2, ry - 10);
    }

    // Scanning line when detecting (not yet found)
    if (!detected && this.confidence === 0) {
      const lineY = ry + (rectH * ((Math.sin(this.animProgress) + 1) / 2));
      const grad = ctx.createLinearGradient(rx, 0, rx + rectW, 0);
      grad.addColorStop(0,   'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rx, lineY);
      ctx.lineTo(rx + rectW, lineY);
      ctx.stroke();
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }
}
