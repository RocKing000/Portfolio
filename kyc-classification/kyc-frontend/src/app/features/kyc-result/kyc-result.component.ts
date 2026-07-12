import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { KycSession, getKycStatus, KycStatus } from '../../core/models/kyc-session.model';
import { MaskNumberPipe } from '../../shared/pipes/mask-number.pipe';

@Component({
  selector: 'app-kyc-result',
  standalone: true,
  imports: [CommonModule, MaskNumberPipe],
  templateUrl: './kyc-result.component.html',
  styleUrls: ['./kyc-result.component.scss']
})
export class KycResultComponent {
  @Input() session!: KycSession;

  private readonly router = inject(Router);

  get status(): KycStatus {
    return getKycStatus(this.session);
  }

  get statusLabel(): string {
    const map: Record<KycStatus, string> = {
      APPROVED:     'KYC Approved',
      REJECTED:     'KYC Rejected',
      NEEDS_REVIEW: 'Needs Review',
      IN_PROGRESS:  'In Progress'
    };
    return map[this.status];
  }

  get statusClass(): string {
    const map: Record<KycStatus, string> = {
      APPROVED:     'status--approved',
      REJECTED:     'status--rejected',
      NEEDS_REVIEW: 'status--review',
      IN_PROGRESS:  'status--progress'
    };
    return map[this.status];
  }

  get statusIcon(): string {
    const map: Record<KycStatus, string> = {
      APPROVED:     '&#10003;',
      REJECTED:     '&#10007;',
      NEEDS_REVIEW: '&#33;',
      IN_PROGRESS:  '&#8987;'
    };
    return map[this.status];
  }

  onStartOver(): void {
    this.router.navigate(['/kyc']);
  }

  downloadReport(): void {
    const report = {
      sessionId:    this.session.sessionId,
      status:       this.status,
      startedAt:    this.session.startedAt,
      completedAt:  new Date(),
      documentType: this.session.documentResult?.document_type,
      documentVerified: this.session.documentResult?.success,
      faceDetected: this.session.faceResult?.face_detected,
      livenessPass: this.session.livenessResult?.is_live,
      faceMatch:    this.session.matchResult?.is_match,
      matchScore:   this.session.matchResult?.similarity_score
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `kyc-report-${this.session.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
