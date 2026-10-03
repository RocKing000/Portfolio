import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, Output, EventEmitter, signal, inject, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CameraService } from '../../core/services/camera.service';
import { FrameSamplerService, FrameStatus } from '../../core/services/frame-sampler.service';
import { KycApiService } from '../../core/services/kyc-api.service';
import { ScanResult } from '../../core/models/scan-result.model';
import { DocumentOverlayComponent } from '../../shared/components/document-overlay/document-overlay.component';
import { StatusIndicatorComponent } from '../../shared/components/status-indicator/status-indicator.component';
import { ResultCardComponent } from '../../shared/components/result-card/result-card.component';

@Component({
  selector: 'app-document-scanner',
  standalone: true,
  imports: [
    CommonModule, AsyncPipe,
    DocumentOverlayComponent, StatusIndicatorComponent, ResultCardComponent
  ],
  templateUrl: './document-scanner.component.html',
  styleUrls: ['./document-scanner.component.scss']
})
export class DocumentScannerComponent implements AfterViewInit, OnDestroy {
  @Output() scanComplete = new EventEmitter<ScanResult>();
  @Output() scanFailed   = new EventEmitter<string>();

  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  readonly documentDetected  = signal(false);
  readonly detectionConfidence = signal(0);
  readonly handDetected      = signal(false);
  readonly scanResult        = signal<ScanResult | null>(null);
  readonly processing        = signal(false);
  readonly cameraReady       = signal(false);
  readonly showResult        = signal(false);

  private readonly destroy$ = new Subject<void>();
  private readonly camera  = inject(CameraService);
  private readonly sampler = inject(FrameSamplerService);
  private readonly api     = inject(KycApiService);
  private readonly cdr     = inject(ChangeDetectorRef);

  readonly currentStatus$ = this.sampler.currentStatus$;

  ngAfterViewInit(): void {
    this.startCamera();
    this.sampler.currentStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => {
        this.documentDetected.set(s.stage === 'complete');
        this.detectionConfidence.set(s.progress / 100);
        this.handDetected.set(s.handDetected);
      });
  }

  private async startCamera(): Promise<void> {
    try {
      await this.camera.startCamera(this.videoRef.nativeElement, 'environment');
      this.cameraReady.set(true);
      this.startAutoScan();
    } catch {
      this.scanFailed.emit('Camera access denied.');
    }
  }

  private startAutoScan(): void {
    this.sampler.startSampling(this.videoRef.nativeElement, (result) => {
      this.onAutoDetected(result);
    });
  }

  onAutoDetected(result: ScanResult): void {
    this.scanResult.set(result);
    this.showResult.set(true);
  }

  async onManualCapture(): Promise<void> {
    this.sampler.stopSampling();
    this.processing.set(true);
    const blob = await this.camera.captureFrameAsBlob(this.videoRef.nativeElement);
    if (!blob) { this.processing.set(false); return; }

    this.api.scanDocument(blob)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.processing.set(false);
          this.scanResult.set(result);
          this.showResult.set(true);
        },
        error: (err) => {
          this.processing.set(false);
          this.scanFailed.emit(err.message);
        }
      });
  }

  onRetry(): void {
    this.showResult.set(false);
    this.scanResult.set(null);
    this.documentDetected.set(false);
    this.sampler.resetStatus();
    // videoRef is destroyed while showResult() was true — wait for Angular
    // to re-render the @if block before accessing the element
    this.cdr.detectChanges();
    this.startCamera();
  }

  onAcceptResult(): void {
    const result = this.scanResult();
    if (result) this.scanComplete.emit(result);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.sampler.stopSampling();
    this.camera.stopCamera();
  }
}
