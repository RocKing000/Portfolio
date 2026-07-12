import {
  Component, OnInit, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, Input, Output, EventEmitter,
  signal, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, interval } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { CameraService } from '../../core/services/camera.service';
import { KycApiService } from '../../core/services/kyc-api.service';
import { FaceResult } from '../../core/models/face-result.model';
import { LivenessResult } from '../../core/models/liveness-result.model';
import { MatchResult } from '../../core/models/kyc-session.model';
import { FaceOverlayComponent } from '../../shared/components/face-overlay/face-overlay.component';
import { environment } from '../../../environments/environment';

export type FaceStep = 'position' | 'liveness' | 'match' | 'done';

export interface FaceCaptureResult {
  faceResult: FaceResult;
  livenessResult: LivenessResult | null;
  matchResult: MatchResult | null;
}

@Component({
  selector: 'app-face-capture',
  standalone: true,
  imports: [CommonModule, FaceOverlayComponent],
  templateUrl: './face-capture.component.html',
  styleUrls: ['./face-capture.component.scss']
})
export class FaceCaptureComponent implements AfterViewInit, OnDestroy {
  @Input() documentFaceImage: string | null = null;
  @Output() captureComplete = new EventEmitter<FaceCaptureResult>();
  @Output() captureFailed   = new EventEmitter<string>();

  @ViewChild('videoRef') videoRef!: ElementRef<HTMLVideoElement>;

  readonly faceStep        = signal<FaceStep>('position');
  readonly faceDetected    = signal(false);
  readonly faceBoundingBox = signal<number[] | null>(null);
  readonly landmarks       = signal<Record<string, number[]> | null>(null);
  readonly processing      = signal(false);

  readonly livenessChallenge = signal('blink');
  readonly livenessProgress  = signal(0);
  readonly livenessComplete  = signal(false);

  readonly matchScore   = signal(0);
  readonly matchPassed  = signal(false);
  readonly selfieB64    = signal<string | null>(null);
  readonly faceResult   = signal<FaceResult | null>(null);

  private readonly destroy$      = new Subject<void>();
  private livenessFrames: string[] = [];
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private faceHoldCount = 0;
  private autoDetectId: ReturnType<typeof setInterval> | null = null;

  private readonly camera = inject(CameraService);
  private readonly api    = inject(KycApiService);

  ngAfterViewInit(): void {
    this.startCamera();
  }

  private async startCamera(): Promise<void> {
    try {
      await this.camera.startCamera(this.videoRef.nativeElement, 'user');
      this.startAutoDetect();
    } catch {
      this.captureFailed.emit('Camera access denied.');
    }
  }

  private startAutoDetect(): void {
    this.autoDetectId = setInterval(async () => {
      if (this.processing() || this.faceStep() !== 'position') return;

      const blob = await this.camera.captureFrameAsBlob(this.videoRef.nativeElement);
      if (!blob) return;

      this.api.captureFacePolling(blob)
        .pipe(takeUntil(this.destroy$))
        .subscribe(result => {
          if (result.face_detected) {
            this.faceDetected.set(true);
            this.faceBoundingBox.set(result.bounding_box);
            this.landmarks.set(result.landmarks);

            if (result.confidence >= environment.faceConfidenceThreshold) {
              this.faceHoldCount++;
              if (this.faceHoldCount >= 5) {  // ~1 second at 200ms
                this.onFaceConfirmed(result);
              }
            } else {
              this.faceHoldCount = 0;
            }
          } else {
            this.faceDetected.set(false);
            this.faceBoundingBox.set(null);
            this.faceHoldCount = 0;
          }
        });
    }, 200);
  }

  private onFaceConfirmed(result: FaceResult): void {
    if (this.faceStep() !== 'position') return;
    this.stopAutoDetect();
    this.faceResult.set(result);

    if (result.face_image_base64) {
      this.selfieB64.set(result.face_image_base64);
    }

    if (result.liveness_required) {
      this.livenessChallenge.set(result.challenge ?? 'blink');
      this.faceStep.set('liveness');
      this.startLivenessCollection();
    } else {
      this.faceStep.set('match');
      this.runMatch(result);
    }
  }

