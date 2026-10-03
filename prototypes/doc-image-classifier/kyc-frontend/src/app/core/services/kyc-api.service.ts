import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ScanResult } from '../models/scan-result.model';
import { FaceResult } from '../models/face-result.model';
import { LivenessResult } from '../models/liveness-result.model';
import { MatchResult } from '../models/kyc-session.model';
import { SILENT_ERROR } from '../interceptors/api-error.interceptor';

const TIMEOUT_MS = 30_000;

/** HttpContext that suppresses the global error toast — used for polling requests. */
const SILENT_CTX = new HttpContext().set(SILENT_ERROR, true);

@Injectable({ providedIn: 'root' })
export class KycApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  // ── Document scanning ──────────────────────────────────────────────────────

  /**
   * Single manual scan — shows toast on error.
   */
  scanDocument(imageBlob: Blob): Observable<ScanResult> {
    const form = new FormData();
    form.append('file', imageBlob, 'capture.jpg');
    return this.http
      .post<ScanResult>(`${this.baseUrl}/api/kyc/scan-document`, form)
      .pipe(timeout(TIMEOUT_MS));
  }

  /**
   * Polling scan used by FrameSamplerService — silently swallows errors so
   * the auto-scan loop does not spam toast notifications.
   */
  scanDocumentPolling(imageBlob: Blob): Observable<ScanResult> {
    const form = new FormData();
    form.append('file', imageBlob, 'capture.jpg');
    return this.http
      .post<ScanResult>(`${this.baseUrl}/api/kyc/scan-document`, form, { context: SILENT_CTX })
      .pipe(timeout(TIMEOUT_MS));
  }

  scanDocumentJson(base64Image: string): Observable<ScanResult> {
    return this.http
      .post<ScanResult>(`${this.baseUrl}/api/kyc/scan-document-json`, { image: base64Image })
      .pipe(timeout(TIMEOUT_MS));
  }

  /**
   * Scan using base64 JSON body — preferred for Angular canvas.toDataURL() output.
   * Accepts raw base64 or data-URI format; backend strips prefix automatically.
   */
  scanDocumentB64(base64Image: string): Observable<ScanResult> {
    return this.http
      .post<ScanResult>(`${this.baseUrl}/api/kyc/scan-document-b64`, { image_base64: base64Image })
      .pipe(timeout(TIMEOUT_MS));
  }

  /** Polling variant of scanDocumentB64 — silently swallows errors. */
  scanDocumentB64Polling(base64Image: string): Observable<ScanResult> {
    return this.http
      .post<ScanResult>(`${this.baseUrl}/api/kyc/scan-document-b64`, { image_base64: base64Image }, { context: SILENT_CTX })
      .pipe(timeout(TIMEOUT_MS));
  }

  // ── Face capture ───────────────────────────────────────────────────────────

  /** Polling face-detect used by FaceCaptureComponent — no toast on transient errors. */
  captureFacePolling(imageBlob: Blob): Observable<FaceResult> {
    const form = new FormData();
    form.append('file', imageBlob, 'face.jpg');
    return this.http
      .post<FaceResult>(`${this.baseUrl}/api/kyc/capture-face`, form, { context: SILENT_CTX })
      .pipe(timeout(TIMEOUT_MS));
  }

  captureFace(imageBlob: Blob): Observable<FaceResult> {
    const form = new FormData();
    form.append('file', imageBlob, 'face.jpg');
    return this.http
      .post<FaceResult>(`${this.baseUrl}/api/kyc/capture-face`, form)
      .pipe(timeout(TIMEOUT_MS));
  }

  // ── Liveness verification ─────────────────────────────────────────────────

  verifyLiveness(frames: string[], challenge: string): Observable<LivenessResult> {
    return this.http
      .post<LivenessResult>(`${this.baseUrl}/api/kyc/verify-liveness`, { frames, challenge })
      .pipe(timeout(TIMEOUT_MS));
  }

  // ── Face matching ─────────────────────────────────────────────────────────

  matchFaces(documentImage: string, selfie: string): Observable<MatchResult> {
    return this.http
      .post<MatchResult>(`${this.baseUrl}/api/kyc/match-face`, {
        document_image: documentImage,
        selfie_image: selfie
      })
      .pipe(timeout(TIMEOUT_MS));
  }

  // ── Health check ──────────────────────────────────────────────────────────

  getHealth(): Observable<unknown> {
    return this.http
      .get(`${this.baseUrl}/framework/health`, { context: SILENT_CTX })
      .pipe(timeout(5000));
  }
}
