import { ScanResult } from './scan-result.model';
import { FaceResult } from './face-result.model';
import { LivenessResult } from './liveness-result.model';

export interface MatchResult {
  success: boolean;
  is_match: boolean;
  similarity_score: number;
  threshold: number;
  message: string;
}

export type KycStep = 'document' | 'face' | 'result';

export type KycStatus = 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW' | 'IN_PROGRESS';

export interface KycSession {
  sessionId: string;
  currentStep: KycStep;
  documentResult: ScanResult | null;
  faceResult: FaceResult | null;
  livenessResult: LivenessResult | null;
  matchResult: MatchResult | null;
  startedAt: Date;
  completedAt: Date | null;
}

export function createSession(): KycSession {
  return {
    sessionId: generateSessionId(),
    currentStep: 'document',
    documentResult: null,
    faceResult: null,
    livenessResult: null,
    matchResult: null,
    startedAt: new Date(),
    completedAt: null
  };
}

export function getKycStatus(session: KycSession): KycStatus {
  if (session.currentStep !== 'result') return 'IN_PROGRESS';

  const docOk = session.documentResult?.success ?? false;
  const faceOk = session.faceResult?.success ?? false;
  const liveOk = session.livenessResult?.is_live ?? false;
  const matchOk = session.matchResult?.is_match ?? false;

  if (docOk && faceOk && liveOk && matchOk) return 'APPROVED';
  if (!docOk) return 'REJECTED';
  if (!liveOk) return 'REJECTED';
  if (!matchOk) return 'NEEDS_REVIEW';
  return 'NEEDS_REVIEW';
}

function generateSessionId(): string {
  return `kyc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