  // ── Liveness ──────────────────────────────────────────────────────────────

  private startLivenessCollection(): void {
    this.livenessFrames = [];
    this.livenessProgress.set(0);

    const target = environment.livenessFrameCount;
    const collectId = setInterval(async () => {
      if (this.livenessFrames.length >= target) {
        clearInterval(collectId);
        this.submitLiveness();
        return;
      }
      const b64 = this.camera.captureFrameAsBase64(this.videoRef.nativeElement);
      if (b64) {
        this.livenessFrames.push(b64);
        this.livenessProgress.set(Math.round((this.livenessFrames.length / target) * 100));
      }
    }, 300);
  }

  private submitLiveness(): void {
    this.processing.set(true);
    this.api.verifyLiveness(this.livenessFrames, this.livenessChallenge())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.processing.set(false);
          this.livenessComplete.set(result.is_live && result.challenge_passed);
          if (result.is_live) {
            this.faceStep.set('match');
            this.runMatch(this.faceResult()!);
          } else {
            this.captureFailed.emit('Liveness check failed: ' + result.message);
          }
        },
        error: (err) => {
          this.processing.set(false);
          // Liveness check not available — proceed without it
          this.faceStep.set('match');
          this.runMatch(this.faceResult()!);
        }
      });
  }

  // ── Face match ────────────────────────────────────────────────────────────

  private runMatch(faceResult: FaceResult): void {
    if (!this.documentFaceImage || !faceResult.face_image_base64) {
      // Skip match if no document face available
      this.faceStep.set('done');
      this.emit(faceResult, null, null);
      return;
    }

    this.processing.set(true);
    this.api.matchFaces(this.documentFaceImage, faceResult.face_image_base64)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (match) => {
          this.processing.set(false);
          this.matchScore.set(match.similarity_score);
          this.matchPassed.set(match.is_match);
          this.faceStep.set('done');
          this.emit(faceResult, null, match);
        },
        error: () => {
          this.processing.set(false);
          this.faceStep.set('done');
          this.emit(faceResult, null, null);
        }
      });
  }

  private emit(face: FaceResult, liveness: LivenessResult | null, match: MatchResult | null): void {
    this.captureComplete.emit({ faceResult: face, livenessResult: liveness, matchResult: match });
  }

  onManualCapture(): void {
    this.stopAutoDetect();
    this.camera.captureFrameAsBlob(this.videoRef.nativeElement).then(blob => {
      if (!blob) return;
      this.processing.set(true);
      this.api.captureFace(blob)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: result => {
            this.processing.set(false);
            this.faceResult.set(result);
            this.onFaceConfirmed(result);
          },
          error: err => {
            this.processing.set(false);
            this.captureFailed.emit(err.message);
          }
        });
    });
  }

  retryPosition(): void {
    this.faceStep.set('position');
    this.faceDetected.set(false);
    this.faceHoldCount = 0;
    this.livenessFrames = [];
    this.startAutoDetect();
  }

  private stopAutoDetect(): void {
    if (this.autoDetectId !== null) {
      clearInterval(this.autoDetectId);
      this.autoDetectId = null;
    }
  }

  challengeLabel(challenge: string): string {
    const labels: Record<string, string> = {
      blink: 'Please BLINK your eyes',
      smile: 'Please SMILE',
      nod:   'Please NOD your head',
      turn:  'Please TURN your head slightly'
    };
    return labels[challenge] ?? challenge;
  }

  challengeIcon(challenge: string): string {
    const icons: Record<string, string> = {
      blink: '&#128064;',
      smile: '&#128512;',
      nod:   '&#128580;',
      turn:  '&#8635;'
    };
    return icons[challenge] ?? '&#128100;';
  }

  ngOnDestroy(): void {
    this.stopAutoDetect();
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.destroy$.next();
    this.destroy$.complete();
    this.camera.stopCamera();
  }
}
