import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CameraService } from './camera.service';
import { KycApiService } from './kyc-api.service';
import { ScanResult } from '../models/scan-result.model';

export interface FrameStatus {
  stage: 'idle' | 'checking_blur' | 'detecting_document' | 'classifying' | 'extracting' | 'complete' | 'failed';
  message: string;
  progress: number; // 0–100
  handDetected: boolean;
}

const IDLE_STATUS: FrameStatus = {
  stage: 'idle',
  message: 'Position your document in the frame',
  progress: 0,
  handDetected: false,
};

@Injectable({ providedIn: 'root' })
export class FrameSamplerService implements OnDestroy {
  readonly isProcessing$ = new BehaviorSubject<boolean>(false);
  readonly currentStatus$ = new BehaviorSubject<FrameStatus>(IDLE_STATUS);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private pendingRequest = false;
  private attemptCount = 0;
  private sub: Subscription | null = null;

  private readonly camera = inject(CameraService);
  private readonly api = inject(KycApiService);

  // ── Public API ────────────────────────────────────────────────────────────

  startSampling(
    videoElement: HTMLVideoElement,
    onResult: (result: ScanResult) => void
  ): void {
    this.stopSampling();
    this.attemptCount = 0;
    this.isProcessing$.next(true);
    this.currentStatus$.next(IDLE_STATUS);

    this.intervalId = setInterval(async () => {
      if (this.pendingRequest) return;
      if (this.attemptCount >= environment.maxScanAttempts) {
        this.stopSampling();
        this.currentStatus$.next({
          stage: 'failed',
          message: 'Could not detect document. Please try again.',
          progress: 0,
          handDetected: false
        });
        return;
      }

      this.attemptCount++;
      const b64 = this.camera.captureFrameAsBase64(videoElement);
      if (!b64) return;

      this.pendingRequest = true;
      this.currentStatus$.next({
        stage: 'checking_blur',
        message: 'Checking image quality…',
        progress: 10,
        handDetected: false
      });

      this.sub = this.api.scanDocumentB64Polling(b64).subscribe({
        next: (result) => {
          this.pendingRequest = false;
          this._handleResult(result, onResult);
        },
        error: () => {
          this.pendingRequest = false;
          // silently retry on transient errors
        }
      });
    }, environment.frameInterval);
  }

  stopSampling(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.sub?.unsubscribe();
    this.sub = null;
    this.pendingRequest = false;
    this.isProcessing$.next(false);
  }

  resetStatus(): void {
    this.currentStatus$.next(IDLE_STATUS);
    this.attemptCount = 0;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _handleResult(result: ScanResult, onResult: (r: ScanResult) => void): void {
    const step = result.failed_at_step;
    const msg  = result.message || '';

    if (step === 'blur_check') {
      this.currentStatus$.next({
        stage: 'checking_blur',
        message: 'Hold steady — image too blurry',
        progress: 15,
        handDetected: false,
      });
      return;
    }

    if (step === 'document_detection') {
      const handDetected = result.hand_detected === true;
      this.currentStatus$.next({
        stage: 'detecting_document',
        message: this._detectionGuidance(msg, handDetected),
        progress: 25,
        handDetected,
      });
      return;
    }

    if (step === 'classification') {
      this.currentStatus$.next({
        stage: 'classifying',
        message: 'Hold card in landscape (horizontal) orientation',
        progress: 50,
        handDetected: false,
      });
      return;
    }

    if (step === 'ocr_extraction') {
      this.currentStatus$.next({
        stage: 'extracting',
        message: 'Reading document text…',
        progress: 70,
        handDetected: false,
      });
      return;
    }

    if (result.success) {
      this.stopSampling();
      this.currentStatus$.next({
        stage: 'complete',
        message: 'Document scanned successfully!',
        progress: 100,
        handDetected: false,
      });
      onResult(result);
      return;
    }

    // Any other failure — keep trying
    this.currentStatus$.next({
      stage: 'detecting_document',
      message: step ? `Step failed: ${step}` : 'Retrying…',
      progress: 20,
      handDetected: false,
    });
  }

  private _detectionGuidance(serverMessage: string, handDetected: boolean): string {
    if (handDetected || serverMessage.includes('Hand detected')) {
      return 'Remove your hand — lay card flat on surface';
    }
    if (serverMessage.includes('No contours')) {
      return 'Move card to a contrasting background';
    }
    if (serverMessage.includes('No valid') || serverMessage.includes('quadrilateral')) {
      return 'Ensure full card is visible in frame';
    }
    return 'Position document fully within the guide rectangle';
  }

  ngOnDestroy(): void {
    this.stopSampling();
  }
}
