import {
  Component, Input, Output, EventEmitter, ViewChild, ElementRef,
  OnDestroy, OnChanges, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { inject } from '@angular/core';
import { CameraService } from '../../../core/services/camera.service';

@Component({
  selector: 'app-camera-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="camera-container" [class.camera-container--loading]="loading">
      @if (loading) {
        <div class="camera-loading">
          <div class="spinner spinner--white spinner--lg"></div>
          <p>Starting camera…</p>
        </div>
      }
      @if (error) {
        <div class="camera-error">
          <p>{{ error }}</p>
          <button class="btn btn--outline" (click)="retry()">Retry</button>
        </div>
      }
      <video #videoEl
             [class.camera-feed--front]="facingMode === 'user'"
             class="camera-feed"
             autoplay
             playsinline
             muted>
      </video>
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    @use 'variables' as v;

    :host { display: block; }

    .camera-container {
      position: relative;
      width: 100%;
      height: 100%;
      background: v.$camera-bg;
      overflow: hidden;

      &--loading video { visibility: hidden; }
    }

    .camera-loading, .camera-error {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: v.$space-4;
      z-index: 5;
      color: white;
      text-align: center;
      padding: v.$space-4;
    }

    .camera-feed {
      width: 100%;
      height: 100%;
      object-fit: cover;

      &--front { transform: scaleX(-1); }
    }
  `]
})
export class CameraViewComponent implements OnChanges, OnDestroy {
  @Input() facingMode: 'user' | 'environment' = 'environment';
  @Input() showControls = false;

  @Output() cameraReady  = new EventEmitter<void>();
  @Output() cameraError  = new EventEmitter<string>();
  @Output() frameCapture = new EventEmitter<Blob>();

  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;

  loading = true;
  error: string | null = null;

  private readonly cameraService = inject(CameraService);

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['facingMode'] && !changes['facingMode'].firstChange) {
      await this.startCamera();
    }
  }

  async startCamera(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      await this.cameraService.startCamera(this.videoRef.nativeElement, this.facingMode);
      this.loading = false;
      this.cameraReady.emit();
    } catch (err) {
      this.loading = false;
      this.error = 'Could not access camera. Please grant camera permissions.';
      this.cameraError.emit(this.error);
    }
  }

  async retry(): Promise<void> {
    await this.startCamera();
  }

  captureFrame(): void {
    const blob$ = this.cameraService.captureFrameAsBlob(this.videoRef.nativeElement);
    blob$.then(blob => { if (blob) this.frameCapture.emit(blob); });
  }

  get videoElement(): HTMLVideoElement {
    return this.videoRef?.nativeElement;
  }

  ngOnDestroy(): void {
    this.cameraService.stopCamera();
  }
}
