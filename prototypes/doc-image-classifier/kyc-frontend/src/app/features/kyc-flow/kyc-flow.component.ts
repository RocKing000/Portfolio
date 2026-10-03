import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScanResult } from '../../core/models/scan-result.model';
import { KycSession, KycStep, createSession } from '../../core/models/kyc-session.model';
import { FaceCaptureResult } from '../face-capture/face-capture.component';
import { DocumentScannerComponent } from '../document-scanner/document-scanner.component';
import { FaceCaptureComponent } from '../face-capture/face-capture.component';
import { KycResultComponent } from '../kyc-result/kyc-result.component';
import { ProgressStepperComponent } from '../../shared/components/progress-stepper/progress-stepper.component';
import { ToastService } from '../../core/services/toast.service';
import { inject } from '@angular/core';

@Component({
  selector: 'app-kyc-flow',
  standalone: true,
  imports: [
    CommonModule,
    DocumentScannerComponent,
    FaceCaptureComponent,
    KycResultComponent,
    ProgressStepperComponent
  ],
  templateUrl: './kyc-flow.component.html',
  styleUrls: ['./kyc-flow.component.scss']
})
export class KycFlowComponent implements OnInit {
  readonly currentStep = signal<KycStep>('document');
  session!: KycSession;

  private readonly toast = inject(ToastService);

  ngOnInit(): void {
    this.session = createSession();
  }

  // ── Document step ─────────────────────────────────────────────────────────

  onDocumentScanned(result: ScanResult): void {
    this.session = { ...this.session, documentResult: result };
    this.advanceTo('face');
  }

  onDocumentFailed(error: string): void {
    this.toast.show(error, 'error');
  }

  // ── Face step ─────────────────────────────────────────────────────────────

  onFaceCaptured(result: FaceCaptureResult): void {
    this.session = {
      ...this.session,
      faceResult:     result.faceResult,
      livenessResult: result.livenessResult,
      matchResult:    result.matchResult
    };
    this.advanceTo('result');
  }

  onFaceFailed(error: string): void {
    this.toast.show(error, 'warning');
    // Still advance to result with whatever we have
    this.advanceTo('result');
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  private advanceTo(step: KycStep): void {
    this.session = { ...this.session, currentStep: step };
    this.currentStep.set(step);
    if (step === 'result') {
      this.session = { ...this.session, completedAt: new Date() };
    }
  }

  get documentFaceImage(): string | null {
    // Wire this to a face_image_base64 field if your backend returns a
    // face crop from the document scan result.
    return null;
  }
}
